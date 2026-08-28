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
| T5 rooms dispatch + socket tests | done | `c13c0b3` | connected-player ids threaded from the DO into the engine for early resolve only (`ConnectedIds`, optional trailing arg); `resolveIfEveryoneReady` called from `webSocketClose`; 8 socket tests in `apps/rooms/test/round.test.ts` (full round on alarms alone, message round-trip, locked phone, eviction, idle self-destruct, voided REVEAL) + 7 engine tests in `packages/shared/test/round.test.ts`; four mutations run |
| T6 web plumbing + Writing | done | `1cc2ee4` | `submittedIds` reverted to `submittedCount`; shared `LeaveButton.svelte` + `ConfirmDialog.svelte`; `Writing.svelte` (prompt, 140-char upsert entry, remaining count, deadline countdown, "n of m written"); router routes WRITING to it and every placeholder now carries a leave control |
| T7 Guessing + Reveal | done | `87e75f2` | `Guessing.svelte` (artboard composition, `candidates` untouched, `myGuess` latched per `answer.id`, ticker-driven client-side grid lock, author variant with no grid) + `Reveal.svelte` (author reveal, per-player `awarded` rows, right/wrong as large marks); router wires both and `submitGuess`; 21 new copy keys in both catalogues |
| T8 RoundEnd + Finale + lobby | done | `0fee890` | `RoundEnd.svelte` (every answer of the round with its author, staged and un-staged, marked not re-sorted; running scoreboard as a horizontal strip; countdown names its destination) + `Finale.svelte` (podium keyed to rank so a tie reads as a tie, full standings, no countdown, `confirm={false}` leave) + the lobby rewritten onto the AHA field with this game's dials and the prompt-pack switches; one protocol addition, `RoundEndAnswer.staged`; `.stamp-frame` and `.leader` deleted from `app.css` |
| T9 rulebook, brand copy, e2e, CSS | done | `—` | landing page and rulebook re-skinned onto the AHA field and rewritten for this game (every number taken from the code); the mask emoji is gone and the favicon/manifest are AHA's; the enabled packs are visible to every player in the lobby; `.stamp`, `.ruled`, `--color-manila` and the whole legacy alias block deleted from `app.css`; `e2e/round.spec.ts` plays a full five-player game to FINALE and asserts anonymity over the wire; the six T1 prompt cuts applied. Domain repoint cancelled (already done by the user) |

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

### T5 — rooms dispatch, the alarm loop and the connected set

35. **The two game messages needed no dispatch work.** T2 already listed
    `submitEntry`/`submitGuess` in `do.ts`'s switch and T3 already routed them
    through `applyEvent` -> `applyRoundMessage`, so they were live the moment
    T3 landed — untested over a socket, which is what T5 actually added. The
    `dispatch` case list is unchanged.
36. **`ConnectedIds` is an argument and never state.** `export type
    ConnectedIds = ReadonlySet<string> | undefined` in `round.ts`; it is an
    **optional trailing parameter** on `applyEvent`, `applyRoundMessage` and
    `handlePlayerLeft`, and `undefined` means the whole roster, i.e. the
    behaviour before it existed. Every pure test and every non-DO caller is
    untouched. Nothing about a socket is written to `InternalRoom`: the room
    is persisted, and a socket set in storage becomes a lie the moment the
    object restarts. The DO derives it in `connectedPlayerIds()` from
    `ctx.getWebSockets()` — authed attachment, `readyState === OPEN` — and
    passes it on every dispatched message.
37. **It reaches exactly one helper.** `awaited(owed, connected)` intersects
    "who we are still waiting for" with the live sockets, and its only two
    callers are `everyoneWrote` and `everyoneGuessed` — the two early-resolve
    predicates. Staging, scoring, `awarded`, `eligibleGuessers` and
    `candidates` all still read `room.players`, so **a disconnected player is
    still staged, still scores and is still a candidate**. Keep it that way:
    the moment the socket set reaches any of those, a locked phone becomes a
    leave.
38. **A dropped socket is the one early-resolve event with no message.**
    Everybody else writes, then the last straggler's phone locks — nothing
    follows a disconnect to re-run the check, so the room would sit out its
    whole timer. `resolveIfEveryoneReady(room, deps, connected)` (pure, in
    `round.ts`) re-runs the WRITING/GUESSING check with no message, and
    `webSocketClose` calls it with the closing socket excluded, then saves,
    broadcasts and re-arms. An **empty** connected set resolves nothing: both
    predicates refuse an empty owed list, so a room whose last socket dropped
    waits for its phase timer rather than resolving on behalf of nobody.
