import { SCENARIOS, resolveScenario, scenarioById } from "../content/scenarios";
import type { Lang } from "../content/scenarios";
import type { ChatLine, ClientMessage, Verdict } from "./protocol";
import type { ApplyResult, EventDeps, InternalRoom } from "./state";

/**
 * The round loop, kept out of `state.ts` so the lobby/session code stays
 * readable. Everything here is pure: transitions take a room, clone it, and
 * return the next room. Every clock read and every random choice goes through
 * `EventDeps` so tests are fully deterministic.
 */

/**
 * One question in a round's queue. Exactly one of `text`/`detailIndex` is set:
 * a detective's question carries its literal `text`, an app-supplied one
 * carries the index of the scenario detail it came from, so it can be rendered
 * in whatever language the reader has selected (see `questionFor`).
 */
export interface RoundQuestion {
  /** Detective-submitted literal text; null for app-supplied questions. */
  text: string | null;
  /** Index into the scenario's `details`; null for detective questions. */
  detailIndex: number | null;
  /** `null` means the question was supplied by the app. */
  askedBy: string | null;
}

export interface RoundState {
  /** 1-based. */
  index: number;
  suspectIds: [string, string];
  scenarioId: string;
  questions: RoundQuestion[];
  /** questionIndex -> playerId -> text ("" means the answer timer ran out). */
  answers: Record<number, Record<string, string>>;
  chat: ChatLine[];
  /** detectiveId -> verdict. */
  votes: Record<string, Verdict>;
  verdict?: Verdict;
  unanimous?: boolean;
  awarded?: { playerId: string; points: number }[];
  /** detectiveId -> questions submitted this round. */
  questionsAsked: Record<string, number>;
}

/** Minimum roster to start: two suspects plus at least one detective. */
export const MIN_PLAYERS = 3;
export const INTRO_MS = 5_000;
export const DELIBERATION_MS = 60_000;
export const REVEAL_MS = 10_000;
export const MAX_QUESTIONS_PER_DETECTIVE = 5;
/** Hard cap on retained planning-chat lines, so a round cannot grow forever. */
export const MAX_CHAT_LINES = 200;

type RoundPhase = "INTRO" | "PLANNING" | "INTERROGATION" | "DELIBERATION" | "REVEAL";

/** True while a round is live (i.e. not LOBBY and not FINALE). */
export function inGame(room: InternalRoom): boolean {
  return room.phase !== "LOBBY" && room.phase !== "FINALE";
}

export function currentRound(room: InternalRoom): RoundState | undefined {
  return room.rounds.length === 0 ? undefined : room.rounds[room.rounds.length - 1];
}

export function isSuspect(round: RoundState, playerId: string): boolean {
  return round.suspectIds[0] === playerId || round.suspectIds[1] === playerId;
}

/** Detectives = everyone still in the room who is not one of the two suspects. */
export function detectiveIds(room: InternalRoom, round: RoundState): string[] {
  return room.players.filter((p) => !isSuspect(round, p.id)).map((p) => p.id);
}

function pick<T>(items: readonly T[], deps: EventDeps): T {
  const idx = Math.min(items.length - 1, Math.floor(deps.random() * items.length));
  return items[idx]!;
}

/**
 * Suspect rotation: prefer players who have not been a suspect yet. When fewer
 * than two such players remain, every flag resets and the pool is the whole
 * room, so nobody repeats until everyone has had a turn (when the roster
 * allows it).
 */
function pickPair(room: InternalRoom, deps: EventDeps): [string, string] {
  let pool = room.players.filter((p) => room.wasSuspect[p.id] !== true);
  if (pool.length < 2) {
    for (const p of room.players) room.wasSuspect[p.id] = false;
    pool = [...room.players];
  }
  const first = pick(pool, deps);
  const second = pick(pool.filter((p) => p.id !== first.id), deps);
  room.wasSuspect[first.id] = true;
  room.wasSuspect[second.id] = true;
  return [first.id, second.id];
}

