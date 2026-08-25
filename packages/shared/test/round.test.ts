import { describe, expect, it } from "vitest";
import type { ClientMessage, Settings } from "../src/protocol";
import { MIN_PLAYERS } from "../src/protocol";
import type { EventDeps, InternalRoom } from "../src/state";
import { applyEvent, createRoom } from "../src/state";
import type { RoundState } from "../src/round";
import {
  INTRO_MS,
  MAX_STAGED,
  PHASE_MS,
  REVEAL_MS,
  ROUND_END_MS,
  advance,
  authorOf,
  currentRound,
  eligibleGuessers,
  resolveIfEveryoneReady,
  stagedAnswerId,
} from "../src/round";
import { promptsForPacks } from "../content/prompts";

/* -------------------------------------------------------------- test harness */

interface TestDeps extends EventDeps {
  /** Jump the clock to an absolute epoch ms. */
  setNow(t: number): void;
  /** Push the clock forward. */
  tick(ms: number): void;
}

const T0 = 1_700_000_000_000;

/**
 * Fully deterministic deps.
 *
 * Ids are zero-padded on purpose: the anonymity assertions check that no
 * `answerId` *contains* a `playerId`, and unpadded counters would make
 * `id-11` contain `id-1` and turn a real proof into a false failure.
 *
 * `random` is a 32-bit LCG rather than a constant, because a constant would
 * make "the stage order is not the join order" pass for a degenerate reason.
 */
function makeDeps(seed = 1): TestDeps {
  let ids = 0;
  let tokens = 0;
  let clock = T0;
  let state = (seed >>> 0) || 1;
  return {
    newId: () => `id-${String(++ids).padStart(4, "0")}`,
    newToken: () => `tok-${String(++tokens).padStart(4, "0")}`,
    now: () => clock,
    random: () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
    setNow: (t) => { clock = t; },
    tick: (ms) => { clock += ms; },
  };
}

async function apply(
  room: InternalRoom,
  senderId: string,
  msg: ClientMessage,
  deps: EventDeps,
): Promise<InternalRoom> {
  const r = await applyEvent(room, senderId, msg, deps);
  if (!r.ok) throw new Error(`unexpected rejection: ${r.code} (${msg.t})`);
  return r.room;
}

async function seat(n: number, deps: TestDeps, patch?: Partial<Settings>): Promise<InternalRoom> {
  let room = createRoom("TEST");
  for (let i = 1; i <= n; i++) {
    room = await apply(room, "", { v: 1, t: "join", name: `P${i}`, emoji: "🦊" }, deps);
  }
  if (patch) {
    room = await apply(room, room.hostId, { v: 1, t: "updateSettings", patch }, deps);
  }
  return room;
}

function ids(room: InternalRoom): string[] {
  return room.players.map((p) => p.id);
}

function round(room: InternalRoom): RoundState {
  const r = currentRound(room);
  if (r === undefined) throw new Error("no live round");
  return r;
}

/**
 * The invariant `enterPhase` exists to guarantee: a phase entered without a
 * deadline is a room the Durable Object never wakes up again, because its
 * alarm is armed solely off `room.deadline`.
 */
function expectLiveDeadline(room: InternalRoom, where: string): void {
  if (room.phase === "LOBBY" || room.phase === "FINALE") {
    expect(room.deadline, `${where}: ${room.phase} must be untimed`).toBeNull();
  } else {
    expect(room.deadline, `${where}: ${room.phase} must carry a deadline`).not.toBeNull();
  }
}

/** Expire the current phase and take exactly one transition, as the DO does. */
function expire(room: InternalRoom, deps: TestDeps): InternalRoom {
  expect(room.deadline).not.toBeNull();
  deps.setNow(room.deadline! + 1);
  const result = advance(room, deps);
  expect(result.changed, `advance should have moved on from ${room.phase}`).toBe(true);
  expectLiveDeadline(result.room, `after expiring ${room.phase}`);
  return result.room;
}

/** The Durable Object's catch-up loop, minus the storage. */
function catchUp(room: InternalRoom, deps: TestDeps): InternalRoom {
  let r = room;
  for (let i = 0; i < 16; i++) {
    const next = advance(r, deps);
    if (!next.changed) break;
    r = next.room;
    expectLiveDeadline(r, "during catch-up");
  }
  return r;
}

async function startGame(room: InternalRoom, deps: TestDeps): Promise<InternalRoom> {
  return apply(room, room.hostId, { v: 1, t: "startGame" }, deps);
}

/** Every present player submits `text(playerId)`. */
async function everybodyWrites(
  room: InternalRoom,
  deps: TestDeps,
  text: (id: string, i: number) => string = (id) => `answer from ${id}`,
): Promise<InternalRoom> {
  let r = room;
  const roster = ids(r);
  for (let i = 0; i < roster.length; i++) {
    r = await apply(r, roster[i]!, { v: 1, t: "submitEntry", text: text(roster[i]!, i) }, deps);
  }
  return r;
}

/** Everyone who owes a guess on the staged answer names `choose(guesserId)`. */
async function everybodyGuesses(
  room: InternalRoom,
  deps: TestDeps,
  choose: (guesserId: string, author: string) => string,
): Promise<InternalRoom> {
  let r = room;
  const live = round(r);
  const answerId = stagedAnswerId(live)!;
  const author = authorOf(live, answerId)!;
  for (const guesserId of eligibleGuessers(r, live, answerId)) {
    if (r.phase !== "GUESSING") break;
    r = await apply(
      r, guesserId, { v: 1, t: "submitGuess", answerId, playerId: choose(guesserId, author) }, deps);
  }
  return r;
}

