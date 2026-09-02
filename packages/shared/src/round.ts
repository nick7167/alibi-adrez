import { PROMPTS, promptsForPacks } from "../content/prompts";
import type { ClientMessage, Lang, Phase } from "./protocol";
import { MIN_PLAYERS } from "./protocol";
import type { ApplyResult, EventDeps, InternalRoom } from "./state";

/**
 * The round engine, kept out of `state.ts` so the lobby/session code stays
 * readable. Everything here is pure: a transition takes a room, mutates a
 * clone, and returns it. Every clock read and every random choice goes through
 * `EventDeps`, so a test can replay a whole game deterministically and the
 * Durable Object stays the only thing that knows what time it is.
 *
 * `round.ts` imports only *types* from `state.ts`; `state.ts` imports this
 * module's functions. That keeps the dependency one-way at runtime.
 *
 * **The loop.** A game is one long ANSWERING phase in which everybody answers
 * every question, followed by a series of guessing rounds. **A round is one
 * question and one answer to it** — not a batch. See
 * `docs/superpowers/specs/2026-08-28-answering-phase-design.md`.
 */

// ------------------------------------------------------------------ the state

/** One player's answer to one question. Stored keyed by author, then question. */
export interface Entry {
  /**
   * The id this answer wears on the public stage. Minted with `deps.newId()`
   * and therefore unrelated to the author's `playerId` — see `GuessRound`.
   */
  answerId: string;
  text: string;
}

/** Points one player earned from one staged answer. Zero entries included. */
export interface AwardEntry {
  playerId: string;
  points: number;
}

/**
 * One guessing round: a single question, and a single answer to it.
 *
 * The anonymity of the whole game rests on the split between this and
 * `room.entries`:
 *
 *  - `room.entries` is **private and keyed by author**. It is the only place
 *    authorship is written down.
 *  - a round names only an opaque `answerId`, minted with `deps.newId()`.
 *
 * So an `answerId` neither encodes nor derives from a `playerId`. Leaking
 * authorship requires actively performing a reverse lookup over `entries`
 * rather than forgetting to delete a field, which is the difference between a
 * bug you have to write and a bug you have to remember not to write.
 */
export interface GuessRound {
  /** 1-based. */
  index: number;
  /** Index into `room.questions`. */
  questionIndex: number;
  /** The answer under scrutiny. */
  answerId: string;
  /** guesserId -> the playerId they accused. */
  guesses: Record<string, string>;
  /** What each present player earned when it was revealed. Empty until REVEAL. */
  awarded: AwardEntry[];
}

// -------------------------------------------------------------- phase timings

/** The "get ready" splash. Once per game, before any question is shown. */
export const INTRO_MS = 3_000;
/**
 * The standings beat. Fixed rather than a seventh host dial: it is a beat you
 * watch, not a phase you play, and every second of it is a second not playing.
 */
export const STANDINGS_MS = 6_000;
/** Correct attribution. */
export const POINTS_CORRECT_GUESS = 2;
/** Paid to the author, per guesser they fooled. */
export const POINTS_FOOLED_GUESSER = 1;

/**
 * How long each phase lasts, or `null` for the two untimed ones.
 *
 * This table plus `enterPhase` is the reason the room cannot hang: the Durable
 * Object arms its single alarm solely off `room.deadline`, so a phase entered
 * without one is a room that never wakes up again. The inner
 * `GUESSING -> REVEAL -> GUESSING` loop gives that mistake several places to
 * happen, so there is exactly one place it can be made.
 */
export const PHASE_MS: Record<Phase, (room: InternalRoom) => number | null> = {
  LOBBY: () => null,
  INTRO: () => INTRO_MS,
  ANSWERING: (room) => room.settings.answerSec * 1000,
  GUESSING: (room) => room.settings.guessSec * 1000,
  REVEAL: (room) => room.settings.revealSec * 1000,
  STANDINGS: () => STANDINGS_MS,
  FINALE: () => null,
};

