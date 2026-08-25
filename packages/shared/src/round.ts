import { PROMPTS, promptsForPacks } from "../content/prompts";
import type { ClientMessage, Phase } from "./protocol";
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
 */

// ------------------------------------------------------------------ the state

/** One player's answer to this round's prompt. Stored keyed by its author. */
export interface RoundEntry {
  /**
   * The id this answer wears on the public stage. Minted with `deps.newId()`
   * and therefore unrelated to the author's `playerId` — see `RoundState`.
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
 * One round.
 *
 * The anonymity of the whole game rests on the shape of two fields:
 *
 *  - `entries` is **private and keyed by author**. It is the only place
 *    authorship is written down.
 *  - `order` is the **public stage**: a list of opaque `answerId`s, minted
 *    with `deps.newId()` and shuffled with `deps.random()`.
 *
 * So an `answerId` neither encodes nor derives from a `playerId`, and the
 * stage order does not follow join order. Leaking authorship then requires
 * actively performing a reverse lookup over `entries` rather than forgetting
 * to delete a field, which is the difference between a bug you have to write
 * and a bug you have to remember not to write.
 */
export interface RoundState {
  /** 1-based. */
  index: number;
  promptId: string;
  /** playerId -> their answer. A player who wrote nothing has **no key** here. */
  entries: Record<string, RoundEntry>;
  /** The staged answerIds, shuffled. Never spliced — see `handlePlayerLeft`. */
  order: string[];
  /** Index into `order` of the answer under scrutiny. */
  stage: number;
  /** answerId -> guesserId -> the playerId they accused. */
  guesses: Record<string, Record<string, string>>;
  /** answerId -> what each present player earned when it was revealed. */
  awarded: Record<string, AwardEntry[]>;
}

// -------------------------------------------------------------- phase timings

/** The "get ready" splash. Once per game, before round 1 exists. */
export const INTRO_MS = 3_000;
/** Long enough to read the author, the guesses and the points. */
export const REVEAL_MS = 7_000;
/** Every answer of the round with its author, staged or not. */
export const ROUND_END_MS = 8_000;
/** Never stage more than this, however big the room is. */
export const MAX_STAGED = 4;
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
  WRITING: (room) => room.settings.writeSec * 1000,
  GUESSING: (room) => room.settings.guessSec * 1000,
  REVEAL: () => REVEAL_MS,
  ROUND_END: () => ROUND_END_MS,
  FINALE: () => null,
};

/**
 * **The only writer of `room.phase` and `room.deadline`.** Every transition in
 * this file goes through it, and nothing outside this file sets either field.
 *
 * The deadline is re-based off `deps.now()` rather than off the deadline that
 * was missed, so a Durable Object that slept through a phase resumes on a
 * fresh timer instead of fast-forwarding to the finale (Alibi ledger, T3
 * ruling 2). Mutates in place; callers own the clone.
 */
export function enterPhase(room: InternalRoom, phase: Phase, deps: EventDeps): void {
  room.phase = phase;
  const ms = PHASE_MS[phase](room);
  room.deadline = ms === null ? null : deps.now() + ms;
}

// ------------------------------------------------------------------- reading

/** True while a round is live, i.e. neither LOBBY nor FINALE. */
export function inGame(room: InternalRoom): boolean {
  return room.phase !== "LOBBY" && room.phase !== "FINALE";
}

export function currentRound(room: InternalRoom): RoundState | undefined {
  return room.rounds.length === 0 ? undefined : room.rounds[room.rounds.length - 1];
}

/**
 * The reverse lookup, in one place. Everything that needs authorship calls
 * this; nothing else walks `entries` looking for an `answerId`.
 *
 * `undefined` means the answer is **voided** — its author left the room and
 * their entry was deleted. `order` is never spliced, so a voided slot stays in
 * place and `stage` cannot be invalidated underneath itself.
 */
export function authorOf(round: RoundState, answerId: string): string | undefined {
  for (const [playerId, entry] of Object.entries(round.entries)) {
    if (entry.answerId === answerId) return playerId;
  }
  return undefined;
}

/** The answerId under scrutiny, or `undefined` past the end of the stage. */
export function stagedAnswerId(round: RoundState): string | undefined {
  return round.order[round.stage];
}

/**
 * Who still owes a guess on `answerId`: everyone present except its author.
 * A player who wrote nothing still guesses; a voided answer (no author) is
 * guessed by everybody, though `advance` skips those before it gets here.
 */
