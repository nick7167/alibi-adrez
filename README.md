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

## Deployment

- CI (`.github/workflows/ci.yml`): every push/PR runs typecheck → test → build; pushes to `main` additionally deploy both workers.
- Deploy order matters: rooms first, then web — web's service binding points at the rooms worker, so its target must exist first.
- Repo secrets required for deploys: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit) and `CLOUDFLARE_ACCOUNT_ID`.
- Manual deploys: `wrangler login` once, then `pnpm deploy:rooms && pnpm deploy:web`.

## Production URLs

TBD — recorded after the first successful pipeline deploy.
