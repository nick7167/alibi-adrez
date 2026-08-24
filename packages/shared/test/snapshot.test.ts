import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "../content/scenarios";
import type { Lang } from "../content/scenarios";
import type { ClientMessage, RoomView, ServerMessage, Settings } from "../src/protocol";
import type { RoundState } from "../src/round";
import {
  INTRO_MS,
  REVEAL_MS,
  advance,
  currentRound,
  interrogationPosition,
} from "../src/round";
import type { ApplyResult, EventDeps, InternalRoom } from "../src/state";
import { applyEvent, createRoom, snapshotForPlayer } from "../src/state";

// ------------------------------------------------------------------ harness

interface TestDeps extends EventDeps {
  at: number;
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

function send(room: InternalRoom, senderId: string, msg: ClientMessage, deps: TestDeps) {
  return applyEvent(room, senderId, msg, deps);
}

function elapse(room: InternalRoom, deps: TestDeps, ms: number): InternalRoom {
  deps.at += ms;
  let cur = room;
  for (let i = 0; i < 50; i++) {
    const { room: next, changed } = advance(cur, deps);
    if (!changed) return next;
    cur = next;
  }
  throw new Error("advance did not settle");
}

const SETTINGS: Partial<Settings> = { rounds: 1, questionCount: 3, answerSec: 10, planningSec: 15 };

/** Four players: p1/p2 are the suspects (deps.random() === 0), p3/p4 detectives. */
async function lobbyOfFour(langs: Lang[] = ["en", "da", "en", "da"]) {
  const deps = makeDeps();
  let room = createRoom("SNAP");
  for (let i = 1; i <= 4; i++) {
    room = ok(
      await applyEvent(room, "", { v: 1, t: "join", name: `P${i}`, emoji: "🦊", lang: langs[i - 1] }, deps),
    );
  }
  room = ok(await send(room, "p1", { v: 1, t: "updateSettings", patch: SETTINGS }, deps));
  return { room, deps };
}

const CHAT = "hide the trumpet receipts";

async function atPhase(phase: RoomView["phase"], langs?: Lang[]) {
  const { room: lobby, deps } = await lobbyOfFour(langs);
  if (phase === "LOBBY") return { room: lobby, deps };

  let cur = ok(await send(lobby, "p1", { v: 1, t: "startGame" }, deps));
  if (phase === "INTRO") return { room: cur, deps };

  cur = elapse(cur, deps, INTRO_MS);
  cur = ok(await send(cur, "p1", { v: 1, t: "suspectChat", text: CHAT }, deps));
  if (phase === "PLANNING") return { room: cur, deps };

  cur = elapse(cur, deps, 15_000);
  if (phase === "INTERROGATION") return { room: cur, deps };

  for (let i = 0; i < 20 && cur.phase === "INTERROGATION"; i++) {
    const pos = interrogationPosition(cur, currentRound(cur)!);
    if (pos.onTheClock === null) break;
    cur = ok(await send(cur, pos.onTheClock, { v: 1, t: "submitAnswer", text: `answer ${i}` }, deps));
  }
  if (phase === "DELIBERATION") return { room: cur, deps };

  cur = ok(await send(cur, "p3", { v: 1, t: "castVote", verdict: "consistent" }, deps));
  cur = ok(await send(cur, "p4", { v: 1, t: "castVote", verdict: "consistent" }, deps));
  if (phase === "REVEAL") return { room: cur, deps };

  cur = elapse(cur, deps, REVEAL_MS); // REVEAL -> FINALE (rounds: 1)
  return { room: cur, deps };
}

function view(snap: ServerMessage): RoomView {
  if (snap.t !== "state") throw new Error("expected a state message");
  return snap.room;
}

/** Every key at every depth of the serialized snapshot. */
function deepKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) deepKeys(item, into);
    return into;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      deepKeys(child, into);
    }
  }
  return into;
}

const PHASES = ["LOBBY", "INTRO", "PLANNING", "INTERROGATION", "DELIBERATION", "REVEAL", "FINALE"] as const;

