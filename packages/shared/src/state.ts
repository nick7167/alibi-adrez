import type {
  ClientMessage,
  ErrorCode,
  PackId,
  Phase,
  Player,
  ServerMessage,
  Settings,
} from "./protocol";
import {
  DEFAULT_LANG,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_SCHEMA,
  SETTINGS_BOUNDS,
} from "./protocol";
import { PACK_IDS } from "../content/prompts";
import type { ConnectedIds, Entry, GuessRound } from "./round";
import { applyRoundMessage, beginGame, handlePlayerLeft, returnToLobby } from "./round";
import { hashToken } from "./token";
import { viewForPlayer } from "./view";
import { containsObjectionableContent } from "./moderation";

export interface SessionSecret { playerId: string; tokenHash: string }

export interface InternalRoom {
  /**
   * Which persisted shape this room was written in. Checked on load; a room
   * from an older build is discarded rather than half-read (see `ROOM_SCHEMA`).
   */
  schema: number;
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  settings: Settings;
  sessions: Record<string /*playerId*/, SessionSecret>;
  /** playerId -> running score. */
  scores: Record<string, number>;
  /**
   * playerId -> how many times one of their answers has been put to the room.
   * Selection is tiered least-staged, so this is a counter: the pool narrows
   * to whoever has the minimum count. Being picked means sitting the round
   * out, so an even spread is a fairness property, not a cosmetic one.
   */
  stagedCount: Record<string, number>;
  /**
   * The game's questions, as promptIds. Drawn once at `startGame`, distinct,
   * and indexed by question number everywhere else.
   */
  questions: string[];
  /**
   * **The private store, and the only place authorship is written down.**
   * playerId -> questionIndex -> their answer. A player who answered nothing
   * has no key; a question they skipped has no key under them.
   *
   * Only `view.ts` may read this (it is the projection boundary) and only
   * `round.ts` may write it. `grep -rn "\.entries" packages apps` should hit
   * nothing else.
   */
  entries: Record<string, Record<number, Entry>>;
  /** playerId -> they pressed "I'm done". Projected only ever as a count. */
  handedIn: Record<string, true>;
  /** playerId -> their rank at the previous standings beat, for movement. */
  prevRanks: Record<string, number>;
  /** Every guessing round played so far; the last entry is the live one. */
  rounds: GuessRound[];
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
    schema: ROOM_SCHEMA,
    code,
    hostId: "",
    phase: "LOBBY",
    players: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    sessions: {},
    scores: {},
    stagedCount: {},
    questions: [],
    entries: {},
    handedIn: {},
    prevRanks: {},
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

/**
 * Every numeric dial clamps to `SETTINGS_BOUNDS`, which the lobby's steppers
 * read too — so a tap can never send a value the server would clamp away, and
 * the bounds exist in exactly one place.
 *
 * `questions` is bounded here but capped *again* at `startGame`, against the
 * number of distinct prompts the enabled packs hold: a host can legally ask
 * for twenty questions and then switch down to a single fifteen-prompt pack,
 * and the game must draw fifteen rather than repeat one.
 */
function nextSettings(current: Settings, patch: Partial<Settings>): Settings {
  const s = structuredClone(current);
  for (const key of ["questions", "rounds", "answerSec", "guessSec", "revealSec",
                     "standingsEvery"] as const) {
    if (!hasOwn(patch, key)) continue;
    const b = SETTINGS_BOUNDS[key];
    s[key] = clampField(s[key], patch[key], b.min, b.max);
  }
  if (hasOwn(patch, "packs")) s.packs = nextPacks(s.packs, patch.packs);
  return s;
}

/**
 * `connected` is the set of player ids the caller currently holds a live
 * socket for. It is used for **early-resolve decisions only** (see
 * `ConnectedIds` in `round.ts`) and defaults to "everybody", which is the
 * behaviour of every caller that does not know about sockets — the pure
 * tests, and anything that is not the Durable Object.
 */
export async function applyEvent(
  room: InternalRoom,
  senderId: string,
  msg: ClientMessage,
  deps: EventDeps,
  connected?: ConnectedIds,
): Promise<ApplyResult> {
  switch (msg.t) {
    case "join": {
      if (room.phase !== "LOBBY") return { ok: false, code: "GAME_STARTED", room };
      if (containsObjectionableContent(msg.name)) {
        return { ok: false, code: "CONTENT_BLOCKED", room };
      }
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
    case "returnToLobby": {
      // Only from a finished game, but by ANY seated player rather than the
      // host: it is the finale's only way onward, so a host-only rule would
      // strand everyone else on a terminal screen the moment the host set
      // their phone down.
      if (room.phase !== "FINALE") return { ok: false, code: "WRONG_PHASE", room };
      if (!room.players.some((p) => p.id === senderId)) {
        return { ok: false, code: "UNKNOWN_PLAYER", room };
      }
      const next = structuredClone(room);
      returnToLobby(next, deps);
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
      handlePlayerLeft(next, senderId, deps, connected);
      return { ok: true, room: next };
    }
    case "kick": {
      if (senderId !== room.hostId) return { ok: false, code: "NOT_HOST", room };
      if (msg.targetPlayerId === senderId) return { ok: false, code: "BAD_MESSAGE", room };
      const idx = room.players.findIndex((p) => p.id === msg.targetPlayerId);
      if (idx === -1) return { ok: false, code: "UNKNOWN_PLAYER", room };
      const next = structuredClone(room);
      next.players.splice(idx, 1);
      delete next.sessions[msg.targetPlayerId];
      delete next.scores[msg.targetPlayerId];
      delete next.stagedCount[msg.targetPlayerId];
      handlePlayerLeft(next, msg.targetPlayerId, deps, connected);
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
      if (containsObjectionableContent(msg.text)) {
        return { ok: false, code: "CONTENT_BLOCKED", room };
      }
      return applyRoundMessage(room, senderId, msg, deps, connected);
    case "submitGuess":
    case "handIn":
      return applyRoundMessage(room, senderId, msg, deps, connected);
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
