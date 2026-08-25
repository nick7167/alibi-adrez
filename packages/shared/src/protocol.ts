import { AVATARS } from "./emojis";
import type { Lang, PackId } from "../content/prompts";

export { AVATARS };
export type { Lang, PackId };

/** Language a client reads when nothing says otherwise. */
export const DEFAULT_LANG: Lang = "en";

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 16;
/** Below this a room cannot start, and a running game ends. */
export const MIN_PLAYERS = 3;
export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_BYTES = 2048;
/**
 * An entry is one line, read aloud-fast on a phone card. Short on purpose:
 * the game is won by recognising *how* someone writes, and a paragraph both
 * buries the voice and makes the guessing screen scroll.
 */
export const MAX_ENTRY_LENGTH = 140;

export type Phase =
  | "LOBBY" | "INTRO" | "WRITING"
  | "GUESSING" | "REVEAL" | "ROUND_END" | "FINALE";

export type EmojiId = string;

export interface Player {
  id: string;
  name: string;
  emoji: EmojiId;
  /** Language this player reads; personalizes their snapshots. */
  lang: Lang;
}

export interface Settings {
  rounds: number;
  /** Seconds everyone has to answer the prompt. */
  writeSec: number;
  /** Seconds to guess who wrote one staged answer. */
  guessSec: number;
  /** Prompt packs in play. Never empty; `spicy` is opt-in. */
  packs: PackId[];
}

export const DEFAULT_SETTINGS: Settings = {
  rounds: 4, writeSec: 60, guessSec: 25, packs: ["everyday", "opinions", "absurd"],
};

export interface LobbyView {
  phase: "LOBBY"; code: string; hostId: string; players: Player[]; settings: Settings;
}

export interface ScoreEntry { playerId: string; score: number }

/**
 * One answer on the public stage.
 *
 * There is deliberately **no `authorId` field**: the private store is keyed by
 * author (`entries: Record<playerId, { answerId, text }>`) while the stage is a
 * list keyed by an opaque `answerId`, so leaking authorship would take an
 * active reverse lookup rather than forgetting to delete a field — and adding
 * the field here to "just pass it through" is a compile error at every call
 * site that builds one. `id` must never encode a `playerId`.
 */
export interface StagedAnswer { id: string; text: string }

/** An answer whose author is public: REVEAL and ROUND_END only. */
export interface RevealedAnswer { id: string; text: string; authorId: string }

/** One player's guess at who wrote the answer under scrutiny. */
export interface GuessLine { playerId: string; guessedId: string }

/** Points a player earned from one staged answer (zero entries included). */
export interface AwardLine { playerId: string; points: number }

/** Fields carried by every in-game (non-LOBBY, non-FINALE) view. */
export interface GameViewCommon {
  code: string;
  /** 1-based; 0 before the first round has started. */
  round: number;
  roundCount: number;
  /** Epoch ms when the current phase ends, or null when untimed. */
  deadline: number | null;
  players: Player[];
  scoreboard: ScoreEntry[];
}

export interface IntroView extends GameViewCommon { phase: "INTRO" }

export interface WritingView extends GameViewCommon {
  phase: "WRITING";
  /** The prompt, in the reader's language. Everyone gets the same one. */
  prompt: string;
  /**
   * Who has handed something in. Public: the writing screen shows the room
   * filling up, and nothing is staged yet, so this names no author of
   * anything.
   *
   * It does narrow the field for later — a player who submitted nothing
   * cannot have written a staged answer, and a client could remember that
   * into GUESSING. That is accepted (T4 ruling 30): `candidates` still lists
   * everyone so the *view* never names the author, and in a room where
   * everybody writes there is nothing to narrow. The guessing counter is
   * deliberately NOT the same shape — see `GuessingView.guessedCount`.
   */
  submittedIds: string[];
  /**
   * This reader's own entry, echoed back so a reconnect mid-WRITING doesn't
   * lose it and an edit starts from what they wrote. Absent until they submit
   * — never another player's entry, and never blanked.
   */
  myEntry?: string;
}

export interface GuessingView extends GameViewCommon {
  phase: "GUESSING";
  /** Kept visible while one answer is under scrutiny. */
  prompt: string;
  answer: StagedAnswer;
  /** 1-based position of this answer within the round's staged answers. */
  answerIndex: number;
  answerTotal: number;
  /**
   * Who this reader may accuse: **everyone except themselves**, including
   * players who wrote nothing this round.
   *
   * Two leaks this rules out, both by construction. Dropping the author for
   * every guesser reveals authorship by omission. Filtering to players who
   * submitted reveals who didn't write. So the only id ever missing from this
   * list is the reader's own.
   */
  candidates: string[];
  /**
   * Present only for the author of the staged answer, who does not guess.
   * Presence *is* the signal — there is no `role` in this game, and the only
   * asymmetry is per-answer authorship.
   */
  youWrote?: true;
  /** This reader's locked-in guess, once cast. Absent before that. */
  myGuess?: string;
  /**
   * How many players have guessed on this answer. A count, never a list:
   * the author never guesses, so `guessedIds` would name them by omission
   * the instant everyone else had voted. A number names nobody.
   */
  guessedCount: number;
}