export function eligibleGuessers(
  room: InternalRoom,
  round: RoundState,
  answerId: string,
): string[] {
  const author = authorOf(round, answerId);
  return room.players.filter((p) => p.id !== author).map((p) => p.id);
}

/**
 * The players the Durable Object currently has a live socket for.
 *
 * **Early-resolve decisions only.** A locked phone is not a leave: a player
 * whose screen went dark still counts for scoring, for staging, for `awarded`
 * and for `candidates` — all of which keep reading `room.players` — but the
 * room must not sit out a 60-second writing timer waiting for an answer that
 * cannot arrive. `undefined` means "assume everybody", i.e. the behaviour
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
 * behalf of nobody. (A fallback was tried and was unobservable — dead code.)
 */
function awaited(owed: string[], connected: ConnectedIds): string[] {
  return connected === undefined ? owed : owed.filter((id) => connected.has(id));
}

// ------------------------------------------------------------------- choosing

function pick<T>(items: readonly T[], deps: EventDeps): T {
  const idx = Math.min(items.length - 1, Math.floor(deps.random() * items.length));
  return items[idx]!;
}

/** Fisher-Yates, driven entirely by `deps.random()`. Returns a new array. */
function shuffle<T>(items: readonly T[], deps: EventDeps): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(deps.random() * (i + 1)));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}

/**
 * A prompt from the enabled packs, never repeating one this game has already
 * used while unused ones remain. Falls back to the whole catalogue if the
 * enabled packs somehow resolve to nothing, so a round can always be started.
 */
function pickPrompt(room: InternalRoom, deps: EventDeps): string {
  const enabled = promptsForPacks(room.settings.packs);
  const catalogue = enabled.length > 0 ? enabled : PROMPTS;
  const used = new Set(room.rounds.map((r) => r.promptId));
  const unused = catalogue.filter((p) => !used.has(p.id));
  const pool = unused.length > 0 ? unused : catalogue;
  return pool.length === 0 ? "" : pick(pool, deps).id;
}

/**
 * Tiered least-staged selection.
 *
 * The pool is whoever has been staged fewest times so far; within a tier the
 * choice is random, and when a tier is smaller than the slots left we take all
 * of it and descend to the next one. That spreads the spotlight across a whole
 * game without the "reset every flag" jolt of a binary has-been-staged bit.
 *
 * Fewer than two entries means there is nothing to guess about, so nothing is
 * staged at all and no `stagedCount` is spent — a player whose lone answer was
 * never put to the room should not lose their place in the rotation for it.
 */
function stageAnswers(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  const eligible = room.players.filter((p) => round.entries[p.id] !== undefined).map((p) => p.id);
  if (eligible.length < 2) {
    round.order = [];
    return;
  }
  const slots = Math.min(MAX_STAGED, eligible.length);

  const tiers = new Map<number, string[]>();
  for (const id of eligible) {
    const count = room.stagedCount[id] ?? 0;
    const tier = tiers.get(count);
    if (tier === undefined) tiers.set(count, [id]);
    else tier.push(id);
  }

  const chosen: string[] = [];
  for (const count of [...tiers.keys()].sort((a, b) => a - b)) {
    const remaining = slots - chosen.length;
    if (remaining <= 0) break;
    const tier = [...tiers.get(count)!];
    if (tier.length <= remaining) {
      chosen.push(...tier);
      continue;
    }
    for (let i = 0; i < remaining; i++) {
      const idx = Math.min(tier.length - 1, Math.floor(deps.random() * tier.length));
      chosen.push(tier.splice(idx, 1)[0]!);
    }
  }

  for (const id of chosen) room.stagedCount[id] = (room.stagedCount[id] ?? 0) + 1;
  // Shuffled, so "answer #2" never correlates with "the second player to join".
  round.order = shuffle(chosen.map((id) => round.entries[id]!.answerId), deps);
}

// ---------------------------------------------------------------- transitions

/** `startGame`'s body: everyone on zero and unstaged, then the INTRO splash. */
export function beginGame(room: InternalRoom, deps: EventDeps): void {
  room.scores = {};
  room.stagedCount = {};
  for (const p of room.players) {
    room.scores[p.id] = 0;
    room.stagedCount[p.id] = 0;
  }
  room.rounds = [];
  enterPhase(room, "INTRO", deps);
}

