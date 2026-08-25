import type {
  ClientMessage,
  ErrorCode,
  PackId,
  Phase,
  Player,
  ServerMessage,
  Settings,
} from "./protocol";
import { DEFAULT_LANG, DEFAULT_SETTINGS, MAX_PLAYERS, MIN_PLAYERS } from "./protocol";
import { PACK_IDS } from "../content/prompts";
import type { RoundState } from "./round";
import { applyRoundMessage, beginGame, handlePlayerLeft } from "./round";
import { hashToken } from "./token";
import { viewForPlayer } from "./view";

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
  /**
   * playerId -> how many times their entry has been staged this game. Staging
   * is tiered least-staged, so this is a counter rather than Alibi's binary
   * "has been a suspect" flag: the pool is whoever has the minimum count.
   */
  stagedCount: Record<string, number>;
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
  /** 0 <= random() < 1. Injected so staging and prompt choice are deterministic. */
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
    stagedCount: {},
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

/**
 * Packs: keep only ids we actually have prompts for, drop duplicates, and
 * refuse to end up with none — an empty pack list would leave the round engine
 * with nothing to ask, so a patch that would empty it is ignored rather than
 * half-applied.
 */
function nextPacks(current: PackId[], value: unknown): PackId[] {
  if (!Array.isArray(value)) return current;
  const known = new Set<PackId>();
  for (const item of value) {
    if ((PACK_IDS as readonly string[]).includes(item as string)) known.add(item as PackId);
  }
  return known.size > 0 ? [...known] : current;
}

function nextSettings(current: Settings, patch: Partial<Settings>): Settings {
  const s = structuredClone(current);
  if (hasOwn(patch, "rounds")) s.rounds = clampField(s.rounds, patch.rounds, 1, 10);
  if (hasOwn(patch, "writeSec")) s.writeSec = clampField(s.writeSec, patch.writeSec, 20, 120);
  if (hasOwn(patch, "guessSec")) s.guessSec = clampField(s.guessSec, patch.guessSec, 10, 60);
  if (hasOwn(patch, "packs")) s.packs = nextPacks(s.packs, patch.packs);
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
      if (room.players.length < MIN_PLAYERS) return { ok: false, code: "BAD_MESSAGE", room };
      const next = structuredClone(room);
      // Everyone on zero and unstaged, then the INTRO splash. `beginGame` is
      // the only thing that knows what a fresh game looks like, and
      // `enterPhase` inside it is the only thing that sets phase + deadline.
      beginGame(next, deps);
      return { ok: true, room: next };
    }
    case "leave": {
      const idx = room.players.findIndex((p) => p.id === senderId);
      if (idx === -1) return { ok: false, code: "UNKNOWN_PLAYER", room };
      const next = structuredClone(room);
      next.players.splice(idx, 1);
      delete next.sessions[senderId];
      delete next.scores[senderId];
      delete next.stagedCount[senderId];
      if (next.players.length === 0) {
        next.hostId = "";
      } else if (senderId === next.hostId) {
        next.hostId = next.players[0]!.id;
      }
      // Voids their entry, skips the answer they authored, resolves a phase
      // they were the last holdout for, and ends the game below MIN_PLAYERS.
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
    case "submitEntry":
    case "submitGuess":
      return applyRoundMessage(room, senderId, msg, deps);
  }
}

// ------------------------------------------------------------------ snapshots

/**
 * The per-player view lives in `packages/shared/src/view.ts`, together with
 * every other projection: that file is the only reader of `round.entries`,
 * and a rule like that is only checkable if it has one address. `state.ts`
 * keeps the lobby, the sessions and the event dispatch — it never sees an
 * answer.
 */

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