/**
 * **The only writer of `room.phase` and `room.deadline`.** Every transition in
 * this file goes through it, and nothing outside this file sets either field.
 *
 * The deadline is re-based off `deps.now()` rather than off the deadline that
 * was missed, so a Durable Object that slept through a phase resumes on a
 * fresh timer instead of fast-forwarding to the finale. Mutates in place;
 * callers own the clone.
 */
export function enterPhase(room: InternalRoom, phase: Phase, deps: EventDeps): void {
  room.phase = phase;
  const ms = PHASE_MS[phase](room);
  room.deadline = ms === null ? null : deps.now() + ms;
}

// ------------------------------------------------------------------- reading

/** True while a game is live, i.e. neither LOBBY nor FINALE. */
export function inGame(room: InternalRoom): boolean {
  return room.phase !== "LOBBY" && room.phase !== "FINALE";
}

export function currentRound(room: InternalRoom): GuessRound | undefined {
  return room.rounds.length === 0 ? undefined : room.rounds[room.rounds.length - 1];
}

/**
 * The reverse lookup, in one place. Everything that needs authorship calls
 * this; nothing else walks `entries` looking for an `answerId`.
 *
 * `undefined` means the answer is **voided** — its author left the room and
 * their entries were deleted.
 */
export function authorOf(room: InternalRoom, answerId: string): string | undefined {
  for (const [playerId, byQuestion] of Object.entries(room.entries)) {
    for (const entry of Object.values(byQuestion)) {
      if (entry.answerId === answerId) return playerId;
    }
  }
  return undefined;
}

/**
 * Who still owes a guess on the live round: everyone present except the
 * author. A player who wrote nothing still guesses.
 */
export function eligibleGuessers(room: InternalRoom, round: GuessRound): string[] {
  const author = authorOf(room, round.answerId);
  return room.players.filter((p) => p.id !== author).map((p) => p.id);
}

/**
 * The players the Durable Object currently has a live socket for.
 *
 * **Early-resolve decisions only.** A locked phone is not a leave: a player
 * whose screen went dark still counts for scoring, for staging, for `awarded`
 * and for `candidates` — all of which keep reading `room.players` — but the
 * room must not sit out a three-minute answering clock waiting for a hand-in
 * that cannot arrive. `undefined` means "assume everybody", i.e. the behaviour
 * before this existed.
 *
 * It is an argument and never a field on `InternalRoom`: the room is
 * persisted, and a socket set written to storage is a lie the moment the
 * Durable Object restarts.
 */
export type ConnectedIds = ReadonlySet<string> | undefined;

/**
 * Narrows "who we are still waiting for" to the players who could actually
 * act.
 *
 * An empty result is deliberately left empty rather than falling back to the
 * roster: both callers refuse to resolve on an empty list, so a room whose
 * last socket dropped waits for its phase timer instead of resolving on
 * behalf of nobody.
 */
function awaited(owed: string[], connected: ConnectedIds): string[] {
  return connected === undefined ? owed : owed.filter((id) => connected.has(id));
}

// ------------------------------------------------------------------- choosing

function pickIndex(length: number, deps: EventDeps): number {
  return Math.min(length - 1, Math.floor(deps.random() * length));
}

/**
 * The game's question set: `settings.questions` distinct prompts drawn from the
 * enabled packs.
 *
 * Capped by what the catalogue actually holds — a host running the smallest
 * single pack cannot have twenty distinct questions, and repeating one would
 * put two identical prompts in the same game. Falls back to the whole
 * catalogue if the enabled packs somehow resolve to nothing, so a game can
 * always start.
 */
export function pickQuestions(room: InternalRoom, deps: EventDeps): string[] {
  const enabled = promptsForPacks(room.settings.packs);
  const catalogue = enabled.length > 0 ? enabled : PROMPTS;
  const pool = catalogue.map((p) => p.id);
  const wanted = Math.min(room.settings.questions, pool.length);
  const chosen: string[] = [];
  for (let i = 0; i < wanted; i++) {
    chosen.push(pool.splice(pickIndex(pool.length, deps), 1)[0]!);
  }
  return chosen;
}