/** A fresh round: new prompt, empty stage, everybody writing. */
function startRound(room: InternalRoom, deps: EventDeps): void {
  room.rounds.push({
    index: room.rounds.length + 1,
    promptId: pickPrompt(room, deps),
    entries: {},
    order: [],
    stage: 0,
    guesses: {},
    awarded: {},
  });
  enterPhase(room, "WRITING", deps);
}

/** ROUND_END is over: the next prompt, or the finale. */
function afterRound(room: InternalRoom, deps: EventDeps): void {
  if (room.rounds.length >= room.settings.rounds) enterPhase(room, "FINALE", deps);
  else startRound(room, deps);
}

/**
 * Opens whatever `round.stage` now points at, skipping voided answers (their
 * author left, so there is nobody to reveal and nothing to score) and
 * discarding any guesses already cast on them. Past the end of the stage the
 * round is over.
 */
function enterStage(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  while (round.stage < round.order.length) {
    const answerId = round.order[round.stage]!;
    if (authorOf(round, answerId) !== undefined) {
      enterPhase(room, "GUESSING", deps);
      return;
    }
    delete round.guesses[answerId];
    round.stage++;
  }
  enterPhase(room, "ROUND_END", deps);
}

/** Leaving WRITING: stage what there is, or skip straight past the guessing. */
function resolveWriting(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  stageAnswers(room, round, deps);
  round.stage = 0;
  enterStage(room, round, deps);
}

/**
 * Scores the staged answer and enters REVEAL.
 *
 * +2 to each guesser who named the author, +1 to the author per guesser they
 * fooled — applied here rather than at the end of the round so the scoreboard
 * moves continuously. `awarded` records **every present player**, zeros
 * included, so the reveal screen can say "you got nothing" without recomputing
 * anything (Alibi ledger, T3 ruling 7).
 */
