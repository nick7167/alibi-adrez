# Plan 3 ledger — the anonymous "who wrote that" game

Plan: `/Users/nicklasandreasen/.claude/plans/i-kinda-don-t-like-declarative-globe.md`
Working branch: `main` (deliberate — see the plan; T0's worker rename is what
keeps the old game serving while this is built).

Alibi is preserved at tag `alibi-v1.0` and branch `archive/alibi-v1`; its plans
and rulings are under `docs/archive/alibi/` and still bind this work.

Update this file at the end of every task, in the same commit as the work.

| Task | Status | Commit | Notes |
|---|---|---|---|
| T0 preserve + rename | done | `519c8de` | workers renamed to aha-rooms/aha-web, `@alibi/shared` → `@aha/shared`, AHA design tokens installed in app.css |
| T0b identity directions | done | `—` (canvas only) | Four directions explored; **A · AHA chosen** |
| T1 prompt packs | done | `6001a98` | 80 bilingual prompts, 4 packs, 20 tests |
| T2 protocol + demolition | done | `68e22fe` | new phases/messages/views in `protocol.ts`, `state.ts` cut to lobby-only, Alibi files deleted, placeholder phase screens, catalogues pruned 93 → 42 keys and paraglide regenerated |
| T3 round engine | done | `606d8f0` | `enterPhase` + `PHASE_MS` (the only writer of phase/deadline), tiered least-staged selection, `advance`, scoring at every REVEAL, leaver rules — all in `packages/shared/src/round.ts`, re-exported from `index.ts`; `state.ts` wires `startGame`/`leave`/`submitEntry`/`submitGuess` into it; 48 new tests in `test/round.test.ts` |
| T4 view projections + anonymity | done | `3a8ee2c` | `view.ts` is the only reader of `round.entries`; `viewForPlayer` moved there out of `state.ts` with `scoreboardFor`; all seven phases projected; `WritingView.submittedCount` → `submittedIds` and `GuessingView.guessedCount` added; 106 tests in `test/snapshot.test.ts`, four mutations run |
| T5 rooms dispatch + socket tests | not started | — | |
| T6 web plumbing + Writing | not started | — | |
| T7 Guessing + Reveal | not started | — | |
| T8 RoundEnd + Finale + lobby | not started | — | |
| T9 rulebook, brand copy, e2e, domain | not started | — | |

## Rulings

### Prompt cuts (orchestrator, after T1)

T1 reported honestly on its own weak entries. Rulings, to be applied by the next
task that touches `packages/shared/content/prompts.ts` (T9 at the latest):

**Cut six and replace them, keeping the per-pack counts:**

- `pretended-to-know` — the Danish drifts to competence rather than knowledge;
  the implementer recommended cutting it and was right.
- `alarm-tomorrow`, `bedtime-last-night` — bare numbers. Strongly identifying,
  but this game is won by recognising *how someone writes*, and a number has no
  writing in it. Identification alone is not the target; voice is.
- `most-used-emoji`, `emoji-to-delete`, `worst-sound` — convergence risk. Half a
  room writes 😂 or "nails on a chalkboard". Identical answers are never deduped,
  so a converged prompt makes a round go dead rather than funny. That is the
  worst failure mode this content has.

**Fix, don't cut:** `pettiest-grudge` — shorten the Danish (67 chars reads
clausey on a phone card).

**Keep:** `deep-scroll`, and `work-confession` (opt-in behind the host toggle).

**Rule for replacements and all future prompts:** a prompt is only good if two
people would answer it *differently in voice*. Convergence and bare-fact answers
are both disqualifying, however revealing they are.

### T2 — protocol + demolition

1. **The three salvaged helpers.** `deepKeys()` and the raw-JSON absence
   harness now live in `packages/shared/test/helpers.ts` (`deepKeys`,
   `overTheWire`, `expectAbsent`); `until()`, the deadline-backdating
   `expirePhase()` and `expireIdle()` live in `apps/rooms/test/helpers.ts`.
   Both files carry the *why* — keys alone miss a secret leaked as a value,
   raw-JSON alone misses a nested key; fixed sleeps flake under load;
   `runDurableObjectAlarm` fires immediately and workerd's clock cannot be
   faked, so backdating the stored deadline is the only honest expiry test.
   **T4 and T5 import these, they do not reinvent them.**
