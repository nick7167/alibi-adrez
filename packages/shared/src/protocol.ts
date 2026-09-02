import { AVATARS } from "./emojis";
import type { Lang, PackId } from "../content/prompts";

export { AVATARS };
export type { Lang, PackId };

/** Language a client reads when nothing says otherwise. */
export const DEFAULT_LANG: Lang = "en";

export const PROTOCOL_VERSION = 1;
/**
 * The shape of a **persisted** room, which is a different thing from the wire
 * protocol: a Durable Object holds `InternalRoom` in storage across deploys,
 * so a build that changes that shape cannot read what the previous build
 * wrote.
 *
 * Bump this whenever `InternalRoom` changes incompatibly. A room stamped with
 * anything else is discarded on load rather than half-read — measured, the
 * alternative is not a crash but something worse: a pre-2 room can never
 * advance (its phase is not in the new `Phase` union), so the object re-arms
 * its alarm on a deadline that has already passed and hot-loops forever.
 *
 * 2 = the answer-all-then-guess loop: `questions`, `entries` keyed by author
 * then question, `handedIn`, `prevRanks`, and settings with `answerSec` /
 * `revealSec` / `standingsEvery`.
 */
export const ROOM_SCHEMA = 2;
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
  | "LOBBY" | "INTRO" | "ANSWERING"
  | "GUESSING" | "REVEAL" | "STANDINGS" | "FINALE";

export type EmojiId = string;

export interface Player {
  id: string;
  name: string;
  emoji: EmojiId;
  /** Language this player reads; personalizes their snapshots. */
  lang: Lang;
  /** Server-controlled participant used only by the visible practice mode. */
  isBot?: true;
}

export interface Settings {
  /**
   * How many questions everyone answers, up front, in one sitting. Every
   * question in a game is distinct, so this is additionally capped at runtime
   * by how many prompts the enabled packs actually hold — a host running the
   * smallest single pack tops out at 15, not 20.
   */
  questions: number;
  /**
   * How many guessing rounds the game plays. One round is **one question and
   * one answer to it**, so this is also "how many answers get put to the
   * room". Capped at runtime by the answer pool (players x questions): the
   * game cannot guess an answer nobody wrote.
   */
  rounds: number;
  /** Seconds for the whole answering phase — all the questions, one clock. */
  answerSec: number;
  /** Seconds to guess who wrote the one answer on the stage. */
  guessSec: number;
  /** Seconds the author and the points stay on screen. */
  revealSec: number;
  /** Show the standings every N rounds. 0 turns the beat off entirely. */
  standingsEvery: number;
  /** Prompt packs in play. Never empty; `spicy` is opt-in. */
  packs: PackId[];
}

/**
 * Roughly a nine-minute game: 3s intro, 3 minutes to answer five questions,
 * then ten rounds at 25s + 7s with a standings beat every third one.
 */
export const DEFAULT_SETTINGS: Settings = {
  questions: 5,
  rounds: 10,
  answerSec: 180,
  guessSec: 25,
  revealSec: 7,
  standingsEvery: 3,
  packs: ["everyday", "opinions", "absurd"],
};

/** Inclusive bounds for every numeric dial, and the stepper's increment.
    `state.ts`'s `nextSettings` clamps to these; the lobby's steppers read
    them so a tap can never send a value the server would clamp away. */
export const SETTINGS_BOUNDS = {
  questions: { min: 1, max: 20, step: 1 },
  rounds: { min: 1, max: 40, step: 1 },
  answerSec: { min: 30, max: 600, step: 15 },
  guessSec: { min: 10, max: 60, step: 5 },
  revealSec: { min: 3, max: 15, step: 1 },
  standingsEvery: { min: 0, max: 10, step: 1 },
} as const;

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

/** An answer whose author is public: REVEAL only. */
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

export interface AnsweringView extends GameViewCommon {
  phase: "ANSWERING";
  /**
   * Every question of the game, in the reader's language, in the order they
   * are presented. Same list for everyone — only the language differs.
   */
  questions: string[];
  /**
   * The reader's **own** answers, keyed by question index. Built straight from
   * their own slot in the private store, never by filtering a bigger
   * structure, so there is no path by which another player's text can reach
   * it. A question they have not answered simply has no key.
   *
   * Echoed back so a reconnect mid-phase repopulates every field instead of
   * silently losing what they typed.
   */
  myAnswers: Record<number, string>;
  /** Whether this reader has pressed "I'm done". Their own flag only. */
  handedIn: boolean;
  /**
   * How many players have handed in. A count, **never a list**, for the same
   * structural reason as `GuessingView.guessedCount`.
   *
   * A list leaks nothing at the instant it is sent — nothing is staged during
   * ANSWERING — which is exactly what makes it easy to wave through. But
   * `candidates` is shaped as "everyone except me, including players who wrote
   * nothing" precisely so a guesser cannot rule out the non-writers, and a
   * client that saw the list could remember who never answered and eliminate
   * them once an answer to that question is staged. That hands back exactly
   * what the candidate rule protects. The screen says "3 of 5 done" and names
   * nobody.
   */
  doneCount: number;
}

