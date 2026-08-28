# Answer-all-then-guess: restructuring the AHA game loop

Status: approved 2026-08-28. Supersedes the round loop described in
`docs/plans/plan3-ledger.md` T3-T8; every ruling in that file about the
*anonymity boundary* still binds, only the loop shape changes.

## The problem

Today a game is `settings.rounds` iterations of "one prompt -> everyone writes
one answer -> the room guesses up to 4 of them". With three players that is a
single question and then immediately "who wrote this", which reads as thin.
Writing is also fragmented into short bursts spread across the whole game.

## The new shape

```
LOBBY
  |
INTRO            3s
  |
ANSWERING        ONE clock, all N questions, paginated, hand-in button
  |              resolves early when everyone has handed in
  +--------------------------+
  |                          |
GUESSING         one question + one answer to it
  |                          |
REVEAL           author + points
  |                          |
STANDINGS        every Nth round only            (new)
  +--------------------------+
  |
FINALE
```

- `WRITING` is renamed **`ANSWERING`**: the phase changed meaning from "write
  one answer" to "write all of them", and keeping the old name would mislead.
- **`ROUND_END` is deleted.** It existed to show a round's un-staged answers
  with their authors. A round is now a single answer, so there is no batch of
  un-staged answers and `REVEAL` already carries author, guesses and points.
- **`STANDINGS` is new**: a short standings beat every `standingsEvery` rounds.

**A round is one (question, answer) pair.** Not a batch.

## Settings

| Field | Default | Range | Step | Runtime cap |
|---|---|---|---|---|
| `questions` | 5 | 1-20 | 1 | <= distinct prompts in enabled packs |
| `rounds` | 10 | 1-40 | 1 | <= players x questions (the answer pool) |
| `answerSec` | 180 | 30-600 | 15 | - |
| `guessSec` | 25 | 10-60 | 5 | - |
| `revealSec` | 7 | 3-15 | 1 | - |
| `standingsEvery` | 3 | 0-10 (0 = off) | 1 | - |
| `packs` | everyday, opinions, absurd | - | - | never empty |

Default game ~9 minutes. Everything maxed is ~1 hour, which the lobby shows as
a live estimate so a host chooses it deliberately.

`STANDINGS` is fixed at 6s rather than becoming a seventh dial.

Catalogue sizes that bound `questions`: everyday 25, opinions 20, absurd 20,
spicy 15; default three = 65, all four = 80, smallest single pack = 15.

## Data model

`InternalRoom` gains a game-level question set and a two-level private store.

```ts
/** promptIds chosen once at game start. Distinct. Index is the question number. */
questions: string[];

/**
 * PRIVATE, author-keyed, question-indexed. The only place authorship is
 * written down. playerId -> questionIndex -> answer.
 */
entries: Record<string, Record<number, Entry>>;   // Entry = { answerId, text }

/** Players who pressed "I'm done". A SET, projected only as a count. */
handedIn: Record<string, true>;

/** One entry per guessing round played; the last is live. */
rounds: GuessRound[];

/** playerId -> times their answer has been staged. Fairness rotation. */
stagedCount: Record<string, number>;

/** Rank at the previous STANDINGS, for movement arrows. */
prevRanks: Record<string, number>;
```

```ts
interface GuessRound {
  index: number;            // 1-based
  questionIndex: number;    // index into room.questions
  answerId: string;
  guesses: Record<string, string>;   // guesserId -> accused playerId
  awarded: AwardEntry[];             // filled at REVEAL, zeros included
}
```

`answerId` is minted with `deps.newId()` and encodes nothing about the author,
exactly as before.

## Round selection

Run once per round, at the moment the round starts:

```
pool    = every (playerId, questionIndex) that has an entry
          and whose answerId has not already been used
if pool is empty                 -> FINALE
lastQ   = previous round's questionIndex, or -1
cands   = pool where questionIndex != lastQ
if cands is empty                -> cands = pool      (relaxation, see below)
minSeen = min(stagedCount[author]) over cands
tier    = cands where stagedCount[author] == minSeen
pick    = random member of tier                       (deps.random)
stagedCount[author of pick] += 1
```

Three properties this gives:

1. **Never the same question twice in a row.** The relaxation only fires when
   every remaining answer belongs to the last question — which happens with
   `questions: 1`, and at the tail of a nearly-exhausted pool. Relaxing beats
   ending the game early.