2. **`advance` is a no-op stub in `state.ts`.** T3 replaces it with
   `enterPhase` + `PHASE_MS`. `do.ts` keeps its single `advance` import and all
   its alarm plumbing — only the `dispatch` case list changed. Consequence
   until T3: `startGame` enters INTRO with `deadline: null`, so no phase is
   timed and the DO's alarm serves only the idle self-destruct. A stub that
   set a deadline nothing could advance past would have re-armed the alarm
   forever against a deadline already in the past.
3. **`InternalRoom.rounds` is `RoundState[]` where `export type RoundState =
   never`** (declared in `state.ts`). It is a placeholder: storing a
   half-invented round before the engine exists is a compile error. **T3
   replaces the alias with the real interface from `src/round.ts`.**
   `wasSuspect` is gone; `stagedCount: Record<string, number>` replaces it and
   is seeded to 0 for every player by `startGame`.
4. **Homes for things that outlived their file.** `Lang` moved from the
   deleted `content/scenarios.ts` to `content/prompts.ts` (next to `PackId`),
   which also gained `PACK_IDS` so settings can filter a patch to real packs.
   `MIN_PLAYERS` moved from the deleted `round.ts` to `protocol.ts`.
   `MAX_TEXT_LENGTH` was **removed** — no protocol field is 240 chars any
   more; `MAX_ENTRY_LENGTH = 140` is the only text limit, and `validText` now
   takes the ceiling as an argument.
5. **`viewForPlayer` is gone.** `snapshotForPlayer` calls a private
   `placeholderView` that builds LOBBY, FINALE, and a minimal `IntroView` for
   every other phase. **T4 replaces it wholesale with `view.ts`'s typed
   projections**; `scoreboardFor` is now exported for that.
6. **Canvas colour: one hex for the whole room route.** Every screen wears the
   AHA field, so `themeColor` is `$derived('#4A1FD6')` — a single literal
   inside the `$derived`, never a lookup object — with one static canvas
   style block to match. `head-canvas.test.ts` passes **unedited** (25 tests).
   A degenerate ternary over identical branches was rejected as dead code: if
   a screen ever needs a different field, turn this back into a literal
   ternary AND add the matching `{#if}` branch in the head, together.
7. **Placeholder screens.** `+page.svelte` has one
   `{#snippet placeholder(label, todo, room)}` — phase name, round counter,
   countdown, and a visible `TODO(T6)`/`TODO(T7)`/`TODO(T8)` chip — rendered
   for WRITING / GUESSING / REVEAL / ROUND_END / FINALE, with
   `data-testid="phase-placeholder"` and `data-phase`. T6-T8 swap each
   `{@render placeholder(...)}` call for the real component (Alibi ruling 33's
   pattern). **INTRO keeps `data-testid="intro-splash"`** — `e2e/lobby.spec.ts`
   asserts on it.
8. **The Alibi CSS primitives could NOT be deleted.** `.stamp` (landing,
   lobby host tag, rulebook), `.stamp-frame` (lobby room code), `.ruled`
   (landing, join form, rulebook), `.leader` (lobby settings) and
   `--color-manila` (landing, lobby settings panel, rulebook) are all still
   referenced by screens T2 does not rewrite. They go with those screens:
   **T8 (lobby) and T9 (landing, rulebook)** — `app.css` now says so.
9. **`leave` no longer ends the game below `MIN_PLAYERS`,** and no longer
   voids anything: T2 only deletes the leaver's `scores`/`stagedCount`
   entries. **T3 owns the leaver rules** (void their entry, skip voided
   stages, end the game below 3) — there is a `TODO(T3)` at the call site.