/** One (author, question) slot that could still be put to the room. */
interface Candidate {
  playerId: string;
  questionIndex: number;
  answerId: string;
}

/**
 * Every answer that still has an author and has not already been guessed on.
 *
 * Reads `room.entries`, which is why this lives in `round.ts` (the store's
 * owner) rather than anywhere else. It yields ids and indices — never text.
 */
function remainingPool(room: InternalRoom): Candidate[] {
  const used = new Set(room.rounds.map((r) => r.answerId));
  const pool: Candidate[] = [];
  // Roster order, so the pool is deterministic given the same room.
  for (const player of room.players) {
    const byQuestion = room.entries[player.id];
    if (byQuestion === undefined) continue;
    for (const [key, entry] of Object.entries(byQuestion)) {
      if (used.has(entry.answerId)) continue;
      pool.push({ playerId: player.id, questionIndex: Number(key), answerId: entry.answerId });
    }
  }
  return pool;
}

/** How many rounds this game can still honestly promise. */
export function effectiveRoundCount(room: InternalRoom): number {
  return Math.min(room.settings.rounds, room.rounds.length + remainingPool(room).length);
}

/**
 * Picks the next (question, answer) pair.
 *
 * Three properties, in priority order:
 *
 *  1. **Never the same question twice in a row.** The room should not be asked
 *     about the same prompt back to back — that is the whole reason the pool
 *     is mixed rather than grouped by question. The rule *relaxes* only when
 *     every remaining answer belongs to the last question, which happens with
 *     a one-question game and at the tail of a nearly-exhausted pool. Relaxing
 *     beats ending the game early.
 *  2. **Spread across players.** Within the legal candidates the pool narrows
 *     to whoever has been staged fewest times, so `max(stagedCount) -
 *     min(stagedCount) <= 1` holds across the game. Being the answer means
 *     sitting the round out — the author does not guess — so a player who kept
 *     getting picked would be a player who kept not playing.
 *  3. **Random within that.** Which of the least-staged players, and which of
 *     their answers, is `deps.random()`.
 *
 * Returns `undefined` when the pool is empty.
 */
export function pickPair(room: InternalRoom, deps: EventDeps): Candidate | undefined {
  const pool = remainingPool(room);
  if (pool.length === 0) return undefined;

  const previous = currentRound(room);
  const lastQuestion = previous?.questionIndex ?? -1;
  const fresh = pool.filter((c) => c.questionIndex !== lastQuestion);
  const candidates = fresh.length > 0 ? fresh : pool;

  let minSeen = Infinity;
  for (const c of candidates) minSeen = Math.min(minSeen, room.stagedCount[c.playerId] ?? 0);
  const tier = candidates.filter((c) => (room.stagedCount[c.playerId] ?? 0) === minSeen);

  return tier[pickIndex(tier.length, deps)]!;
}

// ---------------------------------------------------------------- transitions

/** `startGame`'s body: everyone level, the questions drawn, then the splash. */
export function beginGame(room: InternalRoom, deps: EventDeps): void {
  room.scores = {};
  room.stagedCount = {};
  room.prevRanks = {};
  for (const p of room.players) {
    room.scores[p.id] = 0;
    room.stagedCount[p.id] = 0;
    // Everyone starts level, so the first standings beat measures movement
    // from a genuine all-square position rather than from nothing.
    room.prevRanks[p.id] = 1;
  }
  room.questions = pickQuestions(room, deps);
  room.entries = {};
  room.handedIn = {};
  room.rounds = [];
  enterPhase(room, "INTRO", deps);
}

const PRACTICE_QUESTIONS = ["last-search", "breakfast-today", "useless-skill"] as const;

