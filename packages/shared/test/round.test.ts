import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  MIN_PLAYERS,
  SETTINGS_BOUNDS,
  type Settings,
} from "../src/protocol";
import {
  INTRO_MS,
  POINTS_CORRECT_GUESS,
  POINTS_FOOLED_GUESSER,
  PHASE_MS,
  STANDINGS_MS,
  advance,
  applyRoundMessage,
  authorOf,
  currentRound,
  effectiveRoundCount,
  handlePlayerLeft,
  pickQuestions,
  ranksFor,
  resolveIfEveryoneReady,
} from "../src/round";
import { applyEvent, createRoom, type EventDeps, type InternalRoom } from "../src/state";

/* ------------------------------------------------------------------ harness */

/** Deterministic deps. `random` cycles a supplied sequence so a test can steer
    every pick; the default walks 0, 0.5, 0.25... which is varied but fixed. */
function makeDeps(sequence?: number[]): EventDeps & { clock: { t: number } } {
  let i = 0;
  let n = 0;
  const clock = { t: 1_000_000 };
  const seq = sequence ?? [0, 0.5, 0.25, 0.75, 0.1, 0.9, 0.4, 0.6];
  return {
    newId: () => `a${++i}`,
    newToken: () => `tok${++n}`,
    now: () => clock.t,
    random: () => seq[(i + n++) % seq.length]!,
    clock,
  };
}

async function lobby(playerCount: number, settings?: Partial<Settings>) {
  const deps = makeDeps();
  let room = createRoom("TEST");
  for (let i = 1; i <= playerCount; i++) {
    const r = await applyEvent(room, "", { v: 1, t: "join", name: `P${i}`, emoji: "🦊" }, deps);
    if (!r.ok) throw new Error("join failed");
    room = r.room;
  }
  room.settings = { ...structuredClone(DEFAULT_SETTINGS), ...settings };
  return { room, deps, ids: room.players.map((p) => p.id) };
}

/** Push the clock past the current deadline and run one transition. */
function expire(room: InternalRoom, deps: ReturnType<typeof makeDeps>): InternalRoom {
  deps.clock.t = (room.deadline ?? deps.clock.t) + 1;
  return advance(room, deps).room;
}

/** Everyone answers every question, then hands in. */
function answerAll(room: InternalRoom, deps: EventDeps, text = (p: string, q: number) => `${p}-q${q}`) {
  let next = room;
  for (const player of next.players) {
    for (let q = 0; q < next.questions.length; q++) {
      const r = applyRoundMessage(
        next, player.id, { v: 1, t: "submitEntry", questionIndex: q, text: text(player.id, q) }, deps,
      );
      if (!r.ok) throw new Error(`submitEntry rejected: ${r.code}`);
      next = r.room;
    }
  }
  return next;
}

function handInAll(room: InternalRoom, deps: EventDeps) {
  let next = room;
  for (const player of next.players) {
    const r = applyRoundMessage(next, player.id, { v: 1, t: "handIn" }, deps);
    if (!r.ok) throw new Error(`handIn rejected: ${r.code}`);
    next = r.room;
  }
  return next;
}

/** A room sitting in GUESSING on its first round. */
async function intoGuessing(playerCount: number, settings?: Partial<Settings>) {
  const { room, deps, ids } = await lobby(playerCount, settings);
  const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
  if (!started.ok) throw new Error("startGame failed");
  let live = expire(started.room, deps);        // INTRO -> ANSWERING
  live = answerAll(live, deps);
  live = handInAll(live, deps);                 // resolves early into GUESSING
  return { room: live, deps, ids };
}

/* -------------------------------------------------------------------- tests */

describe("phase timings", () => {
  it("every phase either has a duration or is deliberately untimed", () => {
    const room = createRoom("TEST");
    room.settings = structuredClone(DEFAULT_SETTINGS);
    expect(PHASE_MS.LOBBY(room)).toBeNull();
    expect(PHASE_MS.FINALE(room)).toBeNull();
    expect(PHASE_MS.INTRO(room)).toBe(INTRO_MS);
    expect(PHASE_MS.STANDINGS(room)).toBe(STANDINGS_MS);
    expect(PHASE_MS.ANSWERING(room)).toBe(DEFAULT_SETTINGS.answerSec * 1000);
    expect(PHASE_MS.GUESSING(room)).toBe(DEFAULT_SETTINGS.guessSec * 1000);
    expect(PHASE_MS.REVEAL(room)).toBe(DEFAULT_SETTINGS.revealSec * 1000);
  });

  it("the three timed dials read from settings, not from constants", () => {
    const room = createRoom("TEST");
    room.settings = { ...DEFAULT_SETTINGS, answerSec: 45, guessSec: 11, revealSec: 4 };
    expect(PHASE_MS.ANSWERING(room)).toBe(45_000);
    expect(PHASE_MS.GUESSING(room)).toBe(11_000);
    expect(PHASE_MS.REVEAL(room)).toBe(4_000);
  });
});

