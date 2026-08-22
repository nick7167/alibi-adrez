// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
//
// Note: no global `/// <reference types="@cloudflare/workers-types" />` here.
// A global workers-types reference re-types `Request`/`RequestInit` across the
// whole program and breaks generated third-party JS (Paraglide runtime) under
// checkJs. The service-binding surface we need is structurally typed below.
declare global {
	namespace App {
		interface Platform {
			env: {
				ROOMS: {
					fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
				};
			};
		}
	}
}

export {};
