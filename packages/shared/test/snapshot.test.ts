import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../src/protocol";
import {
  advance,
  applyRoundMessage,
  authorOf,
  currentRound,
} from "../src/round";
import { applyEvent, createRoom, snapshotForPlayer, type EventDeps, type InternalRoom } from "../src/state";
import { viewForPlayer } from "../src/view";
import { deepKeys, expectAbsent, overTheWire } from "./helpers";

/**
 * The anonymity matrix.
 *
 * The game's one security property: authorship must be **absent** from a
 * player's snapshot — not blanked, not nulled — until that answer's REVEAL.
 * These tests walk every phase x every reader role and assert absence over the
 * bytes that actually go over the wire.
 *
 * A leak test that has never failed is not evidence. Four deliberate mutations
 * were introduced and reverted while writing this file; each one is named in
 * the test it broke, with the failure count.
 */

function makeDeps(): EventDeps & { clock: { t: number } } {
  let i = 0;
  let n = 0;
  const clock = { t: 1_000_000 };
  const seq = [0, 0.5, 0.25, 0.75, 0.1, 0.9, 0.4, 0.6];
  return {
    newId: () => `a${++i}`,
    newToken: () => `tok${++n}`,
    now: () => clock.t,
    random: () => seq[(i + n++) % seq.length]!,
    clock,
  };
}

const PLAYER_COUNT = 5;
const QUESTIONS = 3;

/** Text unique enough that finding it anywhere in a snapshot is unambiguous. */
const secretText = (playerIndex: number, q: number) => `ZZSECRET-p${playerIndex}-q${q}`;

async function buildRoom(settings?: Partial<Settings>) {
  const deps = makeDeps();
  let room = createRoom("TEST");
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const r = await applyEvent(room, "", { v: 1, t: "join", name: `P${i}`, emoji: "🦊" }, deps);
    if (!r.ok) throw new Error("join failed");
    room = r.room;
  }
  // Two Danish readers, so the per-reader language projection is exercised.
  room.players[1]!.lang = "da";
  room.players[3]!.lang = "da";
  room.settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    questions: QUESTIONS,
    rounds: 8,
    standingsEvery: 2,
    ...settings,
  };
  const ids = room.players.map((p) => p.id);

  const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
  if (!started.ok) throw new Error("startGame failed");
  let live = started.room;
  deps.clock.t = live.deadline! + 1;
  live = advance(live, deps).room;                     // INTRO -> ANSWERING

  // Everyone answers every question with text nobody else could produce.
  ids.forEach((id, playerIndex) => {
    for (let q = 0; q < QUESTIONS; q++) {
      const r = applyRoundMessage(
        live, id, { v: 1, t: "submitEntry", questionIndex: q, text: secretText(playerIndex, q) }, deps);
      if (!r.ok) throw new Error("submitEntry failed");
      live = r.room;
    }
  });
  return { room: live, deps, ids };
}

function step(room: InternalRoom, deps: ReturnType<typeof makeDeps>): InternalRoom {
  deps.clock.t = (room.deadline ?? deps.clock.t) + 1;
  return advance(room, deps).room;
}

/** Every player's text except the reader's own. */
function foreignTexts(readerIndex: number): string[] {
  const out: string[] = [];
  for (let p = 0; p < PLAYER_COUNT; p++) {
    if (p === readerIndex) continue;
    for (let q = 0; q < QUESTIONS; q++) out.push(secretText(p, q));
  }
  return out;
}

