# Alibi Plan 2 — the round loop (Milestone 3)

Date: 2026-08-24 · Status: in progress · Branch: `feat/plan2-round-loop`
Design spec: `docs/superpowers/specs/2026-08-22-alibi-design.md` (§2.2 round loop,
§4 protocol, §5 data model, §11 testing).

Plan 1 (milestones 1–2: room lifecycle + lobby) is complete and deployed. This
plan builds the game itself: a full round from INTRO to FINALE, for 3–16
players, with curated scenarios and no AI.

## Ground rules for every task

- **Branch**: all work lands on `feat/plan2-round-loop`. Never commit to `main`
  — `main` auto-deploys to production and this feature is only playable once
  the whole loop exists.
- **Commit at the end of every task** (one commit per task, conventional-commit
  subject) and push the branch. A stopped session must always be able to resume
  from the ledger + git history.
- **Verification before every commit**: `pnpm -r typecheck`, `pnpm -r test`,
  `pnpm -r build` must all pass. Report the actual numbers.
- **The design system is settled** — concept D "Party File", documented in
  README under Frontend conventions. New screens compose the primitives in
  `apps/web/src/app.css` (`.sticker`, `.field-label`, `.stamp`, `.stamp-frame`,
  `.ruled`, `.leader`). Play = Baloo 2 on a bright field; evidence = Courier
  Prime in coral stamps (codes, labels, numbering, roles, counts, timers);
  manila = file-like surfaces only.
- **Canvas colour rule holds**: every new full-bleed screen paints `html, html >
  body` with its field colour via *static* `<style>` text in `<svelte:head>` —
  never `{@html}`, never interpolation. `apps/web/test/head-canvas.test.ts`
  enforces it and will fail the build otherwise.
- **All UI copy goes through Paraglide** with both `messages/en.json` and
  `messages/da.json` populated. Danish is authored, not machine-translated.
- **Secrets never leave the DO unpersonalized.** Detectives must never receive
  the scenario or the suspects' private chat, in any phase. This is enforced by
  tests that assert the *absence* of the keys, not just their emptiness.

## Scope decisions (made up front, do not re-litigate)

1. **Minimum players to start becomes 3** (2 suspects + at least 1 detective).
   Today's `startGame` allows 2, which would leave zero detectives. The lobby
   copy key `lobby.needTwo` is replaced by `lobby.needThree`, and the Playwright
   lobby e2e must be updated to seat three players.
2. **Curated scenarios only.** `scenarioSource` stays in `Settings` but any
   value behaves as `curated` in Plan 2; AI generation is Plan 3.
3. **Classic rotation only.** The 2p/3p AI-detective modes and the 9+
   parallel-pair mode are Plan 3. With 3+ players the classic loop is correct.
4. **Deliberation resolves on majority of detectives or timer expiry** — there
   is no skip control (design spec §4.2).
5. **Server owns all timing.** Clients render countdowns from server ticks and
   never decide a phase is over.

## Phase contract

```
LOBBY → INTRO (5s) → PLANNING (settings.planningSec)
      → INTERROGATION (settings.questionCount questions × settings.answerSec × 2 suspects)
      → DELIBERATION (60s cap) → REVEAL (10s)
      → next round, or FINALE after settings.rounds rounds
```

Scoring (design spec §2.3): suspects +2 each if voted Consistent, +1 bonus each
if the detective vote was unanimous; detectives +2 each for voting with the
majority. Ties in the detective vote count as Consistent (the suspects get the
benefit of the doubt) — record this as a rule, it needs a test.

## Task list

Each task is one agent run. `→` marks the files the task owns.

### T1 — shared: curated scenario pack
→ `packages/shared/content/scenarios.ts`, `packages/shared/test/scenarios.test.ts`

20 scenarios, each `{ id, en: { story, details[4] }, da: { story, details[4] } }`,
authored in both languages (absurd, party-friendly, no real people). Export
`SCENARIOS`, `scenarioById(id)`, and `resolveScenario(id, lang) -> { story,
details }`. Tests: ids unique, both languages present, exactly 4 details each,
no empty strings, `resolveScenario` picks the right language.

