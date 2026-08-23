import { describe, expect, it, vi } from "vitest";
import { GET } from "../src/routes/api/[...path]/+server";

// adapter-cloudflare v7 exposes bindings via event.platform.env (not locals.runtime).
// The handler calls binding.fetch(url, init) with primitive inputs — a Request
// object from the Node-side runtime cannot be re-wrapped by the platform proxy.
function makePlatform(captured: { url?: URL | string; init?: RequestInit } = {}) {
	return {
		env: {
			ROOMS: {
				fetch: vi.fn(async (url: URL | string, init?: RequestInit) => {
					captured.url = url;
					captured.init = init;
					return new Response('{"ok":true}');
				})
			}
		}
	};
}

it("forwards path, query and method", async () => {
	const captured: { url?: URL | string; init?: RequestInit } = {};
	const platform = makePlatform(captured);
	const event = { params: { path: "api/rooms/AB23" }, request: new Request("http://x.local/api/rooms/AB23?verbose=1"), platform } as any;
	const res = await GET(event);
	expect(res.status).toBe(200);
	expect(captured.url!.toString()).toBe("https://rooms.internal/api/rooms/AB23?verbose=1");
	expect(captured.init!.method).toBe("GET");
});

it("preserves websocket upgrade headers", async () => {
	const captured: { url?: URL | string; init?: RequestInit } = {};
	const platform = makePlatform(captured);
	const req = new Request("http://x.local/api/room/KXQF/ws", { headers: { Upgrade: "websocket" } });
	await GET({ params: { path: "api/room/KXQF/ws" }, request: req, platform } as any);
	const headers = new Headers(captured.init!.headers);
	expect(headers.get("upgrade")).toBe("websocket");
});

it("streams POST bodies through", async () => {
	const captured: { url?: URL | string; init?: RequestInit & { duplex?: "half" } } = {};
	const platform = makePlatform(captured);
	const req = new Request("http://x.local/api/echo", { method: "POST", body: "payload" });
	await GET({ params: { path: "api/echo" }, request: req, platform } as any);
	expect(captured.init!.method).toBe("POST");
	expect(captured.init!.duplex).toBe("half");
	const body = (captured.init!.body as ReadableStream).getReader();
	expect(new TextDecoder().decode((await body.read()).value)).toBe("payload");
});

it("returns 503 without binding", async () => {
	const res = await GET({ params: { path: "api/rooms" }, request: new Request("http://x.local/api/rooms"), platform: {} } as any);
	expect(res.status).toBe(503);
});
