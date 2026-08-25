# Plan 3 ledger — the anonymous "who wrote that" game

Plan: `/Users/nicklasandreasen/.claude/plans/i-kinda-don-t-like-declarative-globe.md`
Working branch: `main` (deliberate — see the plan; T0's worker rename is what
keeps the old game serving while this is built).

Alibi is preserved at tag `alibi-v1.0` and branch `archive/alibi-v1`; its plans
and rulings are under `docs/archive/alibi/` and still bind this work.

Update this file at the end of every task, in the same commit as the work.

| Task | Status | Commit | Notes |
|---|---|---|---|
| T0 preserve + rename | part done | `6ac84c4` | tag, archive branch and docs done; the rename waits on the new name from T0b |
| T0b identity directions | done | `—` (canvas only) | Four directions explored; **A · AHA chosen** |
| T1 prompt packs | done | `6001a98` | 80 bilingual prompts, 4 packs, 20 tests |
| T2 protocol + demolition | not started | — | |
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
