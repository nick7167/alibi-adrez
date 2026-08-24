# Plan 2 ledger — the round loop

Working branch: `feat/plan2-round-loop` · Plan:
`docs/plans/2026-08-24-alibi-plan2-round-loop.md`

Update this file at the end of every task, in the same commit as the work. It is
what a resumed session reads first.

| Task | Status | Commit | Notes |
|---|---|---|---|
| T1 scenario pack | done | `59fcd9e` | 20 bilingual (en/da) scenarios in `packages/shared/content/scenarios.ts`; exported via `src/index.ts`; `scenarioById`/`resolveScenario` + tests in `test/scenarios.test.ts` |
| T2 protocol | done | `c6b1aa5` | Added round-loop client messages, error codes, and per-phase views (IntroView replaces StartingView) to `packages/shared/src/protocol.ts`; `snapshotForPlayer` builds a minimal `IntroView`; `applyEvent` stub-rejects the new messages with `WRONG_PHASE` pending T3 |
| T3 state machine | done | `4fac82c` | Round loop in new `packages/shared/src/round.ts` (`RoundState`, `advance`, `applyRoundMessage`, `handlePlayerLeft`, scoring, pair/scenario rotation), re-exported from `src/index.ts`; `InternalRoom` gains `scores`/`wasSuspect`/`rounds`/`deadline` and `EventDeps` gains `now()`/`random()`; 33 new tests in `test/round.test.ts` |
| T4 snapshots | done | `30b1ace` | Per-player `lang` (`join` optional `lang`, new `setLang`), app questions store `detailIndex` instead of English text, and `snapshotForPlayer` builds the real per-phase/per-role view in the reader's language; 27 new tests in `test/snapshot.test.ts` |
| T5 rooms timers/dispatch | done | `a9b2d04` | One alarm slot multiplexes the phase deadline and a `destroyAt` idle key; `alarm()` catches up via `advance` in a loop, self-destructs only when idle is due *and* no sockets are attached, then re-arms for whichever is next; `setLang` + the four round messages routed through `dispatch`; `state` gains `now`; 12 new tests in `apps/rooms/test/round.test.ts` |
| T6 web plumbing + PLANNING | done | — | `api.ts` gains `submitQuestion`/`suspectChat`/`submitAnswer`/`castVote`/`setLang` send helpers + `computeClockOffset`; `+page.svelte` routes every `Phase` (LOBBY→Lobby, INTRO→splash, PLANNING→new `Planning.svelte`, INTERROGATION/DELIBERATION/REVEAL/FINALE→`TODO(T7)`/`TODO(T8)`/`TODO(T9)` placeholders); new `Countdown.svelte`; canvas/`theme-color` derivation extended to the ledger's 7-phase table |
| T7 web INTERROGATION | not started | — | |
| T8 web DELIBERATION + REVEAL | not started | — | |
| T9 web FINALE + e2e | not started | — | |

## Rulings

Decisions made mid-flight that later tasks must respect.

**T3 — round state machine**

1. **Where the logic lives.** New `packages/shared/src/round.ts`, re-exported
   from `src/index.ts`. `state.ts` keeps the lobby/session code and dispatches
   the four round messages into `applyRoundMessage`. `round.ts` imports only
   *types* from `state.ts`, so there is no runtime import cycle.
2. **`advance` re-bases the clock.** A transition sets the next deadline from
   `deps.now()`, not from the deadline it missed. A DO that slept resumes the
   phase it was in with a fresh timer instead of racing to FINALE; `advance`
   therefore changes at most one phase per wake-up and the caller's loop
   terminates. Callers must still loop (T5) — it is the safety net.
3. **Interrogation position is derived, not stored.** `interrogationPosition`
   reads it from `answers` (`questionIndex` + `onTheClock`), so it can never
   drift. `suspectIds[0]` always answers first. Empty string = timed out.
4. **The queue is the `questions` array.** A slot is filled the moment it opens,
   so the *first* question of a round is always app-supplied (detectives can
   only submit during INTERROGATION). Detective questions land in later slots.
   `questions.length` may never exceed `settings.questionCount`; a submission
   past that is `RATE_LIMITED`, same as the 5-per-detective cap.
5. **App-supplied questions use the English detail text.** `InternalRoom` has
   no language, so `round.questions[i].text` is `scenario.en.details[n]`.
   Localising app questions needs a stored detail index — Plan 3 if wanted.
   With `questionCount > 4` and no detective questions, details repeat once all
   four are used (prefer-unused, then reuse).