const PRACTICE_ANSWERS: Record<(typeof PRACTICE_QUESTIONS)[number], Record<Lang, [string, string]>> = {
  "last-search": {
    en: ["Weather tomorrow", "How long to boil an egg"],
    da: ["Vejret i morgen", "Hvor længe skal et æg koge"],
  },
  "breakfast-today": {
    en: ["Toast and too much coffee", "Yoghurt with granola"],
    da: ["Toast og alt for meget kaffe", "Yoghurt med müsli"],
  },
  "useless-skill": {
    en: ["Folding fitted sheets", "Recognising songs in two seconds"],
    da: ["At folde faconlagner", "At genkende sange på to sekunder"],
  },
};

/**
 * Starts the public solo-review path on the normal game engine. Questions and
 * bot answers are fixed so every language has coherent content and the three
 * rounds spread authorship across the human and both bots.
 */
export function beginPracticeGame(room: InternalRoom, deps: EventDeps): void {
  room.settings = {
    questions: PRACTICE_QUESTIONS.length,
    rounds: 3,
    answerSec: 180,
    guessSec: 25,
    revealSec: 7,
    standingsEvery: 2,
    packs: ["everyday"],
  };
  beginGame(room, deps);
  room.questions = [...PRACTICE_QUESTIONS];
  const bots = room.players.filter((player) => player.isBot === true);
  bots.forEach((bot, botIndex) => {
    const entries: Record<number, Entry> = {};
    PRACTICE_QUESTIONS.forEach((promptId, questionIndex) => {
      entries[questionIndex] = {
        answerId: deps.newId(),
        text: PRACTICE_ANSWERS[promptId][bot.lang][botIndex % 2]!,
      };
    });
    room.entries[bot.id] = entries;
    room.handedIn[bot.id] = true;
  });
}

/**
 * Casts every pending bot vote on a practice guessing screen. It uses the
 * same submitGuess transition as a person; only the target selection is
 * automated. The first bot guesses correctly and the second takes a plausible
 * wrong option, so the reviewer sees both scoring outcomes.
 */
export function playPracticeBotGuesses(
  room: InternalRoom,
  deps: EventDeps,
): { room: InternalRoom; changed: boolean } {
  if (room.phase !== "GUESSING") return { room, changed: false };
  const live = currentRound(room);
  if (live === undefined) return { room, changed: false };
  const author = authorOf(room, live.answerId);
  if (author === undefined) return { room, changed: false };
  const bots = room.players.filter((player) => player.isBot === true);
  let next = room;
  let changed = false;
  for (const [botIndex, bot] of bots.entries()) {
    if (bot.id === author || currentRound(next)?.guesses[bot.id] !== undefined) continue;
    const wrong = next.players.find((player) => player.id !== bot.id && player.id !== author)?.id;
    const targetPlayerId = botIndex === 0 ? author : (wrong ?? author);
    const result = applyRoundMessage(next, bot.id, {
      v: 1,
      t: "submitGuess",
      answerId: live.answerId,
      playerId: targetPlayerId,
    }, deps);
    if (!result.ok) continue;
    next = result.room;
    changed = true;
    if (next.phase !== "GUESSING") break;
  }
  return { room: next, changed };
}

/**
 * Puts a finished room back in the lobby with everyone still seated.
 *
 * Clears the whole game — including `entries`, the private store. The room is
 * persisted, so leaving a finished game's answers in storage keeps them around
 * for as long as the room lives, and the next game would start with the last
 * one's text still sitting underneath it. Settings are deliberately KEPT: a
 * group that just played a five-question game almost certainly wants another
 * one, and re-dialling six settings is the friction this whole button exists
 * to remove.
 */
export function returnToLobby(room: InternalRoom, deps: EventDeps): void {
  room.questions = [];
  room.entries = {};
  room.handedIn = {};
  room.rounds = [];
  room.scores = {};
  room.stagedCount = {};
  room.prevRanks = {};
  enterPhase(room, "LOBBY", deps);
}

/**
 * Opens the next round, or ends the game.
 *
 * The pair is chosen here rather than baked into a sequence up front, so a
 * player leaving simply shrinks the pool instead of invalidating a plan the
 * room is halfway through.
 */
