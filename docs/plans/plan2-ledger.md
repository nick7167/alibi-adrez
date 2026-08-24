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
| T4 snapshots | done | — | Per-player `lang` (`join` optional `lang`, new `setLang`), app questions store `detailIndex` instead of English text, and `snapshotForPlayer` builds the real per-phase/per-role view in the reader's language; 27 new tests in `test/snapshot.test.ts` |
| T5 rooms timers/dispatch | not started | — | |
| T6 web plumbing + PLANNING | not started | — | |
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
