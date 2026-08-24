import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "../content/scenarios";
import type { ClientMessage, Settings } from "../src/protocol";
import {
  DELIBERATION_MS,
  INTRO_MS,
  MAX_QUESTIONS_PER_DETECTIVE,
  REVEAL_MS,
  advance,
  currentRound,
  interrogationPosition,
} from "../src/round";
import type { ApplyResult, EventDeps, InternalRoom } from "../src/state";
import { applyEvent, createRoom } from "../src/state";

interface TestDeps extends EventDeps {
  /** Mutable clock, in epoch ms. */
  at: number;
  /** Queue consumed by `random()`; falls back to 0 when empty. */
  randoms: number[];
}

function makeDeps(): TestDeps {
  let ids = 0;
  let tokens = 0;
  const deps: TestDeps = {
    at: 1_000_000,
    randoms: [],
    newId: () => `p${++ids}`,
    newToken: () => `tok${++tokens}`,
    now: () => deps.at,
    random: () => (deps.randoms.length > 0 ? deps.randoms.shift()! : 0),
  };
  return deps;
}

function ok(result: ApplyResult): InternalRoom {
  if (!result.ok) throw new Error(`unexpected rejection: ${result.code}`);
  return result.room;
}

async function lobby(n: number, patch: Partial<Settings> = {}) {
  const deps = makeDeps();
  let room = createRoom("TEST");
  for (let i = 1; i <= n; i++) {
    room = ok(await applyEvent(room, "", { v: 1, t: "join", name: `P${i}`, emoji: "🦊" }, deps));
  }
  if (Object.keys(patch).length > 0) {
    room = ok(await applyEvent(room, "p1", { v: 1, t: "updateSettings", patch }, deps));
  }
  return { room, deps };
}

/** Push the clock forward by `ms` and let `advance` settle (the caller loops). */
function elapse(room: InternalRoom, deps: TestDeps, ms: number): InternalRoom {
  deps.at += ms;
  let cur = room;
  for (let i = 0; i < 50; i++) {
    const step = advance(cur, deps);
    if (!step.changed) return step.room;
    cur = step.room;
  }
  throw new Error("advance did not settle");
}

function send(room: InternalRoom, senderId: string, msg: ClientMessage, deps: TestDeps) {
  return applyEvent(room, senderId, msg, deps);
}

const round = (room: InternalRoom) => currentRound(room)!;
const suspects = (room: InternalRoom) => round(room).suspectIds;

async function started(n: number, patch: Partial<Settings> = {}) {
  const { room, deps } = await lobby(n, patch);
  return { room: ok(await send(room, "p1", { v: 1, t: "startGame" }, deps)), deps };
}

/** INTRO -> PLANNING -> INTERROGATION. */
async function toInterrogation(n: number, patch: Partial<Settings> = {}) {
  const s = await started(n, patch);
  let room = elapse(s.room, s.deps, INTRO_MS);
  room = elapse(room, s.deps, room.settings.planningSec * 1000);
  return { room, deps: s.deps };
}

/** Answer every remaining question with both suspects until the phase moves on. */
async function answerEverything(room: InternalRoom, deps: TestDeps): Promise<InternalRoom> {
  let cur = room;
  for (let i = 0; i < 100 && cur.phase === "INTERROGATION"; i++) {
    const pos = interrogationPosition(cur, round(cur));
    if (pos.onTheClock === null) break;
    cur = ok(await send(cur, pos.onTheClock, { v: 1, t: "submitAnswer", text: `a${i}` }, deps));
  }
  return cur;
}