/**
 * Curated scenarios only (Plan 2 scope decision 2: `settings.scenarioSource`
 * is ignored). Never repeats a scenario while unused ones remain.
 */
function pickScenario(room: InternalRoom, deps: EventDeps): string {
  const used = new Set(room.rounds.map((r) => r.scenarioId));
  const unused = SCENARIOS.filter((s) => !used.has(s.id));
  const pool = unused.length > 0 ? unused : SCENARIOS;
  return pick(pool, deps).id;
}

/**
 * Fills question slot `index` when the detectives' queue has not reached it,
 * using a detail from the round's scenario. A detail is never used twice in a
 * round while unused details remain (a round can ask for more questions than a
 * scenario has details, in which case details start to repeat).
 */
function ensureQuestion(room: InternalRoom, round: RoundState, index: number, deps: EventDeps): void {
  if (round.questions.length > index) return;
  const scenario = scenarioById(round.scenarioId);
  const count = scenario ? scenario.en.details.length : 0;
  if (count === 0) {
    // Unknown scenario: an empty slot rather than a crash. Reads as "no
    // question" everywhere downstream.
    round.questions.push({ text: null, detailIndex: null, askedBy: null });
    return;
  }
  const all = Array.from({ length: count }, (_, i) => i);
  const used = new Set(
    round.questions.filter((q) => q.detailIndex !== null).map((q) => q.detailIndex),
  );
  const unused = all.filter((i) => !used.has(i));
  const pool = unused.length > 0 ? unused : all;
  round.questions.push({ text: null, detailIndex: pick(pool, deps), askedBy: null });
}

/**
 * The question a reader sees, in their own language: a detective's question
 * verbatim, an app-supplied one resolved from the scenario detail it stored.
 * Null when the slot does not exist or cannot be resolved.
 */
export function questionFor(
  round: RoundState,
  index: number,
  lang: Lang,
): string | null {
  const q = round.questions[index];
  if (q === undefined) return null;
  if (q.text !== null) return q.text;
  if (q.detailIndex === null) return null;
  const scenario = resolveScenario(round.scenarioId, lang);
  return scenario?.details[q.detailIndex] ?? null;
}

/**
 * Where the interrogation stands, derived from the recorded answers rather
 * than stored separately (so it can never drift out of sync). `onTheClock` is
 * null once every question has both answers.
 */
export function interrogationPosition(
  room: InternalRoom,
  round: RoundState,
): { questionIndex: number; onTheClock: string | null } {
  const total = room.settings.questionCount;
  for (let i = 0; i < total; i++) {
    const slot = round.answers[i];
    for (const suspectId of round.suspectIds) {
      if (slot === undefined || !Object.prototype.hasOwnProperty.call(slot, suspectId)) {
        return { questionIndex: i, onTheClock: suspectId };
      }
    }
  }
  return { questionIndex: total, onTheClock: null };
}

// ---------------------------------------------------------------- transitions

/** Starts a fresh round: new pair, new scenario, INTRO on the clock. */
function startRound(room: InternalRoom, deps: EventDeps): void {
  const scenarioId = pickScenario(room, deps);
  const suspectIds = pickPair(room, deps);
  room.rounds.push({
    index: room.rounds.length + 1,
    suspectIds,
    scenarioId,
    questions: [],
    answers: {},
    chat: [],
    votes: {},
    questionsAsked: {},
  });
  room.phase = "INTRO";
  room.deadline = deps.now() + INTRO_MS;
}

/** `startGame` body: scores reset, round 1 built, phase INTRO. */
export function beginGame(room: InternalRoom, deps: EventDeps): void {
  room.scores = {};
  room.wasSuspect = {};
  for (const p of room.players) {
    room.scores[p.id] = 0;
    room.wasSuspect[p.id] = false;
  }
  room.rounds = [];
  startRound(room, deps);
}