10. **`FinaleView` has no `awards`.** Alibi's superlatives went with the
    Alibi round model and the plan does not specify replacements. T8 adds a
    field if the Finale screen wants one; T2 does not invent unimplemented
    protocol surface.
11. **`submitGuess` ids are capped at 64 chars** by the parser (`validId`),
    the same defensive bound `MAX_ENTRY_LENGTH` gives entry text.
12. **`e2e/lobby.spec.ts` needed one edit** — `DEFAULT_SETTINGS.rounds` is now
    4, so the stepper assertions read 4 → 5 instead of 3 → 4. Everything else
    in that spec is untouched and passing, which is the proof the demolition
    left the lobby alone.
13. **`MaskMark.svelte` was deleted while the landing page still used it,** so
    the landing header is now the wordmark alone. That page is Alibi-styled
    end to end (sunshine canvas, case-file card, "busted alibis" tagline) and
    is **T9's** to re-skin; T2 deliberately did not half-restyle it.

### T3 — round engine

14. **`enterPhase(room, phase, deps)` is the only writer of `room.phase` and
    `room.deadline`,** backed by `PHASE_MS: Record<Phase, (room) => number |
    null>`. Nothing outside `round.ts` assigns either field, and inside it
    every transition goes through `enterPhase`. `createRoom`'s object literal
    is the one exception and is construction, not a transition. **T4 and T5
    must not set `phase` or `deadline` directly** — a phase entered without a
    deadline hangs the room permanently, because the DO's alarm is armed
    solely off `room.deadline`. Durations: INTRO 3s, WRITING
    `settings.writeSec`, GUESSING `settings.guessSec`, REVEAL 7s, ROUND_END
    8s, LOBBY and FINALE `null`. Seven mutation tests confirm the suite bites
    on this and on the anonymity structure (see the report).
15. **INTRO happens once per game, not once per round.** `startGame` →
    INTRO(3s) → WRITING creates round 1; ROUND_END → WRITING creates round
    *n+1* directly. The plan's phase list (`… → ROUND_END(8s) → … → FINALE`)
    did not settle this. Reasons: `IntroView` carries no `prompt` field so it
    could not introduce a round anyway; `GameViewCommon.round` is documented
    as "0 before the first round has started", which is only reachable if
    INTRO precedes round 1; and ROUND_END's 8s already is the between-rounds
    beat. **Consequence for T6–T8: INTRO is a one-off "get ready" splash, and
    the round counter reads 0 while it is showing.**
16. **The reverse lookup lives in exactly one function.** `authorOf(round,
    answerId)` is the only code that walks `entries` looking for an
    `answerId`; `undefined` means the answer is **voided** (its author left).
    **T4 must build its projections through `authorOf` and must never take an
    `authorId` from anywhere else** — that single call site is what makes an
    authorship leak something you have to write rather than something you
    forget to delete.
17. **A voided answer is skipped, never spliced.** `order` is append-only for
    the life of a round; `enterStage` walks past voided slots (discarding
    their guesses) so `stage` can never be invalidated underneath itself. **T4
    must therefore expect `order` to contain ids with no author, and derive
    `answerIndex`/`answerTotal` accordingly** — `answerTotal` from
    `order.length` will over-count once someone has left. That is a T4
    decision; the engine does not paper over it.
18. **`submitEntry` mints the `answerId` once.** An edit updates `text` and
    keeps the same `answerId`, so a player who keeps typing does not migrate
    to a different stage slot.
19. **Guessing yourself, or a player who is not in the room, is
    `BAD_MESSAGE`,** not a new error code. `candidates` is "everyone except
    me", so both are malformed rather than rule violations. Rejection order on
    `submitGuess` is: phase → `STALE_ANSWER` → `IS_AUTHOR` →
    `ALREADY_GUESSED` → `BAD_MESSAGE`. An unknown `answerId` is
    `STALE_ANSWER` (the client cannot tell a stale id from an invented one,
    and neither reading changes what it should do).
20. **Fewer than two entries stages nothing and spends no `stagedCount`.**
    The round goes WRITING → ROUND_END with `order: []` and `awarded: {}`. A
    player whose lone answer was never put to the room keeps their place in
    the fairness rotation.
