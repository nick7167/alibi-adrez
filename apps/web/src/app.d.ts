/// <reference types="@cloudflare/workers-types" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			runtime?: { env: { ROOMS: Fetcher } };
		}
	}
}

export {};
