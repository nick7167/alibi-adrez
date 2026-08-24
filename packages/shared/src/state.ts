import type { ClientMessage, ErrorCode, Phase, Player, ServerMessage, Settings } from "./protocol";
import { DEFAULT_SETTINGS, MAX_PLAYERS } from "./protocol";
import { hashToken } from "./token";

export interface SessionSecret { playerId: string; tokenHash: string }

export interface InternalRoom {
  code: string;
  hostId: string;
  phase: Extract<Phase, "LOBBY" | "INTRO">;
  players: Player[];
  settings: Settings;
  sessions: Record<string /*playerId*/, SessionSecret>;
}

export interface EventDeps {
  newId(): string;
  newToken(): string;
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
      next.players.push({ id: playerId, name: msg.name, emoji: msg.emoji });
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
      if (senderId !== room.hostId) return { ok: false, code: "NOT_HOST", room };
      const next = structuredClone(room);
      next.settings = nextSettings(room.settings, msg.patch);
      return { ok: true, room: next };
    }
    case "startGame": {
      if (senderId !== room.hostId) return { ok: false, code: "NOT_HOST", room };
      if (room.players.length < 2) return { ok: false, code: "BAD_MESSAGE", room };
      const next = structuredClone(room);
      next.phase = "INTRO";
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
      return { ok: true, room: next };
    }
    case "ping":
      return { ok: true, room };
    // Round-loop messages: the state machine lands in T3. Stub rejection
    // here only keeps applyEvent's switch exhaustive and the tree green.
    case "submitQuestion":
    case "suspectChat":
    case "submitAnswer":
    case "castVote":
      return { ok: false, code: "WRONG_PHASE", room };
  }
}

export function snapshotForPlayer(room: InternalRoom, playerId: string): ServerMessage {
  const view =
    room.phase === "LOBBY"
      ? {
          phase: "LOBBY" as const,
          code: room.code,
          hostId: room.hostId,
          players: structuredClone(room.players),
          settings: structuredClone(room.settings),
        }
      : {
          phase: "INTRO" as const,
          code: room.code,
          round: 0,
          roundCount: room.settings.rounds,
          deadline: null,
          players: structuredClone(room.players),
          scoreboard: room.players.map((p) => ({ playerId: p.id, score: 0 })),
          suspectIds: [],
        };
  return { v: 1, t: "state", you: playerId, isHost: room.hostId === playerId, room: view };
}
