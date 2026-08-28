import { resolvePrompt } from "../content/prompts";
import type {
  AnsweringView,
  FinaleView,
  GameViewCommon,
  GuessLine,
  GuessingView,
  IntroView,
  Lang,
  Player,
  RevealView,
  RoomView,
  ScoreEntry,
  StagedAnswer,
  StandingsLine,
  StandingsView,
} from "./protocol";
import { DEFAULT_LANG } from "./protocol";
import type { GuessRound } from "./round";
import { authorOf, currentRound, effectiveRoundCount, ranksFor } from "./round";
import type { InternalRoom } from "./state";

/**
 * The projection boundary — **the single address for this game's one security
 * property.**
 *
 * Everyone answers the same questions anonymously and the room then guesses who
 * wrote what, so authorship must be *absent* from a player's snapshot — not
 * blanked, not nulled — until that answer's REVEAL. A leak does not look like
 * a bug to a player; it ends the game.
 *
 * Three rules make that defensible rather than merely intended:
 *
 *  1. **This file is the only reader of `room.entries`.** Nothing else in the
 *     codebase touches the private, author-keyed store. `grep -rn "\.entries"
 *     packages apps` should only ever hit `round.ts` (which owns it) and this
 *     file (which projects it).
 *  2. **Authorship comes only from `authorOf`** (round.ts's single reverse
 *     lookup). There is no other way to turn an `answerId` into a `playerId`,
 *     so leaking one is something you have to write.
 *  3. **The builders' return types structurally lack the secret.**
 *     `stagedAnswer()` returns `StagedAnswer = { id, text }`, which has no
 *     `authorId` field to fill in by accident. Adding an author to a pre-reveal
 *     view is a type error at the call site, which is a stronger guarantee than
 *     any runtime visibility table could give.
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
 * room read the same game in Danish and English respectively. An unknown
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
 * which reads 0 through INTRO and ANSWERING — no round has started yet.
 *
 * `roundCount` is the *effective* count: capped by the answer pool, so it
 * shrinks honestly when a player leaves rather than promising a round that
 * cannot happen.
 */
function common(room: InternalRoom): GameViewCommon {
  return {
    code: room.code,
    round: room.rounds.length,
    roundCount: effectiveRoundCount(room),
    deadline: room.deadline,
    players: structuredClone(room.players),
    scoreboard: scoreboardFor(room),
  };
}

function promptFor(room: InternalRoom, questionIndex: number, lang: Lang): string {
  const id = room.questions[questionIndex];
  // An unresolvable id renders as no prompt rather than throwing on a live room.
  return id === undefined ? "" : resolvePrompt(id, lang) ?? "";
}

// ------------------------------------------------------------ answer builders

/**
 * The one place an `answerId` is turned back into text. It goes through
 * `authorOf`, so a voided answer (its author left) resolves to `undefined`
 * rather than to an empty card, and `entries` is read by author id — never
 * searched by answer id anywhere but inside `authorOf`.
 *
 * Private on purpose: it carries the secret, and only the builders below
 * decide what leaves this file.
 */
