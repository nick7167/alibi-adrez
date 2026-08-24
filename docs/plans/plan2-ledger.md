# Plan 2 ledger — the round loop

Working branch: `feat/plan2-round-loop` · Plan:
`docs/plans/2026-08-24-alibi-plan2-round-loop.md`

Update this file at the end of every task, in the same commit as the work. It is
what a resumed session reads first.

| Task | Status | Commit | Notes |
|---|---|---|---|
| T1 scenario pack | done | `59fcd9e` | 20 bilingual (en/da) scenarios in `packages/shared/content/scenarios.ts`; exported via `src/index.ts`; `scenarioById`/`resolveScenario` + tests in `test/scenarios.test.ts` |
| T2 protocol | done | `c6b1aa5` | Added round-loop client messages, error codes, and per-phase views (IntroView replaces StartingView) to `packages/shared/src/protocol.ts`; `snapshotForPlayer` builds a minimal `IntroView`; `applyEvent` stub-rejects the new messages with `WRONG_PHASE` pending T3 |
| T3 state machine | done | — | Round loop in new `packages/shared/src/round.ts` (`RoundState`, `advance`, `applyRoundMessage`, `handlePlayerLeft`, scoring, pair/scenario rotation), re-exported from `src/index.ts`; `InternalRoom` gains `scores`/`wasSuspect`/`rounds`/`deadline` and `EventDeps` gains `now()`/`random()`; 33 new tests in `test/round.test.ts` |
| T4 snapshots | not started | — | |
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