6. **A suspect who is not on the clock** gets `ALREADY_ANSWERED` if they have
   already answered the current question, otherwise `WRONG_PHASE` ("not your
   turn yet").
7. **`awarded` lists every participant**, including zero-point entries, for the
   two suspects and every detective still in the room — REVEAL (T8) can show
   "you got nothing" without recomputing.
8. **Majority = the resolved verdict**, so on a tie (which resolves to
   `consistent`) the `consistent` voters score +2 and the `busted` voters score
   nothing. `unanimous` is measured over votes *cast*, so an abstention does
   not spoil it.
9. **Leaving.** A leaver's `scores`/`wasSuspect` entries are deleted, so they
   drop off the scoreboard. A departing detective's vote is withdrawn before
   the "everyone voted" check. A suspect leaving during REVEAL does *not*
   abandon the round — it is already scored. An abandoned round still counts
   against `settings.rounds` and is marked with `awarded: []`.
10. **`updateSettings` and `startGame` are LOBBY-only** and now reject with
    `WRONG_PHASE` outside it. `startGame` below 3 players stays `BAD_MESSAGE`.
11. **Planning chat is capped at 200 lines** (oldest dropped) so a round cannot
    grow without bound in DO storage.
12. **FINALE awards (`FinaleView.awards`) are not computed here** — T4 derives
    them from `room.rounds` when it builds the snapshot.
13. **Scope decision 1 broke two existing tests** (2-player `startGame`); they
    now seat three: `packages/shared/test/state.test.ts` and
    `apps/rooms/test/ws.test.ts`. The lobby's own minimum is still T9.

### Orchestrator ruling — per-player language (added before T4)

The plan never said how the server learns which language a player reads, so T3
had to hardcode English for app-supplied questions (`round.ts:104`), and T4
would have had to do the same for the scenario itself. The design spec (§7)
requires scenario language to follow the reader, and snapshots are already
personalized, so the fix belongs in the protocol:

- `Player` carries `lang: Lang` (default `"en"`).
- `join` accepts an optional `lang`; a new `setLang { lang }` client message
  lets the in-app EN/DA toggle update it mid-game.
- App-supplied questions are stored as a `detailIndex`, not resolved text, so
  they can be rendered in the reader's language.
- `snapshotForPlayer` resolves both the scenario and any app-supplied question
  through `resolveScenario(scenarioId, player.lang)`.

T4 implements this. Later web tasks must send `lang` on join and on locale
change.

**T4 — per-player language + personalized snapshots**

14. **`lang` is on `Player`, not on the room.** `join` takes an optional
    `lang` (absent stays absent in the parsed message, so old clients and the
    existing protocol tests are untouched); `applyEvent` defaults it to
    `DEFAULT_LANG` (`"en"`). A *present but unknown* `lang` on `join` or
    `setLang` is a malformed message (`parseClientMessage` -> null -> the DO's
    `BAD_MESSAGE`), the same treatment an unknown emoji gets.
15. **`setLang` is legal in every phase** and only ever touches the sender's
    own `lang`; an unknown sender gets `UNKNOWN_PLAYER`. A no-op change
    returns the room unchanged (no clone), so the DO can still broadcast
    safely. **T5 must dispatch `setLang` alongside the four round messages**,
    and the web tasks must send `lang` on join and on every locale toggle.
16. **App questions store `detailIndex`.** `RoundQuestion` is now
    `{ text: string | null; detailIndex: number | null; askedBy: string | null }`
    — exactly one of `text`/`detailIndex` is set. `questionFor(round, index,
    lang)` is the only supported way to render a question; never read
    `question.text` directly. This replaces T3 ruling 5.
17. **The transcript only contains fully answered questions.** A slot appears
    once *both* suspects have answered, so the second suspect on the clock
    cannot read the first one's answer, and detectives never see half a
    question. Timed-out answers are the empty string and still count as
    answered.
18. **REVEAL publishes the scenario to everyone**, detectives included — that
    is the contract in `protocol.ts` (`RevealView.scenario` is required) and
    the plan's own wording ("the now-public scenario"). The absence tests
    therefore assert no `scenario` key in LOBBY/INTRO/PLANNING/INTERROGATION/
    DELIBERATION/FINALE and assert its *presence* in REVEAL. The `chat` key is
    absent from a detective's snapshot in **every** phase, and the chat text
    never appears in the serialized JSON.
19. **Scoreboard ordering is score descending, then playerId ascending**, in
    every view that carries one. UI tasks can render it as-is.
20. **`myQuestionsLeft` is the honest minimum** of the detective's personal cap
    (5) and the round's remaining question slots (`questionsLeftFor`), so the
    number never promises a submission that would be `RATE_LIMITED`.
21. **FINALE awards** (`finaleAwards` in `round.ts`): `mostConvincingLiar`
    (suspect in the most `consistent` rounds), `sharpestDetective` (most votes
    matching the resolved verdict), `mostCurious` (most questions submitted;
    app-supplied questions count for nobody). Fixed key order, ties to the
    lowest playerId, players who left are ineligible, an award is omitted
    entirely when nobody qualifies, and one player may win several. New keys
    can be appended later; T9 must translate them.

### Orchestrator ruling — countdowns are deadline-based, not ticked (before T5)

The design spec (§4.4) says phase countdowns broadcast a tick every second. Do
not build that. A Durable Object would need an alarm per second per room, it
fights hibernation, it multiplies socket traffic by the player count, and the
countdown still drifts.

Instead the server sends `deadline` (already in every view) plus its own clock,
and each client renders the countdown locally:

- the `state` server message gains `now: number` — the server's clock when the
  snapshot was built;
- the client computes `offset = now - Date.now()` on receipt and renders
  `deadline - (Date.now() + offset)`, so a skewed device clock cannot desync it;
- the DO sets exactly one alarm, for the phase deadline, and broadcasts only
  when the phase actually changes.

This is fewer moving parts, survives hibernation, and is accurate.

**T5 — rooms: timers, alarms and dispatch**

22. **Two deadlines, one alarm.** The idle self-destruct time lives in its own
    storage key `destroyAt` (set when the last socket closes, deleted on any
    successful `join`/`reconnect`); the phase deadline is `room.deadline`.
    `rescheduleAlarm()` arms `ctx.storage.setAlarm` for the *earlier* of the
    two, or deletes the alarm when neither exists. `alarm()` is therefore a
    general wake-up, not "time to die": it catches the room up, then destroys
    only if `destroyAt` is due **and** `ctx.getWebSockets()` is empty. A
    hibernated socket counts as attached, so a room is never destroyed out
    from under a connected player.
23. **`catchUp()` runs before every client message**, not only in the alarm. An
    alarm can be delivered late, and a socket message wakes the object just
    the same, so a message must never be judged against a phase whose time is
    already up. It loops `advance` until it reports no change (bounded by
    `MAX_ADVANCE_STEPS = 16`, unreachable in practice since `advance`
    re-bases every deadline off `now`), saves once and broadcasts once.
24. **`rescheduleAlarm` is called after every mutating dispatch**, including
    the failure branch (catch-up may have moved the phase even though the
    message was rejected), after `startGame`, after `leave`, and after any
    round message. `setLang` is routed alongside the four round messages, so
    T4's obligation is discharged.
25. **`state` carries `now`** (`snapshotForPlayer(room, playerId, now =
    Date.now())`). The extra parameter is optional so the existing shared
    tests are untouched; the DO stamps one `now` per broadcast. This is the
    only protocol change T5 needed — no tick message exists and none should
    be added (see the orchestrator ruling above). **T6 must compute
    `offset = now - Date.now()` on receipt and render the countdown from
    `deadline`.**
26. **Time cannot be faked in `vitest-pool-workers`.** `runDurableObjectAlarm`
    fires the handler immediately regardless of when the alarm was scheduled,
    and there is no supported clock control. Tests therefore *backdate the
    deadline the alarm is waiting on* (`room.deadline`, or `destroyAt`) via
    `runInDurableObject` and then run the alarm — the handler still makes its
    real decision from the real `Date.now()`. `expirePhase()` also refreshes
    the DO's in-memory `room` cache so storage and cache stay consistent. The
    existing "destroys storage when alarm fires with zero connections" test in
    `ws.test.ts` was updated the same way: it used to rely on the old alarm
    destroying unconditionally.
27. **A room orphaned by `/init` with no joiner still has no idle alarm** —
    pre-existing behaviour, unchanged by T5. Worth a cleanup task if orphan
    rooms ever matter.

### Orchestrator ruling — field colour per phase (binding on T6-T9)

Each screen paints the html+body canvas with its field colour (README's canvas
rule) and `theme-color` must carry the SAME hex — `apps/web/test/head-canvas.test.ts`
fails the build if they drift. Fixed assignment, do not improvise:

| Phase | Field | Hex | Text |
|---|---|---|---|
| LOBBY | paper | `#fff6ea` | ink |
| INTRO | night | `#171531` | paper |
| PLANNING | grape | `#7a3be0` | paper |
| INTERROGATION | night | `#171531` | paper |
| DELIBERATION | cobalt | `#3d50e0` | paper |
| REVEAL | sunshine | `#ffc93c` | ink |
| FINALE | grape | `#7a3be0` | paper |

Colours repeat deliberately (INTRO/INTERROGATION, PLANNING/FINALE) — the phases
never sit next to each other. The room route already derives a single `field`
value that drives both `theme-color` and the canvas `<style>`; extend that one
derivation rather than adding a parallel branch.

**T6 — web plumbing + PLANNING**

28. **Svelte-check has a false-positive "`<script>` was left open" bug**:
    if a JSDoc/comment *inside* `<script lang="ts">` contains literal tag-like
    text that also appears as a real tag later in the same file (e.g. a
    comment mentioning `<style>` in a file that also has real `<style>`
    blocks in `<svelte:head>`), svelte-check's tag scanner gets confused and
    fails the whole file with a bogus parse error — even though
    `svelte/compiler`'s own `compile()` accepts the file fine and the bug
    reproduces with a two-line minimal repro. `pnpm -r build`/`vitest` are
    unaffected; only `svelte-check` (i.e. `pnpm typecheck`) trips on it. Never
    write `<style>`, `<script>`, or `<svelte:head>` literally inside a
    `<script>` comment — say "style block"/"script tag" instead, or wrap the
    word in a way that doesn't read as a tag.
29. **No in-room EN/DA switcher exists yet.** The landing page's switcher is
    unchanged; `setLocale` there reloads the document, so a locale change
    surfaces as a fresh socket open rather than an in-place update. `join`
    now sends `lang: currentLocale()`, and the room route's `onOpen` handler
    resends `setLang` on every socket open (fresh join, reconnect after a
    drop, or a reload from a future locale change) — a harmless no-op per
    ruling 15 when the language didn't actually change. If T7-T9 add an
    in-room switcher, wire its click straight to `setLocale`; the resulting
    reload will deliver `setLang` through this same path, no new plumbing
    needed. Placing such a switcher needs care: it must not collide with a
    screen's own top-right content (Planning's countdown already lives
    there).