/* ------------------------------------------------------------------ the game */

describe("enterPhase and PHASE_MS", () => {
  it("gives every timed phase a duration and leaves LOBBY/FINALE untimed", async () => {
    const deps = makeDeps();
    const room = await seat(3, deps);
    expect(PHASE_MS.LOBBY(room)).toBeNull();
    expect(PHASE_MS.FINALE(room)).toBeNull();
    expect(PHASE_MS.INTRO(room)).toBe(INTRO_MS);
    expect(PHASE_MS.WRITING(room)).toBe(room.settings.writeSec * 1000);
    expect(PHASE_MS.GUESSING(room)).toBe(room.settings.guessSec * 1000);
    expect(PHASE_MS.REVEAL(room)).toBe(REVEAL_MS);
    expect(PHASE_MS.ROUND_END(room)).toBe(ROUND_END_MS);
  });

  it("startGame enters INTRO with a deadline and zeroed scores", async () => {
    const deps = makeDeps();
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    expect(room.phase).toBe("INTRO");
    expect(room.deadline).toBe(T0 + INTRO_MS);
    expect(room.rounds).toEqual([]);
    for (const id of ids(room)) {
      expect(room.scores[id]).toBe(0);
      expect(room.stagedCount[id]).toBe(0);
    }
  });

  it("startGame is host-only and needs MIN_PLAYERS", async () => {
    const deps = makeDeps();
    const room = await seat(MIN_PLAYERS - 1, deps);
    expect(await applyEvent(room, room.hostId, { v: 1, t: "startGame" }, deps))
      .toMatchObject({ ok: false, code: "BAD_MESSAGE" });
    const bigger = await seat(4, makeDeps());
    expect(await applyEvent(bigger, ids(bigger)[1]!, { v: 1, t: "startGame" }, deps))
      .toMatchObject({ ok: false, code: "NOT_HOST" });
  });
});

describe("happy path", () => {
  it("plays a whole game from LOBBY to FINALE", async () => {
    const deps = makeDeps(7);
    let room = await seat(5, deps, { rounds: 2 });
    const roster = ids(room);
    room = await startGame(room, deps);

    const seen: string[] = ["INTRO"];
    room = expire(room, deps);            // INTRO -> WRITING (round 1)
    expect(room.phase).toBe("WRITING");
    expect(round(room).index).toBe(1);

    for (let r = 1; r <= 2; r++) {
      seen.push("WRITING");
      expect(room.phase).toBe("WRITING");
      if (r === 1) {
        // Round 1 resolves early: the last submission ends WRITING itself.
        room = await everybodyWrites(room, deps);
      } else {
        // Round 2 times out with one player still typing, so the DO's
        // catch-up loop is what moves the room on.
        for (const id of roster.slice(0, roster.length - 1)) {
          room = await apply(room, id, { v: 1, t: "submitEntry", text: `late ${id}` }, deps);
        }
        expect(room.phase).toBe("WRITING");
        deps.setNow(room.deadline! + 1);
        room = catchUp(room, deps);
      }
      expect(room.phase).toBe("GUESSING");
      const live = round(room);
      expect(live.order).toHaveLength(Math.min(MAX_STAGED, roster.length));

      for (let stage = 0; stage < live.order.length; stage++) {
        expect(room.phase).toBe("GUESSING");
        expect(round(room).stage).toBe(stage);
        seen.push("GUESSING");
        room = await everybodyGuesses(room, deps, (_g, author) => author);
        expect(room.phase).toBe("REVEAL");
        seen.push("REVEAL");
        room = expire(room, deps);
      }
      expect(room.phase).toBe("ROUND_END");
      seen.push("ROUND_END");
      room = expire(room, deps);
    }

    expect(room.phase).toBe("FINALE");
    expect(room.deadline).toBeNull();
    expect(room.rounds).toHaveLength(2);
    expect(seen.filter((p) => p === "GUESSING")).toHaveLength(2 * MAX_STAGED);
    // Every guess was correct, so every guesser banked 2 per staged answer and
    // no author was ever paid.
    for (const id of roster) expect(room.scores[id]).toBeGreaterThan(0);
  });

  it("never repeats a prompt while unused ones remain, and honours packs", async () => {
    const deps = makeDeps(3);
    let room = await seat(4, deps, { rounds: 6, packs: ["absurd"] });
    const allowed = new Set(promptsForPacks(["absurd"]).map((p) => p.id));
    room = await startGame(room, deps);
    room = expire(room, deps);
    for (let r = 0; r < 6; r++) {
      room = await everybodyWrites(room, deps);
      while (room.phase !== "ROUND_END" && room.phase !== "FINALE") {
        room = expire(room, deps);
      }
      if (room.phase === "ROUND_END") room = expire(room, deps);
    }
    const used = room.rounds.map((r) => r.promptId);
    expect(used).toHaveLength(6);
    for (const id of used) expect(allowed.has(id)).toBe(true);
    expect(new Set(used).size).toBe(6);
  });
});