function toPlanning(room: InternalRoom, deps: EventDeps): void {
  room.phase = "PLANNING";
  room.deadline = deps.now() + room.settings.planningSec * 1000;
}

function toInterrogation(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  room.phase = "INTERROGATION";
  ensureQuestion(room, round, 0, deps);
  room.deadline = deps.now() + room.settings.answerSec * 1000;
}

function toDeliberation(room: InternalRoom, deps: EventDeps): void {
  room.phase = "DELIBERATION";
  room.deadline = deps.now() + DELIBERATION_MS;
}

function toFinale(room: InternalRoom): void {
  room.phase = "FINALE";
  room.deadline = null;
}

/**
 * After an answer lands (submitted or timed out): hand the clock to the other
 * suspect, or open the next question, or close the interrogation.
 */
function afterAnswer(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  const pos = interrogationPosition(room, round);
  if (pos.onTheClock === null) {
    toDeliberation(room, deps);
    return;
  }
  ensureQuestion(room, round, pos.questionIndex, deps);
  room.deadline = deps.now() + room.settings.answerSec * 1000;
}

/**
 * Tallies the detective vote and applies the scoring (design spec §2.3).
 * Majority of votes *cast* decides; a tie counts as `consistent` — the
 * suspects get the benefit of the doubt.
 */
function resolveDeliberation(room: InternalRoom, round: RoundState, deps: EventDeps): void {
  const detectives = detectiveIds(room, round);
  let consistent = 0;
  let busted = 0;
  for (const id of detectives) {
    const vote = round.votes[id];
    if (vote === "consistent") consistent++;
    else if (vote === "busted") busted++;
  }
  const cast = consistent + busted;
  const verdict: Verdict = busted > consistent ? "busted" : "consistent";
  const unanimous = cast > 0 && busted === 0;

  const awarded: { playerId: string; points: number }[] = [];
  const award = (playerId: string, points: number): void => {
    room.scores[playerId] = (room.scores[playerId] ?? 0) + points;
    awarded.push({ playerId, points });
  };
  const suspectPoints = verdict === "consistent" ? (unanimous ? 3 : 2) : 0;
  for (const suspectId of round.suspectIds) award(suspectId, suspectPoints);
  // A detective who did not vote scores nothing.
  for (const id of detectives) award(id, round.votes[id] === verdict ? 2 : 0);

  round.verdict = verdict;
  round.unanimous = unanimous;
  round.awarded = awarded;
  room.phase = "REVEAL";
  room.deadline = deps.now() + REVEAL_MS;
}

/** True once every detective still in the room has voted. */
function everyoneVoted(room: InternalRoom, round: RoundState): boolean {
  const detectives = detectiveIds(room, round);
  return detectives.length > 0 && detectives.every((id) => round.votes[id] !== undefined);
}

function afterRound(room: InternalRoom, deps: EventDeps): void {
  if (room.rounds.length >= room.settings.rounds) toFinale(room);
  else startRound(room, deps);
}

/**
 * Timer-driven transitions. Returns the room unchanged unless the current
 * deadline has passed, and performs exactly one transition per call — a room
 * that slept through several deadlines resumes on a fresh clock rather than
 * fast-forwarding to the finale, so the caller can safely loop.
 */
export function advance(
  room: InternalRoom,
  deps: EventDeps,
): { room: InternalRoom; changed: boolean } {
  if (room.deadline === null || deps.now() < room.deadline) return { room, changed: false };
  if (!inGame(room)) return { room, changed: false };
  const next = structuredClone(room);
  const round = currentRound(next);
  if (round === undefined) return { room, changed: false };
  switch (next.phase as RoundPhase) {
    case "INTRO":
      toPlanning(next, deps);
      break;
    case "PLANNING":
      toInterrogation(next, round, deps);
      break;
    case "INTERROGATION": {
      const pos = interrogationPosition(next, round);
      if (pos.onTheClock === null) {
        toDeliberation(next, deps);
        break;
      }
      // Timing out records an empty answer, which reads as "no answer".
      const slot = round.answers[pos.questionIndex] ?? {};
      slot[pos.onTheClock] = "";
      round.answers[pos.questionIndex] = slot;
      afterAnswer(next, round, deps);
      break;
    }
    case "DELIBERATION":
      resolveDeliberation(next, round, deps);
      break;
    case "REVEAL":
      afterRound(next, deps);
      break;
  }
  return { room: next, changed: true };
}