export interface GuessingView extends GameViewCommon {
  phase: "GUESSING";
  /** Kept visible while one answer is under scrutiny. */
  prompt: string;
  answer: StagedAnswer;
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
  /** Public now, and carried by the *view* — never by `StagedAnswer`. */
  authorId: string;
  guesses: GuessLine[];
  awarded: AwardLine[];
}

/** One row of the standings beat. */
export interface StandingsLine {
  playerId: string;
  score: number;
  /** Dense rank: players on equal scores share a rank, so a tie reads as one. */
  rank: number;
  /**
   * Places moved since the previous standings beat. Positive is a climb,
   * negative a drop, 0 unchanged. At the first beat everyone starts level, so
   * this is movement from the opening all-square position.
   */
  delta: number;
}

/**
 * The periodic standings beat, every `settings.standingsEvery` rounds.
 *
 * Nothing here is secret — it is scores, which every view already carries in
 * `scoreboard`. The reason it is its own view is `delta`: movement can only be
 * computed against the ranks as they stood at the *previous* beat, which the
 * client has no way to remember across a reconnect.
 */
export interface StandingsView extends GameViewCommon {
  phase: "STANDINGS";
  lines: StandingsLine[];
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
  | AnsweringView
  | GuessingView
  | RevealView
  | StandingsView
  | FinaleView;

export type ClientMessage =
  /** `lang` is optional; omitted means `DEFAULT_LANG`, so old clients still work. */
  | { v: 1; t: "join"; name: string; emoji: EmojiId; lang?: Lang }
  | { v: 1; t: "reconnect"; playerId: string; token: string }
  | { v: 1; t: "updateSettings"; patch: Partial<Settings> }
  | { v: 1; t: "startGame" }
  /** Host-only solo review path: replace existing bots, add two, and start. */
  | { v: 1; t: "startPractice" }
  /**
   * FINALE only: put the room back in the lobby with everyone still seated and
   * the settings kept, so the same group can play again without re-sharing the
   * code.
   *
   * **Any seated player may send it, unlike `startGame`.** It is the finale's
   * only way onward — there is no leave control on that screen — so making it
   * host-only would strand every other player on a terminal screen whenever the
   * host put their phone down. The cost is that anyone can move the room off
   * the results, which is a deliberate tap on a clearly-labelled button in a
   * game that is already over, and the lobby is a fine place to end up.
   */
  | { v: 1; t: "returnToLobby" }
  | { v: 1; t: "leave" }
  /** Host-only removal. Revokes the target's current room session. */
  | { v: 1; t: "kick"; targetPlayerId: string }
  | { v: 1; t: "ping" }
  /**
   * ANSWERING only, and an **upsert**: re-submitting the same `questionIndex`
   * overwrites, so a player can keep editing until they hand in or the clock
   * runs out. There is deliberately no `ALREADY_ANSWERED`.
   *
   * `questionIndex` is 0-based into the game's question list. The `answerId`
   * is minted once per (player, question), so editing does not move an answer
   * to a different slot in the pool.
   */
  | { v: 1; t: "submitEntry"; questionIndex: number; text: string }
  /**
   * ANSWERING only: "I have written what I am going to write." Idempotent, and
   * legal with questions left blank — a player who hates a question should be
   * able to skip it rather than hold the whole room until the clock expires.
   */
  | { v: 1; t: "handIn" }
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
  | "WRONG_PHASE" | "RATE_LIMITED" | "CONTENT_BLOCKED" | "KICKED"
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

/** A 0-based question index, bounded by the largest set a host can configure. */
function validQuestionIndex(v: unknown): v is number {
  return typeof v === "number"
    && Number.isInteger(v)
    && v >= 0
    && v < SETTINGS_BOUNDS.questions.max;
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
    case "startPractice":
    case "returnToLobby":
    case "leave":
    case "ping":
    case "handIn":
      return { v: 1, t: data.t };
    case "kick":
      return validId(data.targetPlayerId)
        ? { v: 1, t: "kick", targetPlayerId: data.targetPlayerId }
        : null;
    case "submitEntry":
      // The index is bounded by the largest question set a host can configure,
      // the same defensive ceiling `validId` gives an opaque id. The engine
      // still rejects an index past the game's actual question count.
      return validQuestionIndex(data.questionIndex) && validText(data.text, MAX_ENTRY_LENGTH)
        ? { v: 1, t: "submitEntry", questionIndex: data.questionIndex, text: data.text.trim() }
        : null;
    case "submitGuess":
      return validId(data.answerId) && validId(data.playerId)
        ? { v: 1, t: "submitGuess", answerId: data.answerId, playerId: data.playerId } : null;
    case "setLang":
      return validLang(data.lang) ? { v: 1, t: "setLang", lang: data.lang } : null;
    default:
      return null;
  }
}
