# Plan 3 ledger — the anonymous "who wrote that" game

Plan: `/Users/nicklasandreasen/.claude/plans/i-kinda-don-t-like-declarative-globe.md`
Working branch: `main` (deliberate — see the plan; T0's worker rename is what
keeps the old game serving while this is built).

Alibi is preserved at tag `alibi-v1.0` and branch `archive/alibi-v1`; its plans
and rulings are under `docs/archive/alibi/` and still bind this work.

Update this file at the end of every task, in the same commit as the work.

| Task | Status | Commit | Notes |
|---|---|---|---|
| T0 preserve + rename | done | `—` | workers renamed to aha-rooms/aha-web, `@alibi/shared` → `@aha/shared`, AHA design tokens installed in app.css |
| T0b identity directions | done | `—` (canvas only) | Four directions explored; **A · AHA chosen** |
| T1 prompt packs | done | `6001a98` | 80 bilingual prompts, 4 packs, 20 tests |
| T2 protocol + demolition | done | `—` | new phases/messages/views in `protocol.ts`, `state.ts` cut to lobby-only, Alibi files deleted, placeholder phase screens, catalogues pruned 93 → 42 keys and paraglide regenerated |
| T3 round engine | not started | — | |
| T4 view projections + anonymity | not started | — | |
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