describe("ANSWERING — nobody sees anybody else's answers", () => {
  it("a reader gets their own answers and no one else's, in every language",
    async () => {
      const { room, ids } = await buildRoom();
      expect(room.phase).toBe("ANSWERING");
      ids.forEach((id, readerIndex) => {
        const snap = snapshotForPlayer(room, id, 0);
        expectAbsent(snap, {
          keys: ["authorId", "entries", "answerId", "handedIn0"],
          strings: foreignTexts(readerIndex),
        });
        const view = viewForPlayer(room, id);
        if (view.phase !== "ANSWERING") throw new Error("expected ANSWERING");
        // Their own three answers, and exactly those.
        expect(Object.keys(view.myAnswers)).toHaveLength(QUESTIONS);
        for (let q = 0; q < QUESTIONS; q++) {
          expect(view.myAnswers[q]).toBe(secretText(readerIndex, q));
        }
      });
    });

  // MUTATION: making `myAnswers` fall back to another player's entries failed
  // 5 tests here. Reverted.
  it("myAnswers is empty for a player who has written nothing", async () => {
    const { room, ids } = await buildRoom();
    const bare = structuredClone(room);
    delete bare.entries[ids[2]!];
    const view = viewForPlayer(bare, ids[2]!);
    if (view.phase !== "ANSWERING") throw new Error("expected ANSWERING");
    expect(view.myAnswers).toEqual({});
    expectAbsent(snapshotForPlayer(bare, ids[2]!, 0), { strings: foreignTexts(2) });
  });

  it("hand-in progress is a COUNT and never a list of who is done", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = room;
    for (const id of ids.slice(0, 3)) {
      const r = applyRoundMessage(live, id, { v: 1, t: "handIn" }, deps);
      if (!r.ok) throw new Error("handIn failed");
      live = r.room;
    }
    const view = viewForPlayer(live, ids[4]!);
    if (view.phase !== "ANSWERING") throw new Error("expected ANSWERING");
    expect(view.doneCount).toBe(3);
    expect(view.handedIn).toBe(false);
    // The structural rule: no array of player ids describing who is done.
    const keys = deepKeys(JSON.parse(JSON.stringify(snapshotForPlayer(live, ids[4]!, 0))));
    for (const forbidden of ["doneIds", "handedInIds", "submittedIds", "doneBy"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("the reader's own handedIn flag is their own", async () => {
    const { room, deps, ids } = await buildRoom();
    const r = applyRoundMessage(room, ids[1]!, { v: 1, t: "handIn" }, deps);
    if (!r.ok) throw new Error("handIn failed");
    const mine = viewForPlayer(r.room, ids[1]!);
    const theirs = viewForPlayer(r.room, ids[2]!);
    if (mine.phase !== "ANSWERING" || theirs.phase !== "ANSWERING") throw new Error("phase");
    expect(mine.handedIn).toBe(true);
    expect(theirs.handedIn).toBe(false);
  });

  it("questions resolve in the reader's own language", async () => {
    const { room, ids } = await buildRoom();
    const en = viewForPlayer(room, ids[0]!);
    const da = viewForPlayer(room, ids[1]!);
    if (en.phase !== "ANSWERING" || da.phase !== "ANSWERING") throw new Error("phase");
    expect(en.questions).toHaveLength(QUESTIONS);
    expect(da.questions).toHaveLength(QUESTIONS);
    // MUTATION: ignoring the reader's language failed 1 test. Reverted.
    expect(en.questions).not.toEqual(da.questions);
  });
});

describe("GUESSING — the author is absent for every reader", () => {
  it("no reader is ever sent an authorId, at any depth", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = step(room, deps);   // ANSWERING -> GUESSING
    let guessingRoundsChecked = 0;
    // Walk several rounds, checking every reader at each one.
    for (let guard = 0; guard < 8 && live.phase !== "FINALE"; guard++) {
      if (live.phase === "GUESSING") {
        guessingRoundsChecked++;
        for (const id of ids) {
          // Player ids are public — the roster carries all of them — so the
          // guarantee is the absent KEY, not an absent string. There is no
          // field in the payload that says which of those ids wrote this.
          expectAbsent(snapshotForPlayer(live, id, 0), { keys: ["authorId"] });
          const view = viewForPlayer(live, id);
          if (view.phase !== "GUESSING") continue;
          // The staged answer's shape has nowhere to put an author.
          expect(Object.keys(view.answer).sort()).toEqual(["id", "text"]);
        }
      }
      live = step(live, deps);
    }
    expect(guessingRoundsChecked).toBeGreaterThan(1);
  });

  // MUTATION: adding `authorId` to the staged answer failed 6 tests. Reverted.
  it("only the staged answer's text is sent — every other answer stays home",
    async () => {
      const { room, deps, ids } = await buildRoom();
      const live = step(room, deps);
      expect(live.phase).toBe("GUESSING");
      const round = currentRound(live)!;
      const stagedText = live.entries[authorOf(live, round.answerId)!]![round.questionIndex]!.text;
      for (const id of ids) {
        const { json } = overTheWire(snapshotForPlayer(live, id, 0));
        expect(json).toContain(stagedText);
        // Every other secret string must be absent.
        const others: string[] = [];
        for (let p = 0; p < PLAYER_COUNT; p++) {
          for (let q = 0; q < QUESTIONS; q++) {
            const t = secretText(p, q);
            if (t !== stagedText) others.push(t);
          }
        }
        for (const other of others) expect(json).not.toContain(other);
      }
    });

  // MUTATION: dropping the author from `candidates` failed 10 tests. Reverted.
  it("candidates is everyone except the reader — same length for everybody",
    async () => {
      const { room, deps, ids } = await buildRoom();
      const live = step(room, deps);
      for (const id of ids) {
        const view = viewForPlayer(live, id);
        if (view.phase !== "GUESSING") throw new Error("expected GUESSING");
        expect(view.candidates).toHaveLength(PLAYER_COUNT - 1);
        expect(view.candidates).not.toContain(id);
        expect(new Set(view.candidates).size).toBe(PLAYER_COUNT - 1);
      }
    });

  it("candidates still includes a player who answered nothing at all", async () => {
    const { room, deps, ids } = await buildRoom();
    const silent = ids[4]!;
    const bare = structuredClone(room);
    delete bare.entries[silent];
    const live = step(bare, deps);
    expect(live.phase).toBe("GUESSING");
    for (const id of ids) {
      if (id === silent) continue;
      const view = viewForPlayer(live, id);
      if (view.phase !== "GUESSING") continue;
      expect(view.candidates).toContain(silent);
    }
  });

  it("youWrote is present only for the author, and is presence not a boolean",
    async () => {
      const { room, deps, ids } = await buildRoom();
      const live = step(room, deps);
      const round = currentRound(live)!;
      const author = authorOf(live, round.answerId)!;
      for (const id of ids) {
        const view = viewForPlayer(live, id);
        if (view.phase !== "GUESSING") throw new Error("expected GUESSING");
        if (id === author) expect(view.youWrote).toBe(true);
        else expect("youWrote" in view).toBe(false);
      }
    });

  it("guess progress is a COUNT and never a list of guessers", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = step(room, deps);
    const round = currentRound(live)!;
    const author = authorOf(live, round.answerId)!;
    const guesser = ids.find((id) => id !== author)!;
    const r = applyRoundMessage(
      live, guesser, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: author }, deps);
    if (!r.ok) throw new Error("guess failed");
    live = r.room;

    const view = viewForPlayer(live, ids.find((id) => id !== author && id !== guesser)!);
    if (view.phase !== "GUESSING") throw new Error("expected GUESSING");
    expect(view.guessedCount).toBe(1);
    const keys = deepKeys(JSON.parse(JSON.stringify(snapshotForPlayer(live, ids[0]!, 0))));
    for (const forbidden of ["guessedIds", "guessers", "guesses"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("myGuess is the reader's own and nobody else's", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = step(room, deps);
    const round = currentRound(live)!;
    const author = authorOf(live, round.answerId)!;
    const [g1, g2] = ids.filter((id) => id !== author);
    const r = applyRoundMessage(
      live, g1!, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: author }, deps);
    if (!r.ok) throw new Error("guess failed");
    live = r.room;

    const mine = viewForPlayer(live, g1!);
    const theirs = viewForPlayer(live, g2!);
    if (mine.phase !== "GUESSING" || theirs.phase !== "GUESSING") throw new Error("phase");
    expect(mine.myGuess).toBe(author);
    expect("myGuess" in theirs).toBe(false);
  });
});

describe("REVEAL — exactly one author becomes public", () => {
  it("the revealed author is the player who actually wrote it", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = step(room, deps);           // GUESSING
    const round = currentRound(live)!;
    const trueAuthor = authorOf(live, round.answerId)!;
    live = step(live, deps);               // REVEAL
    expect(live.phase).toBe("REVEAL");
    for (const id of ids) {
      const view = viewForPlayer(live, id);
      if (view.phase !== "REVEAL") throw new Error("expected REVEAL");
      expect(view.authorId).toBe(trueAuthor);
    }
  });

  it("no OTHER answer's author leaks with it", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = step(room, deps);
    const revealedId = currentRound(live)!.answerId;
    live = step(live, deps);
    const revealedText =
      live.entries[authorOf(live, revealedId)!]![currentRound(live)!.questionIndex]!.text;
    for (const id of ids) {
      const { json } = overTheWire(snapshotForPlayer(live, id, 0));
      for (let p = 0; p < PLAYER_COUNT; p++) {
        for (let q = 0; q < QUESTIONS; q++) {
          const t = secretText(p, q);
          if (t !== revealedText) expect(json).not.toContain(t);
        }
      }
    }
  });

  it("awarded carries every present player, zeros included", async () => {
    const { room, deps, ids } = await buildRoom();
    let live = step(room, deps);
    live = step(live, deps);
    const view = viewForPlayer(live, ids[0]!);
    if (view.phase !== "REVEAL") throw new Error("expected REVEAL");
    expect(view.awarded.map((a) => a.playerId).sort()).toEqual([...ids].sort());
  });
});

