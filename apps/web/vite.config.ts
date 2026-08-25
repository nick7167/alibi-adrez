import adapter from '@sveltejs/adapter-cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// SvelteKit options are passed flat since kit 2.62.0 (svelte.config.js is not used).
			adapter: adapter({
				// Dev/preview only: emulate the ROOMS service binding from
				// wrangler.jsonc via getPlatformProxy.
				platformProxy: {}
			}),
			prerender: { handleHttpError: 'warn' }
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		})
	],

	// Dev-only transport for /api/* (REST + WebSocket). Vite's dev server
	// cannot forward HTTP upgrades into SvelteKit endpoints, so a WebSocket
	// opened at /api/room/<code>/ws never reaches src/routes/api/** locally —
	// it is proxied raw to the rooms dev worker instead. Run
	// `pnpm --filter @aha/rooms dev` alongside (port 8787). Deployed builds
	// don't use this: there, /api/* flows through the ROOMS service binding in
	// src/routes/api/[...path]/+server.ts.
	server:
		command === 'serve'
			? { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } }
			: undefined
}));