21. **Staging fairness is exact, not approximate.** Tiered least-staged with
    random-within-tier keeps `max(stagedCount) - min(stagedCount) <= 1` for
    the whole game; the test plays 6 players × 6 rounds and asserts it.
22. **`awarded` is keyed by `answerId`** (`Record<answerId, AwardEntry[]>`)
    and lists **every present player, zeros included**, in `room.players`
    order. Scoring is applied at that answer's REVEAL, so `room.scores` moves
    continuously. T7's Reveal screen can render "you got nothing" straight
    from `awarded` without recomputing.
23. **Leaver rules, in one function** (`handlePlayerLeft`, called from
    `state.ts`'s `leave` on the already-mutated room): below `MIN_PLAYERS` →
    FINALE with scores as they stand; their entry is deleted (voiding their
    answerId) and their guesses withdrawn everywhere; in WRITING the room can
    resolve early now that they no longer owe an answer; in GUESSING, losing
    the **staged author** discards that answer's guesses and moves the stage
    on, while losing a guesser can resolve the phase early; an **in-flight
    REVEAL is left to finish** because it is already scored and on screen.
24. **`advance` still re-bases off `now` and moves at most one phase per
    call** (Alibi ledger T3 ruling 2, unchanged). `enterPhase` is what
    enforces it now. The DO's `catchUp()` loop and `MAX_ADVANCE_STEPS` are
    untouched.
25. **`placeholderView` is unchanged and now understates the room.** T3 made
    WRITING/GUESSING/REVEAL/ROUND_END reachable on the server, but nothing
    projects them, so every in-game phase still renders the minimal
    `IntroView` and the app shows the intro splash for a whole game. No round
    content leaks — that is the safe direction for a placeholder to be wrong
    in — but **the app is not playable until T4**.

### T4 — view projections and the anonymity matrix

26. **`viewForPlayer` lives in `packages/shared/src/view.ts`, not in
    `state.ts`.** The rule that carries this game's one security property is
    "only `view.ts` reads `round.entries`", and a rule like that is only
    checkable if every projection has one address — a `viewForPlayer` left in
    `state.ts` would have had to read the private store from outside the
    boundary on its first line. `scoreboardFor` moved across with it (it is a
    projection), `placeholderView` is gone, and the runtime dependency stays
    one-way — `state.ts` -> `view.ts` -> `round.ts` — because `view.ts`
    imports only *types* from `state.ts`, exactly as `round.ts` does.
    `grep -rn "\.entries" apps/*/src packages/*/src` hits only `round.ts`
    (owner) and `view.ts` (projector); **T5–T8 must keep it that way** — a
    screen that wants an author asks for a view field, it does not reach past
    the boundary.
27. **Two answer builders, and the type is the guarantee.**
    `stagedAnswer(round, id): StagedAnswer` (`{ id, text }`) is what GUESSING
    sends; `openAnswer(round, id): RevealedAnswer` (`+ authorId`) is called
    from exactly two places, REVEAL and ROUND_END. Both go through T3's
    `authorOf` (ruling 16) — the private `liveEntry` helper resolves an
    `answerId` to an author *and then* reads `entries` by author id, so no
    second reverse lookup exists. Objects are built as fresh literals, never
    by deleting a field off a bigger one: absent and blanked are different
    guarantees and only the first survives a refactor.
28. **Counters are live, non-voided values,** implementing the orchestrator's
    ruling: `answerIndex`/`answerTotal` are computed over `order` filtered to
    answers that still have an author, so a leaver turns "2 of 4" into "2 of
    3" mid-round. **T7 renders these as given and must not recompute from
    `order`.**
29. **When an in-game phase has no content to project, the fallback is the
    contentless INTRO view — never ROUND_END.** Reachable when the staged
    answer is voided while its phase is still live; T3 ruling 23 deliberately
    lets an in-flight REVEAL finish, and the leaver's entry (hence the text
    *and* the author) is deleted underneath it. Falling back to ROUND_END
    would have been friendlier and is catastrophically wrong: it publishes
    every un-staged answer of a round the room has not finished guessing.
    **Consequence for T6–T8: any in-game phase can briefly render as the INTRO
    splash.** Screens switch on `view.phase` and must not assume it matches
    the phase they last saw.
