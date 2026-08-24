# Alibi

An online party game of interrogation: question the suspects and catch whoever's alibi falls apart.

pnpm monorepo: `apps/rooms` (Cloudflare Worker REST + WebSocket lobby backed by a Durable Object), `apps/web` (SvelteKit 2 + Svelte 5 client), and `packages/shared` (protocol, room codes, state machine).

## Development

Requires Node 22+ and pnpm 10 (pinned via `packageManager`).

| Command | Description |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev:web` | Run the web app dev server |
| `pnpm --filter @alibi/rooms dev` | Run the rooms worker locally via wrangler |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm test` | Run unit tests in all workspaces |
| `pnpm build` | Build all workspaces |

Playwright e2e lives in `apps/web/e2e`; run it locally from that workspace. It is not part of CI yet.

## Frontend conventions

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

| Service | URL |
| --- | --- |
| Web app | https://alibi-web.nicklas-andreasen2000.workers.dev |
| Rooms worker (health) | https://alibi-rooms.nicklas-andreasen2000.workers.dev/health |

First pipeline deploy: 2026-08-23 (run 32608396401).