describe("starting a game", () => {
  it("draws distinct questions and puts everyone on zero", async () => {
    const { room, deps, ids } = await lobby(4, { questions: 6 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const g = started.room;
    expect(g.phase).toBe("INTRO");
    expect(g.questions).toHaveLength(6);
    expect(new Set(g.questions).size).toBe(6);
    for (const id of ids) {
      expect(g.scores[id]).toBe(0);
      expect(g.stagedCount[id]).toBe(0);
      expect(g.prevRanks[id]).toBe(1);
    }
  });

  it("caps the question count at what the enabled packs actually hold", async () => {
    // The smallest single pack has 15 prompts; asking for 20 must not repeat one.
    const { room, deps } = await lobby(3, { questions: 20, packs: ["spicy"] });
    const questions = pickQuestions(room, deps);
    expect(questions.length).toBe(15);
    expect(new Set(questions).size).toBe(15);
  });

  it("INTRO runs into ANSWERING, not into a round", async () => {
    const { room, deps, ids } = await lobby(3);
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    const next = expire(started.room, deps);
    expect(next.phase).toBe("ANSWERING");
    expect(next.rounds).toHaveLength(0);
  });
});

describe("the answering phase", () => {
  it("submitEntry is an upsert that keeps the same answerId", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);

    const first = applyRoundMessage(
      live, ids[0]!, { v: 1, t: "submitEntry", questionIndex: 0, text: "first" }, deps);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const idAfterFirst = first.room.entries[ids[0]!]![0]!.answerId;

    const second = applyRoundMessage(
      first.room, ids[0]!, { v: 1, t: "submitEntry", questionIndex: 0, text: "edited" }, deps);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.room.entries[ids[0]!]![0]!.text).toBe("edited");
    expect(second.room.entries[ids[0]!]![0]!.answerId).toBe(idAfterFirst);
    live = second.room;
  });

  it("rejects a question index past the game's question count", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    const live = expire(started.room, deps);
    const r = applyRoundMessage(
      live, ids[0]!, { v: 1, t: "submitEntry", questionIndex: 5, text: "nope" }, deps);
    expect(r).toMatchObject({ ok: false, code: "BAD_MESSAGE" });
  });

  it("everyone handing in resolves the phase early", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    live = answerAll(live, deps);
    expect(live.phase).toBe("ANSWERING");
    live = handInAll(live, deps);
    expect(live.phase).toBe("GUESSING");
  });

  it("a player may hand in with questions left blank", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 3 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    // P1 answers only question 0, then hands in. Everyone else answers all.
    const partial = applyRoundMessage(
      live, ids[0]!, { v: 1, t: "submitEntry", questionIndex: 0, text: "only one" }, deps);
    if (!partial.ok) return;
    live = partial.room;
    for (const id of ids.slice(1)) {
      for (let q = 0; q < 3; q++) {
        const r = applyRoundMessage(
          live, id, { v: 1, t: "submitEntry", questionIndex: q, text: `${id}-${q}` }, deps);
        if (!r.ok) return;
        live = r.room;
      }
    }
    live = handInAll(live, deps);
    expect(live.phase).toBe("GUESSING");
    // Their one answer is in the pool; the two they skipped are not.
    expect(Object.keys(live.entries[ids[0]!]!)).toEqual(["0"]);
  });

  it("handIn is idempotent", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 1 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    const live = expire(started.room, deps);
    const once = applyRoundMessage(live, ids[0]!, { v: 1, t: "handIn" }, deps);
    if (!once.ok) return;
    const twice = applyRoundMessage(once.room, ids[0]!, { v: 1, t: "handIn" }, deps);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.room.handedIn[ids[0]!]).toBe(true);
  });

  it("the clock running out resolves the phase with whatever was written", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    live = answerAll(live, deps);       // written, but nobody hands in
    live = expire(live, deps);
    expect(live.phase).toBe("GUESSING");
  });

  it("a room where nobody wrote anything goes straight to the finale", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    live = expire(live, deps);
    expect(live.phase).toBe("FINALE");
  });
});