describe("anonymity structure", () => {
  it("no answerId equals or contains a playerId, and vice versa", async () => {
    const deps = makeDeps(11);
    let room = await seat(6, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const live = round(room);
    const answerIds = Object.values(live.entries).map((e) => e.answerId);
    expect(answerIds).toHaveLength(6);
    for (const answerId of answerIds) {
      for (const playerId of ids(room)) {
        expect(answerId).not.toBe(playerId);
        expect(answerId.includes(playerId)).toBe(false);
        expect(playerId.includes(answerId)).toBe(false);
      }
    }
    // And the staged list is exactly those opaque ids — nothing else.
    for (const staged of live.order) expect(answerIds).toContain(staged);
  });

  it("the staged order is not the join order", async () => {
    const seen = new Set<string>();
    let matchedJoinOrder = 0;
    const SEEDS = 30;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const deps = makeDeps(seed * 7919);
      let room = await seat(4, deps);
      room = await startGame(room, deps);
      room = expire(room, deps);
      room = await everybodyWrites(room, deps);
      const live = round(room);
      const stagedAuthors = live.order.map((a) => authorOf(live, a)!);
      expect(stagedAuthors).toHaveLength(4);
      seen.add(stagedAuthors.join(","));
      if (stagedAuthors.join(",") === ids(room).join(",")) matchedJoinOrder++;
    }
    // A shuffle can land on the identity permutation by chance; what must not
    // happen is that stage position *is* join position.
    expect(seen.size).toBeGreaterThan(1);
    expect(matchedJoinOrder).toBeLessThan(SEEDS / 2);
  });

  it("keeps identical answers from different players, never deduped", async () => {
    const deps = makeDeps(5);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps, () => "the same exact thing");
    const live = round(room);
    expect(Object.keys(live.entries)).toHaveLength(4);
    expect(live.order).toHaveLength(4);
    expect(new Set(live.order).size).toBe(4);
    for (const e of Object.values(live.entries)) expect(e.text).toBe("the same exact thing");
  });
});