### T2 — shared: round-loop protocol
→ `packages/shared/src/protocol.ts`, `packages/shared/test/protocol.test.ts`

Add client messages `submitQuestion { text }`, `suspectChat { text }`,
`submitAnswer { text }`, `castVote { verdict: "consistent" | "busted" }` with
length caps (question/answer/chat ≤ 240 chars, trimmed, non-empty) and full
`parseClientMessage` validation + rejection tests. Add the per-phase views
(`PlanningView`, `InterrogationView`, `DeliberationView`, `RevealView`,
`FinaleView`) to the `RoomView` union — every view carries `phase`, `code`,
`round`, `roundCount`, `deadline` (epoch ms or null) and `scoreboard`. Add error
codes `NOT_SUSPECT`, `NOT_DETECTIVE`, `WRONG_PHASE`, `ALREADY_ANSWERED`,
`ALREADY_VOTED`, `RATE_LIMITED`.

### T3 — shared: round state machine
→ `packages/shared/src/state.ts` (or a new `round.ts` re-exported from index),
  `packages/shared/test/round.test.ts`

Extend `InternalRoom` with `rounds[]`, `currentRound`, per-player `score` and
`wasSuspect`. Implement: suspect-pair selection (never re-pick a player as
suspect until everyone has been one, when possible), question queue with
per-detective cap (5/round), one answer per suspect per question, vote
collection, scoring, phase transitions including timeout events, and FINALE
awards derived from round stats. Pure functions only — no Cloudflare imports.
Tests must cover every legal and illegal transition, the scoring maths, the tie
rule, and pair rotation across rounds.

### T4 — shared: personalized snapshots
→ `packages/shared/src/state.ts`, `packages/shared/test/snapshot.test.ts`

`snapshotForPlayer` returns the right view per phase and per role. Suspects see
the scenario and their private chat; detectives see the sanitized transcript
only. Tests assert the *absence* of `scenario` and `chat` keys from every
detective snapshot in every phase, via deep key-walking rather than shallow
checks.

### T5 — rooms: timers, alarms and dispatch
→ `apps/rooms/src/do.ts`, `apps/rooms/test/round.test.ts`

Drive phase deadlines with `ctx.storage.setAlarm`, broadcast a 1 Hz tick while a
phase is timed, feed timeout events into the state machine, and dispatch the
four new client messages through `applyEvent`. State must survive a simulated DO
restart mid-round. Keep the existing serialized read-modify-write discipline and
the hibernation-safe socket attachments.

### T6 — web: round plumbing + PLANNING screen
→ `apps/web/src/lib/api.ts`, `apps/web/src/routes/room/[code]/+page.svelte`,
  new `Planning.svelte`, a shared `Countdown.svelte`, messages

Route the room page by phase, add a countdown component fed by server ticks,
and build PLANNING: suspects see the scenario card plus their two-person chat;
detectives see a waiting screen with the countdown. Reconnecting mid-phase must
land on the right screen.

### T7 — web: INTERROGATION screen
→ new `Interrogation.svelte`, messages

Detectives: submit questions (with their remaining-question count) and watch the
transcript build. Suspects: answer the current question under the timer, never
seeing the other suspect's answer.

### T8 — web: DELIBERATION + REVEAL screens
→ new `Deliberation.svelte`, `Reveal.svelte`, messages

Deliberation: both transcripts side by side (stacked on a phone), a vote control
for detectives only, and live vote progress. Reveal: verdict, points awarded and
the running scoreboard.

### T9 — web: FINALE, lobby minimum, full-round e2e
→ new `Finale.svelte`, `Lobby.svelte` (min-players copy), `e2e/round.spec.ts`,
  messages

Finale: podium plus superlative awards, and a way back to the lobby. Update the
lobby's minimum-players rule to 3. Add a Playwright e2e that seats four players
and plays a complete one-round game to FINALE, and update the existing lobby
e2e to seat three.

## Out of scope for Plan 2

AI scenario generation and the AI detective; the 2p/3p and 9+ modes; spectators;
PWA install prompt work; profanity filtering.
