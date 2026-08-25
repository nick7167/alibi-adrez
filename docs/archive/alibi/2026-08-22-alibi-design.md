# Alibi — Design Spec

Date: 2026-08-22
Status: Approved (brainstormed with product owner)
Note: To be moved to `docs/superpowers/specs/2026-08-22-alibi-design.md` in the repo when implementation starts (session permissions restrict writes to plan files).

## 1. Overview

Alibi is a mobile-first party game PWA. Each round, a pair of players ("suspects")
secretly receives the same absurd scenario and must keep their stories consistent
while the remaining players ("detectives") interrogate them separately and vote on
whether the alibi holds. The app is the host: it paces every phase, keeps secrets,
and scores results — no moderator needed.

- Works in the same room (players talk out loud) and online (players coordinate via
  built-in private chat; voice calls happen outside the app in v1).
- Scales from 2 to 12+ players with dedicated modes per size.
- English and Danish are equal first-class languages, switchable at any time.
- Hosted entirely on Cloudflare (Workers, Durable Objects, Workers AI).

### v1 non-goals

- In-app live voice/video chat (planned post-v1 via WebRTC).
- User accounts, profiles, friend lists.
- Monetization, analytics beyond basic error logging.
- Spectator mode, replays, matchmaking with strangers.

## 2. Game Design

### 2.1 Roles

- **Suspects** (exactly 2 per round): share a secret scenario; goal: answer all
  questions with a consistent story.
- **Detectives** (everyone else): submit questions, observe separate answers,
  then vote *Consistent* or *Busted*.
- **AI Detective**: fills the detective role when there are fewer than 4 humans.

### 2.2 Round loop

1. **INTRO** (~5s): everyone sees round number and the chosen suspect pair.
2. **PLANNING** (configurable, default 45s): suspects receive the identical secret
   scenario plus a private two-person text channel to sync their story. Detectives
   see only a waiting screen with countdown.
3. **INTERROGATION**: detectives submit questions; the app queues them and serves
   one at a time. Both suspects answer each question separately under a timer
   (default 30s), never seeing each other's answers. Default N questions per round:
   configurable (default 6). If no question is queued, the app supplies a prompt
   from the scenario's detail list.
4. **DELIBERATION**: detectives see both transcripts side-by-side, discuss out loud,
   then vote on their phones (majority of detectives decides).
5. **REVEAL** (~10s): verdict animation, points awarded, running scoreboard shown.
6. Next round starts with a new random suspect pair (players who were suspects are
   not picked again until everyone has been a suspect once, when possible).
7. **FINALE**: podium + superlative awards (e.g., "Most Convincing Liar",
   "Sharpest Detective").

### 2.3 Scoring

- Suspects: +2 points each if voted Consistent; +1 bonus if unanimous.
- Detectives: +2 each if they vote with the majority. No extra bonuses in v1.
- Awards at finale derived from round stats (most consistent pair, most active
  questioner, etc.).

### 2.4 Player-count modes

| Players | Mode |
|---------|------|
| 2 | Co-op vs AI Detective: both humans are the suspect pair; AI generates questions and judges consistency per question; team score vs bot. |
| 3 | Pair + lone human detective; AI suggests follow-up questions and shows an advisory consistency meter next to the human's deciding vote. |
| 4–8 | Classic rotation (section 2.2). |
| 9+ | Two parallel suspect pairs; interrogation alternates between pairs; detectives are split into two teams (alternating by join order) that compete on total score across rounds. |

Mode selection is automatic from join count but can be overridden by the host in
room settings where sensible (e.g., force classic mode at 9).

### 2.5 Room settings (set by host at creation, editable in lobby)

- Number of rounds (default 3, range 1–10)
- Planning timer (default 45s), answer timer (default 30s)
- Questions per interrogation (default 6)
- Scenario source: curated pack / AI-generated / mix (default mix)
- Language needs no setting: each player's device uses its own language.

## 3. Architecture