function liveEntry(
  room: InternalRoom,
  answerId: string,
): { authorId: string; text: string } | undefined {
  const authorId = authorOf(room, answerId);
  if (authorId === undefined) return undefined;
  for (const entry of Object.values(room.entries[authorId] ?? {})) {
    if (entry.answerId === answerId) return { authorId, text: entry.text };
  }
  return undefined;
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
export function stagedAnswer(room: InternalRoom, answerId: string): StagedAnswer | undefined {
  const entry = liveEntry(room, answerId);
  return entry === undefined ? undefined : { id: answerId, text: entry.text };
}

// -------------------------------------------------------------- phase builders

function introView(room: InternalRoom): IntroView {
  return { phase: "INTRO", ...common(room) };
}

/**
 * ANSWERING — everybody answers every question, on one clock.
 *
 * `myAnswers` is the reader's **own** text and nobody else's. It is built by
 * indexing straight into their own slot of the private store, never by
 * filtering a larger structure down, so there is no code path along which
 * another player's answer could arrive in it.
 *
 * `doneCount` is how many have handed in — a count, and naming nobody is the
 * point. A *list* would leak nothing at the instant it is sent, since nothing
 * is staged yet, and is still wrong: a client can remember who never answered
 * and eliminate them once one of that question's answers is staged, which is
 * exactly what `candidates` (everyone except me, non-writers included) exists
 * to prevent.
 */
function answeringView(room: InternalRoom, readerId: string): AnsweringView {
  const lang = langOf(room, readerId);
  const myAnswers: Record<number, string> = {};
  for (const [key, entry] of Object.entries(room.entries[readerId] ?? {})) {
    myAnswers[Number(key)] = entry.text;
  }
  return {
    phase: "ANSWERING",
    ...common(room),
    questions: room.questions.map((_, i) => promptFor(room, i, lang)),
    myAnswers,
    handedIn: room.handedIn[readerId] === true,
    doneCount: room.players.filter((p) => room.handedIn[p.id] === true).length,
  };
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
 *    compares their list with anyone else's; and not "everyone who answered
 *    this question", which reveals who skipped it. The only id ever missing is
 *    the reader's own, so every list is the same length.
 *  - **`youWrote` is presence, not a boolean.** It is set only for the author,
 *    and there is no `role` anywhere in this game.
 *  - **guess progress is a count, never a list of guessers.** The author never
 *    guesses, so a `guessedIds` array would name the author by omission the
 *    instant everyone else had voted.
 */
function guessingView(
  room: InternalRoom,
  readerId: string,
  round: GuessRound,
): GuessingView | undefined {
  const answer = stagedAnswer(room, round.answerId);
  if (answer === undefined) return undefined;

  const view: GuessingView = {
    phase: "GUESSING",
    ...common(room),
    prompt: promptFor(room, round.questionIndex, langOf(room, readerId)),
    answer,
    candidates: room.players.filter((p) => p.id !== readerId).map((p) => p.id),
    guessedCount: room.players.filter((p) => round.guesses[p.id] !== undefined).length,
  };
  if (authorOf(room, round.answerId) === readerId) view.youWrote = true;
  const mine = round.guesses[readerId];
  if (mine !== undefined) view.myGuess = mine;
  return view;
}

/**
 * REVEAL — authorship goes public for **this answer only**. Every other answer
 * in the pool, including the ones already written for questions still to come,
 * stays out of the snapshot entirely.
 */
function revealView(
  room: InternalRoom,
  readerId: string,
  round: GuessRound,
): RevealView | undefined {
  const open = liveEntry(room, round.answerId);
  if (open === undefined) return undefined;

  const guesses: GuessLine[] = [];
  for (const p of room.players) {
    const guessedId = round.guesses[p.id];
    if (guessedId !== undefined) guesses.push({ playerId: p.id, guessedId });
  }
  return {
    phase: "REVEAL",
    ...common(room),
    prompt: promptFor(room, round.questionIndex, langOf(room, readerId)),
    // Fresh `{ id, text }`: the view carries `authorId`, `StagedAnswer` never does.
    answer: { id: round.answerId, text: open.text },
    authorId: open.authorId,
    guesses,
    // Every present player, zeros included, so the screen can say "you got
    // nothing" without recomputing the scoring.
    awarded: round.awarded.map((a) => ({ ...a })),
  };
}

/**
 * STANDINGS — the periodic beat. Scores only, which every view already
 * carries; the one thing that has to come from the server is `delta`, because
 * movement is measured against the ranks as they stood at the previous beat
 * and a reconnecting client has no way to remember those.
 */
function standingsView(room: InternalRoom): StandingsView {
  const ranks = ranksFor(room);
  const lines: StandingsLine[] = scoreboardFor(room).map((entry) => {
    const rank = ranks[entry.playerId] ?? 1;
    const before = room.prevRanks[entry.playerId] ?? rank;
    return {
      playerId: entry.playerId,
      score: entry.score,
      rank,
      // Positive is a climb: rank 4 -> rank 2 is +2.
      delta: before - rank,
    };
  });
  return { phase: "STANDINGS", ...common(room), lines };
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
 * place allowed to read `room.entries`, and that rule is only checkable if
 * every projection is written here.
 *
 * When an in-game phase has no content to project — no round yet, or the
 * answer under scrutiny was voided by its author leaving during an in-flight
 * REVEAL, which is deliberately allowed to finish — the fallback is the
 * *contentless* INTRO view. A splash for a few seconds is the safe direction
 * for this to be wrong in; anything richer would publish material the room has
 * not finished guessing.
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
  if (room.phase === "INTRO") return introView(room);
  if (room.phase === "ANSWERING") return answeringView(room, playerId);
  if (room.phase === "STANDINGS") return standingsView(room);

  const round = currentRound(room);
  if (round === undefined) return introView(room);

  switch (room.phase) {
    case "GUESSING":
      return guessingView(room, playerId, round) ?? introView(room);
    case "REVEAL":
      return revealView(room, playerId, round) ?? introView(room);
    default:
      return introView(room);
  }
}
