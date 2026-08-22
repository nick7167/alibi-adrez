import { describe, expect, it, vi } from "vitest";
import { GET } from "../src/routes/api/[...path]/+server";

// adapter-cloudflare v7 exposes bindings via event.platform.env (not locals.runtime)
function makePlatform(captured: { req?: Request } = {}) {
	return { env: { ROOMS: { fetch: vi.fn(async (req: Request) => { captured.req = req; return new Response("{\"ok\":true}") }) } } };
}

it("forwards path, query and method", async () => {
	const captured: { req?: Request } = {};
	const platform = makePlatform(captured);
	const event = { params: { path: "api/rooms/AB23" }, request: new Request("http://x.local/api/rooms/AB23?verbose=1"), platform } as any;
	const res = await GET(event);
	expect(res.status).toBe(200);
	expect(captured.req!.url).toBe("https://rooms.internal/api/rooms/AB23?verbose=1");
	expect(captured.req!.method).toBe("GET");
});

it("preserves websocket upgrade headers", async () => {
	const captured: { req?: Request } = {};
	const platform = makePlatform(captured);
	const req = new Request("http://x.local/api/room/KXQF/ws", { headers: { Upgrade: "websocket" } });
	await GET({ params: { path: "api/room/KXQF/ws" }, request: req, platform } as any);
	expect(captured.req!.headers.get("upgrade")).toBe("websocket");
});

it("returns 503 without binding", async () => {
	const res = await GET({ params: { path: "api/rooms" }, request: new Request("http://x.local/api/rooms"), platform: {} } as any);
	expect(res.status).toBe(503);
});