39. **`expirePhase()`'s return value is the re-arm assertion.** It is
    `runDurableObjectAlarm`'s "was an alarm scheduled", so `expect(await
    expirePhase(code)).toBe(true)` at every step of `GUESSING -> REVEAL ->
    GUESSING` is what proves the loop cannot hang. Mutating `rescheduleAlarm`
    to skip REVEAL failed 3 rooms tests; dropping the connected set in
    `dispatch` failed 1; skipping the close-handler re-check failed 1; making
    the engine ignore the set failed 3 shared + 2 rooms tests.
40. **T4 ruling 29 confirmed over a real socket.** The staged author leaving
    during their own REVEAL voids the answer under scrutiny, the projection
    falls back to the contentless INTRO view, the REVEAL still finishes, and
    the next alarm carries the loop on to the remaining answers with
    `answerTotal` down by one. **T7 must render a REVEAL that turns into an
    INTRO splash mid-phase without treating it as an error.**
41. **The rooms tests deliberately do not assert `submittedIds`.** The
    entry round-trip is asserted through `myEntry` and the guess through
    `guessedCount`, both of which survive T6's revert of `submittedIds` to
    `submittedCount`. T6 changes `protocol.ts`, `view.ts` and the snapshot
    tests only.
42. **Nothing arms `destroyAt` while a socket is attached,** so the "idle does
    not fire mid-game" test injects it and fires the alarm — that is a
    reachable state (a socket that connects but never authenticates does not
    clear the key) and it is the guard being tested. The abandoned-room test
    waits for zero sockets *and* a stable `destroyAt` first: closes are
    processed one at a time, and a handler still in flight re-arms the idle
    clock ten minutes into the future right on top of the backdate.

### T6 — web plumbing, the Writing screen and the shared navigation

43. **`submittedIds` is gone; `WritingView.submittedCount: number` is back**
    (`protocol.ts`, `view.ts`, two assertions in `test/snapshot.test.ts`).
    The rooms suite was unaffected exactly as T5 ruling 41 predicted — 25
    tests, untouched, still green. The Writing screen renders "4 of 6
    written" and names nobody. **Neither this nor `GuessingView.guessedCount`
    may become a list again.**
44. **`LeaveButton.svelte` and `ConfirmDialog.svelte` are the shared
    navigation, and T7/T8 compose them — they do not write their own.**
    - `LeaveButton` is the whole control, not just a button: it renders the
      44px chip in the fixed top-left slot (its host must be `relative`) and
      owns the confirmation itself, so a screen writes
      `<LeaveButton onLeave={leaveRoom} />` and *cannot forget the warning*.
      Pass `confirm={false}` only where nothing is lost — the finale.
      `data-testid="leave-game"`; the dialog is `leave-confirm`, its buttons
      `leave-confirm-confirm` / `leave-confirm-cancel`, backdrop
      `leave-confirm-backdrop`.
    - `ConfirmDialog` is generic (`title`, `body`, `confirmLabel`,
      `cancelLabel`, `destructive`, `onConfirm`, `onCancel`, `testid`) and
      knows nothing about leaving. Reuse it for any later destructive flow.
    - Focus: on open it captures `document.activeElement` and moves focus to
      **cancel** (the dismissive action, so a stray Enter destroys nothing);
      on close the `$effect` cleanup returns focus to whatever it captured,
      guarded by `isConnected`. Escape and a backdrop tap both cancel, Tab is
      trapped between the two buttons, and the card is `role="dialog"`
      `aria-modal="true"` `tabindex="-1"` labelled by its title and described
      by its body. All of that is verified in a real browser, not reasoned
      about.
    - **Cancel sits below confirm**, nearest the thumb, so the stray tap at
      the bottom of a phone is the harmless one.
    - Colour note: the dialog card is **ink, not white** — white is the
      answer card and only the answer card, and an overlay in white would
      read as game content. `--color-accent-wrong` is the destructive action
      fill; it is 6.6:1 on the ink card, which is why it is usable there even
      though the identity ruling limits it to large marks on the *field*.
45. **Every screen carries a leave control, placeholders included.** The
    `placeholder` snippet in `+page.svelte` gained a fourth parameter,
    `confirmLeave`, and its `<section>` is now `relative` so the absolutely
    placed button lands. GUESSING / REVEAL / ROUND_END pass `true`; FINALE
    passes `false`.
46. **The Writing screen seeds its field from `myEntry` exactly once.** The
    server broadcasts a fresh snapshot every time *anyone* submits, so
    re-assigning the textarea from `room.myEntry` on every update would wipe
    an edit-in-progress mid-keystroke. A `seeded` latch takes the first
    defined value (which is what makes a reconnect repopulate) and never
    fires again. **T7's guess grid has the same hazard** — `myGuess` arrives
    on every broadcast.
47. **Handing in never disables the field.** `submitEntry` is an upsert, so
    the screen swaps the button to "change my answer", shows a green
    "handed in" chip and says out loud that it can still be changed. The
    submit button is disabled only when there is nothing new to send.
48. **Everyone writing early-resolves WRITING immediately**, so the
    "everybody has submitted" state of this screen is not reachable in
    practice — the room is already in GUESSING. Worth knowing before
    designing for it.
49. **The entry field is a `<textarea>`, not an `<input>`.** One line is the
    rule (`MAX_ENTRY_LENGTH` 140) but a 140-character sentence has to wrap to
    stay readable in Fredoka at 26px. Enter hands in rather than inserting a
    newline, and a pasted newline is flattened to a space, so the value is
    still single-line.
50. **`Countdown.svelte` is restyled from outside, not extended.** It is on
    the plan's untouched list and hardcodes `font-mono text-2xl`, so
    `Writing.svelte` overrides it with a `:global([data-testid='countdown'])`
    rule scoped to its pill. **T7/T8 should do the same rather than adding a
    prop** — every phase wants a different countdown size, and Tailwind class
    order on the component would not reliably beat the component's own
    `font-mono`.
51. **Copy keys added:** `nav.leave`, `leave.title|body|confirm`, and
    `writing.eyebrow|placeholder|remaining|submit|update|submitted|editHint|progress`,
    in both catalogues, Danish written natively. `common.cancel` already
    existed and is `ConfirmDialog`'s default cancel label.

### T7 — the Guessing and Reveal screens

52. **`candidates` is rendered exactly as the server sent it, in the order it
    sent it.** `Guessing.svelte` never filters, sorts or de-duplicates the
    array; the only thing it does with an id is look up the name and emoji in
    `room.players`. The chip list is `{#each room.candidates}` and must stay
    that way — any client-side filter (to writers, or to drop the author) is
    the leak the whole view shape exists to prevent. Verified over the wire:
    all four readers received `candidates.length === 3` in a 4-player room and
    no reader's own id appeared in their own list.
53. **`myGuess` is latched per `answer.id`, not per mount.** `seededFor` (a
    plain `let`, not `$state` — it is effect bookkeeping and is never
    rendered) holds the answer id the local `selected` belongs to. On a new
    `answer.id` the selection resets and re-seeds from whatever `myGuess` the
    server already holds (a reconnect mid-answer); on the *same* id it takes
    the first defined `myGuess` and ignores every later snapshot. The reset
    branch is not defensive padding: `GUESSING → GUESSING` with a new staged
    answer and no REVEAL between is reachable whenever the staged author
    leaves (T3 ruling 23). The read of `selected` inside the effect is
    `untrack`ed so the effect depends on the *view*, not on its own write.
54. **The grid locks on a 250ms ticker against the deadline, not on a
    timeout and not on `STALE_ANSWER`.** `expired = deadline - (nowMs +
    offset) <= 0`; `locked = expired || selected !== null`; every chip is
    `disabled={locked}` and `tap()` returns early when locked. A one-shot
    `setTimeout` at the deadline was rejected — it fires late after a phone
    sleeps, and re-deriving from the clock is the discipline `Countdown`
    already uses. Measured: with the page's `Date.now` pushed 120s forward
    while the server was still broadcasting `GUESSING`, all 3 chips went
    `disabled` within one tick and a forced click produced no guess.
55. **The author's variant is a different screen, not a disabled grid.**
    `youWrote` swaps the whole candidate block for a "this one's yours" panel
    plus the `guessedCount` line, and also swaps the answer card's eyebrow
    from "Somebody wrote" to "You wrote" — the author already knows, and the
    anonymous framing would read as the app not knowing either. Measured: the
    author's DOM contains **zero** `guess-grid` and **zero** `guess-chip`
    nodes while a guesser's contains one grid and three chips, from the same
    `candidates.length`.
56. **`guessedCount`'s denominator is `players.length - 1`,** not
    `candidates.length` — they are numerically identical here, but the
    denominator means "the players who guess", which is everyone except the
    author. Still a count, still names nobody.
57. **Reveal renders `awarded` and `guesses`; it computes nothing.** Rows are
    one per `awarded` line (so zeros show), joined to `guesses` by a Map;
    "correct" is `guessedId === view.authorId` and the points chip is the
    server's integer. Verified against the payload: every rendered row's
    points string equalled its `awarded` entry and every `correct`/`wrong`
    mark equalled `guessedId === authorId`, in both languages.
58. **The reader's own award row is hoisted to the top of the list;
    everything else keeps roster order.** The list is the element that scrolls
    on a short viewport, so the line the reader cares about is the one
    guaranteed to be visible without scrolling. This is presentation order
    only — no value is recomputed.
59. **Accent colours are marks, never words.** `--color-accent-right` and
    `--color-accent-wrong` fill 24px badges and the points pill; the labels
    next to them are white/`text-white/70`. The pink is 3.5:1 on the field and
    never carries text on this screen, per the identity ruling.
60. **Both screens restyle `Countdown` with the same `:global` override**
    (`.gu-countdown` / `.rv-countdown`), exactly as ruling 50 prescribes.
    `Countdown.svelte` is still untouched. **T8 does the same.**
61. **Short-viewport shape, measured at 390×420 in a real browser.** Guessing:
    the prompt clamps to two lines at 14px, the answer card floor drops
    272px → 92px and its type 33px → 21px, and **chips keep a 44px minimum**
    (they shrink from 56px, never below the touch target). Reveal: the answer
    card clamps to two lines and the author chip shrinks, while the award list
    keeps scrolling inside its own box. Numbers at 390×420, 4-player room:
    `scrollHeight === innerHeight === 420` on every page; guessing answer card
    `y 128 → 241`, grid `y 284 → 382`, chip heights `44/44/44`; reveal answer
    card `y 60 → 133`, author `y 168 → 224`, rows `y 264 → 396`. Nothing
    clipped, nothing overlapping, no page scroll. At 390×844 the same pages
    measure `scrollHeight === 844` with the answer card at its full 278px.
62. **The staged-counter and `youWrote` copy is `game.answerProgress`
    ("Answer {index} of {total}" / "Svar {index} af {total}") plus the
    `guessing.*` and `reveal.*` namespaces** — 21 keys, both catalogues,
    Danish written natively rather than translated. **T8 reuses
    `game.answerProgress` rather than inventing a second counter string.**
63. **What was NOT verified in the browser, and is the weak spot.** The
    fallback where an in-game phase renders as the INTRO splash (T4 ruling 29
    / T5 ruling 40) is handled structurally — the router switches on
    `view.phase` and both components are simply unmounted — but no live
    play-through exercised a player leaving as the staged author. The unit
    matrix covers the projection; the screen behaviour is reasoned, not
    measured. **T9's full-round e2e should drive a leave during GUESSING and
    during REVEAL.**

### T8 — the RoundEnd and Finale screens, and the lobby's settings

64. **One protocol field was added: `RoundEndAnswer.staged`.** The brief asks
    ROUND_END to mark which answers were staged, and `RoundEndView.answers`
    carried no way to tell: the ordering (staged first, then the rest) is a
    convention the client cannot read, and a reconnecting player has no history
    to reconstruct it from. So `protocol.ts` gained `RoundEndAnswer extends
    RevealedAnswer { staged: boolean }` and `RoundEndView.answers` is now
    `RoundEndAnswer[]`. This is **reporting, not invention** — the engine
    already keeps `round.order`, and it is the opposite of T2 ruling 10's
    `awards`, which had no engine behind it. `RevealedAnswer` itself is
    unchanged, so `openAnswer`'s type still structurally lacks nothing and
    REVEAL is untouched. The round is over when this ships, so the flag is not
    a secret. `view.ts`'s `roundEndView` is the only writer; it sets `true` for
    everything it walks out of `order` and `false` for the rest.
65. **The anonymity matrix was re-run and re-mutated** (ruling 34 requires it
    of any task changing these views). `test/snapshot.test.ts` is now 118 tests
    — twelve new ones asserting that the flagged-staged ids equal `round.order`
    exactly, that the un-staged remainder is `WRITER_COUNT - order.length`, and
    that the staged ones come first. Mutation: flipping `staged: true` to
    `false` in `roundEndView` failed 12 tests; reverted and green.
66. **RoundEnd scrolls on two different axes on purpose.** The answer list
    grows with the room (up to 16) and the scoreboard grows with it, and two
    vertically-growing lists on a 420px viewport both lose. So the answers
    scroll vertically inside their own box and the scoreboard is a
    **horizontally** scrolling strip of chips with a fixed height — the leader
    is always the first chip, the reader's own chip is the yellow one, and the
    strip costs the same 35px whether the room is 3 or 16.
67. **The ROUND_END countdown names what it is counting down to.** After the
    last round the clock runs into the finale, not another prompt, so the pill
    reads "Results"/"Resultat" instead of "Next round"/"Næste runde"
    (`room.round >= room.roundCount`). A pill promising a round that never
    arrives is the kind of thing a player reads as a bug.
68. **The finale podium is styled by rank, not by slot position.** The server
    sorts by score and breaks ties by `playerId` — that tiebreak is an
    *ordering*, not a placing, and painting the second row silver would print a
    result the game never produced. Plinth colour, plinth height and the `#n`
    tag all come from a dense rank computed off the score, so two players on 12
    points get two gold plinths of the same height and the headline says "It's
    a tie!". Measured live: a 12/12/8/7/2 room rendered ranks 1, 1, 3, 4, 5.
69. **The finale carries a second exit, and it is deliberate.** `LeaveButton`
    with `confirm={false}` stays in the top-left slot every screen shares, and
    a full-width "Back to start" button sits at the bottom calling the same
    `onLeave`. A terminal screen whose only way onward is a 44px chip in the
    corner is a dead end in practice. Neither asks for confirmation — the game
    is over and nothing is lost (ruling 44).
70. **`FinaleView` still has no `awards` and none was invented** (T2 ruling
    10). The screen shows the podium and the full standings, both of which are
    `scoreboard` rendered.
71. **The lobby moved onto the AHA field, which is what freed the CSS.** The
    room code is Fredoka in the action yellow inside a translucent frame (the
    code alphabet already excludes I/L/O/0/1, so mono's disambiguation earned
    nothing), the host tag is a yellow chip, and the settings sit in a
    translucent panel. Deleted from `app.css` as a result: **`.stamp-frame`**
    (only the lobby room code used it) and **`.leader`** (only the lobby
    settings rows). **Still held, and T9's to free: `.stamp`** (landing,
    rulebook), **`.ruled`** (landing, `JoinForm.svelte`, rulebook) and
    **`--color-manila`** (landing, rulebook) — plus the whole legacy alias
    block, which `JoinForm` and the landing page still compose.