30. **`+page.svelte`'s `field`/`themeColor` `$derived` is the one place phase
    colours live** (ruling above) — it's one literal ternary, not a lookup
    object, because `head-canvas.test.ts` statically extracts hex literals
    from inside the `$derived(...)` call. `PHASE_SURFACE` (a `Partial<Record
    <Phase, string>>` of Tailwind bg/text classes, matching the same table)
    is a separate, ordinary lookup for body content — the canvas test doesn't
    read it, so it's fine as an object. Extend both together; keep the
    ternary literal.
31. **`Countdown.svelte` contract**: props `deadline: number | null`,
    `offset: number`, optional `class`. Renders nothing when `deadline` is
    null. Text is bare seconds under a minute (`"42"`), `m:ss` at/above a
    minute (`"1:05"`), and a hard-coded `"0:00"` floor at/below zero — never
    negative. Updates on a 250ms interval (~4x/sec), cleaned up on
    unmount/deadline change. No animation, so `prefers-reduced-motion` is
    moot by construction.
32. **`FinaleView` has no `deadline`** (it's not part of `GameViewCommon`) —
    T9's real Finale screen can't feed one to `Countdown`. The current
    placeholder renders the phase stamp only, no timer; keep that when
    replacing it.
33. **T7's placeholder → real screen swap**: replace the `{:else if
    view?.room.phase === 'INTERROGATION'}` branch in `+page.svelte`, passing
    `view.room.deadline` and `offset` to the new component the same way
    `Planning` receives them. Same pattern for T8 (DELIBERATION, REVEAL) and
    T9 (FINALE) — each just swaps its `{@render placeholder(...)}` call for
    the real component.

### Resume point (session checkpoint, 2026-08-24)

T1–T5 are done, verified and pushed. The server now drives the whole loop:
sockets in, phases on an alarm, personalized snapshots out. Next up is **T6
(web: round plumbing + PLANNING screen)**. Two things T6 inherits: the `state`
frame carries `now` (render countdowns from `deadline` locally — never expect a
tick), and the client must send `lang` on join and `setLang` on every locale
toggle.

### Resume point (session checkpoint, 2026-08-24, later)

T1–T6 are done, verified and pushed. The room route now renders every phase
(LOBBY/INTRO/PLANNING for real, INTERROGATION/DELIBERATION/REVEAL/FINALE as
labelled placeholders) and a shared `Countdown.svelte` renders every timer
from `deadline`+`offset`. Next up is **T7 (web: INTERROGATION screen)** —
replace the `TODO(T7)` placeholder per ruling 33, wiring `submitQuestion`
(detectives) and `submitAnswer` (suspects) through the `RoomSocket` helpers
already on `api.ts`. Watch for the svelte-check comment gotcha (ruling 28)
if any new file's script-block comments mention HTML tags by name.
