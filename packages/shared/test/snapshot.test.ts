import { describe, expect, it } from "vitest";
import { resolvePrompt } from "../content/prompts";
import type { ClientMessage, GuessingView, Lang, RevealView, RoundEndView, ServerMessage, WritingView } from "../src/protocol";
import type { EventDeps, InternalRoom } from "../src/state";
import { applyEvent, createRoom, snapshotForPlayer } from "../src/state";
import { advance, authorOf, currentRound, eligibleGuessers, stagedAnswerId } from "../src/round";
import { viewForPlayer } from "../src/view";
import { expectAbsent, overTheWire } from "./helpers";

/**
 * The anonymity matrix.
 *
 * This game has exactly one security property: everybody answers the same
 * prompt anonymously, so **authorship must be absent from a player's snapshot
 * — not blanked, not nulled — until that answer's REVEAL.** A leak here is not
 * a cosmetic bug; the round it leaks in is unplayable and the players cannot
 * un-know it.
 *
 * So the suite is a matrix rather than a handful of spot checks: every phase ×
 * every reader role (the author of the staged answer, a guesser, a player who
 * wrote nothing) × every staged answer index. Each cell serializes the
 * snapshot exactly as it goes over the wire and asserts three things:
 *
 *  1. no `authorId`-shaped key exists for any answer not yet revealed;
 *  2. no other player's entry text appears anywhere in the raw JSON, and
 *     neither does any other answer's id;
 *  3. `myEntry` carries the reader's own text and nobody else's.
 *
 * Two checks and not one, per `helpers.ts`: `deepKeys` catches a secret
 * smuggled under a nested key, the raw-JSON scan catches one leaked as a
 * *value* under an innocent key. Either alone would pass a real leak.
 */

/* -------------------------------------------------------------- test harness */

interface TestDeps extends EventDeps {
  setNow(t: number): void;
}

const T0 = 1_700_000_000_000;

/**
 * Ids are zero-padded so that `id-0011` does not *contain* `id-0001`: the
 * correlation assertions below check substrings, and unpadded counters would
 * turn a real proof into a false failure. `random` is an LCG rather than a
 * constant so "stage order is not join order" cannot pass degenerately.
 */