// -------------------------------------------------------------- client events

type RoundMessage = Extract<
  ClientMessage,
  { t: "submitQuestion" } | { t: "suspectChat" } | { t: "submitAnswer" } | { t: "castVote" }
>;

/** Handles the four in-round client messages. Pure. */
export function applyRoundMessage(
  room: InternalRoom,
  senderId: string,
  msg: RoundMessage,
  deps: EventDeps,
): ApplyResult {
  const live = currentRound(room);
  if (!inGame(room) || live === undefined) return { ok: false, code: "WRONG_PHASE", room };
  if (!room.players.some((p) => p.id === senderId)) {
    return { ok: false, code: "UNKNOWN_PLAYER", room };
  }

  switch (msg.t) {
    case "suspectChat": {
      if (room.phase !== "PLANNING") return { ok: false, code: "WRONG_PHASE", room };
      if (!isSuspect(live, senderId)) return { ok: false, code: "NOT_SUSPECT", room };
      const next = structuredClone(room);
      const round = currentRound(next)!;
      round.chat.push({ playerId: senderId, text: msg.text });
      if (round.chat.length > MAX_CHAT_LINES) {
        round.chat.splice(0, round.chat.length - MAX_CHAT_LINES);
      }
      return { ok: true, room: next };
    }

    case "submitQuestion": {
      if (room.phase !== "INTERROGATION") return { ok: false, code: "WRONG_PHASE", room };
      if (isSuspect(live, senderId)) return { ok: false, code: "NOT_DETECTIVE", room };
      const asked = live.questionsAsked[senderId] ?? 0;
      if (asked >= MAX_QUESTIONS_PER_DETECTIVE) return { ok: false, code: "RATE_LIMITED", room };
      // The queue can never outrun the round's question budget.
      if (live.questions.length >= room.settings.questionCount) {
        return { ok: false, code: "RATE_LIMITED", room };
      }
      const next = structuredClone(room);
      const round = currentRound(next)!;
      round.questions.push({ text: msg.text, detailIndex: null, askedBy: senderId });
      round.questionsAsked[senderId] = asked + 1;
      return { ok: true, room: next };
    }

    case "submitAnswer": {
      if (room.phase !== "INTERROGATION") return { ok: false, code: "WRONG_PHASE", room };
      if (!isSuspect(live, senderId)) return { ok: false, code: "NOT_SUSPECT", room };
      const pos = interrogationPosition(room, live);
      if (pos.onTheClock === null) return { ok: false, code: "WRONG_PHASE", room };
      if (pos.onTheClock !== senderId) {
        const answered = Object.prototype.hasOwnProperty.call(
          live.answers[pos.questionIndex] ?? {},
          senderId,
        );
        // Either they already answered this question, or it is not their turn.
        return { ok: false, code: answered ? "ALREADY_ANSWERED" : "WRONG_PHASE", room };
      }
      const next = structuredClone(room);
      const round = currentRound(next)!;
      const slot = round.answers[pos.questionIndex] ?? {};
      slot[senderId] = msg.text;
      round.answers[pos.questionIndex] = slot;
      afterAnswer(next, round, deps);
      return { ok: true, room: next };
    }

    case "castVote": {
      if (room.phase !== "DELIBERATION") return { ok: false, code: "WRONG_PHASE", room };
      if (isSuspect(live, senderId)) return { ok: false, code: "NOT_DETECTIVE", room };
      if (live.votes[senderId] !== undefined) return { ok: false, code: "ALREADY_VOTED", room };
      const next = structuredClone(room);
      const round = currentRound(next)!;
      round.votes[senderId] = msg.verdict;
      // Deliberation resolves early once every detective still here has voted.
      if (everyoneVoted(next, round)) resolveDeliberation(next, round, deps);
      return { ok: true, room: next };
    }
  }
}

