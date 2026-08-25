import { resolvePrompt } from "../content/prompts";
import type {
  FinaleView,
  GameViewCommon,
  GuessLine,
  GuessingView,
  IntroView,
  Lang,
  Player,
  RevealView,
  RevealedAnswer,
  RoomView,
  RoundEndView,
  ScoreEntry,
  StagedAnswer,
  WritingView,
} from "./protocol";
import { DEFAULT_LANG } from "./protocol";
import type { RoundState } from "./round";
import { authorOf, currentRound, stagedAnswerId } from "./round";
import type { InternalRoom } from "./state";

/**
 * The projection boundary — **the single address for this game's one security
 * property.**
 *
 * Everyone answers the same prompt anonymously and the room then guesses who
 * wrote what, so authorship must be *absent* from a player's snapshot — not
 * blanked, not nulled — until that answer's REVEAL. A leak does not look like
 * a bug to a player; it ends the game.
 *
 * Three rules make that defensible rather than merely intended:
 *
 *  1. **This file is the only reader of `round.entries`.** Nothing else in the
 *     codebase touches the private, author-keyed store. `grep -rn
 *     "\.entries" packages apps` should only ever hit `round.ts` (which owns
 *     it) and this file (which projects it).
 *  2. **Authorship comes only from `authorOf`** (round.ts's single reverse
 *     lookup, T3 ruling 16). There is no other way to turn an `answerId` into
 *     a `playerId`, so leaking one is something you have to write.
 *  3. **The builders' return types structurally lack the secret.**
 *     `stagedAnswer()` returns `StagedAnswer = { id, text }`, which has no
 *     `authorId` field to fill in by accident; only `openAnswer()` returns
 *     `RevealedAnswer`, and only REVEAL and ROUND_END call it. Adding an
 *     author to a pre-reveal view is a type error at the call site, which is
 *     a stronger guarantee than any runtime visibility table could give.
 *
 * `view.ts` imports only *types* from `state.ts` (as `round.ts` does), so the
 * runtime dependency stays one-way: `state.ts` -> `view.ts` -> `round.ts`.
 */

// ------------------------------------------------------------------- readers

function readerOf(room: InternalRoom, playerId: string): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

/**
 * Prompts resolve through the *reader's* language, so two players in the same
 * room read the same round in Danish and English respectively. An unknown
 * reader (a snapshot built for someone no longer seated) falls back to the
 * default rather than failing.
 */
function langOf(room: InternalRoom, playerId: string): Lang {
  return readerOf(room, playerId)?.lang ?? DEFAULT_LANG;
}

