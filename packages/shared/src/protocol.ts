import { AVATARS } from "./emojis";

export { AVATARS };

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 16;
export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_BYTES = 2048;

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
export interface StartingView { phase: "INTRO"; code: string }
export type RoomView = LobbyView | StartingView;

export type ClientMessage =
  | { v: 1; t: "join"; name: string; emoji: EmojiId }
  | { v: 1; t: "reconnect"; playerId: string; token: string }
  | { v: 1; t: "updateSettings"; patch: Partial<Settings> }
  | { v: 1; t: "startGame" }
  | { v: 1; t: "leave" }
  | { v: 1; t: "ping" };

export type ErrorCode =
  | "BAD_MESSAGE" | "ROOM_FULL" | "NAME_TAKEN"
  | "NOT_HOST" | "UNKNOWN_PLAYER" | "GAME_STARTED" | "INTERNAL";

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
    default:
      return null;
  }
}
