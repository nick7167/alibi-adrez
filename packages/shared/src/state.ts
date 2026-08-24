import type { Lang } from "../content/scenarios";
import { resolveScenario } from "../content/scenarios";
import type {
  ClientMessage,
  DeliberationView,
  ErrorCode,
  InterrogationView,
  Phase,
  PlanningView,
  Player,
  Role,
  RoomView,
  ScenarioText,
  ScoreEntry,
  ServerMessage,
  Settings,
  TranscriptEntry,
} from "./protocol";
import { DEFAULT_LANG, DEFAULT_SETTINGS, MAX_PLAYERS } from "./protocol";
import type { RoundState } from "./round";
import {
  MIN_PLAYERS,
  applyRoundMessage,
  beginGame,
  currentRound,
  detectiveIds,
  finaleAwards,
  handlePlayerLeft,
  interrogationPosition,
  isSuspect,
  questionFor,
  questionsLeftFor,
} from "./round";
import { hashToken } from "./token";

export interface SessionSecret { playerId: string; tokenHash: string }

export interface InternalRoom {
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  settings: Settings;
  sessions: Record<string /*playerId*/, SessionSecret>;
  /** playerId -> running score. */
  scores: Record<string, number>;
  /** playerId -> has already been a suspect in the current rotation. */
  wasSuspect: Record<string, boolean>;
  /** Every round played so far; the last entry is the live one. */
  rounds: RoundState[];
  /** Epoch ms when the current phase ends, or null when untimed. */
  deadline: number | null;
}

export interface EventDeps {
  newId(): string;
  newToken(): string;
  /** Epoch ms. Injected so phase timing is deterministic in tests. */
  now(): number;
  /** 0 <= random() < 1. Injected so pair/scenario choice is deterministic. */
  random(): number;
}

export type ApplyResult =
  | { ok: true; welcome?: { playerId: string; token: string }; room: InternalRoom }
  | { ok: false; code: ErrorCode; room: InternalRoom };