30. **`WritingView.submittedCount` became `submittedIds: string[]`** (per the
    T4 brief) and **`GuessingView` gained `guessedCount: number`**. The
    asymmetry is deliberate and load-bearing: nothing is staged during
    WRITING, so naming who has submitted names no author — but the author
    never guesses, so a `guessedIds` list would name them by omission the
    instant everyone else had voted, which is the same leak `candidates` is
    shaped to avoid. **Never turn `guessedCount` into a list.**
    Accepted residual: `submittedIds` does let a client remember that a
    non-writer cannot have written a staged answer, narrowing the field in a
    room where somebody sat the round out. `candidates` still lists everyone,
    so the view never names the author; if playtesting shows this mattering,
    the fix is to fold it back to a count, and only the Writing screen changes.
31. **ROUND_END order: staged answers first, in the order the room guessed
    them, then the un-staged ones in roster order.** A leaver's entry was
    deleted when they left, so their answer never appears — the round shows
    who is still there.
32. **REVEAL's `awarded` is passed straight through** (every present player,
    zeros included, T3 ruling 22) and `guesses` lists only players who
    actually cast one, in roster order. T7 does not recompute scoring.
33. **A reader who is not seated** (a snapshot built for someone who just
    left) gets the default language, no `myEntry` and no `youWrote`, rather
    than a throw.
34. **The matrix is proven by mutation, not by assertion count.**
    `test/snapshot.test.ts` is 106 tests: every phase × every reader role
    (author of the staged answer / a guesser / a player who wrote nothing) ×
    every staged answer index, each serialized over the wire and checked with
    the T2 helpers for absent author keys, absent foreign entry text, absent
    foreign answer ids, and a `myEntry` that is only ever the reader's own.
    Four deliberate leaks were introduced and reverted: `authorId` on the
    staged answer (24 failures), `myEntry` falling back to another player's
    text (6), `candidates` dropping the author (8), and ignoring the reader's
    language (1). **A leak test that has never failed is not evidence — any
    later task changing these views should re-run at least one mutation.**

### Chosen identity — A · AHA (orchestrator, after T0b)