72. **The pack floor is enforced in the UI, not just refused by the server.**
    `nextSettings` ignores a patch that would empty `packs`, which from the
    host's side is a tap that silently does nothing. So the last enabled pack's
    switch is `disabled` and a line appears saying at least one has to stay on.
    Verified live: turning everything off but `absurd` disables that switch, a
    forced click changes nothing, and the server still holds `["absurd"]` after
    the debounce.
73. **Spicy is labelled plainly: "Confessions" / "Tilståelser",** with a line
    naming the material — "Personal admissions: white lies, cringe, petty
    revenge. Not for every group." The pack id stays `spicy`; only the label a
    host reads changed. "Spicy" is the cute name, and a host switching it on in
    mixed company should not have to guess what is behind it. (Read against the
    actual content: the pack is embarrassment and petty confession, not adult
    material, and the label says so rather than over-warning.)
74. **Non-hosts still see no settings at all,** including whether the
    confessions pack is on. That is unchanged from Alibi's lobby and it is the
    one consent-shaped gap left in this screen. **T9 should consider a
    read-only summary for guests**; T8 did not add one because it is new
    surface on the screen with the tightest short-viewport budget.
75. **Short-viewport measurements, real browser, 5 contexts (3 EN / 2 DA)
    driven through two full rounds into ROUND_END and on into FINALE.** Every
    page: `scrollHeight === scrollWidth-clean === innerHeight` at both sizes,
    i.e. no page scroll in either axis.
    - ROUND_END 390×844 (EN): leave `y 16→60`, countdown `y 47→68`, prompt
      `y 117→157`, answer list `y 208→751`, scoreboard strip `y 777→812`.
    - ROUND_END 390×420 (EN/DA identical): prompt clamps to one line
      `y 89→105`, answer list `y 151→350`, scoreboard `y 377→408`.
    - FINALE 390×844: headline `y 62→94`, podium `y 111→286`, standings
      `y 320→588`, primary action `y 756→812`.
    - FINALE 390×420: headline `y 38→68`, podium `y 80→193`, standings
      `y 227→344`, action `y 352→408` (its 56px height is untouched by the
      compaction).
    - Lobby 390×420: every stepper and pack switch measured **≥44px** tall
      (44/44/44/44/44/44, packs 52/52/52/67).
