import adapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
	const mobile = mode === 'mobile';

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				// Keep the deployed Cloudflare build unchanged. Capacitor receives a
				// separate static SPA with an index fallback for client-side routes.
				adapter: mobile
					? staticAdapter({
							pages: 'build-mobile',
							assets: 'build-mobile',
							fallback: 'index.html',
							strict: false
						})
					: adapter({
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
				// Cookies are appropriate for the server-rendered web app. Capacitor
				// runs the static app on a custom URL scheme, where cookie access is
				// not a dependable locale store during client startup.
				strategy: mobile
					? ['localStorage', 'preferredLanguage', 'baseLocale']
					: ['cookie', 'preferredLanguage', 'baseLocale']
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
	};
});