describe("round selection", () => {
  it("a round is one question and one answer to it", async () => {
    const { room } = await intoGuessing(4, { questions: 3, rounds: 6 });
    const round = currentRound(room)!;
    expect(round.index).toBe(1);
    expect(round.questionIndex).toBeGreaterThanOrEqual(0);
    expect(round.questionIndex).toBeLessThan(3);
    expect(typeof round.answerId).toBe("string");
    expect(authorOf(room, round.answerId)).toBeDefined();
  });

  it("never uses the same question twice in a row", async () => {
    // 5 players x 4 questions = a 20-answer pool, played out over 14 rounds.
    let { room, deps } = await intoGuessing(5, { questions: 4, rounds: 14, standingsEvery: 0 });
    const seen: number[] = [currentRound(room)!.questionIndex];
    while (room.phase !== "FINALE") {
      room = expire(room, deps);                       // GUESSING -> REVEAL
      if (room.phase === "FINALE") break;
      room = expire(room, deps);                       // REVEAL -> next GUESSING
      const round = currentRound(room);
      if (room.phase === "GUESSING" && round !== undefined) seen.push(round.questionIndex);
    }
    expect(seen.length).toBeGreaterThan(5);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i], `round ${i + 1} repeated question ${seen[i]}`).not.toBe(seen[i - 1]);
    }
  });

  it("never puts the same answer to the room twice", async () => {
    let { room, deps } = await intoGuessing(4, { questions: 3, rounds: 12, standingsEvery: 0 });
    while (room.phase !== "FINALE") room = expire(room, deps);
    const used = room.rounds.map((r) => r.answerId);
    expect(new Set(used).size).toBe(used.length);
  });

  it("spreads the spotlight: nobody is staged more than one time more than anyone else",
    async () => {
      let { room, deps } = await intoGuessing(5, { questions: 4, rounds: 16, standingsEvery: 0 });
      while (room.phase !== "FINALE") room = expire(room, deps);
      const counts = room.players.map((p) => room.stagedCount[p.id] ?? 0);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });

  it("relaxes the no-repeat rule when there is only one question", async () => {
    // Every answer belongs to question 0, so the rule cannot hold and must
    // yield rather than ending the game early.
    let { room, deps } = await intoGuessing(4, { questions: 1, rounds: 4, standingsEvery: 0 });
    while (room.phase !== "FINALE") room = expire(room, deps);
    expect(room.rounds).toHaveLength(4);
    expect(room.rounds.every((r) => r.questionIndex === 0)).toBe(true);
    expect(new Set(room.rounds.map((r) => r.answerId)).size).toBe(4);
  });

  it("stops when the pool runs out, however many rounds were asked for", async () => {
    // 3 players x 1 question = 3 answers, but the host asked for 10 rounds.
    let { room, deps } = await intoGuessing(3, { questions: 1, rounds: 10, standingsEvery: 0 });
    while (room.phase !== "FINALE") room = expire(room, deps);
    expect(room.rounds).toHaveLength(3);
  });

  it("effectiveRoundCount never promises a round the pool cannot fill", async () => {
    const { room } = await intoGuessing(3, { questions: 1, rounds: 10 });
    // One round is live and two answers remain.
    expect(effectiveRoundCount(room)).toBe(3);
  });
});