76. **Verified live, not reasoned about:** ROUND_END listing all five answers
    with authors in a 5-player room where only four were staged (4 × "Guessed",
    1 × "Not guessed", every row carrying an author name); the scoreboard chip
    count matching the roster; the in-game leave control opening
    `leave-confirm` and the finale's navigating straight home with no dialog;
    all three steppers clamping at both bounds with their buttons disabled;
    the pack floor; both ROUND_END countdown labels.
77. **Reasoned, not measured — the weak spots.** (a) A room at the 16-player
    ceiling was never rendered; the answer list and the scoreboard strip both
    scroll, so nothing should clip, but the 8-second ROUND_END is certainly too
    short to *read* sixteen answers, which is a game-design problem the
    orchestrator's outstanding paper playtest owns, not a layout one. (b) The
    empty-round path (`roundEnd.empty`, reachable when fewer than two players
    wrote) is unit-covered by T3 ruling 20 but was never seen on screen. (c) A
    leaver during ROUND_END or FINALE was not driven — T7 ruling 63's gap is
    still open and still T9's.

### T9 — brand copy, the rulebook, consent in the lobby, the full-round e2e

78. **The mask emoji was replaced with nothing, and that is the decision, not a
    dodge.** The `<title>` is now plain `AHA`. An emoji next to the title is a
    second mark competing with the favicon, and Alibi's 🎭 worked precisely
    because the mask *was* that game's mark — AHA's mark is the wordmark, which
    the tab already carries as an icon. Picking 🎉/😲/💥 would have inherited
    the pattern without inheriting the meaning. What did change instead: the
    **favicon** (both copies — `static/favicon.svg` and `src/lib/assets/favicon.svg`,
    which `+layout.svelte` imports) is the same A-with-a-mark glyph redrawn in
    the AHA palette — action yellow on the field, accent-right for the spark —
    and `app.html`'s `theme-color` plus the manifest's `theme_color` /
    `background_color` / `description` moved from Alibi's sunshine to `#4A1FD6`.