/**
 * Called on the *already-mutated* room after a player has been removed. Keeps
 * a departure from ever wedging a live room:
 *
 * 1. below the minimum roster -> the game ends now, scores as they stand;
 * 2. a suspect left an unresolved round -> that round is abandoned with no
 *    scores and the next round begins (or FINALE if it was the last);
 * 3. a detective left -> the round continues, their vote is withdrawn and
 *    deliberation resolves if the remaining detectives have all voted.
 */
export function handlePlayerLeft(room: InternalRoom, leaverId: string, deps: EventDeps): void {
  delete room.scores[leaverId];
  delete room.wasSuspect[leaverId];
  if (!inGame(room)) return;
  const round = currentRound(room);
  if (round === undefined) return;

  if (room.players.length < MIN_PLAYERS) {
    toFinale(room);
    return;
  }
  const roundResolved = room.phase === "REVEAL";
  if (isSuspect(round, leaverId)) {
    if (roundResolved) return;
    round.awarded = [];
    afterRound(room, deps);
    return;
  }
  delete round.votes[leaverId];
  delete round.questionsAsked[leaverId];
  if (room.phase === "DELIBERATION" && everyoneVoted(room, round)) {
    resolveDeliberation(room, round, deps);
  }
}

// -------------------------------------------------------------- finale awards

export interface Award { key: string; playerId: string }

/**
 * Superlatives derived from the whole game's history. Keys are stable so the
 * UI can translate them; an award is omitted entirely when nobody qualifies
 * (no rounds, no votes, no questions) rather than inventing a winner. Ties go
 * to the lowest playerId so a snapshot is byte-stable, and only players still
 * in the room can win (a leaver has no scoreboard row to attach to).
 */
export function finaleAwards(room: InternalRoom): Award[] {
  const present = new Set(room.players.map((p) => p.id));
  const liar: Record<string, number> = {};
  const sharp: Record<string, number> = {};
  const curious: Record<string, number> = {};
  const bump = (tally: Record<string, number>, id: string): void => {
    if (present.has(id)) tally[id] = (tally[id] ?? 0) + 1;
  };
  for (const r of room.rounds) {
    if (r.verdict === "consistent") for (const id of r.suspectIds) bump(liar, id);
    if (r.verdict !== undefined) {
      for (const [id, vote] of Object.entries(r.votes)) if (vote === r.verdict) bump(sharp, id);
    }
    for (const q of r.questions) if (q.askedBy !== null) bump(curious, q.askedBy);
  }
  const awards: Award[] = [];
  const add = (key: string, tally: Record<string, number>): void => {
    let best: string | null = null;
    let bestCount = 0;
    // Ascending id order + strict > means the lowest id wins a tie.
    for (const id of Object.keys(tally).sort()) {
      const count = tally[id]!;
      if (count > bestCount) {
        best = id;
        bestCount = count;
      }
    }
    if (best !== null) awards.push({ key, playerId: best });
  };
  add("mostConvincingLiar", liar);
  add("sharpestDetective", sharp);
  add("mostCurious", curious);
  return awards;
}

/**
 * How many more questions a detective may submit this round: their personal
 * cap and the round's remaining question slots, whichever bites first.
 */
export function questionsLeftFor(
  room: InternalRoom,
  round: RoundState,
  detectiveId: string,
): number {
  const asked = round.questionsAsked[detectiveId] ?? 0;
  const slots = room.settings.questionCount - round.questions.length;
  return Math.max(0, Math.min(MAX_QUESTIONS_PER_DETECTIVE - asked, slots));
}