describe("scoring", () => {
  it("+2 for naming the author, +1 to the author per guesser fooled", async () => {
    const { room, deps, ids } = await intoGuessing(4, { questions: 2, rounds: 4 });
    const round = currentRound(room)!;
    const author = authorOf(room, round.answerId)!;
    const guessers = ids.filter((id) => id !== author);

    let live = room;
    // One guesser is right, the rest are wrong.
    const right = applyRoundMessage(
      live, guessers[0]!, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: author }, deps);
    if (!right.ok) return;
    live = right.room;
    for (const g of guessers.slice(1)) {
      const wrongTarget = guessers.find((x) => x !== g && x !== author)!;
      const r = applyRoundMessage(
        live, g, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: wrongTarget }, deps);
      if (!r.ok) return;
      live = r.room;
    }
    expect(live.phase).toBe("REVEAL");
    expect(live.scores[guessers[0]!]).toBe(POINTS_CORRECT_GUESS);
    expect(live.scores[author]).toBe(POINTS_FOOLED_GUESSER * (guessers.length - 1));
  });

  it("awarded lists every present player, zeros included", async () => {
    const { room, deps, ids } = await intoGuessing(4, { questions: 2, rounds: 4 });
    const live = expire(room, deps);   // nobody guessed; GUESSING -> REVEAL
    expect(live.phase).toBe("REVEAL");
    const awarded = currentRound(live)!.awarded;
    expect(awarded.map((a) => a.playerId).sort()).toEqual([...ids].sort());
    expect(awarded.every((a) => a.points === 0)).toBe(true);
  });

  it("a player who never guesses scores nothing and pays the author nothing", async () => {
    const { room, deps } = await intoGuessing(4, { questions: 2, rounds: 4 });
    const round = currentRound(room)!;
    const author = authorOf(room, round.answerId)!;
    const live = expire(room, deps);
    expect(live.scores[author]).toBe(0);
  });
});

describe("guess rejection", () => {
  it("rejects the author, a repeat guess, a stale answer and self-accusation",
    async () => {
      const { room, deps, ids } = await intoGuessing(4, { questions: 2, rounds: 4 });
      const round = currentRound(room)!;
      const author = authorOf(room, round.answerId)!;
      const guesser = ids.find((id) => id !== author)!;

      expect(applyRoundMessage(
        room, author, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: guesser }, deps,
      )).toMatchObject({ ok: false, code: "IS_AUTHOR" });

      expect(applyRoundMessage(
        room, guesser, { v: 1, t: "submitGuess", answerId: "nonsense", playerId: author }, deps,
      )).toMatchObject({ ok: false, code: "STALE_ANSWER" });

      expect(applyRoundMessage(
        room, guesser, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: guesser }, deps,
      )).toMatchObject({ ok: false, code: "BAD_MESSAGE" });

      const first = applyRoundMessage(
        room, guesser, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: author }, deps);
      if (!first.ok) return;
      expect(applyRoundMessage(
        first.room, guesser, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: author }, deps,
      )).toMatchObject({ ok: false, code: "ALREADY_GUESSED" });
    });

  it("rejects an entry once the answering phase is over", async () => {
    const { room, deps, ids } = await intoGuessing(3, { questions: 2, rounds: 4 });
    expect(applyRoundMessage(
      room, ids[0]!, { v: 1, t: "submitEntry", questionIndex: 0, text: "late" }, deps,
    )).toMatchObject({ ok: false, code: "WRONG_PHASE" });
  });
});

describe("the standings beat", () => {
  it("fires every N rounds and not after the last one", async () => {
    let { room, deps } = await intoGuessing(4, { questions: 3, rounds: 6, standingsEvery: 2 });
    const phases: string[] = [];
    while (room.phase !== "FINALE") {
      room = expire(room, deps);
      phases.push(room.phase);
    }
    // Two standings beats: after rounds 2 and 4. Not after round 6 — the
    // finale is the standings, at greater length.
    expect(phases.filter((p) => p === "STANDINGS")).toHaveLength(2);
    expect(phases[phases.length - 1]).toBe("FINALE");
  });

  it("standingsEvery 0 turns the beat off entirely", async () => {
    let { room, deps } = await intoGuessing(4, { questions: 3, rounds: 6, standingsEvery: 0 });
    const phases: string[] = [];
    while (room.phase !== "FINALE") {
      room = expire(room, deps);
      phases.push(room.phase);
    }
    expect(phases).not.toContain("STANDINGS");
  });

  it("ranks are dense, so a tie reads as a tie", async () => {
    const { room } = await intoGuessing(4, { questions: 2, rounds: 4 });
    const live = structuredClone(room);
    const [a, b, c, d] = live.players.map((p) => p.id);
    live.scores = { [a!]: 12, [b!]: 12, [c!]: 8, [d!]: 2 };
    const ranks = ranksFor(live);
    expect(ranks[a!]).toBe(1);
    expect(ranks[b!]).toBe(1);
    expect(ranks[c!]).toBe(3);
    expect(ranks[d!]).toBe(4);
  });

  it("leaving the beat rebases the ranks movement is measured against", async () => {
    let { room, deps } = await intoGuessing(4, { questions: 3, rounds: 6, standingsEvery: 1 });
    room = expire(room, deps);            // GUESSING -> REVEAL
    room = expire(room, deps);            // REVEAL -> STANDINGS
    expect(room.phase).toBe("STANDINGS");
    const before = structuredClone(room.prevRanks);
    room = expire(room, deps);            // STANDINGS -> next GUESSING
    expect(room.prevRanks).toEqual(ranksFor(room));
    expect(room.prevRanks).not.toBe(before);
  });
});