function resolveGuessing(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  const answerId = stagedAnswerId(round);
  const author = answerId === undefined ? undefined : authorOf(round, answerId);
  if (answerId === undefined || author === undefined) {
    // Voided or off the end: nothing to score, move on.
    round.stage++;
    enterStage(room, round, deps);
    return;
  }

  const cast = round.guesses[answerId] ?? {};
  const points: Record<string, number> = {};
  for (const p of room.players) points[p.id] = 0;
  for (const [guesserId, guessedId] of Object.entries(cast)) {
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
  round.awarded[answerId] = awarded;
  enterPhase(room, "REVEAL", deps);
}

/**
 * True once every player we are still waiting on has cast a guess on this
 * answer — i.e. every eligible guesser with a live socket (all of them when
 * the caller supplies no connected set).
 */
function everyoneGuessed(
  room: InternalRoom,
  round: RoundState,
  answerId: string,
  connected?: ConnectedIds,
): boolean {
  const cast = round.guesses[answerId] ?? {};
  const owed = awaited(eligibleGuessers(room, round, answerId), connected);
  return owed.length > 0 && owed.every((id) => cast[id] !== undefined);
}

/** True once every player we are still waiting on has an entry this round. */
function everyoneWrote(room: InternalRoom, round: RoundState, connected?: ConnectedIds): boolean {
  const owed = awaited(room.players.map((p) => p.id), connected);
  return owed.length > 0 && owed.every((id) => round.entries[id] !== undefined);
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

  if (next.phase === "INTRO") {
    startRound(next, deps);
    return { room: next, changed: true };
  }

  const round = currentRound(next);
  if (round === undefined) return { room, changed: false };

  switch (next.phase) {
    case "WRITING":
      resolveWriting(next, round, deps);
      break;
    case "GUESSING":
      resolveGuessing(next, round, deps);
      break;
    case "REVEAL":
      round.stage++;
      enterStage(next, round, deps);
      break;
    case "ROUND_END":
      afterRound(next, deps);
      break;
    default:
      return { room, changed: false };
  }
  return { room: next, changed: true };
}

// -------------------------------------------------------------- client events

type RoundMessage = Extract<ClientMessage, { t: "submitEntry" } | { t: "submitGuess" }>;

/**
 * The two in-round client messages. Pure: rejects with a code or returns the
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
  const live = currentRound(room);
  if (!inGame(room) || live === undefined) return { ok: false, code: "WRONG_PHASE", room };

  switch (msg.t) {
    case "submitEntry": {
      if (room.phase !== "WRITING") return { ok: false, code: "WRONG_PHASE", room };
      const next = structuredClone(room);
      const round = currentRound(next)!;
      // Upsert: a player may keep editing until the deadline, and the answerId
      // is minted once so an edit does not shuffle them to a new slot.
      const existing = round.entries[senderId];
      round.entries[senderId] = {
        answerId: existing?.answerId ?? deps.newId(),
        text: msg.text,
      };
      if (everyoneWrote(next, round, connected)) resolveWriting(next, round, deps);
      return { ok: true, room: next };
    }

    case "submitGuess": {
      if (room.phase !== "GUESSING") return { ok: false, code: "WRONG_PHASE", room };
      const answerId = stagedAnswerId(live);
      // The race this whole field exists for: a tap that lands after the stage
      // advanced must not apply to the next answer.
      if (answerId === undefined || answerId !== msg.answerId) {
        return { ok: false, code: "STALE_ANSWER", room };
      }
      if (authorOf(live, answerId) === senderId) return { ok: false, code: "IS_AUTHOR", room };
      if ((live.guesses[answerId] ?? {})[senderId] !== undefined) {
        return { ok: false, code: "ALREADY_GUESSED", room };
      }
      // Candidates are "everyone except me": accusing yourself, or a player
      // who is not in the room, is a malformed message rather than a rule.
      if (msg.playerId === senderId || !room.players.some((p) => p.id === msg.playerId)) {
        return { ok: false, code: "BAD_MESSAGE", room };
      }
      const next = structuredClone(room);
      const round = currentRound(next)!;
      const cast = round.guesses[answerId] ?? {};
      cast[senderId] = msg.playerId;
      round.guesses[answerId] = cast;
      if (everyoneGuessed(next, round, answerId, connected)) resolveGuessing(next, round, deps);
      return { ok: true, room: next };
    }
  }
}

/**
 * Called on the **already-mutated** room, after the player has been spliced out
 * of `players` and their `scores`/`stagedCount`/`sessions` entries deleted.
 *
 * One deletion does most of the work: the leaver's entry goes, which **voids**
 * their `answerId`. `order` is never spliced, so `stage` stays valid and the
 * voided slot is simply skipped. Beyond that:
 *
 *  1. below `MIN_PLAYERS` the game ends at FINALE with scores as they stand;
 *  2. losing the author of the answer under scrutiny during GUESSING discards
 *     its guesses and moves on — but an **in-flight REVEAL is left to finish**,
 *     because it is already scored and the screen is already showing;
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
  if (round === undefined) return;

  const staged = stagedAnswerId(round);
  const wasStagedAuthor = staged !== undefined && authorOf(round, staged) === leaverId;

  delete round.entries[leaverId];
  for (const cast of Object.values(round.guesses)) delete cast[leaverId];

  if (room.phase === "WRITING") {
    // Their unwritten answer no longer blocks the room.
    if (everyoneWrote(room, round, connected)) resolveWriting(room, round, deps);
    return;
  }

  if (room.phase === "GUESSING" && staged !== undefined) {
    if (wasStagedAuthor) {
      delete round.guesses[staged];
      round.stage++;
      enterStage(room, round, deps);
      return;
    }
    if (everyoneGuessed(room, round, staged, connected)) resolveGuessing(room, round, deps);
  }
  // REVEAL / ROUND_END / INTRO: already scored or nothing pending. The next
  // `advance` skips whatever this leaver voided further down `order`.
}

/**
 * Re-runs the early-resolve check for the live phase **without a client
 * message**, for the one event that has no message: a socket dropping.
 *
 * A phone locking can be the last thing the room was waiting for — everybody
 * else has already written or guessed, and then the straggler disappears. No
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
  const live = currentRound(room);
  if (live === undefined) return { room, changed: false };

  if (room.phase === "WRITING") {
    if (!everyoneWrote(room, live, connected)) return { room, changed: false };
    const next = structuredClone(room);
    resolveWriting(next, currentRound(next)!, deps);
    return { room: next, changed: true };
  }

  if (room.phase === "GUESSING") {
    const answerId = stagedAnswerId(live);
    if (answerId === undefined) return { room, changed: false };
    if (!everyoneGuessed(room, live, answerId, connected)) return { room, changed: false };
    const next = structuredClone(room);
    resolveGuessing(next, currentRound(next)!, deps);
    return { room: next, changed: true };
  }

  return { room, changed: false };
}