### 3.1 Repository layout (pnpm monorepo)

```
apps/web        SvelteKit app (Svelte 5, TypeScript, Tailwind CSS v4,
                vite-plugin-pwa, Paraglide i18n). Deployed with
                @sveltejs/adapter-cloudflare. Contains all UI and thin
                API routes that proxy to apps/rooms via Service Binding.
apps/rooms      Cloudflare Worker exporting RoomDurableObject (DO with
                SQLite storage). Authoritative game state machine +
                WebSocket hub. Also hosts REST bootstrap endpoints
                (create room, resolve room code → DO id).
packages/shared Typed message protocol, pure game state machine, shared
                types & scoring logic. No runtime dependencies.
```

One origin: `apps/web` upgrades `/api/room/[code]/ws` WebSockets and forwards
them through the Service Binding to the room DO. All client traffic hits
`apps/web`; `apps/rooms` is not publicly routable.

### 3.2 Why this shape

- A Durable Object per room gives a single authoritative state holder with
  WebSocket fan-out; server-side timers prevent client-side cheating; idle rooms
  hibernate to near-zero cost.
- Game rules live in `packages/shared` as pure functions over state
  (`applyEvent(state, event) -> {state, effects}`). The DO executes transitions,
  timers, persistence, and broadcasts. This makes the full rule set unit-testable
  without Cloudflare runtimes.
- Two deployables stay necessary because Durable Object classes cannot be
  exported from the adapter-generated SvelteKit worker script.

### 3.3 Client

- SvelteKit SPA-style usage (no SSR requirements; landing page prerendered for
  fast first paint).
- State management: Svelte 5 runes stores fed exclusively by server snapshots;
  clients are dumb terminals.
- Tailwind CSS v4; animations via Svelte transitions/motion.

## 4. Real-time protocol & state machine

### 4.1 Phases

`LOBBY → INTRO → PLANNING → INTERROGATION → DELIBERATION → REVEAL → (loop) → FINALE`

Sub-state during INTERROGATION tracks the active suspect-pair slot, current
question index, and which suspect is on the clock. In 9+ mode there are two pair
slots and interrogation alternates between them; all other modes have one slot.

### 4.2 Messages (all typed in packages/shared)

Client → server:
`joinRoom`, `reconnect`, `updateSettings`, `startGame`, `submitQuestion`,
`suspectChat`, `submitAnswer`, `castVote`, `leaveRoom`.

(Deliberation needs no skip control: the vote resolves automatically once a
majority is reached or when the deliberation timer expires.)

Server → client (per connection):
- `state`: personalized snapshot (see 4.3) sent on connect and after each change.
- `event`: transient notifications (timer tick every second, player joined/left,
  phase changed, answer submitted, verdict revealed).

### 4.3 Personalized snapshots

The DO builds each player's snapshot individually:

- Suspects see: their secret scenario, private chat log, current phase, timers.
- Detectives see: sanitized transcript (questions + submitted answers only),
  vote status, timers. Never see scenarios or the private planning channel.
- Secret fields are omitted entirely from non-recipient snapshots (not just
  hidden) — enforced by unit tests that assert absence of secret keys.

### 4.4 Timers & disconnection

- Phase countdowns run inside the DO (setTimeout/alarms), ticks broadcast at 1 Hz.
- Disconnects: session token issued at join (stored in localStorage). Reconnect
  restores exact position. Suspect dropout mid-answer: grace timer (default 60s),
  then auto-skip (counts as "no answer").
- Empty rooms self-destruct after 10 minutes of zero connected players.

## 5. Data model

```
Player     { id, name, emoji, tokenHash, connected, score, wasSuspect }
Settings   { rounds, planningSec, answerSec, questionCount, scenarioSource }
Scenario   { id?, lang, story, details[4] }        // runtime instance
// Content store (packages/shared/content/) holds each curated scenario
// bilingually keyed by id: { id, en: {story, details}, da: {story, details} };
// a Scenario instance is resolved per reader's language at snapshot time.
// AI-generated scenarios are stored as single-language instances.
Round      { index, suspectIds[2], scenario, questions[], answers{}, votes{} }
RoomState  { code, hostId, phase, players[], settings, rounds[], currentRound? }
```