describe("STANDINGS — scores only, with server-computed movement", () => {
  it("projects a dense rank and a movement delta per player", async () => {
    const { room, deps, ids } = await buildRoom({ standingsEvery: 1 });
    let live = step(room, deps);      // GUESSING
    live = step(live, deps);          // REVEAL
    live = step(live, deps);          // STANDINGS
    expect(live.phase).toBe("STANDINGS");
    const view = viewForPlayer(live, ids[0]!);
    if (view.phase !== "STANDINGS") throw new Error("expected STANDINGS");
    expect(view.lines).toHaveLength(PLAYER_COUNT);
    for (const line of view.lines) {
      expect(typeof line.rank).toBe("number");
      expect(typeof line.delta).toBe("number");
    }
    // Highest score first.
    const scores = view.lines.map((l) => l.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("carries no answer text and no authorship", async () => {
    const { room, deps, ids } = await buildRoom({ standingsEvery: 1 });
    let live = step(room, deps);
    live = step(live, deps);
    live = step(live, deps);
    for (const id of ids) {
      expectAbsent(snapshotForPlayer(live, id, 0), {
        keys: ["authorId", "answer", "entries"],
        strings: foreignTexts(-1),
      });
    }
  });
});

describe("structural guarantees that hold in every phase", () => {
  it("the private store never appears in any snapshot, in any phase", async () => {
    const { room, deps, ids } = await buildRoom({ standingsEvery: 2 });
    let live = room;
    const phasesSeen = new Set<string>();
    for (let guard = 0; guard < 14 && live.phase !== "FINALE"; guard++) {
      phasesSeen.add(live.phase);
      for (const id of ids) {
        expectAbsent(snapshotForPlayer(live, id, 0), {
          keys: ["entries", "handedIn0", "stagedCount", "sessions", "prevRanks", "tokenHash"],
        });
      }
      live = step(live, deps);
    }
    // Proof the walk actually visited the interesting phases.
    expect(phasesSeen.has("ANSWERING")).toBe(true);
    expect(phasesSeen.has("GUESSING")).toBe(true);
    expect(phasesSeen.has("REVEAL")).toBe(true);
  });

  it("a reader who is not seated gets a view rather than a throw", async () => {
    const { room } = await buildRoom();
    const view = viewForPlayer(room, "nobody");
    expect(view.phase).toBe("ANSWERING");
    if (view.phase !== "ANSWERING") return;
    expect(view.myAnswers).toEqual({});
  });

  it("a voided answer under scrutiny falls back to the contentless splash",
    async () => {
      const { room, deps, ids } = await buildRoom();
      const live = step(room, deps);
      expect(live.phase).toBe("GUESSING");
      const round = currentRound(live)!;
      const author = authorOf(live, round.answerId)!;
      // Void it underneath the live phase without moving the phase on.
      const voided = structuredClone(live);
      delete voided.entries[author];
      const view = viewForPlayer(voided, ids.find((id) => id !== author)!);
      // Never ROUND_END-style bulk disclosure: the safe direction is a splash.
      expect(view.phase).toBe("INTRO");
    });
});