79. **The rulebook's numbers are cited, not remembered.** `content/rules.ts`
    carries a header comment naming the file each number comes from
    (`MIN_PLAYERS`/`MAX_PLAYERS`/`MAX_ENTRY_LENGTH` and `DEFAULT_SETTINGS` from
    `protocol.ts`, the 1–10 / 20–120 / 10–60 bounds from `state.ts`'s
    `nextSettings`, INTRO 3s / REVEAL 7s / ROUND_END 8s / `MAX_STAGED` 4 and the
    +2/+1 from `round.ts`). **Any change to those constants changes this file in
    the same commit.** Two scoring details are stated because they are not
    guessable: a player who never guesses scores 0 *and* pays the author
    nothing, and points land at every REVEAL rather than at the end.
80. **The pack summary sits ABOVE the roster for guests, not below it.** It was
    below first and at 390×420 the roster pushed it out of the scroll box —
    a consent notice one scroll away from a screen you are about to tap "ready"
    on is the same problem the ruling was written about. All four packs are
    listed, on *and* off (a pack missing from a list of enabled ones is
    ambiguous; off has to look off), and when confessions is on the guest reads
    the same material-naming line the host read. The host's panel is unchanged.
81. **The landing page's identity group centres itself, and stops centring at
    390×420.** `justify-center` inside a scrolling box clips the *top* of
    anything taller than the box — the overflow spills both ways and only the
    bottom half is reachable — which is exactly what happened first: the
    wordmark lost its top third. At `max-height: 600px` the group aligns to the
    top, the "3–16 players" line is hidden, the mark drops to 52px, and with the
    join panel open the three-beat strip is hidden too (`.ho-compact`), because
    whoever opened that box was handed a code and does not need the explanation.
    Measured at 390×420 in both languages: every control fully visible, no page
    scroll in either axis.