Name **AHA** — the noise the room makes at the reveal, spelled and said
identically in Danish and English. Clash-checked: no party game owns it (a-ha the
band, an Android game hub, a kids' app — none in this space). **TYPISK** was
noted as a Danish-leaning alternate; not taken.

Axis: loud and toy-like. It reads across a room and tells a first-time player
where to tap without instruction. Its known cost — that it shares a visual
dialect with Kahoot and much of the party category — is accepted.

Tokens, to be written into `apps/web/src/app.css` in T0 and composed by every
screen after it:

| Role | Hex |
|---|---|
| field | `#4A1FD6` |
| surface (answer card only) | `#FFFFFF` |
| surface-2 (chips) | `#6B3BFF` |
| ink | `#160B3D` |
| primary action | `#FFE14D` |
| accent right (reveal only) | `#22E39A` |
| accent wrong (reveal only) | `#FF7BAE` |

Type: display **Fredoka** (500/600/700) carries answers and names; UI **Figtree**
(400/500/600/800) does labels, counts and hints — content versus chrome legible
at a glance. Self-host via `@fontsource` as the old faces were, not a CDN.

Contrast, measured: ink on white card 18.3:1; white on field 8.5:1; white on chip
5.7:1; ink on the yellow action 14.0:1. `#FF7BAE` is only 3.5:1 on the field —
**large marks only, never body text.**

The full spec (all four directions, palettes, tradeoffs) is in the session
scratchpad at `identity/DIRECTIONS.md` and on the canvas artifact
`ef9559a1-f2d1-4d98-ae77-e6957b192f79`.

### Navigation and leave confirmation (orchestrator — binding on T6–T8)

Alibi's game screens had no exit at all: once a round started you were stuck
until it ended. Every screen in this game gets a way out.

**Every screen carries a leave control** in the same place — top-left, matching
the existing back/leave buttons on the join and lobby screens, 44px minimum,
with an `aria-label`. Screens: Writing, Guessing, Reveal, RoundEnd, Finale, plus
the existing Join and Lobby.

**Leaving mid-game is destructive, so it is confirmed.** Tapping leave opens a
confirmation that states the real consequence rather than a generic "are you
sure":

- your score for this game is gone;
- if the room drops below 3 players, the game ends for everyone.

Two actions: cancel (default, dismissive) and leave (destructive styling).
Escape and a backdrop tap cancel; focus moves into the dialog and returns to the
leave button on cancel; `aria-modal` with a labelled title.

**Where confirmation is NOT required:** the join screen and the lobby (nothing is
lost yet) and the finale (the game is over). Guarding those would train players
to dismiss the dialog without reading it, which is what makes a real warning
useless.

**Build it once.** T6 creates a shared `LeaveButton.svelte` plus a
`ConfirmDialog.svelte` in `apps/web/src/lib/components/`, and T7/T8 compose them
— they do not each invent one. The dialog is generic (title, body, confirm
label, destructive flag) so later flows can reuse it.

### The staged counter after a void (orchestrator — binding on T4/T7)

T3 correctly refused to paper over this in the engine: `order` is append-only, so
`order.length` counts voided slots too. The player-facing rule:

**The counter shows live, non-voided values** — both the position and the total
are computed over answers that still have an author. If someone leaves mid-round
the room sees "2 of 4" become "2 of 3", which is honest: a person left and there
is one less answer to guess. The alternative — holding the denominator at 4 and
then ending after 3 — looks like a bug to a player, and there is no way for them
to know it wasn't one.

### A locked phone is not a leave (orchestrator — binding on T5)

T3 flagged this and it is a real play problem, not a theoretical one. Early
resolve waits for "every present player", where present means *in the roster* —
so one person whose phone locked makes a room of six wait out the full 60-second
writing timer, every round.

The pure engine cannot know about sockets, and should not. **T5 passes the
connected player ids in from the Durable Object** (it already tracks them for
broadcast) and the engine uses that set for early-resolve decisions only —
never for scoring, staging or presence in the candidate list, where a
disconnected player must still count. Default when not supplied: the whole
roster, i.e. today's behaviour.

Scope it as an argument, not as state: nothing about a socket belongs in
`InternalRoom`, which is persisted.

### `submittedIds` was my mistake — revert it to a count (binding on T6)

T2 deliberately made the writing view expose `submittedCount`, "an aggregate — it
names nobody". My T4 brief asked for `submittedIds` instead, and T4 implemented
it but flagged it as the weakest thing in the change. T4 is right.

The hole: `candidates` is shaped as "everyone except me, including people who
wrote nothing" precisely so a guesser cannot rule out the non-writers. But a
client that saw `submittedIds` during WRITING can simply *remember* who never
submitted and eliminate them at GUESSING. The list gives back exactly what the
candidate rule protects. It leaks nothing at the instant it is sent — nothing is
staged during writing — which is what makes it easy to wave through, and it is
still wrong.

**T6 reverts it to `submittedCount: number`** in `protocol.ts`, `view.ts` and the
snapshot tests, and the Writing screen shows "4 of 6 written" rather than naming
anyone. The nudge value of naming a straggler is real but small; the protection
is structural.

Related, and already correct: `GuessingView.guessedCount` is a count for the same
reason and must never become a list — the author never guesses, so a list of
guessers names them by omission the moment everyone else has voted.

### Open, unruled: a leaver's answer at ROUND_END

T3 deletes a leaver's entry, so their answer vanishes from the round-end recap.
Nobody has decided whether it should still be shown. Leaving it as-is for now;
decide it if a playtest makes it feel wrong.