describe("round loop — happy path", () => {
  it("plays a whole game from startGame to FINALE", async () => {
    const { room: start, deps } = await started(4, { rounds: 1, questionCount: 3, answerSec: 10, planningSec: 15 });

    expect(start.phase).toBe("INTRO");
    expect(start.deadline).toBe(deps.at + INTRO_MS);
    expect(start.rounds).toHaveLength(1);
    expect(round(start).index).toBe(1);
    expect(suspects(start)).toEqual(["p1", "p2"]);
    expect(round(start).scenarioId).toBe(SCENARIOS[0]!.id);
    expect(start.scores).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });

    const planning = elapse(start, deps, INTRO_MS);
    expect(planning.phase).toBe("PLANNING");
    expect(planning.deadline).toBe(deps.at + 15_000);

    // Suspects plan privately; detectives cannot.
    const chatted = ok(await send(planning, "p1", { v: 1, t: "suspectChat", text: "we were at the car wash" }, deps));
    expect(round(chatted).chat).toEqual([{ playerId: "p1", text: "we were at the car wash" }]);
    expect(await send(chatted, "p3", { v: 1, t: "suspectChat", text: "hi" }, deps))
      .toMatchObject({ ok: false, code: "NOT_SUSPECT" });

    const interrogation = elapse(chatted, deps, 15_000);
    expect(interrogation.phase).toBe("INTERROGATION");
    expect(round(interrogation).questions).toHaveLength(1);
    expect(interrogation.deadline).toBe(deps.at + 10_000);
    expect(interrogationPosition(interrogation, round(interrogation)))
      .toEqual({ questionIndex: 0, onTheClock: "p1" });

    // A detective's question lands in the queue and is used for the next slot.
    const queued = ok(await send(interrogation, "p3", { v: 1, t: "submitQuestion", text: "what colour was the foam?" }, deps));
    expect(round(queued).questions[1]).toEqual({ text: "what colour was the foam?", askedBy: "p3" });
    expect(round(queued).questionsAsked["p3"]).toBe(1);

    const a1 = ok(await send(queued, "p1", { v: 1, t: "submitAnswer", text: "pink" }, deps));
    expect(interrogationPosition(a1, round(a1))).toEqual({ questionIndex: 0, onTheClock: "p2" });
    const a2 = ok(await send(a1, "p2", { v: 1, t: "submitAnswer", text: "pink too" }, deps));
    expect(interrogationPosition(a2, round(a2))).toEqual({ questionIndex: 1, onTheClock: "p1" });
    expect(round(a2).answers[0]).toEqual({ p1: "pink", p2: "pink too" });

    const answered = await answerEverything(a2, deps);
    expect(answered.phase).toBe("DELIBERATION");
    expect(answered.deadline).toBe(deps.at + DELIBERATION_MS);
    expect(Object.keys(round(answered).answers)).toHaveLength(3);

    const v1 = ok(await send(answered, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(v1.phase).toBe("DELIBERATION");
    // Last detective's vote resolves deliberation early.
    const reveal = ok(await send(v1, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(reveal.phase).toBe("REVEAL");
    expect(reveal.deadline).toBe(deps.at + REVEAL_MS);
    expect(round(reveal).verdict).toBe("consistent");
    expect(round(reveal).unanimous).toBe(true);
    expect(reveal.scores).toEqual({ p1: 3, p2: 3, p3: 2, p4: 2 });

    const finale = elapse(reveal, deps, REVEAL_MS);
    expect(finale.phase).toBe("FINALE");
    expect(finale.deadline).toBeNull();
    expect(finale.rounds).toHaveLength(1);
  });

  it("runs multiple rounds and only reaches FINALE after settings.rounds", async () => {
    const { room, deps } = await started(4, { rounds: 2, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = room;
    for (let r = 1; r <= 2; r++) {
      expect(cur.phase).toBe("INTRO");
      expect(round(cur).index).toBe(r);
      cur = elapse(cur, deps, INTRO_MS);
      cur = elapse(cur, deps, 15_000);
      cur = await answerEverything(cur, deps);
      expect(cur.phase).toBe("DELIBERATION");
      cur = elapse(cur, deps, DELIBERATION_MS);
      expect(cur.phase).toBe("REVEAL");
      cur = elapse(cur, deps, REVEAL_MS);
    }
    expect(cur.phase).toBe("FINALE");
    expect(cur.rounds).toHaveLength(2);
  });

  it("advance is pure and a no-op before the deadline", async () => {
    const { room, deps } = await started(3);
    const before = structuredClone(room);
    const step = advance(room, deps);
    expect(step.changed).toBe(false);
    expect(step.room).toBe(room);
    deps.at += INTRO_MS;
    const moved = advance(room, deps);
    expect(moved.changed).toBe(true);
    expect(room).toEqual(before);
  });

  it("advance after a long-missed deadline moves one phase and re-bases the clock", async () => {
    const { room, deps } = await started(3, { planningSec: 30 });
    deps.at += 3_600_000; // the DO slept for an hour
    const first = advance(room, deps);
    expect(first.changed).toBe(true);
    expect(first.room.phase).toBe("PLANNING");
    expect(first.room.deadline).toBe(deps.at + 30_000);
    // Safe to call repeatedly: the loop terminates instead of racing to FINALE.
    const second = advance(first.room, deps);
    expect(second.changed).toBe(false);
    expect(second.room.phase).toBe("PLANNING");
  });
});

describe("interrogation", () => {
  it("times out an unanswered suspect with an empty answer and moves on", async () => {
    const { room, deps } = await toInterrogation(3, { questionCount: 3, answerSec: 10, planningSec: 15 });
    const timedOut = elapse(room, deps, 10_000);
    expect(round(timedOut).answers[0]).toEqual({ p1: "" });
    expect(interrogationPosition(timedOut, round(timedOut))).toEqual({ questionIndex: 0, onTheClock: "p2" });
    expect(timedOut.deadline).toBe(deps.at + 10_000);

    const both = elapse(timedOut, deps, 10_000);
    expect(round(both).answers[0]).toEqual({ p1: "", p2: "" });
    expect(interrogationPosition(both, round(both))).toEqual({ questionIndex: 1, onTheClock: "p1" });
  });

  it("times out the whole interrogation into DELIBERATION", async () => {
    const { room, deps } = await toInterrogation(3, { questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = room;
    for (let i = 0; i < 6; i++) cur = elapse(cur, deps, 10_000);
    expect(cur.phase).toBe("DELIBERATION");
    expect(Object.values(round(cur).answers).flatMap((slot) => Object.values(slot)))
      .toEqual(["", "", "", "", "", ""]);
  });

  it("falls back to scenario details when no detective asks, without reusing one", async () => {
    const { room, deps } = await toInterrogation(3, { questionCount: 4, answerSec: 10, planningSec: 15 });
    const done = await answerEverything(room, deps);
    const questions = round(done).questions;
    expect(questions).toHaveLength(4);
    expect(questions.every((q) => q.askedBy === null)).toBe(true);
    const details = scenarioById(round(done).scenarioId)!.en.details;
    expect(questions.every((q) => (details as readonly string[]).includes(q.text))).toBe(true);
    expect(new Set(questions.map((q) => q.text)).size).toBe(4);
  });

  it("caps a detective at 5 questions per round", async () => {
    const { room, deps } = await toInterrogation(3, { questionCount: 10, answerSec: 10, planningSec: 15 });
    let cur = room;
    for (let i = 0; i < MAX_QUESTIONS_PER_DETECTIVE; i++) {
      cur = ok(await send(cur, "p3", { v: 1, t: "submitQuestion", text: `q${i}` }, deps));
    }
    expect(round(cur).questionsAsked["p3"]).toBe(5);
    expect(await send(cur, "p3", { v: 1, t: "submitQuestion", text: "one more" }, deps))
      .toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("rate-limits once the queue fills the round's question budget", async () => {
    const { room, deps } = await toInterrogation(4, { questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = ok(await send(room, "p3", { v: 1, t: "submitQuestion", text: "q1" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "submitQuestion", text: "q2" }, deps));
    expect(round(cur).questions).toHaveLength(3);
    expect(await send(cur, "p3", { v: 1, t: "submitQuestion", text: "q3" }, deps))
      .toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});

describe("scoring", () => {
  async function toDeliberation(n: number, patch: Partial<Settings> = {}) {
    const { room, deps } = await toInterrogation(n, { questionCount: 3, answerSec: 10, planningSec: 15, ...patch });
    return { room: await answerEverything(room, deps), deps };
  }

  it("awards +2 to suspects on a consistent verdict and +1 more when unanimous", async () => {
    const { room, deps } = await toDeliberation(4);
    let cur = ok(await send(room, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(round(cur).unanimous).toBe(true);
    expect(cur.scores).toEqual({ p1: 3, p2: 3, p3: 2, p4: 2 });
    expect(round(cur).awarded).toEqual([
      { playerId: "p1", points: 3 },
      { playerId: "p2", points: 3 },
      { playerId: "p3", points: 2 },
      { playerId: "p4", points: 2 },
    ]);
  });

  it("awards nothing to suspects when busted, +2 to the majority detectives", async () => {
    const { room, deps } = await toDeliberation(5);
    let cur = ok(await send(room, "p3", { v: 1, t: "castVote", verdict: "busted" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "busted" }, deps));
    cur = ok(await send(cur, "p5", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(round(cur).verdict).toBe("busted");
    expect(round(cur).unanimous).toBe(false);
    expect(cur.scores).toEqual({ p1: 0, p2: 0, p3: 2, p4: 2, p5: 0 });
  });

  it("a tie counts as consistent — the suspects get the benefit of the doubt", async () => {
    const { room, deps } = await toDeliberation(4);
    let cur = ok(await send(room, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "busted" }, deps));
    expect(cur.phase).toBe("REVEAL");
    expect(round(cur).verdict).toBe("consistent");
    expect(round(cur).unanimous).toBe(false);
    // Suspects +2 (no unanimity bonus); only the consistent voter matched.
    expect(cur.scores).toEqual({ p1: 2, p2: 2, p3: 2, p4: 0 });
  });

  it("a detective who abstains scores nothing and does not block the timer", async () => {
    const { room, deps } = await toDeliberation(5);
    let cur = ok(await send(room, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(cur.phase).toBe("DELIBERATION"); // p5 has not voted
    cur = elapse(cur, deps, DELIBERATION_MS);
    expect(cur.phase).toBe("REVEAL");
    // Unanimity is measured over votes cast, so the abstention does not spoil it.
    expect(round(cur).unanimous).toBe(true);
    expect(cur.scores).toEqual({ p1: 3, p2: 3, p3: 2, p4: 2, p5: 0 });
  });

  it("nobody scores when every detective abstains", async () => {
    const { room, deps } = await toDeliberation(4);
    const cur = elapse(room, deps, DELIBERATION_MS);
    expect(cur.phase).toBe("REVEAL");
    expect(round(cur).verdict).toBe("consistent");
    expect(round(cur).unanimous).toBe(false);
    expect(cur.scores).toEqual({ p1: 2, p2: 2, p3: 0, p4: 0 });
  });
});

describe("suspect pair and scenario rotation", () => {
  it("never repeats a suspect until everyone has had a turn, then resets", async () => {
    const { room, deps } = await started(4, { rounds: 3, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = room;
    const pairs: string[][] = [];
    for (let r = 1; r <= 3; r++) {
      pairs.push([...suspects(cur)]);
      cur = elapse(cur, deps, INTRO_MS);
      cur = elapse(cur, deps, 15_000);
      cur = await answerEverything(cur, deps);
      cur = elapse(cur, deps, DELIBERATION_MS);
      cur = elapse(cur, deps, REVEAL_MS);
    }
    expect(pairs[0]).toEqual(["p1", "p2"]);
    expect(pairs[1]).toEqual(["p3", "p4"]); // fresh players preferred
    expect(pairs[2]).toEqual(["p1", "p2"]); // pool exhausted -> flags reset
    expect(cur.phase).toBe("FINALE");
  });

  it("resets the rotation when fewer than two fresh players remain", async () => {
    const { room, deps } = await started(5, { rounds: 3, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = room;
    const pairs: string[][] = [];
    for (let r = 1; r <= 3; r++) {
      pairs.push([...suspects(cur)]);
      cur = elapse(cur, deps, INTRO_MS);
      cur = elapse(cur, deps, 15_000);
      cur = await answerEverything(cur, deps);
      cur = elapse(cur, deps, DELIBERATION_MS);
      cur = elapse(cur, deps, REVEAL_MS);
    }
    expect(pairs[0]).toEqual(["p1", "p2"]);
    expect(pairs[1]).toEqual(["p3", "p4"]);
    // Only p5 was fresh, so the flags reset and the whole room is eligible again.
    expect(pairs[2]).toEqual(["p1", "p2"]);
  });

  it("uses deps.random for the pair", async () => {
    const { room, deps } = await lobby(4);
    deps.randoms = [0 /* scenario */, 0.99 /* first suspect */, 0.99 /* second suspect */];
    const started = ok(await send(room, "p1", { v: 1, t: "startGame" }, deps));
    expect(suspects(started)).toEqual(["p4", "p3"]);
  });

  it("never repeats a scenario while unused ones remain", async () => {
    const { room, deps } = await started(4, { rounds: 3, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = room;
    for (let r = 1; r <= 3; r++) {
      cur = elapse(cur, deps, INTRO_MS);
      cur = elapse(cur, deps, 15_000);
      cur = await answerEverything(cur, deps);
      cur = elapse(cur, deps, DELIBERATION_MS);
      cur = elapse(cur, deps, REVEAL_MS);
    }
    const ids = cur.rounds.map((r) => r.scenarioId);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual([SCENARIOS[0]!.id, SCENARIOS[1]!.id, SCENARIOS[2]!.id]);
  });
});

describe("players leaving mid-game", () => {
  it("ends the game when the roster drops below three", async () => {
    const { room, deps } = await toInterrogation(4, { rounds: 3, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = await answerEverything(room, deps);
    cur = ok(await send(cur, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(cur.scores).toEqual({ p1: 3, p2: 3, p3: 2, p4: 2 });

    cur = ok(await send(cur, "p4", { v: 1, t: "leave" }, deps));
    expect(cur.phase).toBe("REVEAL");
    cur = ok(await send(cur, "p3", { v: 1, t: "leave" }, deps));
    expect(cur.phase).toBe("FINALE");
    expect(cur.deadline).toBeNull();
    // Scores stand as they were, minus the players who left.
    expect(cur.scores).toEqual({ p1: 3, p2: 3 });
  });

  it("abandons the round with no scores when a suspect leaves, and starts the next", async () => {
    const { room, deps } = await toInterrogation(4, { rounds: 2, questionCount: 3, answerSec: 10, planningSec: 15 });
    const cur = ok(await send(room, "p1", { v: 1, t: "leave" }, deps));
    expect(cur.phase).toBe("INTRO");
    expect(cur.rounds).toHaveLength(2);
    expect(cur.rounds[0]!.awarded).toEqual([]);
    expect(cur.rounds[0]!.verdict).toBeUndefined();
    expect(cur.scores).toEqual({ p2: 0, p3: 0, p4: 0 });
    expect(cur.rounds[1]!.suspectIds).toEqual(["p3", "p4"]);
    expect(cur.rounds[1]!.scenarioId).not.toBe(cur.rounds[0]!.scenarioId);
    expect(cur.deadline).toBe(deps.at + INTRO_MS);
  });

  it("goes to FINALE when the suspect who leaves was in the last round", async () => {
    const { room, deps } = await toInterrogation(4, { rounds: 1, questionCount: 3, answerSec: 10, planningSec: 15 });
    const cur = ok(await send(room, "p2", { v: 1, t: "leave" }, deps));
    expect(cur.phase).toBe("FINALE");
    expect(cur.deadline).toBeNull();
    expect(cur.rounds).toHaveLength(1);
    expect(cur.scores).toEqual({ p1: 0, p3: 0, p4: 0 });
  });

  it("keeps the round alive when a detective leaves and resolves once the rest have voted", async () => {
    const { room, deps } = await toInterrogation(5, { rounds: 2, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = await answerEverything(room, deps);
    cur = ok(await send(cur, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(cur.phase).toBe("DELIBERATION");
    // p5 never voted; their departure means the remaining detectives are done.
    cur = ok(await send(cur, "p5", { v: 1, t: "leave" }, deps));
    expect(cur.phase).toBe("REVEAL");
    expect(round(cur).unanimous).toBe(true);
    expect(cur.scores).toEqual({ p1: 3, p2: 3, p3: 2, p4: 2 });
  });

  it("withdraws a departing detective's vote", async () => {
    const { room, deps } = await toInterrogation(5, { rounds: 2, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = await answerEverything(room, deps);
    cur = ok(await send(cur, "p3", { v: 1, t: "castVote", verdict: "busted" }, deps));
    cur = ok(await send(cur, "p3", { v: 1, t: "leave" }, deps));
    expect(round(cur).votes).toEqual({});
    expect(cur.phase).toBe("DELIBERATION");
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p5", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(cur.phase).toBe("REVEAL");
    expect(round(cur).unanimous).toBe(true);
  });

  it("does not rewind a round that a suspect leaves during REVEAL", async () => {
    const { room, deps } = await toInterrogation(4, { rounds: 2, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = await answerEverything(room, deps);
    cur = ok(await send(cur, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
    expect(cur.phase).toBe("REVEAL");
    cur = ok(await send(cur, "p1", { v: 1, t: "leave" }, deps));
    expect(cur.phase).toBe("REVEAL");
    expect(cur.rounds).toHaveLength(1);
    expect(cur.scores).toEqual({ p2: 3, p3: 2, p4: 2 });
  });
});

describe("rejections", () => {
  it("startGame needs the host, three players and the lobby phase", async () => {
    const { room: small } = await lobby(2);
    const deps = makeDeps();
    expect(await send(small, "p1", { v: 1, t: "startGame" }, deps))
      .toMatchObject({ ok: false, code: "BAD_MESSAGE" });
    const { room, deps: d2 } = await lobby(3);
    expect(await send(room, "p2", { v: 1, t: "startGame" }, d2))
      .toMatchObject({ ok: false, code: "NOT_HOST" });
    const running = ok(await send(room, "p1", { v: 1, t: "startGame" }, d2));
    expect(await send(running, "p1", { v: 1, t: "startGame" }, d2))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
    expect(await send(running, "p1", { v: 1, t: "updateSettings", patch: { rounds: 1 } }, d2))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
  });

  it("rejects round messages in the lobby", async () => {
    const { room, deps } = await lobby(3);
    for (const msg of [
      { v: 1, t: "suspectChat", text: "x" },
      { v: 1, t: "submitQuestion", text: "x" },
      { v: 1, t: "submitAnswer", text: "x" },
      { v: 1, t: "castVote", verdict: "consistent" },
    ] as ClientMessage[]) {
      expect(await send(room, "p1", msg, deps)).toMatchObject({ ok: false, code: "WRONG_PHASE" });
    }
  });

  it("rejects an unknown sender", async () => {
    const { room, deps } = await started(3);
    expect(await send(room, "ghost", { v: 1, t: "suspectChat", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "UNKNOWN_PLAYER" });
  });

  it("suspectChat is PLANNING-only and suspects-only", async () => {
    const { room, deps } = await started(3);
    expect(await send(room, "p1", { v: 1, t: "suspectChat", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" }); // still INTRO
    const planning = elapse(room, deps, INTRO_MS);
    expect(await send(planning, "p3", { v: 1, t: "suspectChat", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "NOT_SUSPECT" });
    const interrogation = elapse(planning, deps, planning.settings.planningSec * 1000);
    expect(await send(interrogation, "p1", { v: 1, t: "suspectChat", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
  });

  it("submitQuestion is INTERROGATION-only and detectives-only", async () => {
    const { room, deps } = await started(3, { planningSec: 15 });
    const planning = elapse(room, deps, INTRO_MS);
    expect(await send(planning, "p3", { v: 1, t: "submitQuestion", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
    const interrogation = elapse(planning, deps, 15_000);
    expect(await send(interrogation, "p1", { v: 1, t: "submitQuestion", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "NOT_DETECTIVE" });
  });

  it("submitAnswer enforces role, turn order and one answer per question", async () => {
    const { room, deps } = await started(3, { planningSec: 15, questionCount: 3, answerSec: 10 });
    const planning = elapse(room, deps, INTRO_MS);
    expect(await send(planning, "p1", { v: 1, t: "submitAnswer", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
    const interrogation = elapse(planning, deps, 15_000);
    expect(await send(interrogation, "p3", { v: 1, t: "submitAnswer", text: "x" }, deps))
      .toMatchObject({ ok: false, code: "NOT_SUSPECT" });
    // p1 is on the clock, so p2 must wait.
    expect(await send(interrogation, "p2", { v: 1, t: "submitAnswer", text: "early" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
    const answered = ok(await send(interrogation, "p1", { v: 1, t: "submitAnswer", text: "mine" }, deps));
    expect(await send(answered, "p1", { v: 1, t: "submitAnswer", text: "again" }, deps))
      .toMatchObject({ ok: false, code: "ALREADY_ANSWERED" });
  });

  it("castVote is DELIBERATION-only, detectives-only and once per round", async () => {
    const { room, deps } = await toInterrogation(4, { questionCount: 3, answerSec: 10, planningSec: 15 });
    expect(await send(room, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
    const deliberation = await answerEverything(room, deps);
    expect(await send(deliberation, "p1", { v: 1, t: "castVote", verdict: "busted" }, deps))
      .toMatchObject({ ok: false, code: "NOT_DETECTIVE" });
    const voted = ok(await send(deliberation, "p3", { v: 1, t: "castVote", verdict: "busted" }, deps));
    expect(await send(voted, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps))
      .toMatchObject({ ok: false, code: "ALREADY_VOTED" });
  });

  it("rejects everything once the game is over", async () => {
    const { room, deps } = await toInterrogation(4, { rounds: 1, questionCount: 3, answerSec: 10, planningSec: 15 });
    let cur = await answerEverything(room, deps);
    cur = elapse(cur, deps, DELIBERATION_MS);
    cur = elapse(cur, deps, REVEAL_MS);
    expect(cur.phase).toBe("FINALE");
    expect(await send(cur, "p3", { v: 1, t: "castVote", verdict: "busted" }, deps))
      .toMatchObject({ ok: false, code: "WRONG_PHASE" });
    expect(advance(cur, deps).changed).toBe(false);
  });

  it("leaves the room untouched when a round message is rejected", async () => {
    const { room, deps } = await started(3);
    const before = structuredClone(room);
    await send(room, "p3", { v: 1, t: "castVote", verdict: "busted" }, deps);
    expect(room).toEqual(before);
  });
});