Persistence: DO SQLite storage saves room state after each transition (crash
recovery) and deletes at self-destruct. No external database in v1.

Room codes: 4 characters from an unambiguous set (no 0/O, 1/I/L); collision-safe
generation with retry.

## 6. AI integration (Workers AI, called only from apps/rooms)

- **Scenario generation** ("Infinite mode"): prompt returns strict JSON
  `{story, details[4]}` in the requesting player's language; schema-validated;
  on timeout (>8s) or invalid output, silently falls back to a curated scenario.
  Generation happens during PLANNING so latency hides behind the timer.
- **AI Detective (2p/3p)**: generates interrogation questions from scenario +
  transcript; judges per-question consistency with structured output
  `{verdict: consistent|contradiction, reason}`. Heuristic fallback if the model
  errors — gameplay never blocks on AI.
- Model access abstracted behind one module (`ai.ts`) so model IDs can change
  without touching game logic.

## 7. Content & i18n

- Curated pack: ≥60 scenarios authored natively in both EN and DA (not machine
  translated), stored as typed JSON in `packages/shared/content/`.
- UI strings: Paraglide JS (inlang) with EN + DA catalogs, compile-time checked;
  toggle persisted per device; default from browser locale.
- Scenario language follows the reader: curated entries exist bilingually; AI
  generation requests the reader's language. Mixed-language rooms work because
  snapshots are personalized anyway.

## 8. PWA & mobile UX

- vite-plugin-pwa: webmanifest (standalone, portrait), maskable icons, offline
  app-shell precache; no runtime caching for API/WebSocket traffic.
- Mobile-first: portrait-first layout, safe-area insets, 100dvh handling, ≥44px
  touch targets, ≥16px input font (no iOS zoom), thumb-reach actions.
- Install prompt deferred until after first completed game.
- Network loss: banner + exponential-backoff reconnect; server restores exact
  state from session token. Landing page works offline; gameplay requires
  connection (by design).

## 9. Security

- Secrets never leave the DO unpersonalized (tested, section 4.3).
- Session tokens hashed at rest in DO storage.
- Host-only actions (start, kick, settings) verified against host id server-side.
- Rate limits: max queued questions per detective per round (default 5); message
  size caps; name length cap (20 chars) with optional profanity filter.
- Rooms private by knowledge of code; no public room listing.

## 10. Error handling

- AI failure → curated/heuristic fallback (never blocks).
- DO crash → SQLite-restored state; clients auto-reconnect.
- Invalid/stale messages → explicitly rejected illegal transitions; no-ops for
  stale ones.
- Unknown room code → clear error screen with retry.
- Version skew: messages carry protocol `v`; major mismatch forces reload before
  joining.

## 11. Testing strategy

- **Vitest unit tests** over `packages/shared` state machine: every legal/illegal
  transition, scoring math, secret-leak snapshot assertions, timer edge cases.
- **Contract tests**: message schemas validated both directions.
- **DO integration tests** (vitest-pool-workers): join/reconnect, service-binding
  proxy, persistence across simulated restarts.
- **Playwright e2e**: multiple browser contexts playing create→join→full round→
  finale; mobile viewports; mid-round reconnect.
- AI paths tested against mocked model modules (no network in CI).

## 12. Milestone shape (for planning, not commitments)

1. Monorepo scaffold + CI + deploy pipeline (hello world on both workers).
2. Room lifecycle: create/join/reconnect + lobby UI.
3. Core round loop for 4–8 players end-to-end with curated scenarios.
4. Modes for 2–3 players (AI detective) and 9+ (parallel pairs).
5. AI scenario generation, PWA polish, i18n completeness, e2e hardening.