export function createRoom(code: string): InternalRoom {
  return {
    code,
    hostId: "",
    phase: "LOBBY",
    players: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    sessions: {},
    scores: {},
    wasSuspect: {},
    rounds: [],
    deadline: null,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampField(current: number, value: unknown, lo: number, hi: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, lo, hi) : current;
}

function hasOwn(patch: Partial<Settings>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

function nextSettings(current: Settings, patch: Partial<Settings>): Settings {
  const s = structuredClone(current);
  if (hasOwn(patch, "rounds")) s.rounds = clampField(s.rounds, patch.rounds, 1, 10);
  if (hasOwn(patch, "planningSec")) s.planningSec = clampField(s.planningSec, patch.planningSec, 15, 120);
  if (hasOwn(patch, "answerSec")) s.answerSec = clampField(s.answerSec, patch.answerSec, 10, 90);
  if (hasOwn(patch, "questionCount")) s.questionCount = clampField(s.questionCount, patch.questionCount, 3, 10);
  if (hasOwn(patch, "scenarioSource")
      && (patch.scenarioSource === "curated" || patch.scenarioSource === "ai" || patch.scenarioSource === "mix")) {
    s.scenarioSource = patch.scenarioSource;
  }
  return s;
}

export async function applyEvent(
  room: InternalRoom,
  senderId: string,
  msg: ClientMessage,
  deps: EventDeps,
): Promise<ApplyResult> {
  switch (msg.t) {
    case "join": {
      if (room.phase !== "LOBBY") return { ok: false, code: "GAME_STARTED", room };
      const lower = msg.name.toLowerCase();
      if (room.players.some((p) => p.name.toLowerCase() === lower)) {
        return { ok: false, code: "NAME_TAKEN", room };
      }
      if (room.players.length >= MAX_PLAYERS) return { ok: false, code: "ROOM_FULL", room };
      const next = structuredClone(room);
      const playerId = deps.newId();
      const token = deps.newToken();
      next.players.push({ id: playerId, name: msg.name, emoji: msg.emoji, lang: msg.lang ?? DEFAULT_LANG });
      next.sessions[playerId] = { playerId, tokenHash: await hashToken(token) };
      if (next.hostId === "") next.hostId = playerId;
      return { ok: true, welcome: { playerId, token }, room: next };
    }
    case "reconnect": {
      const secret = room.sessions[msg.playerId];
      const known = secret !== undefined && room.players.some((p) => p.id === msg.playerId);
      if (!known || secret.tokenHash !== (await hashToken(msg.token))) {
        return { ok: false, code: "UNKNOWN_PLAYER", room };
      }
      return { ok: true, room };
    }
    case "updateSettings": {
      if (room.phase !== "LOBBY") return { ok: false, code: "WRONG_PHASE", room };
      if (senderId !== room.hostId) return { ok: false, code: "NOT_HOST", room };
      const next = structuredClone(room);
      next.settings = nextSettings(room.settings, msg.patch);
      return { ok: true, room: next };
    }
    case "startGame": {
      if (room.phase !== "LOBBY") return { ok: false, code: "WRONG_PHASE", room };
      if (senderId !== room.hostId) return { ok: false, code: "NOT_HOST", room };
      // Scope decision 1: two suspects plus at least one detective.
      if (room.players.length < MIN_PLAYERS) return { ok: false, code: "BAD_MESSAGE", room };
      const next = structuredClone(room);
      beginGame(next, deps);
      return { ok: true, room: next };
    }
    case "leave": {
      const idx = room.players.findIndex((p) => p.id === senderId);
      if (idx === -1) return { ok: false, code: "UNKNOWN_PLAYER", room };
      const next = structuredClone(room);
      next.players.splice(idx, 1);
      delete next.sessions[senderId];
      if (next.players.length === 0) {
        next.hostId = "";
      } else if (senderId === next.hostId) {
        next.hostId = next.players[0]!.id;
      }
      handlePlayerLeft(next, senderId, deps);
      return { ok: true, room: next };
    }
    case "setLang": {
      // Legal in every phase: the in-app EN/DA toggle follows the player
      // mid-game, and the next snapshot is rendered in the new language.
      const idx = room.players.findIndex((p) => p.id === senderId);
      if (idx === -1) return { ok: false, code: "UNKNOWN_PLAYER", room };
      if (room.players[idx]!.lang === msg.lang) return { ok: true, room };
      const next = structuredClone(room);
      next.players[idx]!.lang = msg.lang;
      return { ok: true, room: next };
    }
    case "ping":
      return { ok: true, room };
    case "submitQuestion":
    case "suspectChat":
    case "submitAnswer":
    case "castVote":
      return applyRoundMessage(room, senderId, msg, deps);
  }
}

// ------------------------------------------------------------------ snapshots

/** Highest score first; ties by playerId so the ordering is stable. */
function scoreboardFor(room: InternalRoom): ScoreEntry[] {
  return room.players
    .map((p) => ({ playerId: p.id, score: room.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
}

const UNKNOWN_SCENARIO: ScenarioText = { story: "", details: ["", "", "", ""] };

function scenarioFor(round: RoundState, lang: Lang): ScenarioText {
  return structuredClone(resolveScenario(round.scenarioId, lang) ?? UNKNOWN_SCENARIO);
}

/**
 * Only *fully* answered questions make the transcript, so the suspect who is
 * second on the clock never sees what the first one just said, and detectives
 * only ever read a question once both answers are in.
 */
function transcriptFor(room: InternalRoom, round: RoundState, lang: Lang): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (let i = 0; i < round.questions.length; i++) {
    const slot = round.answers[i];
    if (slot === undefined) continue;
    if (!round.suspectIds.every((id) => Object.prototype.hasOwnProperty.call(slot, id))) continue;
    entries.push({
      question: questionFor(round, i, lang) ?? "",
      answers: round.suspectIds.map((id) => ({ playerId: id, text: slot[id]! })),
    });
  }
  return entries;
}

/**
 * The per-player view of the room. Everything a detective must not know — the
 * scenario before REVEAL and the suspects' private chat, ever — is added only
 * on the suspect branch, so those keys are *absent* from a detective's object
 * rather than empty. Scenario text and app-supplied questions are resolved in
 * the reader's own language.
 */
function viewForPlayer(room: InternalRoom, playerId: string): RoomView {
  const me = room.players.find((p) => p.id === playerId);
  const lang: Lang = me?.lang ?? DEFAULT_LANG;

  if (room.phase === "LOBBY") {
    return {
      phase: "LOBBY",
      code: room.code,
      hostId: room.hostId,
      players: structuredClone(room.players),
      settings: structuredClone(room.settings),
    };
  }

  const scoreboard = scoreboardFor(room);
  if (room.phase === "FINALE") {
    return {
      phase: "FINALE",
      code: room.code,
      players: structuredClone(room.players),
      scoreboard,
      awards: finaleAwards(room),
    };
  }

  const round = currentRound(room);
  const common = {
    code: room.code,
    round: round?.index ?? 0,
    roundCount: room.settings.rounds,
    deadline: room.deadline,
    players: structuredClone(room.players),
    scoreboard,
    suspectIds: round === undefined ? [] : [...round.suspectIds],
  };
  // A live phase without a round should be impossible; INTRO is the safe view.
  if (round === undefined) return { phase: "INTRO", ...common };

  const suspect = me !== undefined && isSuspect(round, playerId);
  const role: Role = suspect ? "suspect" : "detective";

  switch (room.phase) {
    case "INTRO":
      return { phase: "INTRO", ...common };

    case "PLANNING": {
      const view: PlanningView = { phase: "PLANNING", ...common, role };
      if (suspect) {
        view.scenario = scenarioFor(round, lang);
        view.chat = structuredClone(round.chat);
      }
      return view;
    }

    case "INTERROGATION": {
      const pos = interrogationPosition(room, round);
      const view: InterrogationView = {
        phase: "INTERROGATION",
        ...common,
        role,
        questionIndex: pos.questionIndex,
        questionTotal: room.settings.questionCount,
        question: questionFor(round, pos.questionIndex, lang),
        onTheClock: pos.onTheClock,
        transcript: transcriptFor(room, round, lang),
      };
      if (suspect) {
        view.scenario = scenarioFor(round, lang);
        view.awaitingMyAnswer = pos.onTheClock === playerId;
      } else {
        view.myQuestionsLeft = questionsLeftFor(room, round, playerId);
      }
      return view;
    }

    case "DELIBERATION": {
      const detectives = detectiveIds(room, round);
      const view: DeliberationView = {
        phase: "DELIBERATION",
        ...common,
        role,
        transcript: transcriptFor(room, round, lang),
        votesCast: detectives.filter((id) => round.votes[id] !== undefined).length,
        votesNeeded: detectives.length,
      };
      if (!suspect) view.myVote = round.votes[playerId] ?? null;
      return view;
    }

    case "REVEAL":
      return {
        phase: "REVEAL",
        ...common,
        verdict: round.verdict ?? "consistent",
        unanimous: round.unanimous ?? false,
        // Public from REVEAL on: the whole table is told what the alibi was.
        scenario: scenarioFor(round, lang),
        awarded: structuredClone(round.awarded ?? []),
      };
  }
}

/**
 * `now` is stamped on every snapshot so clients can render the phase
 * countdown from `deadline` alone (see the `state` message in `protocol.ts`).
 * It defaults to the wall clock; callers with an injected clock pass theirs.
 */
export function snapshotForPlayer(
  room: InternalRoom,
  playerId: string,
  now: number = Date.now(),
): ServerMessage {
  return {
    v: 1,
    t: "state",
    you: playerId,
    isHost: room.hostId === playerId,
    room: viewForPlayer(room, playerId),
    now,
  };
}