82. **The e2e proves anonymity over the wire, not in the DOM.** Each page
    records its own WebSocket frames. During WRITING no page may be *sent*
    another player's answer text; during GUESSING no page may be sent an
    `authorId` at any depth (the `deepKeys` walk from the unit helpers, ported
    into the spec). A DOM-only check would prove the screen didn't render the
    secret — it would not prove the server never told the browser, which is
    where the guarantee actually lives. The DOM checks stay as well
    (`[data-author]` count 0 on a guesser's page; zero `guess-grid` and zero
    `guess-chip` on the author's, against four chips on everyone else's).
83. **Scoring is asserted arithmetically.** Every staged answer is guessed
    correctly by exactly one player (+2) and wrongly by the other three (+1 to
    the author each), so the whole four-answer round must total exactly 20
    points at the finale. Combined with the per-REVEAL "the named author is the
    player who actually wrote it" assertion, a right total paid to the wrong
    player still fails.
84. **The lobby drops a pending settings patch when it unmounts, and that is a
    real footgun the e2e tripped over.** The stepper is debounced 300ms and the
    teardown effect deliberately cancels the in-flight patch (T8's reasoning:
    no stray `updateSettings` after the phase leaves LOBBY). Tapping a stepper
    and hitting **Start** inside that 300ms therefore *silently loses the
    setting* — the first run of the e2e played a 4-round game it had configured
    to 1. The spec now waits for the server's own echo (a LOBBY `state` frame
    carrying `rounds: 1`) rather than for the number on screen, which is only
    the local draft. **Left unfixed in the product**; the window is 300ms and
    the fix (flush on unmount) risks re-introducing the stray patch T8 removed.
    Worth revisiting if a host ever reports "my setting didn't stick".
85. **The e2e drives the leave that T7 ruling 63 asked for.** Second test: four
    players, the staged author leaves mid-GUESSING, the room voids the answer,
    skips it, and the remaining three reach the finale with the leaver's answer
    absent from the recap. It also covers the INTRO-splash fallback path
    incidentally, since that is what a voided in-flight phase renders.
86. **The six T1 prompt cuts were applied here** (they were ruled "T9 at the
    latest"). Replacements, keeping the per-pack counts exactly:
    `alarm-tomorrow` → `notes-app-last-line`, `most-used-emoji` →
    `phone-greeting`, `bedtime-last-night` → `home-alone-mutter`, `worst-sound`
    → `menu-red-flag`, `emoji-to-delete` → `phrase-banned-from-email`,
    `pretended-to-know` → `secretly-googled`; `pettiest-grudge`'s Danish
    shortened from 67 to 44 characters. Every replacement is a prompt two people
    answer *differently in voice* rather than with the same word or a number.
    The 20 content tests still pass unchanged, counts included (25/20/20/15).
87. **`.field-label` survived but stopped being Alibi's.** It was Courier Prime
    at 0.2em — the "evidence label" — and it is now Figtree 800 at 0.16em, the
    same chrome every AHA screen writes inline. Its only remaining user is
    `JoinForm.svelte`. `--font-mono` itself stays, with exactly one user:
    `Countdown.svelte`, which hardcodes `font-mono` and is on the plan's
    untouched list — so every countdown in the game is still in Courier Prime.
    That is the one visible piece of Alibi's type left in the product.

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

### Resume point (session checkpoint, 2026-08-25)

T0–T5 are done, verified and pushed: the game is fully built and tested on the
server side. `main` deploys to `aha-web`/`aha-rooms`; the old game still serves
at `alibi.adrez.dev` from the untouched `alibi-*` workers.

280 tests green (shared 217, rooms 25, web 38); rooms suite run 3× without flake.

**T6 is done too**: the leak is reverted, the shared navigation exists, and
WRITING is a real screen. 284 tests green (shared 217, rooms 25, web 42 — the
four new web tests are `head-canvas.test.ts`'s `it.each` picking up
`Writing.svelte`; that file is unedited).

**T6b (short-viewport priority fix, 2026-08-25)**: `Writing.svelte` clipped the
entry card under the submit button at 390×420 (keyboard-up height) whenever the
prompt ran two lines or more. Fixed with a `@media (max-height: 600px)` block
scoped to the component: the prompt's type scale shrinks and clamps to two
lines (`-webkit-line-clamp`), `pt-safe`/`pb-safe` and the card/footer paddings
tighten, and the entry card keeps a 128px floor instead of 240px — the submit
button's size is untouched. Verified in Playwright (WebKit-equivalent Chromium,
real app, three-context room to WRITING) at 390×844 and 390×420, including a
forced 57-char/3-line prompt: at 420 the entry field and submit button are both
fully inside the viewport with no overlap and no page scroll
(`scrollHeight === innerHeight`); at 844 every measured box (card, prompt,
button) is pixel-identical before and after the fix. The query never matches
at 844, so the full-height screen is provably unchanged.

**T7 is done**: GUESSING and REVEAL are real screens (rulings 52–63), verified
in Playwright with four contexts driven through to both phases in both
languages at 390×844 and 390×420. 292 tests green (shared 217, rooms 25, web
50 — the eight new web tests are `head-canvas.test.ts`'s `it.each` picking up
`Guessing.svelte` and `Reveal.svelte`; that file is unedited).