export interface RevealView extends GameViewCommon {
  phase: "REVEAL";
  prompt: string;
  answer: StagedAnswer;
  answerIndex: number;
  answerTotal: number;
  /** Public now, and carried by the *view* — never by `StagedAnswer`. */
  authorId: string;
  guesses: GuessLine[];
  awarded: AwardLine[];
}

export interface RoundEndView extends GameViewCommon {
  phase: "ROUND_END";
  prompt: string;
  /** Every entry with its author, including the ones never staged. */
  answers: RevealedAnswer[];
}

export interface FinaleView {
  phase: "FINALE";
  code: string;
  players: Player[];
  scoreboard: ScoreEntry[];
}

export type RoomView =
  | LobbyView
  | IntroView
  | WritingView
  | GuessingView
  | RevealView
  | RoundEndView
  | FinaleView;

export type ClientMessage =
  /** `lang` is optional; omitted means `DEFAULT_LANG`, so old clients still work. */
  | { v: 1; t: "join"; name: string; emoji: EmojiId; lang?: Lang }
  | { v: 1; t: "reconnect"; playerId: string; token: string }
  | { v: 1; t: "updateSettings"; patch: Partial<Settings> }
  | { v: 1; t: "startGame" }
  | { v: 1; t: "leave" }
  | { v: 1; t: "ping" }
  /**
   * WRITING only, and an **upsert**: re-submitting overwrites, so a player can
   * keep editing until the deadline. There is deliberately no
   * `ALREADY_ANSWERED`.
   */
  | { v: 1; t: "submitEntry"; text: string }
  /**
   * `answerId` is carried explicitly so a tap that lands after the stage
   * advanced is rejected with `STALE_ANSWER` rather than silently applied to
   * the next answer. On a phone that is a real race, not a theoretical one.
   */
  | { v: 1; t: "submitGuess"; answerId: string; playerId: string }
  | { v: 1; t: "setLang"; lang: Lang };

export type ErrorCode =
  | "BAD_MESSAGE" | "ROOM_FULL" | "NAME_TAKEN"
  | "NOT_HOST" | "UNKNOWN_PLAYER" | "GAME_STARTED" | "INTERNAL"
  | "WRONG_PHASE" | "RATE_LIMITED"
  /** You wrote the answer under scrutiny; you cannot guess on it. */
  | "IS_AUTHOR"
  /** One guess per answer, and it is final. */
  | "ALREADY_GUESSED"
  /** The stage moved on before the tap landed. */
  | "STALE_ANSWER";

export type ServerMessage =
  | { v: 1; t: "welcome"; playerId: string; token: string }
  /**
   * `now` is the server's clock (epoch ms) at the moment the snapshot was
   * built. Countdowns are deadline-based, not ticked: the client derives
   * `offset = now - Date.now()` on receipt and renders
   * `deadline - (Date.now() + offset)`, so a skewed device clock cannot
   * desync it and the server never has to broadcast once a second.
   */
  | { v: 1; t: "state"; you: string; isHost: boolean; room: RoomView; now: number }
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

function validText(text: unknown, max: number): text is string {
  return typeof text === "string"
    && text.trim().length > 0
    && text.trim().length <= max;
}

/** An opaque id minted by the server (`playerId`, `answerId`). */
function validId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function validLang(v: unknown): v is Lang {
  return v === "en" || v === "da";
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!isPlainObject(data) || data.v !== PROTOCOL_VERSION) return null;
  switch (data.t) {
    case "join": {
      if (!validName(data.name) || !validEmoji(data.emoji)) return null;
      // Absent `lang` stays absent (old clients); present-but-unknown is a
      // malformed message, same as an unknown emoji.
      if (data.lang === undefined) {
        return { v: 1, t: "join", name: data.name.trim(), emoji: data.emoji };
      }
      return validLang(data.lang)
        ? { v: 1, t: "join", name: data.name.trim(), emoji: data.emoji, lang: data.lang } : null;
    }
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
    case "submitEntry":
      return validText(data.text, MAX_ENTRY_LENGTH)
        ? { v: 1, t: "submitEntry", text: data.text.trim() } : null;
    case "submitGuess":
      return validId(data.answerId) && validId(data.playerId)
        ? { v: 1, t: "submitGuess", answerId: data.answerId, playerId: data.playerId } : null;
    case "setLang":
      return validLang(data.lang) ? { v: 1, t: "setLang", lang: data.lang } : null;
    default:
      return null;
  }
}