// ------------------------------------------------------------------- tests

describe("deepKeys (the tool the security tests lean on)", () => {
  it("finds keys nested inside arrays and objects", () => {
    const keys = deepKeys({ a: [{ b: { chat: 1 } }], c: null });
    expect([...keys].sort()).toEqual(["a", "b", "c", "chat"]);
  });
});

describe.each(PHASES)("detective snapshot in %s", (phase) => {
  it("never carries the suspects' chat, and carries the scenario only once it is public", async () => {
    const { room } = await atPhase(phase);
    expect(room.phase).toBe(phase);
    const snap = snapshotForPlayer(room, "p3");
    const json = JSON.stringify(snap);
    const keys = deepKeys(JSON.parse(json));

    // The private chat is never visible to a detective, in any phase.
    expect(keys.has("chat")).toBe(false);
    expect(json).not.toContain(CHAT);

    const scenario = SCENARIOS[0]!;
    if (phase === "REVEAL") {
      // REVEAL publishes the scenario to the whole table by design
      // (protocol.ts: RevealView.scenario is required).
      expect(keys.has("scenario")).toBe(true);
      expect(view(snap)).toMatchObject({ phase: "REVEAL", scenario: scenario.en });
    } else {
      expect(keys.has("scenario")).toBe(false);
      expect(json).not.toContain(scenario.en.story);
      expect(json).not.toContain(scenario.da.story);
    }
  });
});

describe("suspect snapshots", () => {
  it("carry the scenario and the private chat in PLANNING", async () => {
    const { room } = await atPhase("PLANNING");
    const snap = snapshotForPlayer(room, "p1");
    const keys = deepKeys(JSON.parse(JSON.stringify(snap)));
    expect(keys.has("scenario")).toBe(true);
    expect(keys.has("chat")).toBe(true);
    expect(view(snap)).toMatchObject({
      phase: "PLANNING",
      role: "suspect",
      scenario: SCENARIOS[0]!.en,
      chat: [{ playerId: "p1", text: CHAT }],
    });
  });

  it("keep the scenario during INTERROGATION but not the chat", async () => {
    const { room } = await atPhase("INTERROGATION");
    const snap = snapshotForPlayer(room, "p1");
    const keys = deepKeys(JSON.parse(JSON.stringify(snap)));
    expect(keys.has("scenario")).toBe(true);
    // InterrogationView has no chat field: planning is over.
    expect(keys.has("chat")).toBe(false);
  });
});

