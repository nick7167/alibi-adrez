import { AVATARS } from "./emojis";
import type { ScenarioText } from "../content/scenarios";

export { AVATARS };
export type { ScenarioText };

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 16;
export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_BYTES = 2048;
export const MAX_TEXT_LENGTH = 240;

export type Phase =
  | "LOBBY" | "INTRO" | "PLANNING"
  | "INTERROGATION" | "DELIBERATION" | "REVEAL" | "FINALE";

export type EmojiId = string;

export interface Player { id: string; name: string; emoji: EmojiId }

export interface Settings {
  rounds: number;
  planningSec: number;
  answerSec: number;
  questionCount: number;
  scenarioSource: "curated" | "ai" | "mix";
}

export const DEFAULT_SETTINGS: Settings = {
  rounds: 3, planningSec: 45, answerSec: 30, questionCount: 6, scenarioSource: "mix",
};

export interface LobbyView {
  phase: "LOBBY"; code: string; hostId: string; players: Player[]; settings: Settings;
}

export type Verdict = "consistent" | "busted";
export type Role = "suspect" | "detective";

export interface ScoreEntry { playerId: string; score: number }
export interface ChatLine { playerId: string; text: string }
export interface AnswerLine { playerId: string; text: string }
export interface TranscriptEntry { question: string; answers: AnswerLine[] }

/** Fields carried by every in-game (non-LOBBY, non-FINALE) view. */
interface GameViewCommon {
  code: string;
  /** 1-based; 0 before the first round has started. */
  round: number;
  roundCount: number;
  /** Epoch ms when the current phase ends, or null when untimed. */
  deadline: number | null;
  players: Player[];
  scoreboard: ScoreEntry[];
  /** Empty until a suspect pair has been chosen for the round. */
  suspectIds: readonly string[];
}

export interface IntroView extends GameViewCommon { phase: "INTRO" }

export interface PlanningView extends GameViewCommon {
  phase: "PLANNING";
  role: Role;
  /** Suspects only. */
  scenario?: ScenarioText;
  /** Suspects only. */
  chat?: ChatLine[];
}

export interface InterrogationView extends GameViewCommon {
  phase: "INTERROGATION";
  role: Role;
  questionIndex: number;
  questionTotal: number;
  question: string | null;
  onTheClock: string | null;
  transcript: TranscriptEntry[];
  /** Suspects only. */
  scenario?: ScenarioText;
  /** Detectives only. */
  myQuestionsLeft?: number;
  /** Suspects only. */
  awaitingMyAnswer?: boolean;
}

export interface DeliberationView extends GameViewCommon {
  phase: "DELIBERATION";
  role: Role;
  transcript: TranscriptEntry[];
  votesCast: number;
  votesNeeded: number;
  /** Detectives only. */
  myVote?: Verdict | null;
}

export interface RevealView extends GameViewCommon {
  phase: "REVEAL";
  verdict: Verdict;
  unanimous: boolean;
  scenario: ScenarioText;
  awarded: { playerId: string; points: number }[];
}

export interface FinaleView {
  phase: "FINALE";
  code: string;
  players: Player[];
  scoreboard: ScoreEntry[];
  awards: { key: string; playerId: string }[];
}

export type RoomView =
  | LobbyView
  | IntroView
  | PlanningView
  | InterrogationView
  | DeliberationView
  | RevealView
  | FinaleView;

export type ClientMessage =
  | { v: 1; t: "join"; name: string; emoji: EmojiId }
  | { v: 1; t: "reconnect"; playerId: string; token: string }
  | { v: 1; t: "updateSettings"; patch: Partial<Settings> }
  | { v: 1; t: "startGame" }
  | { v: 1; t: "leave" }
  | { v: 1; t: "ping" }
  | { v: 1; t: "submitQuestion"; text: string }
  | { v: 1; t: "suspectChat"; text: string }
  | { v: 1; t: "submitAnswer"; text: string }
  | { v: 1; t: "castVote"; verdict: Verdict };

export type ErrorCode =
  | "BAD_MESSAGE" | "ROOM_FULL" | "NAME_TAKEN"
  | "NOT_HOST" | "UNKNOWN_PLAYER" | "GAME_STARTED" | "INTERNAL"
  | "NOT_SUSPECT" | "NOT_DETECTIVE" | "WRONG_PHASE"
  | "ALREADY_ANSWERED" | "ALREADY_VOTED" | "RATE_LIMITED";

export type ServerMessage =
  | { v: 1; t: "welcome"; playerId: string; token: string }
  | { v: 1; t: "state"; you: string; isHost: boolean; room: RoomView }
  | { v: 1; t: "error"; code: ErrorCode; message?: string }
  | { v: 1; t: "pong" };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validName(name: unknown): name is string {
  return typeof name === "string"
    && name.trim().length > 0
    && name.length <= MAX_NAME_LENGTH;
}

function validEmoji(e: unknown): e is EmojiId {
  return typeof e === "string" && (AVATARS as readonly string[]).includes(e);
}

function validText(text: unknown): text is string {
  return typeof text === "string"
    && text.trim().length > 0
    && text.trim().length <= MAX_TEXT_LENGTH;
}

function validVerdict(v: unknown): v is Verdict {
  return v === "consistent" || v === "busted";
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!isPlainObject(data) || data.v !== PROTOCOL_VERSION) return null;
  switch (data.t) {
    case "join":
      return validName(data.name) && validEmoji(data.emoji)
        ? { v: 1, t: "join", name: data.name.trim(), emoji: data.emoji } : null;
    case "reconnect":
      return typeof data.playerId === "string" && typeof data.token === "string"
        ? { v: 1, t: "reconnect", playerId: data.playerId, token: data.token } : null;
    case "updateSettings":
      return isPlainObject(data.patch)
        ? { v: 1, t: "updateSettings", patch: data.patch as Partial<Settings> } : null;
    case "startGame":
    case "leave":
    case "ping":
      return { v: 1, t: data.t };
    case "submitQuestion":
      return validText(data.text)
        ? { v: 1, t: "submitQuestion", text: data.text.trim() } : null;
    case "suspectChat":
      return validText(data.text)
        ? { v: 1, t: "suspectChat", text: data.text.trim() } : null;
    case "submitAnswer":
      return validText(data.text)
        ? { v: 1, t: "submitAnswer", text: data.text.trim() } : null;
    case "castVote":
      return validVerdict(data.verdict)
        ? { v: 1, t: "castVote", verdict: data.verdict } : null;
    default:
      return null;
  }
}