**T8 is done**: ROUND_END, FINALE and the lobby's settings are real screens
(rulings 64–77). One protocol field was added and justified —
`RoundEndAnswer.staged` — and the anonymity matrix was re-run and re-mutated
around it. `.stamp-frame` and `.leader` are deleted; `.stamp`, `.ruled` and
`--color-manila` are still held by the landing page, `JoinForm.svelte` and the
rulebook, so the legacy alias block in `app.css` goes with **T9**.

**T9 is done, and with it Plan 3.** (rulings 78–87)

## Plan 3 complete

**What works, verified:** the whole game end to end. A host creates a room,
3–16 players join on their own phones in English or Danish, everyone answers
the same anonymous prompt, up to four answers are put to the room one at a
time, the room guesses, the author is revealed and points land, every answer of
the round is shown with its author, and the finale ranks the room. The server
is the authority on all of it; the client can only ask.

- **312 unit tests green** — shared 229, rooms 25, web 58. `pnpm -r typecheck`,
  `pnpm -r test`, `pnpm -r build` all clean.
- **3 Playwright e2e green locally** (not in CI, deliberately): the lobby spec,
  a full five-player game to FINALE with the anonymity property asserted over
  the wire, and a staged author leaving mid-guess without hanging the room.
- **Anonymity** is structural (the private store is keyed by author, the public
  stage by opaque shuffled ids, and only `view.ts` reads `round.entries`),
  covered by a 118-test projection matrix that has been mutation-tested five
  times, and now confirmed in real browsers against real socket frames.
- **Every screen** works at 390×420 as well as 390×844, carries a leave control,
  and wears one field colour with a matching canvas so iOS never shows a seam.
- **Both games are live**: `aha.adrez.dev` (this) and `alibi.adrez.dev` (the
  retired concept, untouched workers, tag `alibi-v1.0`).

**Explicitly still outstanding:**

1. **The paper playtest at 3, 6 and 10 players — the only thing that can tell
   us whether the game is fun.** At 8+ players only 4 of N answers are staged,
   so half the room writes something nobody is asked about; ROUND_END is a
   mitigation, not a fix. `MAX_STAGED` is one exported constant and is cheap to
   change now, expensive once anything else assumes 4.
2. **Prompt volume.** 80 bilingual prompts ship; the design pass argued ~120 is
   the real number before a group hits repeats on night two.
3. **A 16-player room has never been rendered**, at any viewport (T8 ruling 77a).
   The 8-second ROUND_END is certainly too short to read sixteen answers, which
   is a game-design question, not a layout one.
4. **The empty round** (`roundEnd.empty`, fewer than two writers) is unit-covered
   and has never been seen on screen (T8 ruling 77b).
5. **A settings tap lost inside the 300ms debounce** if the host starts the game
   immediately after it (ruling 84). Known, unfixed, 300ms wide.
6. **Every countdown in the game is still Courier Prime** — `Countdown.svelte`
   is on the plan's untouched list and hardcodes `font-mono` (ruling 87). It is
   the last visible piece of Alibi's type.
7. **A leaver's answer at ROUND_END** stays unruled (see the open item above):
   their entry is deleted, so their answer vanishes from the recap.

**Still outstanding and not a code task:** the paper playtest at 3, 6 and 10
players. At 8+ players only 4 of 8 answers are staged, so half the room writes
something nobody sees. `MAX_STAGED` is one exported constant — cheap to change
now, expensive once five screens assume the current shape.

### Short-viewport priority (orchestrator — binding on T6b, T7, T8)

Verified in WebKit at 390×844 and again at 390×420, the height iOS leaves when
the software keyboard is up. At full height the Writing screen is correct. At
keyboard height **the answer card is clipped mid-text** — the three-line prompt
consumes the space and the field the player is typing into is sliced by the
submit button.

The rule for every screen with an input:

**When vertical space is short, the prompt yields and the input does not.** The
prompt is context; the input is the task. Concretely: the prompt block is the
flexible element (it may shrink its type scale, clamp its line count, or scroll),
while the entry card keeps a minimum height and the primary action stays fully
visible. Never the other way round.

Test it the way it was found: set the viewport to 390×420 and assert that both
the input and the primary action are fully within the viewport, and that neither
is clipped by the other. A screen that only works at 844px tall does not work on
a phone, because the keyboard is up for the entire time the player is writing.

This is binding on T7 and T8 as well — they were about to copy the Writing
screen's layout shape, which is exactly how a single-screen bug becomes the
house style.

### Domains — already done by the user, T9 does NOT repoint anything

- **`aha.adrez.dev` → the AHA workers** (verified serving the new build).
- **`alibi.adrez.dev` → the old ALIBI workers**, untouched and still playable.

The plan's T9 step "repoint the domain" is therefore **cancelled**. The two games
live at separate addresses; retiring the old one is a later, independent choice.
T9 updates the README's production URLs to show both.

### The mask emoji is Alibi's (binding on T9)

The AHA page title still reads "AHA 🎭". The theatre mask was Alibi's identity;
AHA's is the noise the room makes at the reveal. It appears on the browser tab,
the home-screen icon and share previews, so T9 replaces it across `app.html`,
the manifest, the favicon and `app.title` — and picks something that belongs to
this game or nothing at all, rather than inheriting the old one by accident.

### Non-hosts cannot see whether Confessions is on (binding on T9)

T8 flagged this and it is the one consent-shaped hole left. Only the host sees
the pack selection, so a player can be asked to write an answer to a personal
prompt without ever having been told the spicy pack was enabled.