function makeDeps(seed = 7): TestDeps {
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

/** Expire the current phase and take exactly one transition, as the DO does. */
function expire(room: InternalRoom, deps: TestDeps): InternalRoom {
  if (room.deadline === null) throw new Error(`cannot expire untimed ${room.phase}`);
  deps.setNow(room.deadline + 1);
  const result = advance(room, deps);
  if (!result.changed) throw new Error(`advance did not move on from ${room.phase}`);
  return result.room;
}

function ids(room: InternalRoom): string[] {
  return room.players.map((p) => p.id);
}

function liveRound(room: InternalRoom) {
  const r = currentRound(room);
  if (r === undefined) throw new Error("no live round");
  return r;
}

/**
 * Distinctive, mutually non-overlapping entry texts. They have to be unique
 * *and* not substrings of one another, because the whole proof is a substring
 * scan over the serialized snapshot.
 */
const WRITER_COUNT = 5;
const PLAYER_COUNT = 6;
const TEXTS = [
  "quartz-flamingo-01",
  "velvet-harpsichord-02",
  "tangerine-obelisk-03",
  "brindle-kazoo-04",
  "sundial-mackerel-05",
];

interface Fixture {
  deps: TestDeps;
  /** Every seated player, in join order. */
  roster: string[];
  /** The five who wrote, in join order; `roster[5]` wrote nothing. */
  writers: string[];
  nonWriter: string;
  textOf: Record<string, string>;
  intro: InternalRoom;
  writingEmpty: InternalRoom;
  writing: InternalRoom;
  /** One entry per staged answer: the phase as it opens, nobody guessed yet. */
  guessing: InternalRoom[];
  /** The same stage after exactly one guess has been cast. */
  guessingPartial: InternalRoom[];
  /** The same stage once everyone guessed and the answer was scored. */
  reveal: InternalRoom[];
  roundEnd: InternalRoom;
  finale: InternalRoom;
}

/**
 * One full round, captured at every phase.
 *
 * Six players and five writers on purpose: `MAX_STAGED` is 4, so one written
 * answer is never staged (ROUND_END must still show it) and one player wrote
 * nothing at all (they still guess, and they must still appear in everyone
 * else's `candidates`).
 */
async function playRound(seed = 7): Promise<Fixture> {
  const deps = makeDeps(seed);
  const langs: Lang[] = ["en", "da", "en", "da", "en", "da"];
  let room = createRoom("VIEW");
  for (let i = 0; i < PLAYER_COUNT; i++) {
    room = await apply(
      room, "", { v: 1, t: "join", name: `P${i + 1}`, emoji: "🦊", lang: langs[i]! }, deps);
  }
  room = await apply(room, room.hostId, { v: 1, t: "updateSettings", patch: { rounds: 1 } }, deps);
  room = await apply(room, room.hostId, { v: 1, t: "startGame" }, deps);

  const roster = ids(room);
  const writers = roster.slice(0, WRITER_COUNT);
  const textOf: Record<string, string> = {};
  writers.forEach((id, i) => { textOf[id] = TEXTS[i]!; });

  const intro = room;
  room = expire(room, deps);
  const writingEmpty = room;
  for (const id of writers) {
    room = await apply(room, id, { v: 1, t: "submitEntry", text: textOf[id]! }, deps);
  }
  const writing = room;
  // The sixth player never writes, so WRITING runs to its deadline.
  room = expire(room, deps);

  const guessing: InternalRoom[] = [];
  const guessingPartial: InternalRoom[] = [];
  const reveal: InternalRoom[] = [];
  while (room.phase === "GUESSING") {
    guessing.push(room);
    const round = liveRound(room);
    const answerId = stagedAnswerId(round)!;
    const author = authorOf(round, answerId)!;
    const owed = eligibleGuessers(room, round, answerId);
    for (let i = 0; i < owed.length; i++) {
      const guesser = owed[i]!;
      // The first guesser is right, the rest are wrong: `awarded` then carries
      // a mix of points and zeros, and both branches of the scoring are live.
      const target = i === 0 ? author : roster.find((id) => id !== guesser && id !== author)!;
      room = await apply(
        room, guesser, { v: 1, t: "submitGuess", answerId, playerId: target }, deps);
      if (i === 0) guessingPartial.push(room);
    }
    reveal.push(room);
    room = expire(room, deps);
  }

  const roundEnd = room;
  const finale = expire(room, deps);
  return {
    deps, roster, writers, nonWriter: roster[WRITER_COUNT]!, textOf,
    intro, writingEmpty, writing, guessing, guessingPartial, reveal, roundEnd, finale,
  };
}

const F = await playRound();
/** `MAX_STAGED` of the five entries. Asserted below, then used as the matrix axis. */
const STAGE_INDEXES = [0, 1, 2, 3];

function stagedIdAt(k: number): string {
  return liveRound(F.guessing[k]!).order[k]!;
}

function authorAt(k: number): string {
  return authorOf(liveRound(F.guessing[k]!), stagedIdAt(k))!;
}

/** The three reader roles, resolved against the answer staged at index `k`. */
function readerFor(role: string, k: number): string {
  if (role === "author") return authorAt(k);
  if (role === "non-writer") return F.nonWriter;
  // A guesser who also wrote — the interesting guesser, since their own text
  // is in play elsewhere in the round and must not surface early.
  return F.writers.find((id) => id !== authorAt(k))!;
}

function snapshotPhase(snapshot: ServerMessage): string {
  return snapshot.t === "state" ? snapshot.room.phase : "";
}

function snapshotFor(room: InternalRoom, playerId: string): ServerMessage {
  return snapshotForPlayer(room, playerId, T0);
}

/**
 * The three assertions of the matrix, applied to one serialized snapshot.
 *
 * `publicTexts` is what this phase has legitimately made public; every other
 * writer's text, and every answer id that is not on screen, must be absent
 * from the bytes entirely.
 */
function expectNoLeak(
  snapshot: ServerMessage,
  reader: string,
  opts: { publicTexts?: readonly string[]; publicAnswerIds?: readonly string[]; authors: "none" | "staged" | "all" },
): void {
  const publicTexts = new Set([...(opts.publicTexts ?? [])]);
  const secretTexts = F.writers.map((id) => F.textOf[id]!).filter((t) => !publicTexts.has(t));
  const publicIds = new Set([...(opts.publicAnswerIds ?? [])]);
  const round = currentRound(F.roundEnd)!;
  const secretAnswerIds = F.writers
    .map((id) => round.entries[id]!.answerId)
    .filter((id) => !publicIds.has(id));

  if (opts.authors === "none") {
    expectAbsent(snapshot, { keys: ["authorId", "author", "entries"], strings: secretTexts });
  } else {
    expectAbsent(snapshot, { strings: secretTexts });
  }
  // No answer that is not on screen may be named, even by its opaque id: an id
  // that reaches a client early is an id it can correlate with later.
  expectAbsent(snapshot, { strings: secretAnswerIds });

  const { json, keys } = overTheWire(snapshot);
  if (opts.authors === "staged") {
    // Exactly one authorship claim, and it is the answer being revealed.
    expect(json.split('"authorId"').length - 1, "one authorId, for the revealed answer").toBe(1);
  }
  // `myEntry` exists only in WRITING, and only ever carries the reader's own
  // text — the scan is over the raw bytes so a second one nested anywhere
  // would be caught too.
  expect(keys.has("myEntry")).toBe(snapshotPhase(snapshot) === "WRITING" && F.textOf[reader] !== undefined);
  for (const found of [...json.matchAll(/"myEntry":"([^"]*)"/g)]) {
    expect(found[1]).toBe(F.textOf[reader]);
  }
}

/* ---------------------------------------------------------------- the matrix */

describe("the fixture is the room the matrix assumes", () => {
  it("stages MAX_STAGED of five entries, leaving one written answer unstaged", () => {
    const round = currentRound(F.roundEnd)!;
    expect(round.order).toHaveLength(4);
    expect(Object.keys(round.entries)).toHaveLength(WRITER_COUNT);
    expect(F.guessing).toHaveLength(4);
    expect(F.reveal).toHaveLength(4);
  });
  it("has one player who wrote nothing and is still seated", () => {
    expect(F.roundEnd.players.map((p) => p.id)).toContain(F.nonWriter);
    expect(currentRound(F.roundEnd)!.entries[F.nonWriter]).toBeUndefined();
  });
});

describe.each(["author", "guesser", "non-writer"])("reader: %s", (role) => {
  describe.each(STAGE_INDEXES)("staged answer #%i", (k) => {
    it("INTRO leaks nothing", () => {
      const reader = readerFor(role, k);
      expectNoLeak(snapshotFor(F.intro, reader), reader, { authors: "none" });
    });

    it("WRITING carries only the reader's own entry", () => {
      const reader = readerFor(role, k);
      const snap = snapshotFor(F.writing, reader);
      expectNoLeak(snap, reader, { publicTexts: [F.textOf[reader] ?? ""], authors: "none" });
      const view = (snap as { room: WritingView }).room;
      expect(view.phase).toBe("WRITING");
      expect(view.myEntry).toBe(F.textOf[reader]);
      expect(view.submittedIds).toEqual(F.writers);
    });

    it("GUESSING carries the staged answer and no authorship", () => {
      const reader = readerFor(role, k);
      const room = F.guessing[k]!;
      const answerId = stagedIdAt(k);
      const author = authorAt(k);
      const snap = snapshotFor(room, reader);
      expectNoLeak(snap, reader, {
        publicTexts: [F.textOf[author]!],
        publicAnswerIds: [answerId],
        authors: "none",
      });
      const view = (snap as { room: GuessingView }).room;
      expect(view.phase).toBe("GUESSING");
      expect(view.answer).toEqual({ id: answerId, text: F.textOf[author] });
      expect(view.answerIndex).toBe(k + 1);
      expect(view.answerTotal).toBe(4);
      expect(view.youWrote).toBe(reader === author ? true : undefined);
      expect(view.myGuess).toBeUndefined();
      expect(view.guessedCount).toBe(0);
    });

    it("GUESSING mid-phase carries only this reader's own guess", () => {
      const reader = readerFor(role, k);
      const room = F.guessingPartial[k]!;
      const answerId = stagedIdAt(k);
      const author = authorAt(k);
      const snap = snapshotFor(room, reader);
      expectNoLeak(snap, reader, {
        publicTexts: [F.textOf[author]!],
        publicAnswerIds: [answerId],
        authors: "none",
      });
      const view = (snap as { room: GuessingView }).room;
      const cast = liveRound(room).guesses[answerId] ?? {};
      expect(view.guessedCount).toBe(1);
      expect(view.myGuess).toBe(cast[reader]);
      // The one guess that has been cast is correct, so if it were echoed to
      // everybody the room would know the author. Only its owner sees it.
      if (cast[reader] === undefined) expect(view.myGuess).toBeUndefined();
    });

    it("REVEAL opens this answer and only this answer", () => {
      const reader = readerFor(role, k);
      const room = F.reveal[k]!;
      const answerId = stagedIdAt(k);
      const author = authorAt(k);
      const snap = snapshotFor(room, reader);
      expectNoLeak(snap, reader, {
        publicTexts: [F.textOf[author]!],
        publicAnswerIds: [answerId],
        authors: "staged",
      });
      const view = (snap as { room: RevealView }).room;
      expect(view.phase).toBe("REVEAL");
      expect(view.authorId).toBe(author);
      expect(view.answer).toEqual({ id: answerId, text: F.textOf[author] });
      expect(Object.keys(view.answer)).toEqual(["id", "text"]);
      // Every present player, zeros included (T3 ruling 22).
      expect(view.awarded.map((a) => a.playerId)).toEqual(F.roster);
      expect(view.awarded.some((a) => a.points === 0)).toBe(true);
      expect(view.guesses).toHaveLength(PLAYER_COUNT - 1);
    });

    it("ROUND_END opens every answer of the round, staged or not", () => {
      const reader = readerFor(role, k);
      const snap = snapshotFor(F.roundEnd, reader);
      const view = (snap as { room: RoundEndView }).room;
      expect(view.phase).toBe("ROUND_END");
      expect(view.answers).toHaveLength(WRITER_COUNT);
      for (const writer of F.writers) {
        expect(view.answers.find((a) => a.authorId === writer)?.text).toBe(F.textOf[writer]);
      }
      // The round is over, so nothing is secret — but the store itself still
      // never travels.
      expectAbsent(snap, { keys: ["entries"] });
    });

    it("FINALE carries no round content at all", () => {
      const reader = readerFor(role, k);
      expectNoLeak(snapshotFor(F.finale, reader), reader, { authors: "none" });
    });
  });
});

/* ------------------------------------------------------- the omission leaks */

describe("candidates", () => {
  it.each(STAGE_INDEXES)("is the same length for the author and a guesser (#%i)", (k) => {
    const author = authorAt(k);
    const guesser = readerFor("guesser", k);
    const asAuthor = (viewForPlayer(F.guessing[k]!, author) as GuessingView).candidates;
    const asGuesser = (viewForPlayer(F.guessing[k]!, guesser) as GuessingView).candidates;
    const asNonWriter = (viewForPlayer(F.guessing[k]!, F.nonWriter) as GuessingView).candidates;
    expect(asAuthor).toHaveLength(PLAYER_COUNT - 1);
    expect(asGuesser).toHaveLength(asAuthor.length);
    expect(asNonWriter).toHaveLength(asAuthor.length);
    // Dropping the author for every guesser would leak authorship by omission.
    expect(asGuesser).toContain(author);
    // Filtering to writers would leak who sat the round out.
    expect(asGuesser).toContain(F.nonWriter);
    expect(asAuthor).toContain(F.nonWriter);
  });

  it.each(STAGE_INDEXES)("always excludes the reader and nobody else (#%i)", (k) => {
    for (const role of ["author", "guesser", "non-writer"]) {
      const reader = readerFor(role, k);
      const view = viewForPlayer(F.guessing[k]!, reader) as GuessingView;
      expect(view.candidates).not.toContain(reader);
      expect([...view.candidates, reader].sort()).toEqual([...F.roster].sort());
    }
  });

  it("never names who has guessed — a list would name the author by omission", () => {
    for (const room of [...F.guessing, ...F.guessingPartial]) {
      for (const reader of F.roster) {
        const { keys } = overTheWire(snapshotFor(room, reader));
        expect(keys.has("guessedIds")).toBe(false);
        expect(keys.has("guessers")).toBe(false);
      }
    }
  });
});

/* ---------------------------------------------------- the correlation leaks */

describe("answer ids and stage order", () => {
  it("no answerId equals or contains a playerId, in either direction", () => {
    const round = currentRound(F.roundEnd)!;
    for (const writer of F.writers) {
      const answerId = round.entries[writer]!.answerId;
      for (const playerId of F.roster) {
        expect(answerId).not.toBe(playerId);
        expect(answerId).not.toContain(playerId);
        expect(playerId).not.toContain(answerId);
      }
    }
  });

  it("stage order is not join order", () => {
    // Across independent seeds, so this cannot pass because one shuffle
    // happened to be lucky. Sorted-ascending means "the room sees the answers
    // in the order the authors joined", which is the correlation leak.
    let sorted = 0;
    const seeds = 24;
    const results: number[][] = [];
    for (let seed = 1; seed <= seeds; seed++) results.push(joinOrderOf(seed));
    for (const positions of results) {
      if (positions.every((p, i) => i === 0 || positions[i - 1]! < p)) sorted++;
    }
    expect(sorted).toBeLessThan(seeds / 2);
    // And the shuffles are not all the same shuffle either.
    expect(new Set(results.map((r) => r.join(","))).size).toBeGreaterThan(seeds / 2);
  });
});

/** Where each staged answer's author sits in join order, for one seed. */
function joinOrderOf(seed: number): number[] {
  const room = SEEDED[seed]!;
  const round = currentRound(room)!;
  const roster = ids(room);
  return round.order.map((answerId) => roster.indexOf(authorOf(round, answerId)!));
}

const SEEDED: Record<number, InternalRoom> = {};
for (let seed = 1; seed <= 24; seed++) SEEDED[seed] = (await playRound(seed)).guessing[0]!;

/* -------------------------------------------------------------- per-player */

describe("per-player language", () => {
  it("gives two readers the same round in their own language", () => {
    const round = currentRound(F.writing)!;
    const en = F.roster.find((id) => F.writing.players.find((p) => p.id === id)!.lang === "en")!;
    const da = F.roster.find((id) => F.writing.players.find((p) => p.id === id)!.lang === "da")!;
    const enView = viewForPlayer(F.writing, en) as WritingView;
    const daView = viewForPlayer(F.writing, da) as WritingView;
    expect(enView.prompt).toBe(resolvePrompt(round.promptId, "en"));
    expect(daView.prompt).toBe(resolvePrompt(round.promptId, "da"));
    expect(enView.prompt).not.toBe(daView.prompt);
    // Same round, same answer, different words.
    const enGuess = viewForPlayer(F.guessing[0]!, en) as GuessingView;
    const daGuess = viewForPlayer(F.guessing[0]!, da) as GuessingView;
    expect(enGuess.answer).toEqual(daGuess.answer);
    expect(enGuess.prompt).not.toBe(daGuess.prompt);
  });

  it("falls back to the default language for a reader who is no longer seated", () => {
    const view = viewForPlayer(F.writing, "ghost") as WritingView;
    expect(view.prompt).toBe(resolvePrompt(currentRound(F.writing)!.promptId, "en"));
    expect(view.myEntry).toBeUndefined();
    expect("candidates" in view).toBe(false);
  });
});

describe("myEntry", () => {
  it("is absent before the reader submits, and never blanked", () => {
    for (const reader of F.roster) {
      const view = viewForPlayer(F.writingEmpty, reader) as WritingView;
      expect("myEntry" in view).toBe(false);
      expect(view.submittedIds).toEqual([]);
    }
  });
  it("survives a reconnect mid-WRITING", () => {
    for (const writer of F.writers) {
      expect((viewForPlayer(F.writing, writer) as WritingView).myEntry).toBe(F.textOf[writer]);
    }
    expect((viewForPlayer(F.writing, F.nonWriter) as WritingView).myEntry).toBeUndefined();
  });
});

/* ------------------------------------------------------- counters and voids */

describe("the staged counter", () => {
  it("reads 0 under INTRO — INTRO is once per game, before round 1 exists", () => {
    const view = viewForPlayer(F.intro, F.roster[0]!);
    expect(view.phase).toBe("INTRO");
    expect("round" in view && view.round).toBe(0);
  });

  it("counts live, non-voided answers when someone leaves mid-round", async () => {
    const deps = makeDeps(11);
    const room = F.guessing[0]!;
    const round = liveRound(room);
    // Void a *later* stage by removing its author; the current stage stands.
    const victim = authorOf(round, round.order[2]!)!;
    const before = viewForPlayer(room, F.nonWriter) as GuessingView;
    expect(before.answerTotal).toBe(4);
    const after = await applyEvent(room, victim, { v: 1, t: "leave" }, deps);
    expect(after.ok).toBe(true);
    const view = viewForPlayer(after.room, F.nonWriter) as GuessingView;
    expect(view.answerIndex).toBe(1);
    expect(view.answerTotal).toBe(3);
    // And the leaver's answer is gone from the room entirely, not blanked.
    expectAbsent(snapshotFor(after.room, F.nonWriter), { strings: [F.textOf[victim]!] });
  });

  it("shows the round counter and total once a round is live", () => {
    const view = viewForPlayer(F.writing, F.roster[0]!) as WritingView;
    expect(view.round).toBe(1);
    expect(view.roundCount).toBe(1);
  });
});

describe("degenerate rooms", () => {
  it("falls back to a contentless view rather than to ROUND_END when the staged answer is voided", () => {
    // The author of the answer under scrutiny vanishes from `entries` without
    // the phase moving on. This cannot happen through `handlePlayerLeft`, which
    // advances the stage — it is the shape of the bug the fallback exists for.
    const room = structuredClone(F.reveal[0]!);
    const round = liveRound(room);
    delete round.entries[authorAt(0)!];
    const view = viewForPlayer(room, F.nonWriter);
    expect(view.phase).toBe("INTRO");
    // The critical part: it did NOT fall back to a view that publishes the
    // round's other answers.
    expectAbsent(
      { view },
      { keys: ["answers", "answer", "authorId"], strings: F.writers.map((id) => F.textOf[id]!) },
    );
  });

  it("LOBBY still projects the lobby and nothing else", async () => {
    const deps = makeDeps(3);
    let room = createRoom("LOB");
    for (let i = 0; i < 3; i++) {
      room = await apply(room, "", { v: 1, t: "join", name: `Q${i}`, emoji: "🦊" }, deps);
    }
    const snap = snapshotFor(room, room.hostId);
    expect(snap.t === "state" && snap.room.phase).toBe("LOBBY");
    expectAbsent(snap, { keys: ["entries", "authorId", "prompt", "answer", "answers", "myEntry"] });
  });
});