/** Highest score first; ties by playerId so the ordering is stable. */
export function scoreboardFor(room: InternalRoom): ScoreEntry[] {
  return room.players
    .map((p) => ({ playerId: p.id, score: room.scores[p.id] ?? 0 }))
    .sort((a, b) =>
      b.score - a.score || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
}

/**
 * The fields every in-game view carries. `round` is `room.rounds.length`,
 * which reads 0 under INTRO — INTRO happens once per game, before round 1
 * exists (T3 ruling 15).
 */
function common(room: InternalRoom): GameViewCommon {
  return {
    code: room.code,
    round: room.rounds.length,
    roundCount: room.settings.rounds,
    deadline: room.deadline,
    players: structuredClone(room.players),
    scoreboard: scoreboardFor(room),
  };
}

function promptFor(round: RoundState, lang: Lang): string {
  // `pickPrompt` can only return "" if the catalogue is empty, which the pack
  // filter already rules out; an unresolvable id renders as no prompt rather
  // than throwing on a live room.
  return resolvePrompt(round.promptId, lang) ?? "";
}

// ------------------------------------------------------------ answer builders

/**
 * The one place an `answerId` is turned back into text. It goes through
 * `authorOf`, so a voided answer (its author left) resolves to `undefined`
 * rather than to an empty card, and `entries` is read by author id — never
 * searched by answer id anywhere but inside `authorOf`.
 *
 * Private on purpose: it carries the secret, and only the two builders below
 * decide what leaves this file.
 */
function liveEntry(
  round: RoundState,
  answerId: string,
): { authorId: string; text: string } | undefined {
  const authorId = authorOf(round, answerId);
  if (authorId === undefined) return undefined;
  const entry = round.entries[authorId];
  return entry === undefined ? undefined : { authorId, text: entry.text };
}

/**
 * One answer as the room sees it while guessing: an opaque id and the text.
 *
 * The return type has **no `authorId` field**, so this cannot leak authorship
 * even if someone later edits the body carelessly — there is nowhere to put
 * it. The object is built fresh from `{ id, text }` rather than by deleting a
 * field off a bigger one, because "absent" and "blanked" are different
 * guarantees and only the first one survives a refactor.
 */
export function stagedAnswer(round: RoundState, answerId: string): StagedAnswer | undefined {
  const entry = liveEntry(round, answerId);
  return entry === undefined ? undefined : { id: answerId, text: entry.text };
}

/**
 * The same answer once its author is public: REVEAL and ROUND_END only.
 *
 * Every call site of this function is a place where the phase has already
 * made authorship public, and there are exactly two of them in this file.
 */
export function openAnswer(round: RoundState, answerId: string): RevealedAnswer | undefined {
  const entry = liveEntry(round, answerId);
  return entry === undefined
    ? undefined
    : { id: answerId, text: entry.text, authorId: entry.authorId };
}

/**
 * The staged answers that still have an author.
 *
 * `order` is append-only and voided slots are skipped rather than spliced (T3
 * ruling 17), so `order.length` over-counts once somebody has left. The
 * player-facing counter is **live, non-voided values** for both the position
 * and the total (orchestrator ruling): a room watching "2 of 4" become "2 of
 * 3" has just watched a person leave, which is honest, where a denominator
 * that never arrives looks like a bug nobody can distinguish from one.
 */
function liveOrder(round: RoundState): string[] {
  return round.order.filter((id) => authorOf(round, id) !== undefined);
}

/** 1-based position of the answer under scrutiny among the live ones. */
function stagePosition(round: RoundState, answerId: string): { index: number; total: number } {
  const live = liveOrder(round);
  return { index: live.indexOf(answerId) + 1, total: live.length };
}

// -------------------------------------------------------------- phase builders

function introView(room: InternalRoom): IntroView {
  return { phase: "INTRO", ...common(room) };
}

/**
 * WRITING.
 *
 * `submittedCount` is how many have handed something in — the screen says "4 of
 * 6 written" and names nobody. A *list* of submitters would leak nothing at the
 * instant it is sent, since nothing is staged yet, and is still wrong: a client
 * can remember who never submitted and eliminate them at GUESSING, which is
 * exactly what `candidates` (everyone except me, non-writers included) exists
 * to prevent. `myEntry` is the reader's **own** text and nobody else's, echoed
 * back so a reconnect mid-round repopulates the field instead of silently
 * losing what they typed; it is absent, never blank, until they submit.
 */
function writingView(room: InternalRoom, readerId: string, round: RoundState): WritingView {
  const mine = round.entries[readerId];
  const view: WritingView = {
    phase: "WRITING",
    ...common(room),
    prompt: promptFor(round, langOf(room, readerId)),
    submittedCount: room.players.filter((p) => round.entries[p.id] !== undefined).length,
  };
  if (mine !== undefined) view.myEntry = mine.text;
  return view;
}

/**
 * GUESSING — the phase the whole security property is about.
 *
 * The answer goes out as a `StagedAnswer`, so its author is not merely
 * withheld, it has no field to travel in. Three further details, each a leak
 * if done the obvious way:
 *
 *  - **`candidates` is every present player except the reader.** Not "except
 *    the author", which reveals authorship by omission the moment a guesser
 *    compares their list with anyone else's; and not "everyone who wrote",
 *    which reveals who sat the round out. The only id ever missing is the
 *    reader's own, so every list is the same length.
 *  - **`youWrote` is presence, not a boolean.** It is set only for the author,
 *    and there is no `role` anywhere in this game.
 *  - **guess progress is a count, never a list of guessers.** The author never
 *    guesses, so a `guessedIds` array would name the author by omission the
 *    instant everyone else had voted — exactly the leak `candidates` is
 *    shaped to avoid. `guessedCount` names nobody.
 */
function guessingView(
  room: InternalRoom,
  readerId: string,
  round: RoundState,
): GuessingView | undefined {
  const answerId = stagedAnswerId(round);
  if (answerId === undefined) return undefined;
  const answer = stagedAnswer(round, answerId);
  if (answer === undefined) return undefined;

  const cast = round.guesses[answerId] ?? {};
  const { index, total } = stagePosition(round, answerId);
  const view: GuessingView = {
    phase: "GUESSING",
    ...common(room),
    prompt: promptFor(round, langOf(room, readerId)),
    answer,
    answerIndex: index,
    answerTotal: total,
    candidates: room.players.filter((p) => p.id !== readerId).map((p) => p.id),
    guessedCount: room.players.filter((p) => cast[p.id] !== undefined).length,
  };
  if (authorOf(round, answerId) === readerId) view.youWrote = true;
  const mine = cast[readerId];
  if (mine !== undefined) view.myGuess = mine;
  return view;
}

/**
 * REVEAL — authorship goes public for **this answer only**. The other staged
 * answers, and every un-staged entry, stay out of the snapshot entirely: the
 * round is not over, and the room still has answers left to guess.
 */
function revealView(
  room: InternalRoom,
  readerId: string,
  round: RoundState,
): RevealView | undefined {
  const answerId = stagedAnswerId(round);
  if (answerId === undefined) return undefined;
  const open = openAnswer(round, answerId);
  if (open === undefined) return undefined;

  const cast = round.guesses[answerId] ?? {};
  const guesses: GuessLine[] = [];
  for (const p of room.players) {
    const guessedId = cast[p.id];
    if (guessedId !== undefined) guesses.push({ playerId: p.id, guessedId });
  }
  const { index, total } = stagePosition(round, answerId);
  return {
    phase: "REVEAL",
    ...common(room),
    prompt: promptFor(round, langOf(room, readerId)),
    // Fresh `{ id, text }`: the view carries `authorId`, `StagedAnswer` never does.
    answer: { id: open.id, text: open.text },
    answerIndex: index,
    answerTotal: total,
    authorId: open.authorId,
    guesses,
    // Every present player, zeros included (T3 ruling 22), so the screen can
    // say "you got nothing" without recomputing the scoring.
    awarded: (round.awarded[answerId] ?? []).map((a) => ({ ...a })),
  };
}

/**
 * ROUND_END — every answer of the round with its author, **including the ones
 * never staged**. The round is over, so nothing here is secret any more, and
 * the players whose answer the room never saw at least get to be seen.
 *
 * Staged answers come first, in the order the room guessed them, then the
 * un-staged ones in roster order. A leaver's entry was deleted when they went,
 * so only present players appear.
 */
function roundEndView(room: InternalRoom, readerId: string, round: RoundState): RoundEndView {
  const answers: RevealedAnswer[] = [];
  const seen = new Set<string>();
  for (const answerId of round.order) {
    const open = openAnswer(round, answerId);
    if (open === undefined) continue;
    answers.push(open);
    seen.add(answerId);
  }
  for (const p of room.players) {
    const entry = round.entries[p.id];
    if (entry === undefined || seen.has(entry.answerId)) continue;
    answers.push({ id: entry.answerId, text: entry.text, authorId: p.id });
  }
  return {
    phase: "ROUND_END",
    ...common(room),
    prompt: promptFor(round, langOf(room, readerId)),
    answers,
  };
}

function finaleView(room: InternalRoom): FinaleView {
  return {
    phase: "FINALE",
    code: room.code,
    players: structuredClone(room.players),
    scoreboard: scoreboardFor(room),
  };
}

// ------------------------------------------------------------------ the view

/**
 * One player's view of the room.
 *
 * Lives here rather than in `state.ts` for one reason: this file is the only
 * place allowed to read `round.entries`, and that rule is only checkable if
 * every projection is written here. `state.ts` keeps the lobby, the sessions
 * and the event dispatch; the secret never leaves this module except through
 * a builder whose return type has already dropped it.
 *
 * When an in-game phase has no content to project — no round yet, or the
 * staged answer was voided by its author leaving during an in-flight REVEAL
 * (T3 ruling 23 lets that reveal finish) — the fallback is the *contentless*
 * INTRO view. Falling back to ROUND_END would have been friendlier and is
 * exactly wrong: it would publish every un-staged answer of a round the room
 * has not finished guessing. A splash for a few seconds is the safe direction
 * for this to be wrong in.
 */
export function viewForPlayer(room: InternalRoom, playerId: string): RoomView {
  if (room.phase === "LOBBY") {
    return {
      phase: "LOBBY",
      code: room.code,
      hostId: room.hostId,
      players: structuredClone(room.players),
      settings: structuredClone(room.settings),
    };
  }
  if (room.phase === "FINALE") return finaleView(room);

  const round = currentRound(room);
  if (round === undefined) return introView(room);

  switch (room.phase) {
    case "INTRO":
      return introView(room);
    case "WRITING":
      return writingView(room, playerId, round);
    case "GUESSING":
      return guessingView(room, playerId, round) ?? introView(room);
    case "REVEAL":
      return revealView(room, playerId, round) ?? introView(room);
    case "ROUND_END":
      return roundEndView(room, playerId, round);
    default:
      return introView(room);
  }
}