**T9 shows the enabled packs to everyone in the lobby** — read-only for
non-hosts, host-editable as now. It does not need to be a control or take much
room; it needs to be visible before anyone agrees to play. Consent that only the
host can see is not consent.

### Keep the finale's two exits

T8 gave the finale both a corner leave chip and a full-width "Back to start", and
asked whether that duplication should stand. It should. A terminal screen whose
only exit is a 44px corner chip is a dead end for anyone who does not think to
look there, and neither control asks for confirmation, so there is no cost to
having both.

### Ruling 84 resolved — settings flush on Start

The lobby debounced `updateSettings` by 300ms and its teardown dropped any
pending patch, so tapping a stepper and immediately pressing **Start** began a
game with the old value, silently. T9 hit this for real: its first e2e run played
a four-round game it had configured to one.

Fixed by flushing the pending patch synchronously **when Start is pressed** —
`flushPatch()` then `onStart()`. Not on teardown: T8 removed a stray
`updateSettings` that fired after the room had left LOBBY, and a blind teardown
flush would bring it straight back. Start is the one moment where the host is
provably still in the lobby and the patch is still legal. The debounce still
coalesces rapid taps.

**Outstanding: the regression test is NOT in the repo.** A spec was written
(`lobby-settings-flush.spec.ts`, kept in the session scratchpad as `.wip`) but it
hangs locally and was never observed passing, so it was not committed — a hanging
spec in the suite is worse than no spec. The fix itself is verified only by
typecheck, the 312 unit tests, a clean build and reading the diff. **Anyone
picking this up should finish that spec and prove it fails without the fix.**

Also note: the local Playwright environment got wedged during this work (repeated
dev-server kills left ports and the wrangler dev registry in a bad state). The
full e2e suite passed cleanly earlier at `894c009`; it could not be re-run after
this change. Re-run it on a clean machine state before trusting the e2e result.

### Countdown moved off Courier Prime

`Countdown.svelte` hardcoded `font-mono`, the last visible piece of Alibi's
type. It now uses `--font-display` (Fredoka), the `:global` overrides the five
screens carried for it are gone, and `--font-mono` plus the
`@fontsource/courier-prime` dependency are deleted — nothing rendered it any
more, and an unused webfont is weight on every page load.


---

## Superseded: the round loop (2026-08-28)

Plan 3's loop — `settings.rounds` iterations of "one prompt, everyone writes
one answer, the room guesses up to `MAX_STAGED` of them" — has been replaced.
The new design is in
`docs/superpowers/specs/2026-08-28-answering-phase-design.md`.

**What changed.** Everybody answers a whole set of questions up front on one
clock (`ANSWERING`, renamed from `WRITING`) and hands in when they choose; the
game then plays guessing rounds where **a round is one question and one answer
to it**, never the same question twice in a row, drawn from the least-staged
players. `ROUND_END` is deleted and `STANDINGS` is new. Three host dials became
six.

**Which rulings in this file are now dead.** 14 (durations), 15 (INTRO once per
round), 17, 20, 21 (`MAX_STAGED` staging), 22 (`awarded` keyed by answerId), 28,
31 (ROUND_END ordering), 43 (`submittedCount`), 46-50 (the Writing screen),
64-67, 71, 76-77 (the ROUND_END screen), 86's prompt-cut bookkeeping is still
accurate but the "per-pack counts" now also cap the questions dial.

**Which rulings still bind, unchanged, and were re-proved.** 16 (`authorOf` is
the only reverse lookup), 26-27 (`view.ts` is the only reader of the private
store; the builders' types structurally lack the secret), 29 (a contentless
splash is the safe fallback, never a richer view), 30 and the `submittedIds`
ruling (progress is a count, never a list — now `doneCount` and `guessedCount`),
32, 34 (**mutation, not assertion count** — five leaks were introduced and
reverted against the new matrix), 36-40 (`ConnectedIds` is an argument, never
state; a locked phone is not a leave), 44-45 (the shared `LeaveButton` on every
screen), 52-56, 58-60 (the Guessing and Reveal screens), 68-70 (the finale),
72-74 (the pack floor, plain labelling, and packs visible to guests — the guest
panel now also names the game shape), 79 (the rulebook cites its numbers), 81,
87.

**Ruling 69 is overturned (2026-08-28).** It kept the finale's *two* exits — a
corner leave chip and a full-width "Back to start". Both are gone. The finale
now has exactly one action, "Back to lobby", which returns the room to LOBBY
with the same players, the same code and the same settings; leaving for good is
done from the lobby. A party game should not end by scattering everyone to the
landing page, and two exits that both meant "leave" was the wrong ending.

Consequently the finale is the **one in-room screen with no `LeaveButton`**, a
deliberate exception to that standing rule, and `returnToLobby` is open to
**any** seated player rather than the host: it is the screen's only way onward,
so a host-only reset would strand everyone else the moment the host set their
phone down. `finale.home` was deleted as dead copy.

**Ruling 84 is resolved and stays resolved:** the lobby still flushes its
pending settings patch on Start, and the e2e still waits for the *server's*
echo rather than the on-screen draft. The dials additionally expose
`data-value`, because the standings dial renders "Off" at zero and a test that
parses the label reads `NaN`.