function nextRound(room: InternalRoom, deps: EventDeps): void {
  if (room.rounds.length >= room.settings.rounds) {
    enterPhase(room, "FINALE", deps);
    return;
  }
  const pick = pickPair(room, deps);
  if (pick === undefined) {
    // Nothing left anybody could be asked about.
    enterPhase(room, "FINALE", deps);
    return;
  }
  room.stagedCount[pick.playerId] = (room.stagedCount[pick.playerId] ?? 0) + 1;
  room.rounds.push({
    index: room.rounds.length + 1,
    questionIndex: pick.questionIndex,
    answerId: pick.answerId,
    guesses: {},
    awarded: [],
  });
  enterPhase(room, "GUESSING", deps);
}

/** Dense ranks over the current scores: equal scores share a rank. */
export function ranksFor(room: InternalRoom): Record<string, number> {
  const board = room.players
    .map((p) => ({ playerId: p.id, score: room.scores[p.id] ?? 0 }))
    .sort((a, b) =>
      b.score - a.score || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  const ranks: Record<string, number> = {};
  let rank = 0;
  let prevScore: number | null = null;
  board.forEach((row, i) => {
    if (prevScore === null || row.score !== prevScore) rank = i + 1;
    prevScore = row.score;
    ranks[row.playerId] = rank;
  });
  return ranks;
}

/**
 * After a REVEAL: the standings beat if one is due, otherwise straight into
 * the next question.
 *
 * The beat is due every `standingsEvery` rounds, and never after the last one
 * — the finale is the standings, at greater length, and stopping to show them
 * six seconds before showing them again is dead air.
 */
function afterReveal(room: InternalRoom, deps: EventDeps): void {
  const every = room.settings.standingsEvery;
  const played = room.rounds.length;
  const more = played < room.settings.rounds && remainingPool(room).length > 0;
  if (every > 0 && more && played % every === 0) {
    enterPhase(room, "STANDINGS", deps);
    return;
  }
  nextRound(room, deps);
}

/** Leaving ANSWERING: draw the first pair, or end a game nobody wrote for. */
function resolveAnswering(room: InternalRoom, deps: EventDeps): void {
  nextRound(room, deps);
}

/**
 * Scores the answer under scrutiny and enters REVEAL.
 *
 * +2 to each guesser who named the author, +1 to the author per guesser they
 * fooled — applied here rather than at the end of the game so the scoreboard
 * moves continuously. `awarded` records **every present player**, zeros
 * included, so the reveal screen can say "you got nothing" without recomputing
 * anything.
 */
function resolveGuessing(room: InternalRoom, round: GuessRound, deps: EventDeps): void {
  const author = authorOf(room, round.answerId);
  if (author === undefined) {
    // Voided under us: the author left. Nothing to reveal, nothing to score.
    afterReveal(room, deps);
    return;
  }

  const points: Record<string, number> = {};
  for (const p of room.players) points[p.id] = 0;
  for (const [guesserId, guessedId] of Object.entries(round.guesses)) {
    if (guessedId === author) {
      if (points[guesserId] !== undefined) points[guesserId] += POINTS_CORRECT_GUESS;
    } else if (points[author] !== undefined) {
      points[author] += POINTS_FOOLED_GUESSER;
    }
  }

  const awarded: AwardEntry[] = [];
  for (const p of room.players) {
    const earned = points[p.id] ?? 0;
    room.scores[p.id] = (room.scores[p.id] ?? 0) + earned;
    awarded.push({ playerId: p.id, points: earned });
  }
  round.awarded = awarded;
  enterPhase(room, "REVEAL", deps);
}

/**
 * True once every player we are still waiting on has handed in — i.e. every
 * player with a live socket (all of them when the caller supplies no set).
 */
function everyoneHandedIn(room: InternalRoom, connected?: ConnectedIds): boolean {
  const owed = awaited(room.players.map((p) => p.id), connected);
  return owed.length > 0 && owed.every((id) => room.handedIn[id] === true);
}

/** True once every player we are still waiting on has guessed this round. */
function everyoneGuessed(
  room: InternalRoom,
  round: GuessRound,
  connected?: ConnectedIds,
): boolean {
  const owed = awaited(eligibleGuessers(room, round), connected);
  return owed.length > 0 && owed.every((id) => round.guesses[id] !== undefined);
}

/**
 * Timer-driven transitions. Returns the room unchanged unless the current
 * deadline has passed, and performs **exactly one phase transition per call**:
 * every deadline it sets is re-based off `deps.now()`, so a room that slept
 * through several phases resumes on a fresh clock rather than racing to the
 * finale, and the caller's catch-up loop always terminates.
 */
export function advance(
  room: InternalRoom,
  deps: EventDeps,
): { room: InternalRoom; changed: boolean } {
  if (room.deadline === null || deps.now() < room.deadline) return { room, changed: false };
  if (!inGame(room)) return { room, changed: false };
  const next = structuredClone(room);

  switch (next.phase) {
    case "INTRO":
      enterPhase(next, "ANSWERING", deps);
      return { room: next, changed: true };
    case "ANSWERING":
      resolveAnswering(next, deps);
      return { room: next, changed: true };
    case "STANDINGS":
      // The beat is over; the ranks it showed become the baseline the next one
      // measures movement against.
      next.prevRanks = ranksFor(next);
      nextRound(next, deps);
      return { room: next, changed: true };
    case "GUESSING": {
      const round = currentRound(next);
      if (round === undefined) return { room, changed: false };
      resolveGuessing(next, round, deps);
      return { room: next, changed: true };
    }
    case "REVEAL":
      afterReveal(next, deps);
      return { room: next, changed: true };
    default:
      return { room, changed: false };
  }
}

// -------------------------------------------------------------- client events

type RoundMessage = Extract<
  ClientMessage,
  { t: "submitEntry" } | { t: "submitGuess" } | { t: "handIn" }
>;

/**
 * The three in-game client messages. Pure: rejects with a code or returns the
 * next room.
 */
export function applyRoundMessage(
  room: InternalRoom,
  senderId: string,
  msg: RoundMessage,
  deps: EventDeps,
  connected?: ConnectedIds,
): ApplyResult {
  if (!room.players.some((p) => p.id === senderId)) {
    return { ok: false, code: "UNKNOWN_PLAYER", room };
  }
  if (!inGame(room)) return { ok: false, code: "WRONG_PHASE", room };

  switch (msg.t) {
    case "submitEntry": {
      if (room.phase !== "ANSWERING") return { ok: false, code: "WRONG_PHASE", room };
      // The parser bounds the index defensively; this is the real bound.
      if (msg.questionIndex >= room.questions.length) {
        return { ok: false, code: "BAD_MESSAGE", room };
      }
      const next = structuredClone(room);
      const mine = next.entries[senderId] ?? {};
      const existing = mine[msg.questionIndex];
      // Upsert: a player may keep editing, and the answerId is minted once so
      // an edit does not move them to a different slot in the pool.
      mine[msg.questionIndex] = {
        answerId: existing?.answerId ?? deps.newId(),
        text: msg.text,
      };
      next.entries[senderId] = mine;
      return { ok: true, room: next };
    }

    case "handIn": {
      if (room.phase !== "ANSWERING") return { ok: false, code: "WRONG_PHASE", room };
      const next = structuredClone(room);
      // Idempotent, and legal with questions left blank.
      next.handedIn[senderId] = true;
      if (everyoneHandedIn(next, connected)) resolveAnswering(next, deps);
      return { ok: true, room: next };
    }

    case "submitGuess": {
      if (room.phase !== "GUESSING") return { ok: false, code: "WRONG_PHASE", room };
      const live = currentRound(room);
      if (live === undefined) return { ok: false, code: "WRONG_PHASE", room };
      // The race this whole field exists for: a tap that lands after the round
      // advanced must not apply to the next answer.
      if (live.answerId !== msg.answerId) return { ok: false, code: "STALE_ANSWER", room };
      if (authorOf(room, live.answerId) === senderId) {
        return { ok: false, code: "IS_AUTHOR", room };
      }
      if (live.guesses[senderId] !== undefined) {
        return { ok: false, code: "ALREADY_GUESSED", room };
      }
      // Candidates are "everyone except me": accusing yourself, or a player
      // who is not in the room, is a malformed message rather than a rule.
      if (msg.playerId === senderId || !room.players.some((p) => p.id === msg.playerId)) {
        return { ok: false, code: "BAD_MESSAGE", room };
      }
      const next = structuredClone(room);
      const round = currentRound(next)!;
      round.guesses[senderId] = msg.playerId;
      if (everyoneGuessed(next, round, connected)) resolveGuessing(next, round, deps);
      return { ok: true, room: next };
    }
  }
}

/**
 * Called on the **already-mutated** room, after the player has been spliced out
 * of `players` and their `scores`/`stagedCount`/`sessions` entries deleted.
 *
 * One deletion does most of the work: the leaver's whole `entries` map goes,
 * which **voids** every answerId they own. Beyond that:
 *
 *  1. below `MIN_PLAYERS` the game ends at FINALE with scores as they stand;
 *  2. losing the author of the answer under scrutiny during GUESSING ends that
 *     round — there is nobody left to reveal — but an **in-flight REVEAL is
 *     left to finish**, because it is already scored and on screen;
 *  3. a guesser leaving can complete the round: their guess is withdrawn
 *     before the "everyone has guessed" check, so the phase resolves early
 *     rather than waiting out a timer nobody is left to beat.
 */
export function handlePlayerLeft(
  room: InternalRoom,
  leaverId: string,
  deps: EventDeps,
  connected?: ConnectedIds,
): void {
  if (!inGame(room)) return;

  if (room.players.length < MIN_PLAYERS) {
    enterPhase(room, "FINALE", deps);
    return;
  }

  const round = currentRound(room);
  const wasStagedAuthor =
    round !== undefined && authorOf(room, round.answerId) === leaverId;

  delete room.entries[leaverId];
  delete room.handedIn[leaverId];
  delete room.prevRanks[leaverId];
  for (const r of room.rounds) delete r.guesses[leaverId];

  if (room.phase === "ANSWERING") {
    // Their missing hand-in no longer blocks the room.
    if (everyoneHandedIn(room, connected)) resolveAnswering(room, deps);
    return;
  }

  if (room.phase === "GUESSING" && round !== undefined) {
    if (wasStagedAuthor) {
      // Nothing left to reveal. Straight on to the next question.
      afterReveal(room, deps);
      return;
    }
    if (everyoneGuessed(room, round, connected)) resolveGuessing(room, round, deps);
  }
  // REVEAL / STANDINGS / INTRO: already scored or nothing pending.
}

/**
 * Re-runs the early-resolve check for the live phase **without a client
 * message**, for the one event that has no message: a socket dropping.
 *
 * A phone locking can be the last thing the room was waiting for — everybody
 * else has already handed in or guessed, and then the straggler disappears. No
 * further message arrives to re-evaluate the check, so the Durable Object
 * calls this from its close handler with the sockets that are left. Pure, and
 * a no-op unless the phase actually resolves.
 */
export function resolveIfEveryoneReady(
  room: InternalRoom,
  deps: EventDeps,
  connected: ConnectedIds,
): { room: InternalRoom; changed: boolean } {
  if (!inGame(room)) return { room, changed: false };

  if (room.phase === "ANSWERING") {
    if (!everyoneHandedIn(room, connected)) return { room, changed: false };
    const next = structuredClone(room);
    resolveAnswering(next, deps);
    return { room: next, changed: true };
  }

  if (room.phase === "GUESSING") {
    const live = currentRound(room);
    if (live === undefined) return { room, changed: false };
    if (!everyoneGuessed(room, live, connected)) return { room, changed: false };
    const next = structuredClone(room);
    resolveGuessing(next, currentRound(next)!, deps);
    return { room: next, changed: true };
  }

  return { room, changed: false };
}
