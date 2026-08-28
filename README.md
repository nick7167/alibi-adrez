# AHA

An online party game: everyone answers the same set of questions anonymously,
then the room guesses who wrote what.

**The loop.** A host sets how many questions everyone answers and how many
guessing rounds the game plays. Everybody answers the whole set up front on one
clock, at their own pace, and hands in when they are done. Then the game runs
guessing rounds — **one round is one question and one answer to it** — never
the same question twice in a row, spread fairly across players so nobody is
picked three rounds running while another player never appears. A standings
beat lands every few rounds. Not every answer gets used; that is deliberate.

The full design is in
`docs/superpowers/specs/2026-08-28-answering-phase-design.md`.

pnpm monorepo: `apps/rooms` (Cloudflare Worker REST + WebSocket lobby backed by a Durable Object), `apps/web` (SvelteKit 2 + Svelte 5 client), and `packages/shared` (protocol, room codes, state machine).

## Development

Requires Node 22+ and pnpm 10 (pinned via `packageManager`).

| Command | Description |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev:web` | Run the web app dev server |
| `pnpm --filter @aha/rooms dev` | Run the rooms worker locally via wrangler |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm test` | Run unit tests in all workspaces |
| `pnpm build` | Build all workspaces |

Playwright e2e lives in `apps/web/e2e` and is **not** part of CI — run it
locally with `pnpm --filter web exec playwright test` (the config starts both
dev servers itself). `lobby.spec.ts` covers create/join/settings/start;
`round.spec.ts` plays a complete five-player game to the finale, asserts the
anonymity property **over the wire** and checks that the same question never
runs twice in a row; `viewport.spec.ts` measures the short-viewport rule below
on real screens at 390×420.

**Port note:** the config uses 5173 with `reuseExistingServer` locally, so a
dev server from *another* project on that port will silently be used instead.
`pkill -f vite` before running if you have been working elsewhere.

### Playtesting on your own

The game needs 3 players, so `scripts/bots.mjs` seats bots that answer every
question and guess at random, letting one person play a real game:

```
pnpm --filter @aha/rooms dev          # terminal 1
pnpm dev:web                          # terminal 2
# open http://localhost:5173, create a room, JOIN it, note the code
node scripts/bots.mjs ABCD 4          # terminal 3 — four bots
```

Join in the browser **before** running it: the first player to join is the
host, and only the host can change settings or start. Ctrl-C removes the bots
with a real `leave`, which is also how you exercise the leaver path by hand.

## Frontend conventions

**Design system — AHA.** Tokens live in `apps/web/src/app.css`, and the palette
is seven colours, nothing else: `--color-field` (#4A1FD6, every screen's
ground), `--color-surface` (white — answer cards and reading surfaces only),
`--color-surface-2` (chips), `--color-ink`, `--color-action` (#FFE14D, the
primary action and every eyebrow label), `--color-accent-right` and
`--color-accent-wrong`. The last is 3.5:1 on the field — **large marks only,
never body text**. Two faces, one rule: `--font-display` (Fredoka) carries
content — answers, player names, headings — and `--font-sans` (Figtree) carries
chrome — labels, counts, hints, buttons. There is no mono face: `--font-mono`
and Courier Prime were deleted once `Countdown.svelte` moved to Fredoka.

Two class primitives survive: `.sticker` (the pressable offset shadow) and
`.field-label` (small-caps caption on a light surface). Alibi's "Party File"
vocabulary — `.stamp`, `.stamp-frame`, `.ruled`, `.leader`, `--color-manila`
and the aliased `--color-paper` / `-cobalt` / `-sunshine` / `-coral` / `-mint` /
`-grape` / `-night` tokens — is **deleted**. Screens compose Tailwind utilities
over the tokens rather than growing `app.css`.

**Short-viewport priority.** Every screen is checked at 390×844 *and* 390×420,
the height iOS leaves when the software keyboard is up. When space is short the
context yields — smaller type, clamped lines, hidden decoration — and the input
and the primary action do not. A screen that only works at 844px tall does not
work on a phone. `e2e/viewport.spec.ts` measures this rather than trusting it:
no page scroll in either axis, every touch target ≥44px, and the primary action
visible **without** scrolling (controls inside a scroll region only have to be
reachable).

**Every in-room screen carries the shared `LeaveButton`** in the same top-left
slot, and it owns its own confirmation, so a screen cannot ship an unguarded
exit. Pass `confirm={false}` only where nothing is lost (lobby, finale).

**Screen canvas color.** Every full-bleed screen paints the `html`+`body` canvas
with its own field color, so iOS can never expose a system zone (status bar,
home indicator) in a mismatched color. Two rules make that safe:

1. The style goes in `<svelte:head>` as **static `<style>` text** — never
   `{@html}`, never an interpolated value. Dynamic head styles make Svelte 5
   hydrate the head as a mismatch, and its reconciliation then detaches the
   `<link rel="stylesheet">` elements Vite emits right after — the page loads
   its CSS and renders completely unstyled. Branch with `{#if}` around whole
   static blocks instead.
2. The selector is `html, html > body` (specificity 0,0,2). `apps/web/src/app.css`
   holds the shared default at `:where(html, html > body)` — zero specificity, so
   a page's own color always wins regardless of `<head>` order.

`apps/web/test/head-canvas.test.ts` enforces both rules across every route in CI,
plus that a screen's `theme-color` and canvas hexes stay in sync.

## Deployment

- CI (`.github/workflows/ci.yml`): every push/PR runs typecheck → test → build; pushes to `main` additionally deploy both workers.
- Deploy order matters: rooms first, then web — web's service binding points at the rooms worker, so its target must exist first.
- Repo secrets required for deploys: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit) and `CLOUDFLARE_ACCOUNT_ID`.
- Manual deploys: `wrangler login` once, then `pnpm deploy:rooms && pnpm deploy:web`.

## Production URLs

Two games are live. **AHA** is this repo's `main`; **Alibi** is the retired
concept, still serving from the untouched `alibi-*` workers and recoverable at
tag `alibi-v1.0` (branch `archive/alibi-v1`).

| Service | URL |
| --- | --- |
| AHA (play here) | https://aha.adrez.dev |
| AHA web worker | https://aha-web.nicklas-andreasen2000.workers.dev |
| AHA rooms worker (health) | https://aha-rooms.nicklas-andreasen2000.workers.dev/health |
| Alibi (retired, still playable) | https://alibi.adrez.dev |
| Alibi web worker (frozen) | https://alibi-web.nicklas-andreasen2000.workers.dev |
| Alibi rooms worker (health, frozen) | https://alibi-rooms.nicklas-andreasen2000.workers.dev/health |

Deploys from `main` only ever touch the `aha-*` workers; nothing in this repo
deploys to the Alibi pair any more.

First pipeline deploy: 2026-08-23 (run 32608396401).