describe("leavers", () => {
  it("ends the game below the player floor", async () => {
    const { room, deps, ids } = await intoGuessing(3, { questions: 2, rounds: 6 });
    const left = await applyEvent(room, ids[0]!, { v: 1, t: "leave" }, deps);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.room.players).toHaveLength(MIN_PLAYERS - 1);
    expect(left.room.phase).toBe("FINALE");
  });

  it("voids every answer the leaver owned", async () => {
    const { room, deps, ids } = await intoGuessing(5, { questions: 3, rounds: 8 });
    const victim = ids[2]!;
    const owned = Object.values(room.entries[victim]!).map((e) => e.answerId);
    expect(owned.length).toBe(3);
    const left = await applyEvent(room, victim, { v: 1, t: "leave" }, deps);
    if (!left.ok) return;
    for (const answerId of owned) {
      expect(authorOf(left.room, answerId)).toBeUndefined();
    }
  });

  it("the staged author leaving ends that round rather than hanging it", async () => {
    const { room, deps } = await intoGuessing(5, { questions: 3, rounds: 8 });
    const round = currentRound(room)!;
    const author = authorOf(room, round.answerId)!;
    const left = await applyEvent(room, author, { v: 1, t: "leave" }, deps);
    if (!left.ok) return;
    // The room moved on — it is not still sitting on a voided answer.
    expect(left.room.phase === "GUESSING" || left.room.phase === "FINALE").toBe(true);
    if (left.room.phase === "GUESSING") {
      expect(currentRound(left.room)!.answerId).not.toBe(round.answerId);
    }
  });

  it("an in-flight REVEAL is left to finish", async () => {
    const { room, deps } = await intoGuessing(5, { questions: 3, rounds: 8 });
    const revealing = expire(room, deps);
    expect(revealing.phase).toBe("REVEAL");
    const author = authorOf(revealing, currentRound(revealing)!.answerId)!;
    const left = await applyEvent(revealing, author, { v: 1, t: "leave" }, deps);
    if (!left.ok) return;
    expect(left.room.phase).toBe("REVEAL");
  });

  it("a guesser leaving can resolve the round early", async () => {
    const { room, deps, ids } = await intoGuessing(4, { questions: 2, rounds: 6 });
    const round = currentRound(room)!;
    const author = authorOf(room, round.answerId)!;
    const guessers = ids.filter((id) => id !== author);
    let live = room;
    // All but one guesser votes; the last one walks out.
    for (const g of guessers.slice(0, -1)) {
      const r = applyRoundMessage(
        live, g, { v: 1, t: "submitGuess", answerId: round.answerId, playerId: author }, deps);
      if (!r.ok) return;
      live = r.room;
    }
    expect(live.phase).toBe("GUESSING");
    const left = await applyEvent(live, guessers[guessers.length - 1]!, { v: 1, t: "leave" }, deps);
    if (!left.ok) return;
    expect(left.room.phase).not.toBe("GUESSING");
  });

  it("a leaver during ANSWERING no longer blocks the hand-in", async () => {
    const { room, deps, ids } = await lobby(4, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    live = answerAll(live, deps);
    // Everyone hands in except the last player, who then leaves.
    for (const id of ids.slice(0, -1)) {
      const r = applyRoundMessage(live, id, { v: 1, t: "handIn" }, deps);
      if (!r.ok) return;
      live = r.room;
    }
    expect(live.phase).toBe("ANSWERING");
    const left = await applyEvent(live, ids[ids.length - 1]!, { v: 1, t: "leave" }, deps);
    if (!left.ok) return;
    expect(left.room.phase).toBe("GUESSING");
  });
});