2. **Spread across players.** Tiered least-staged keeps
   `max(stagedCount) - min(stagedCount) <= 1` across the game, so nobody is
   picked three rounds running while another player never appears.
3. **No answer is used twice.**

Selection is per-round rather than precomputed, so a player leaving mid-game
simply shrinks the pool instead of invalidating a baked sequence.

## Round total

`roundCount` shown to players is `min(settings.rounds, roundsPlayed + poolLeft)`
— honest as the pool shrinks under leavers, and never promises a round that
cannot happen.

## Views and the anonymity boundary

Every rule in the ledger's T4 rulings still binds: `view.ts` is the only reader
of `entries`, `authorOf` is the only reverse lookup, and `StagedAnswer` has no
`authorId` field to fill in.

```ts
AnsweringView {
  phase: "ANSWERING";
  questions: string[];               // resolved in the READER's language
  myAnswers: Record<number, string>; // the reader's OWN answers, nobody else's
  handedIn: boolean;                 // the reader's own flag
  doneCount: number;                 // a COUNT. never a list.
}
StandingsView {
  phase: "STANDINGS";
  lines: { playerId; score; rank; delta }[];   // delta = places moved
}
```

`GuessingView` and `RevealView` lose `answerIndex`/`answerTotal` (the round
number now carries that) and are otherwise unchanged.

**`doneCount` is a count for the same structural reason `submittedCount` was.**
A list of who has handed in lets a client remember who never answered a given
question and eliminate them at GUESSING, which is exactly what `candidates`
(everyone except me) exists to prevent. `guessedCount` likewise stays a count.

**New surface, new leak to rule out:** `myAnswers` is keyed by question index
and contains only the reader's own text. It is built from
`entries[readerId]` directly — never by filtering a bigger structure — so
there is no path by which another player's text can enter it.

## Protocol messages

- `submitEntry` gains `questionIndex: number`. Still an upsert; the `answerId`
  is minted once per (player, question) so editing does not re-slot an answer.
- **`handIn`** is new: marks the sender done. Idempotent. Legal only in
  ANSWERING. A player may hand in with questions left blank.
- `submitGuess` is unchanged.

## Early resolve

ANSWERING resolves when every connected player has handed in (the existing
`ConnectedIds` rule: a locked phone must not hold the room, but a disconnected
player still scores, still stages and stays a candidate). GUESSING resolves
when every connected eligible guesser has guessed. Unchanged in spirit.

## Leavers

Unchanged in spirit, adapted to the new store: the leaver's whole
`entries[playerId]` map is deleted, voiding every answerId they own; guesses
they cast are withdrawn; below `MIN_PLAYERS` the game ends at FINALE. A voided
answer under scrutiny during GUESSING ends that round early; an in-flight
REVEAL is left to finish. The pool shrinks and `roundCount` follows it down.

## Screens

| Screen | Change |
|---|---|
| `Answering.svelte` | **new** — paginated, one clock, Back/Next, progress dots, per-question upsert, hand-in with n/m filled, "x of y done" |
| `Standings.svelte` | **new** — rank, movement arrows, leader crown, own row highlighted |
| `Guessing.svelte` | minor — round counter instead of answer counter |
| `Reveal.svelte` | minor — same |
| `RoundEnd.svelte` | **deleted** |
| `Lobby.svelte` | six dials grouped (basics visible, timings behind a disclosure), hold-to-repeat steppers, live length estimate |

Standing constraints that still apply: every in-room screen carries the shared
`LeaveButton`; every screen is checked at 390x844 and 390x420; canvas colour
goes in `<svelte:head>` as static `<style>` text; copy lands in both catalogues
with the Danish written natively.

`apps/web/src/lib/content/rules.ts` is rewritten, with every number cited from
its source file, per the standing rule that the rulebook changes in the same
commit as the constants.

## Testing

- Engine: selection constraints (no adjacent repeat, no reuse, fairness
  invariant), standings cadence, pool exhaustion, the `questions: 1`
  relaxation, leaver rules.
- Anonymity matrix rebuilt over the new views, with deliberate mutations run
  and reverted — a leak test that has never failed is not evidence.
- Rooms: the whole loop over alarms, handIn round-trip, locked-phone early
  resolve, leaver mid-guess.
- e2e: a full multi-player game through the new loop, anonymity asserted over
  the wire (no `authorId` at any depth during GUESSING, no foreign answer text
  during ANSWERING), plus the leaver case.