describe("common fields", () => {
  it("are filled honestly in every in-game phase", async () => {
    const { room } = await atPhase("PLANNING");
    const snap = snapshotForPlayer(room, "p3");
    expect(view(snap)).toMatchObject({
      phase: "PLANNING",
      code: "SNAP",
      round: 1,
      roundCount: 1,
      deadline: room.deadline,
      suspectIds: ["p1", "p2"],
      role: "detective",
    });
    const v = view(snap) as { players: { id: string }[]; scoreboard: unknown };
    expect(v.players.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(v.scoreboard).toEqual([
      { playerId: "p1", score: 0 },
      { playerId: "p2", score: 0 },
      { playerId: "p3", score: 0 },
      { playerId: "p4", score: 0 },
    ]);
  });

  it("sorts the scoreboard by score, then playerId", async () => {
    const { room } = await atPhase("REVEAL");
    // Suspects took 3 each (unanimous consistent), detectives 2 each.
    const board = (view(snapshotForPlayer(room, "p3")) as { scoreboard: unknown }).scoreboard;
    expect(board).toEqual([
      { playerId: "p1", score: 3 },
      { playerId: "p2", score: 3 },
      { playerId: "p3", score: 2 },
      { playerId: "p4", score: 2 },
    ]);
  });
});

describe("INTERROGATION view", () => {
  it("gives detectives their remaining question count and suspects their turn flag", async () => {
    const { room, deps } = await atPhase("INTERROGATION");
    const det = view(snapshotForPlayer(room, "p3")) as unknown as Record<string, unknown>;
    expect(det.questionIndex).toBe(0);
    expect(det.questionTotal).toBe(3);
    expect(det.onTheClock).toBe("p1");
    expect(det.transcript).toEqual([]);
    // questionCount 3, one slot already filled by the app question.
    expect(det.myQuestionsLeft).toBe(2);
    expect(det.awaitingMyAnswer).toBeUndefined();

    const onClock = view(snapshotForPlayer(room, "p1")) as unknown as Record<string, unknown>;
    expect(onClock.awaitingMyAnswer).toBe(true);
    expect(onClock.myQuestionsLeft).toBeUndefined();
    expect(view(snapshotForPlayer(room, "p2"))).toMatchObject({ awaitingMyAnswer: false });

    const asked = ok(await send(room, "p3", { v: 1, t: "submitQuestion", text: "who paid?" }, deps));
    expect(view(snapshotForPlayer(asked, "p3"))).toMatchObject({ myQuestionsLeft: 1 });
  });

  it("hides the first suspect's answer until the second one has answered too", async () => {
    const { room, deps } = await atPhase("INTERROGATION");
    const half = ok(await send(room, "p1", { v: 1, t: "submitAnswer", text: "SECRET-FIRST-ANSWER" }, deps));
    for (const reader of ["p2", "p3"]) {
      const snap = snapshotForPlayer(half, reader);
      expect(view(snap)).toMatchObject({ transcript: [] });
      expect(JSON.stringify(snap)).not.toContain("SECRET-FIRST-ANSWER");
    }
    const full = ok(await send(half, "p2", { v: 1, t: "submitAnswer", text: "me too" }, deps));
    const transcript = (view(snapshotForPlayer(full, "p3")) as { transcript: unknown[] }).transcript;
    expect(transcript).toHaveLength(1);
    expect(transcript[0]).toMatchObject({
      answers: [
        { playerId: "p1", text: "SECRET-FIRST-ANSWER" },
        { playerId: "p2", text: "me too" },
      ],
    });
  });
});

describe("DELIBERATION view", () => {
  it("reports vote progress, and myVote for detectives only", async () => {
    const { room, deps } = await atPhase("DELIBERATION");
    const before = view(snapshotForPlayer(room, "p3")) as unknown as Record<string, unknown>;
    expect(before.votesCast).toBe(0);
    expect(before.votesNeeded).toBe(2);
    expect(before.myVote).toBeNull();
    expect((before.transcript as unknown[]).length).toBe(3);

    const suspect = view(snapshotForPlayer(room, "p1")) as unknown as Record<string, unknown>;
    expect(suspect.role).toBe("suspect");
    expect("myVote" in suspect).toBe(false);

    const voted = ok(await send(room, "p3", { v: 1, t: "castVote", verdict: "busted" }, deps));
    expect(view(snapshotForPlayer(voted, "p3"))).toMatchObject({ votesCast: 1, myVote: "busted" });
    expect(view(snapshotForPlayer(voted, "p4"))).toMatchObject({ votesCast: 1, myVote: null });
  });
});

describe("REVEAL view", () => {
  it("carries the verdict, unanimity, the public scenario and the awards", async () => {
    const { room } = await atPhase("REVEAL");
    expect(view(snapshotForPlayer(room, "p4"))).toMatchObject({
      phase: "REVEAL",
      verdict: "consistent",
      unanimous: true,
      scenario: SCENARIOS[0]!.da, // p4 reads Danish
      awarded: [
        { playerId: "p1", points: 3 },
        { playerId: "p2", points: 3 },
        { playerId: "p3", points: 2 },
        { playerId: "p4", points: 2 },
      ],
    });
  });
});

describe("per-player language", () => {
  it("gives two players the same round, each in their own language", async () => {
    const { room } = await atPhase("INTERROGATION", ["en", "da", "en", "da"]);
    const en = view(snapshotForPlayer(room, "p1")) as unknown as Record<string, unknown>;
    const da = view(snapshotForPlayer(room, "p2")) as unknown as Record<string, unknown>;
    const scenario = scenarioById(currentRound(room)!.scenarioId)!;

    // Same round, same position, same suspects.
    expect(en.round).toEqual(da.round);
    expect(en.suspectIds).toEqual(da.suspectIds);
    expect(en.questionIndex).toEqual(da.questionIndex);

    expect(en.scenario).toEqual(scenario.en);
    expect(da.scenario).toEqual(scenario.da);
    expect(scenario.en.story).not.toEqual(scenario.da.story);

    // The app-supplied question is the *same* detail, rendered per reader.
    const detailIndex = currentRound(room)!.questions[0]!.detailIndex!;
    expect(en.question).toBe(scenario.en.details[detailIndex]);
    expect(da.question).toBe(scenario.da.details[detailIndex]);
    expect(en.question).not.toBe(da.question);
  });

  it("renders a detective's literal question identically for both languages", async () => {
    const { room, deps } = await atPhase("INTERROGATION");
    let cur = ok(await send(room, "p3", { v: 1, t: "submitQuestion", text: "who drove?" }, deps));
    // Clear question slot 0 by answering it, so slot 1 (the detective's) is live.
    cur = ok(await send(cur, "p1", { v: 1, t: "submitAnswer", text: "a" }, deps));
    cur = ok(await send(cur, "p2", { v: 1, t: "submitAnswer", text: "b" }, deps));
    expect(view(snapshotForPlayer(cur, "p1"))).toMatchObject({ question: "who drove?" });
    expect(view(snapshotForPlayer(cur, "p2"))).toMatchObject({ question: "who drove?" });
  });

  it("defaults to English when join omits lang", async () => {
    const deps = makeDeps();
    let room = createRoom("SNAP");
    room = ok(await applyEvent(room, "", { v: 1, t: "join", name: "A", emoji: "🦊" }, deps));
    expect(room.players[0]!.lang).toBe("en");
  });

  it("setLang changes what the next snapshot returns, in any phase", async () => {
    const { room, deps } = await atPhase("PLANNING", ["en", "en", "en", "en"]);
    const scenario = scenarioById(currentRound(room)!.scenarioId)!;
    expect(view(snapshotForPlayer(room, "p1"))).toMatchObject({ scenario: scenario.en });

    const switched = ok(await send(room, "p1", { v: 1, t: "setLang", lang: "da" }, deps));
    expect(view(snapshotForPlayer(switched, "p1"))).toMatchObject({ scenario: scenario.da });
    // Nobody else moves.
    expect(view(snapshotForPlayer(switched, "p2"))).toMatchObject({ scenario: scenario.en });
  });

  it("setLang rejects an unknown sender and works in the lobby too", async () => {
    const { room, deps } = await lobbyOfFour();
    expect(await send(room, "ghost", { v: 1, t: "setLang", lang: "da" }, deps))
      .toMatchObject({ ok: false, code: "UNKNOWN_PLAYER" });
    const switched = ok(await send(room, "p1", { v: 1, t: "setLang", lang: "da" }, deps));
    expect(switched.players[0]!.lang).toBe("da");
    // Pure: the original room is untouched.
    expect(room.players[0]!.lang).toBe("en");
  });
});

// ------------------------------------------------------------ finale awards

function roundStub(partial: Partial<RoundState> & Pick<RoundState, "index" | "suspectIds">): RoundState {
  return {
    scenarioId: SCENARIOS[0]!.id,
    questions: [],
    answers: {},
    chat: [],
    votes: {},
    questionsAsked: {},
    ...partial,
  };
}

const det = (askedBy: string) => ({ text: "q", detailIndex: null, askedBy });
const app = { text: null, detailIndex: 0, askedBy: null };

async function finaleWith(rounds: RoundState[], players = ["p1", "p2", "p3", "p4"]) {
  const { room } = await lobbyOfFour();
  const next = structuredClone(room);
  next.phase = "FINALE";
  next.players = next.players.filter((p) => players.includes(p.id));
  next.rounds = rounds;
  next.deadline = null;
  return next;
}

function awardsOf(room: InternalRoom): { key: string; playerId: string }[] {
  const v = view(snapshotForPlayer(room, "p3")) as { awards: { key: string; playerId: string }[] };
  return v.awards;
}

describe("FINALE awards", () => {
  const history: RoundState[] = [
    roundStub({
      index: 1,
      suspectIds: ["p1", "p2"],
      verdict: "consistent",
      votes: { p3: "consistent", p4: "busted" },
      questions: [det("p4"), det("p4"), app],
    }),
    roundStub({
      index: 2,
      suspectIds: ["p1", "p4"],
      verdict: "consistent",
      votes: { p2: "consistent", p3: "consistent" },
      questions: [det("p3")],
    }),
    roundStub({
      index: 3,
      suspectIds: ["p3", "p4"],
      verdict: "busted",
      votes: { p1: "busted", p2: "consistent" },
      questions: [det("p1")],
    }),
  ];

  it("picks the right winner for each superlative", async () => {
    const room = await finaleWith(structuredClone(history));
    expect(awardsOf(room)).toEqual([
      // p1 was a suspect in two 'consistent' rounds; p2 and p4 in one each.
      { key: "mostConvincingLiar", playerId: "p1" },
      // p3 matched the verdict twice; p1 and p2 once each.
      { key: "sharpestDetective", playerId: "p3" },
      // p4 submitted two questions; p1 and p3 one each. App questions count for nobody.
      { key: "mostCurious", playerId: "p4" },
    ]);
  });

  it("breaks ties on the lowest playerId, deterministically", async () => {
    const tied: RoundState[] = [
      roundStub({
        index: 1,
        suspectIds: ["p2", "p1"],
        verdict: "consistent",
        votes: { p3: "consistent", p4: "consistent" },
        questions: [det("p4"), det("p3")],
      }),
    ];
    const room = await finaleWith(tied);
    const first = awardsOf(room);
    expect(first).toEqual([
      { key: "mostConvincingLiar", playerId: "p1" },
      { key: "sharpestDetective", playerId: "p3" },
      { key: "mostCurious", playerId: "p3" },
    ]);
    // Same room, same answer, every time.
    expect(awardsOf(room)).toEqual(first);
    expect(awardsOf(await finaleWith(structuredClone(tied)))).toEqual(first);
  });

  it("omits an award entirely when nobody qualifies", async () => {
    const room = await finaleWith([
      roundStub({
        index: 1,
        suspectIds: ["p1", "p2"],
        verdict: "busted",
        // Nobody voted with the verdict, so there is no sharpest detective.
        votes: { p3: "consistent", p4: "consistent" },
        // Only app-supplied questions, so nobody is the most curious.
        questions: [app, app],
      }),
    ]);
    expect(awardsOf(room)).toEqual([]);
  });

  it("has no awards at all when no round was ever resolved", async () => {
    const room = await finaleWith([roundStub({ index: 1, suspectIds: ["p1", "p2"] })]);
    expect(awardsOf(room)).toEqual([]);
  });

  it("skips players who have left the room", async () => {
    const room = await finaleWith(structuredClone(history), ["p2", "p3", "p4"]);
    expect(awardsOf(room)).toEqual([
      // p1 is gone, so the next-best liars (p2, p4) tie and p2 wins on id.
      { key: "mostConvincingLiar", playerId: "p2" },
      { key: "sharpestDetective", playerId: "p3" },
      { key: "mostCurious", playerId: "p4" },
    ]);
  });

  it("carries no scenario or chat key for anyone", async () => {
    const room = await finaleWith(structuredClone(history));
    for (const reader of ["p2", "p3"]) {
      const keys = deepKeys(JSON.parse(JSON.stringify(snapshotForPlayer(room, reader))));
      expect(keys.has("scenario")).toBe(false);
      expect(keys.has("chat")).toBe(false);
    }
  });
});