describe("writing", () => {
  it("submitEntry is an upsert that keeps the same answerId", async () => {
    const deps = makeDeps();
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    const [a] = ids(room);
    room = await apply(room, a!, { v: 1, t: "submitEntry", text: "first" }, deps);
    const firstId = round(room).entries[a!]!.answerId;
    room = await apply(room, a!, { v: 1, t: "submitEntry", text: "second" }, deps);
    expect(round(room).entries[a!]).toEqual({ answerId: firstId, text: "second" });
    expect(room.phase).toBe("WRITING");
  });

  it("a reconnecting player can still read back their own entry", async () => {
    const deps = makeDeps();
    let room = await seat(3, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    const [a] = ids(room);
    room = await apply(room, a!, { v: 1, t: "submitEntry", text: "mine" }, deps);
    room = await apply(room, a!, { v: 1, t: "reconnect", playerId: a!, token: "tok-0001" }, deps);
    expect(round(room).entries[a!]!.text).toBe("mine");
  });

  it("resolves early once every present player has submitted", async () => {
    const deps = makeDeps(2);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    const roster = ids(room);
    for (let i = 0; i < 3; i++) {
      room = await apply(room, roster[i]!, { v: 1, t: "submitEntry", text: `e${i}` }, deps);
      expect(room.phase).toBe("WRITING");
    }
    room = await apply(room, roster[3]!, { v: 1, t: "submitEntry", text: "e3" }, deps);
    expect(room.phase).toBe("GUESSING");
    expect(room.deadline).toBe(deps.now() + room.settings.guessSec * 1000);
  });

  it("a player who writes nothing stores no entry but still guesses and stays a candidate", async () => {
    const deps = makeDeps(4);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    const roster = ids(room);
    const abstainer = roster[3]!;
    for (const id of roster.slice(0, 3)) {
      room = await apply(room, id, { v: 1, t: "submitEntry", text: `from ${id}` }, deps);
    }
    room = expire(room, deps); // WRITING times out
    expect(room.phase).toBe("GUESSING");
    const live = round(room);
    expect(Object.prototype.hasOwnProperty.call(live.entries, abstainer)).toBe(false);
    expect(live.order).toHaveLength(3);
    // Still guesses, and is still on everyone else's candidate list.
    const answerId = stagedAnswerId(live)!;
    expect(eligibleGuessers(room, live, answerId)).toContain(abstainer);
    const author = authorOf(live, answerId)!;
    room = await apply(
      room, abstainer, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    expect(round(room).guesses[answerId]![abstainer]).toBe(author);
  });

  it("submitEntry outside WRITING is WRONG_PHASE", async () => {
    const deps = makeDeps();
    let room = await seat(3, deps);
    room = await startGame(room, deps);
    expect(await applyEvent(room, ids(room)[0]!, { v: 1, t: "submitEntry", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
  });

  it("a stranger gets UNKNOWN_PLAYER", async () => {
    const deps = makeDeps();
    let room = await seat(3, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    expect(await applyEvent(room, "nobody", { v: 1, t: "submitEntry", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "UNKNOWN_PLAYER" });
  });
});

describe("staging", () => {
  it("stages min(4, entries) and spends one stagedCount each", async () => {
    const deps = makeDeps(9);
    let room = await seat(7, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const live = round(room);
    expect(live.order).toHaveLength(MAX_STAGED);
    const staged = live.order.map((a) => authorOf(live, a)!);
    expect(new Set(staged).size).toBe(MAX_STAGED);
    for (const id of ids(room)) {
      expect(room.stagedCount[id]).toBe(staged.includes(id) ? 1 : 0);
    }
  });

  it("tiered least-staged descends a tier and keeps everyone within one of each other", async () => {
    const deps = makeDeps(23);
    let room = await seat(6, deps, { rounds: 6 });
    room = await startGame(room, deps);
    room = expire(room, deps);
    const tierDescended: boolean[] = [];
    for (let r = 0; r < 6; r++) {
      const before = { ...room.stagedCount };
      room = await everybodyWrites(room, deps);
      const staged = new Set(round(room).order.map((a) => authorOf(round(room), a)!));
      // A descent happened iff the staged set spans more than one prior tier.
      const tiers = new Set([...staged].map((id) => before[id] ?? 0));
      tierDescended.push(tiers.size > 1);
      // Nobody is ever staged twice while somebody two tiers below waits.
      const min = Math.min(...Object.values(before));
      for (const id of staged) expect((before[id] ?? 0) - min).toBeLessThanOrEqual(1);

      while (room.phase !== "ROUND_END" && room.phase !== "FINALE") room = expire(room, deps);
      if (room.phase === "ROUND_END") room = expire(room, deps);
    }
    expect(tierDescended.some(Boolean)).toBe(true);

    const counts = ids(room).map((id) => room.stagedCount[id]!);
    // 6 rounds x 4 slots / 6 players = 4 each, and tiering makes it exact.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6 * MAX_STAGED);
  });

  it("fewer than two entries skips GUESSING and REVEAL entirely", async () => {
    const deps = makeDeps(6);
    let room = await seat(3, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await apply(room, ids(room)[0]!, { v: 1, t: "submitEntry", text: "alone" }, deps);
    room = expire(room, deps);
    expect(room.phase).toBe("ROUND_END");
    expect(round(room).order).toEqual([]);
    expect(round(room).awarded).toEqual({});
    for (const id of ids(room)) {
      expect(room.scores[id]).toBe(0);
      // A lone answer nobody guessed on does not cost its author a turn.
      expect(room.stagedCount[id]).toBe(0);
    }
  });

  it("zero entries also lands on ROUND_END", async () => {
    const deps = makeDeps(8);
    let room = await seat(3, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = expire(room, deps);
    expect(room.phase).toBe("ROUND_END");
    expect(round(room).order).toEqual([]);
  });
});

describe("guessing", () => {
  async function intoGuessing(deps: TestDeps, n = 4): Promise<InternalRoom> {
    let room = await seat(n, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    expect(room.phase).toBe("GUESSING");
    return room;
  }

  it("rejects the author with IS_AUTHOR", async () => {
    const deps = makeDeps(13);
    const room = await intoGuessing(deps);
    const live = round(room);
    const answerId = stagedAnswerId(live)!;
    const author = authorOf(live, answerId)!;
    const other = ids(room).find((id) => id !== author)!;
    expect(await applyEvent(room, author, { v: 1, t: "submitGuess", answerId, playerId: other }, deps))
      .toMatchObject({ ok: false, code: "IS_AUTHOR" });
  });

  it("rejects a second guess with ALREADY_GUESSED", async () => {
    const deps = makeDeps(14);
    let room = await intoGuessing(deps);
    const live = round(room);
    const answerId = stagedAnswerId(live)!;
    const author = authorOf(live, answerId)!;
    const guesser = ids(room).find((id) => id !== author)!;
    const someoneElse = ids(room).find((id) => id !== author && id !== guesser)!;
    room = await apply(
      room, guesser, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    expect(await applyEvent(
      room, guesser, { v: 1, t: "submitGuess", answerId, playerId: someoneElse }, deps))
      .toMatchObject({ ok: false, code: "ALREADY_GUESSED" });
    expect(round(room).guesses[answerId]![guesser]).toBe(author);
  });

  it("rejects a tap that lands after the stage advanced with STALE_ANSWER", async () => {
    const deps = makeDeps(15);
    let room = await intoGuessing(deps);
    const staleId = stagedAnswerId(round(room))!;
    const nextId = round(room).order[1]!;
    // The whole stage resolves and moves on...
    room = await everybodyGuesses(room, deps, (_g, author) => author);
    expect(room.phase).toBe("REVEAL");
    room = expire(room, deps);
    expect(room.phase).toBe("GUESSING");
    expect(stagedAnswerId(round(room))).toBe(nextId);
    // ...and the late tap on the previous answer is refused, not re-aimed.
    const author = authorOf(round(room), nextId)!;
    const guesser = ids(room).find((id) => id !== author)!;
    expect(await applyEvent(
      room, guesser, { v: 1, t: "submitGuess", answerId: staleId, playerId: author }, deps))
      .toMatchObject({ ok: false, code: "STALE_ANSWER" });
    expect(round(room).guesses[nextId]).toBeUndefined();
  });

  it("rejects an unknown answerId with STALE_ANSWER and a bad target with BAD_MESSAGE", async () => {
    const deps = makeDeps(16);
    const room = await intoGuessing(deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    const guesser = ids(room).find((id) => id !== author)!;
    expect(await applyEvent(
      room, guesser, { v: 1, t: "submitGuess", answerId: "made-up", playerId: author }, deps))
      .toMatchObject({ ok: false, code: "STALE_ANSWER" });
    expect(await applyEvent(
      room, guesser, { v: 1, t: "submitGuess", answerId, playerId: guesser }, deps))
      .toMatchObject({ ok: false, code: "BAD_MESSAGE" });
    expect(await applyEvent(
      room, guesser, { v: 1, t: "submitGuess", answerId, playerId: "ghost" }, deps))
      .toMatchObject({ ok: false, code: "BAD_MESSAGE" });
  });

  it("submitGuess outside GUESSING is WRONG_PHASE", async () => {
    const deps = makeDeps(17);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    expect(await applyEvent(
      room, ids(room)[0]!, { v: 1, t: "submitGuess", answerId: "x", playerId: ids(room)[1]! }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
  });

  it("resolves early once every eligible guesser has guessed", async () => {
    const deps = makeDeps(18);
    let room = await intoGuessing(deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    const guessers = eligibleGuessers(room, round(room), answerId);
    expect(guessers).toHaveLength(3);
    expect(guessers).not.toContain(author);
    for (let i = 0; i < guessers.length; i++) {
      expect(room.phase).toBe("GUESSING");
      room = await apply(
        room, guessers[i]!, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    }
    expect(room.phase).toBe("REVEAL");
  });
});

describe("scoring", () => {
  it("+2 per correct attribution, +1 to the author per wrong guess, zeros recorded", async () => {
    const deps = makeDeps(19);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    const [g1, g2, abstainer] = eligibleGuessers(room, round(room), answerId);

    room = await apply(room, g1!, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    room = await apply(room, g2!, { v: 1, t: "submitGuess", answerId, playerId: g1! }, deps);
    expect(room.phase).toBe("GUESSING"); // the abstainer never guesses
    room = expire(room, deps);
    expect(room.phase).toBe("REVEAL");

    expect(room.scores[g1!]).toBe(2);   // correct
    expect(room.scores[g2!]).toBe(0);   // wrong
    expect(room.scores[abstainer!]).toBe(0);
    expect(room.scores[author]).toBe(1); // fooled exactly one guesser

    const awarded = round(room).awarded[answerId]!;
    expect(awarded).toHaveLength(4);
    expect(awarded.map((a) => a.playerId).sort()).toEqual(ids(room).slice().sort());
    const points = Object.fromEntries(awarded.map((a) => [a.playerId, a.points]));
    expect(points).toEqual({ [author]: 1, [g1!]: 2, [g2!]: 0, [abstainer!]: 0 });
  });

  it("an author who fools everybody banks one point per guesser", async () => {
    const deps = makeDeps(20);
    let room = await seat(5, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    room = await everybodyGuesses(room, deps, (guesser, a) =>
      ids(room).find((id) => id !== guesser && id !== a)!);
    expect(room.phase).toBe("REVEAL");
    expect(room.scores[author]).toBe(4);
    for (const id of ids(room)) if (id !== author) expect(room.scores[id]).toBe(0);
  });

  it("the scoreboard moves at every REVEAL, not once at the end", async () => {
    const deps = makeDeps(21);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const totals: number[] = [];
    for (let stage = 0; stage < MAX_STAGED; stage++) {
      room = await everybodyGuesses(room, deps, (_g, author) => author);
      totals.push(Object.values(room.scores).reduce((a, b) => a + b, 0));
      room = expire(room, deps);
    }
    expect(totals).toEqual([6, 12, 18, 24]); // 3 correct guessers x 2 points, each stage
    expect(room.phase).toBe("ROUND_END");
  });
});

describe("leaving", () => {
  async function leave(room: InternalRoom, id: string, deps: TestDeps): Promise<InternalRoom> {
    return apply(room, id, { v: 1, t: "leave" }, deps);
  }

  it("mid-WRITING: their unwritten answer stops blocking the room", async () => {
    const deps = makeDeps(24);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    const roster = ids(room);
    for (const id of roster.slice(0, 3)) {
      room = await apply(room, id, { v: 1, t: "submitEntry", text: `from ${id}` }, deps);
    }
    expect(room.phase).toBe("WRITING");
    room = await leave(room, roster[3]!, deps);
    expect(room.phase).toBe("GUESSING");
    expect(room.players).toHaveLength(3);
    expect(round(room).order).toHaveLength(3);
    expectLiveDeadline(room, "after a leave resolved WRITING");
  });

  it("mid-WRITING: a writer's entry is voided and never staged", async () => {
    const deps = makeDeps(26);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    const roster = ids(room);
    for (const id of roster.slice(0, 3)) {
      room = await apply(room, id, { v: 1, t: "submitEntry", text: `from ${id}` }, deps);
    }
    room = await leave(room, roster[0]!, deps);
    expect(room.phase).toBe("WRITING"); // P4 still owes an answer
    expect(Object.prototype.hasOwnProperty.call(round(room).entries, roster[0]!)).toBe(false);
    room = expire(room, deps);
    expect(room.phase).toBe("GUESSING");
    expect(round(room).order).toHaveLength(2);
    for (const staged of round(room).order) {
      expect(authorOf(round(room), staged)).not.toBe(roster[0]!);
    }
  });

  it("mid-GUESSING as a guesser: their guess is withdrawn and the phase can resolve", async () => {
    const deps = makeDeps(27);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    const [g1, g2, g3] = eligibleGuessers(room, round(room), answerId);
    room = await apply(room, g1!, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    room = await apply(room, g2!, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    expect(room.phase).toBe("GUESSING");
    room = await leave(room, g3!, deps);
    expect(room.phase).toBe("REVEAL");
    expect(round(room).guesses[answerId]![g3!]).toBeUndefined();
    expect(round(room).awarded[answerId]!.map((a) => a.playerId)).not.toContain(g3);
    expect(room.scores[g3!]).toBeUndefined();
  });

  it("mid-GUESSING as the staged author: the answer is voided and the stage moves on", async () => {
    const deps = makeDeps(28);
    let room = await seat(5, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const voided = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), voided)!;
    const nextId = round(room).order[1]!;
    const guesser = ids(room).find((id) => id !== author)!;
    room = await apply(room, guesser, { v: 1, t: "submitGuess", answerId: voided, playerId: author }, deps);

    room = await leave(room, author, deps);
    expect(room.phase).toBe("GUESSING");
    expect(round(room).stage).toBe(1);
    expect(stagedAnswerId(round(room))).toBe(nextId);
    // `order` is never spliced, so the voided slot is still there — skipped.
    expect(round(room).order[0]).toBe(voided);
    expect(round(room).guesses[voided]).toBeUndefined();
    expect(round(room).awarded[voided]).toBeUndefined();
    for (const id of ids(room)) expect(room.scores[id]).toBe(0);
    expectLiveDeadline(room, "after voiding the staged answer");
  });

  it("as the staged author during REVEAL: the in-flight reveal is left to finish", async () => {
    const deps = makeDeps(29);
    let room = await seat(5, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    room = await everybodyGuesses(room, deps, (_g, a) => a);
    expect(room.phase).toBe("REVEAL");
    const awardedBefore = round(room).awarded[answerId]!.length;

    room = await leave(room, author, deps);
    expect(room.phase).toBe("REVEAL");
    expect(round(room).awarded[answerId]).toHaveLength(awardedBefore);
    expect(round(room).stage).toBe(0);
    // Everyone who guessed right keeps the points that were already applied.
    for (const id of ids(room)) expect(room.scores[id]).toBe(2);
    room = expire(room, deps);
    expect(room.phase).toBe("GUESSING");
    expect(round(room).stage).toBe(1);
  });

  it("skips every answer a leaver voided further down the order", async () => {
    const deps = makeDeps(30);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const order = [...round(room).order];
    const lastAuthor = authorOf(round(room), order[3]!)!;
    // Play the first three answers out, having voided the fourth in advance.
    room = await leave(room, lastAuthor, deps);
    expect(room.phase).toBe("GUESSING");
    for (let i = 0; i < 3; i++) {
      const staged = stagedAnswerId(round(room))!;
      if (authorOf(round(room), staged) === undefined) break;
      room = await everybodyGuesses(room, deps, (_g, a) => a);
      room = expire(room, deps);
    }
    expect(room.phase).toBe("ROUND_END");
    expect(round(room).order).toEqual(order); // never spliced
    expect(round(room).awarded[order[3]!]).toBeUndefined();
  });

  it("dropping below MIN_PLAYERS ends the game at FINALE with scores as they stand", async () => {
    const deps = makeDeps(31);
    let room = await seat(3, deps);
    room = await startGame(room, deps);
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    const answerId = stagedAnswerId(round(room))!;
    const author = authorOf(round(room), answerId)!;
    const guesser = ids(room).find((id) => id !== author)!;
    room = await apply(room, guesser, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
    room = expire(room, deps);
    expect(room.phase).toBe("REVEAL");
    expect(room.scores[guesser]).toBe(2);

    const quitter = ids(room).find((id) => id !== guesser)!;
    room = await leave(room, quitter, deps);
    expect(room.phase).toBe("FINALE");
    expect(room.deadline).toBeNull();
    expect(room.players).toHaveLength(2);
    expect(room.scores[guesser]).toBe(2);
    expect(advance(room, deps).changed).toBe(false);
  });

  it("leaving in the LOBBY does not start or end anything", async () => {
    const deps = makeDeps(32);
    let room = await seat(4, deps);
    room = await apply(room, ids(room)[3]!, { v: 1, t: "leave" }, deps);
    expect(room.phase).toBe("LOBBY");
    expect(room.deadline).toBeNull();
    room = await apply(room, ids(room)[2]!, { v: 1, t: "leave" }, deps);
    expect(room.phase).toBe("LOBBY");
  });
});

describe("advance", () => {
  it("is a no-op before the deadline, in LOBBY, and in FINALE", async () => {
    const deps = makeDeps(33);
    let room = await seat(3, deps);
    expect(advance(room, deps).changed).toBe(false);
    room = await startGame(room, deps);
    expect(advance(room, deps).changed).toBe(false); // deadline not reached
    deps.tick(INTRO_MS + 1);
    expect(advance(room, deps).changed).toBe(true);
  });

  it("re-bases the clock off now, not off the deadline it missed", async () => {
    const deps = makeDeps(34);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    const missed = room.deadline!;
    // The Durable Object slept for an hour.
    const wokeAt = missed + 3_600_000;
    deps.setNow(wokeAt);
    const first = advance(room, deps);
    expect(first.changed).toBe(true);
    expect(first.room.phase).toBe("WRITING");
    // A fresh writing timer, not one that expired 59 minutes ago.
    expect(first.room.deadline).toBe(wokeAt + room.settings.writeSec * 1000);
    // Exactly one transition per call: the caller's loop must terminate.
    expect(advance(first.room, deps).changed).toBe(false);
  });

  it("a long sleep never fast-forwards past a single phase per catch-up step", async () => {
    const deps = makeDeps(35);
    let room = await seat(4, deps);
    room = await startGame(room, deps);
    deps.setNow(T0 + 86_400_000);
    room = catchUp(room, deps);
    // INTRO expired, WRITING was entered on a fresh clock and is still live.
    expect(room.phase).toBe("WRITING");
    expect(room.deadline).toBeGreaterThan(deps.now());
  });
});

/* ------------------------------------------------------- the hang-proof test */

describe("every reachable transition leaves a live deadline", () => {
  /**
   * The property `enterPhase` exists to guarantee. A phase entered without a
   * deadline hangs the room permanently: the Durable Object arms its single
   * alarm solely off `room.deadline`, so nothing ever wakes it again.
   *
   * The driver below walks the state space rather than one happy path —
   * varying roster size, who writes, who guesses, whether a phase resolves
   * early or times out, and who leaves when — and asserts the invariant after
   * *every* mutation, not just at the phase boundaries.
   */
  const SCENARIOS = [
    { players: 3, writers: 3, guessers: 3, leaveAt: null },
    { players: 3, writers: 1, guessers: 3, leaveAt: null },
    { players: 3, writers: 0, guessers: 0, leaveAt: null },
    { players: 4, writers: 4, guessers: 0, leaveAt: null },
    { players: 5, writers: 3, guessers: 2, leaveAt: null },
    { players: 8, writers: 8, guessers: 8, leaveAt: null },
    { players: 6, writers: 6, guessers: 6, leaveAt: "WRITING" as const },
    { players: 6, writers: 6, guessers: 3, leaveAt: "GUESSING" as const },
    { players: 6, writers: 6, guessers: 6, leaveAt: "REVEAL" as const },
    { players: 6, writers: 6, guessers: 6, leaveAt: "ROUND_END" as const },
  ];

  for (const scenario of SCENARIOS) {
    const label = `${scenario.players}p, ${scenario.writers} write, `
      + `${scenario.guessers} guess, leave at ${scenario.leaveAt ?? "never"}`;
    it(label, async () => {
      const deps = makeDeps(scenario.players * 977 + scenario.writers);
      let room = await seat(scenario.players, deps, { rounds: 3 });
      expectLiveDeadline(room, "lobby");
      room = await startGame(room, deps);
      expectLiveDeadline(room, "startGame");

      let left = false;
      let steps = 0;
      while (room.phase !== "FINALE" && steps++ < 400) {
        const phase = room.phase;
        if (phase === "WRITING") {
          const roster = ids(room);
          for (let i = 0; i < Math.min(scenario.writers, roster.length); i++) {
            if (room.phase !== "WRITING") break;
            room = await apply(
              room, roster[i]!, { v: 1, t: "submitEntry", text: `w${i}` }, deps);
            expectLiveDeadline(room, "after submitEntry");
          }
        } else if (phase === "GUESSING") {
          const live = round(room);
          const answerId = stagedAnswerId(live)!;
          const author = authorOf(live, answerId)!;
          const owed = eligibleGuessers(room, live, answerId);
          for (let i = 0; i < Math.min(scenario.guessers, owed.length); i++) {
            if (room.phase !== "GUESSING") break;
            room = await apply(
              room, owed[i]!, { v: 1, t: "submitGuess", answerId, playerId: author }, deps);
            expectLiveDeadline(room, "after submitGuess");
          }
        }
        if (!left && scenario.leaveAt === phase && room.players.length > MIN_PLAYERS) {
          left = true;
          const victim = room.players[room.players.length - 1]!.id;
          room = await apply(room, victim, { v: 1, t: "leave" }, deps);
          expectLiveDeadline(room, `after a leave during ${phase}`);
          if (room.phase === "FINALE") break;
        }
        if (room.phase === phase) room = expire(room, deps);
        expectLiveDeadline(room, `after ${phase}`);
      }
      expect(room.phase).toBe("FINALE");
      expect(room.deadline).toBeNull();
      expect(steps).toBeLessThan(400);
    });
  }
});

/* ------------------------------------------------- a locked phone is not a leave */

/**
 * The connected-ids argument (plan 3 ledger, "A locked phone is not a leave").
 *
 * These are the *pure* half of the ruling: the engine's behaviour given a set
 * of live sockets. That the Durable Object actually computes and passes that
 * set is proven over a real socket in `apps/rooms/test/round.test.ts` — the
 * engine cannot know a phone locked, and must never learn.
 */
describe("connected ids (early resolve only)", () => {
  async function applyWith(
    room: InternalRoom,
    senderId: string,
    msg: ClientMessage,
    deps: EventDeps,
    connected: ReadonlySet<string> | undefined,
  ): Promise<InternalRoom> {
    const r = await applyEvent(room, senderId, msg, deps, connected);
    if (!r.ok) throw new Error(`unexpected rejection: ${r.code} (${msg.t})`);
    return r.room;
  }

  /** Four players, in WRITING, with round 1 live. */
  async function writing(deps: TestDeps, n = 4): Promise<InternalRoom> {
    let room = await seat(n, deps);
    room = await startGame(room, deps);
    return expire(room, deps);
  }

  it("resolves WRITING once the connected players have written", async () => {
    const deps = makeDeps(3);
    let room = await writing(deps);
    const [a, b, c, d] = ids(room) as [string, string, string, string];
    const connected = new Set([a, b, c]); // d's phone locked
    for (const id of [a, b]) {
      room = await applyWith(room, id, { v: 1, t: "submitEntry", text: `by ${id}` }, deps, connected);
      expect(room.phase).toBe("WRITING");
    }
    room = await applyWith(room, c, { v: 1, t: "submitEntry", text: "by c" }, deps, connected);
    expect(room.phase).toBe("GUESSING");
    expectLiveDeadline(room, "after an early resolve on connected ids");
    expect(d).toBeDefined();
  });

  it("waits for the whole roster when no connected set is supplied", async () => {
    const deps = makeDeps(3);
    let room = await writing(deps);
    const [a, b, c] = ids(room) as [string, string, string];
    for (const id of [a, b, c]) {
      room = await apply(room, id, { v: 1, t: "submitEntry", text: `by ${id}` }, deps);
    }
    expect(room.phase).toBe("WRITING");
  });

  it("a disconnected player still stages, still scores and stays a candidate", async () => {
    const deps = makeDeps(11);
    let room = await writing(deps, 3);
    const [a, b, c] = ids(room) as [string, string, string];
    // c writes, then their phone locks; a and b finish.
    room = await apply(room, c, { v: 1, t: "submitEntry", text: "from c" }, deps);
    const connected = new Set([a, b]);
    room = await applyWith(room, a, { v: 1, t: "submitEntry", text: "from a" }, deps, connected);
    room = await applyWith(room, b, { v: 1, t: "submitEntry", text: "from b" }, deps, connected);
    expect(room.phase).toBe("GUESSING");

    const live = round(room);
    // Staging never consults the socket set: all three entries are on the stage.
    expect(live.order).toHaveLength(3);
    expect(live.order.map((id) => authorOf(live, id))).toEqual(
      expect.arrayContaining([a, b, c]),
    );
    // Nor does the candidate list: c owes a guess on every answer but their own.
    for (const answerId of live.order) {
      const owed = eligibleGuessers(room, live, answerId);
      if (authorOf(live, answerId) !== c) expect(owed).toContain(c);
    }
    // And c's entry scores: a and b both guess wrong on c's answer.
    const cAnswer = live.entries[c]!.answerId;
    let staged = room;
    while (stagedAnswerId(round(staged)) !== cAnswer) staged = expire(staged, deps);
    for (const guesser of [a, b]) {
      staged = await applyWith(
        staged, guesser, { v: 1, t: "submitGuess", answerId: cAnswer, playerId: guesser === a ? b : a },
        deps, connected);
    }
    expect(staged.phase).toBe("REVEAL");
    expect(staged.scores[c]).toBe(2); // +1 per fooled guesser
  });

  it("resolves GUESSING once the connected guessers have guessed", async () => {
    const deps = makeDeps(5);
    let room = await writing(deps, 4);
    room = await everybodyWrites(room, deps);
    expect(room.phase).toBe("GUESSING");
    const live = round(room);
    const answerId = stagedAnswerId(live)!;
    const author = authorOf(live, answerId)!;
    const owed = eligibleGuessers(room, live, answerId);
    const [first, second, third] = owed as [string, string, string];
    const connected = new Set([author, first, second]); // third locked
    room = await applyWith(
      room, first, { v: 1, t: "submitGuess", answerId, playerId: author }, deps, connected);
    expect(room.phase).toBe("GUESSING");
    room = await applyWith(
      room, second, { v: 1, t: "submitGuess", answerId, playerId: author }, deps, connected);
    expect(room.phase).toBe("REVEAL");
    expect(third).toBeDefined();
  });

  it("an empty connected set falls back to the roster and resolves nothing early", async () => {
    const deps = makeDeps(7);
    let room = await writing(deps, 3);
    const roster = ids(room);
    const nobody = new Set<string>();
    for (const id of roster.slice(0, 2)) {
      room = await applyWith(room, id, { v: 1, t: "submitEntry", text: `by ${id}` }, deps, nobody);
    }
    expect(room.phase).toBe("WRITING");
  });

  it("resolveIfEveryoneReady moves the phase on when the last straggler drops", async () => {
    const deps = makeDeps(13);
    let room = await writing(deps, 3);
    const [a, b, c] = ids(room) as [string, string, string];
    for (const id of [a, b]) {
      room = await apply(room, id, { v: 1, t: "submitEntry", text: `by ${id}` }, deps);
    }
    expect(room.phase).toBe("WRITING");
    // Nothing happens while c could still write...
    expect(resolveIfEveryoneReady(room, deps, new Set([a, b, c])).changed).toBe(false);
    // ...and the phase resolves the moment c's socket is gone.
    const dropped = resolveIfEveryoneReady(room, deps, new Set([a, b]));
    expect(dropped.changed).toBe(true);
    expect(dropped.room.phase).toBe("GUESSING");
    expectLiveDeadline(dropped.room, "after resolveIfEveryoneReady");
  });

  it("resolveIfEveryoneReady is a no-op outside WRITING and GUESSING", async () => {
    const deps = makeDeps(17);
    let room = await seat(3, deps);
    expect(resolveIfEveryoneReady(room, deps, new Set(ids(room))).changed).toBe(false); // LOBBY
    room = await startGame(room, deps);
    expect(resolveIfEveryoneReady(room, deps, new Set(ids(room))).changed).toBe(false); // INTRO
    room = expire(room, deps);
    room = await everybodyWrites(room, deps);
    room = await everybodyGuesses(room, deps, (_g, author) => author);
    expect(room.phase).toBe("REVEAL");
    expect(resolveIfEveryoneReady(room, deps, new Set()).changed).toBe(false);
  });
});