describe("a locked phone is not a leave", () => {
  it("resolves ANSWERING once every connected player has handed in", async () => {
    const { room, deps, ids } = await lobby(4, { questions: 2 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    live = answerAll(live, deps);
    const connected = new Set(ids.slice(0, 3));   // one phone is dark
    for (const id of ids.slice(0, 3)) {
      const r = applyRoundMessage(live, id, { v: 1, t: "handIn" }, deps, connected);
      if (!r.ok) return;
      live = r.room;
    }
    expect(live.phase).toBe("GUESSING");
  });

  it("the disconnected player is still staged, still scores and is still present",
    async () => {
      const { room, deps, ids } = await lobby(4, { questions: 2 });
      const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
      if (!started.ok) return;
      let live = expire(started.room, deps);
      live = answerAll(live, deps);
      const absent = ids[3]!;
      const connected = new Set(ids.slice(0, 3));
      for (const id of ids.slice(0, 3)) {
        const r = applyRoundMessage(live, id, { v: 1, t: "handIn" }, deps, connected);
        if (!r.ok) return;
        live = r.room;
      }
      // Their answers are in the pool and they are still on the roster.
      expect(live.players.some((p) => p.id === absent)).toBe(true);
      expect(Object.keys(live.entries[absent]!)).toHaveLength(2);
      expect(live.scores[absent]).toBe(0);
    });

  it("an empty connected set resolves nothing", async () => {
    const { room, deps, ids } = await lobby(3, { questions: 1 });
    const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
    if (!started.ok) return;
    let live = expire(started.room, deps);
    live = answerAll(live, deps);
    live = handInAll(live, deps);
    // Already in GUESSING; a dropped-to-zero room must not resolve on behalf
    // of nobody.
    const result = resolveIfEveryoneReady(live, deps, new Set());
    expect(result.changed).toBe(false);
  });

  it("resolveIfEveryoneReady closes ANSWERING when the last straggler drops",
    async () => {
      const { room, deps, ids } = await lobby(4, { questions: 1 });
      const started = await applyEvent(room, ids[0]!, { v: 1, t: "startGame" }, deps);
      if (!started.ok) return;
      let live = expire(started.room, deps);
      live = answerAll(live, deps);
      for (const id of ids.slice(0, 3)) {
        const r = applyRoundMessage(live, id, { v: 1, t: "handIn" }, deps);
        if (!r.ok) return;
        live = r.room;
      }
      expect(live.phase).toBe("ANSWERING");
      const result = resolveIfEveryoneReady(live, deps, new Set(ids.slice(0, 3)));
      expect(result.changed).toBe(true);
      expect(result.room.phase).toBe("GUESSING");
    });
});

describe("advance is one step at a time and re-bases its clock", () => {
  it("moves at most one phase per call", async () => {
    const { room, deps } = await intoGuessing(4, { questions: 2, rounds: 6 });
    deps.clock.t = (room.deadline ?? 0) + 10_000_000;
    const once = advance(room, deps);
    expect(once.changed).toBe(true);
    expect(once.room.phase).toBe("REVEAL");
    // The new deadline is off the CURRENT clock, not the one that was missed.
    expect(once.room.deadline).toBe(deps.clock.t + DEFAULT_SETTINGS.revealSec * 1000);
  });

  it("does nothing before the deadline", async () => {
    const { room, deps } = await intoGuessing(4, { questions: 2, rounds: 6 });
    const result = advance(room, deps);
    expect(result.changed).toBe(false);
  });
});

describe("settings bounds", () => {
  it("the engine's dials and the published bounds agree", () => {
    expect(DEFAULT_SETTINGS.questions).toBeGreaterThanOrEqual(SETTINGS_BOUNDS.questions.min);
    expect(DEFAULT_SETTINGS.questions).toBeLessThanOrEqual(SETTINGS_BOUNDS.questions.max);
    expect(DEFAULT_SETTINGS.rounds).toBeLessThanOrEqual(SETTINGS_BOUNDS.rounds.max);
    expect(DEFAULT_SETTINGS.answerSec).toBeLessThanOrEqual(SETTINGS_BOUNDS.answerSec.max);
    expect(DEFAULT_SETTINGS.answerSec).toBeGreaterThanOrEqual(SETTINGS_BOUNDS.answerSec.min);
    expect(DEFAULT_SETTINGS.revealSec).toBeGreaterThanOrEqual(SETTINGS_BOUNDS.revealSec.min);
    expect(DEFAULT_SETTINGS.standingsEvery).toBeLessThanOrEqual(SETTINGS_BOUNDS.standingsEvery.max);
  });
});
