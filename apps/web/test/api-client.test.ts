import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSocket {
	static instances: FakeSocket[] = [];
	sent: string[] = [];
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	constructor(public url: string) { FakeSocket.instances.push(this); }
	send(data: string) { this.sent.push(data); }
	close() { this.onclose?.(); }        // simulate abnormal server close
	serverAccept() { this.onopen?.(); }  // simulate connection established
}
vi.stubGlobal("WebSocket", FakeSocket);
vi.stubGlobal("location", { protocol: "http:", host: "x.local" });

beforeEach(() => { vi.useFakeTimers(); FakeSocket.instances = []; });
afterEach(() => vi.useRealTimers());

function lastSocket() {
	const s = FakeSocket.instances.at(-1);
	if (!s) throw new Error("no socket created");
	return s;
}

describe("openRoomSocket", () => {
	it("flushes a queued join after the socket opens", async () => {
		const { openRoomSocket } = await import("../src/lib/api");
		const client = openRoomSocket("AB23", { onMessage: vi.fn(), onStatus: vi.fn() });
		client.send({ v: 1, t: "join", name: "Nick", emoji: "🦊" });
		const sock = lastSocket();
		sock.serverAccept();
		expect(sock.sent).toEqual([JSON.stringify({ v: 1, t: "join", name: "Nick", emoji: "🦊" })]);
		client.close();
	});

	it("reconnects with growing backoff after abnormal close", async () => {
		const statuses: string[] = [];
		const { openRoomSocket } = await import("../src/lib/api");
		openRoomSocket("AB23", { onMessage: vi.fn(), onStatus: (s) => statuses.push(s) });
		lastSocket().serverAccept();
		lastSocket().close();
		expect(statuses).toContain("reconnecting");
		await vi.advanceTimersByTimeAsync(500);
		expect(FakeSocket.instances.length).toBe(2);
		await vi.advanceTimersByTimeAsync(0);
		lastSocket().close();
		await vi.advanceTimersByTimeAsync(1000);
		expect(FakeSocket.instances.length).toBe(3); // backoff grew 0.5s → 1s
	});

	it("forwards valid server frames and ignores non-conforming ones", async () => {
		const onMessage = vi.fn();
		const { openRoomSocket } = await import("../src/lib/api");
		const client = openRoomSocket("AB23", { onMessage, onStatus: vi.fn() });
		const sock = lastSocket();
		sock.serverAccept();
		sock.onmessage?.({ data: "not json" });
		sock.onmessage?.({ data: JSON.stringify({ v: 2, t: "state", you: "p1" }) });
		sock.onmessage?.({ data: JSON.stringify({ v: 1, t: "nonsense" }) });
		sock.onmessage?.({ data: JSON.stringify({ v: 1, t: "pong" }) });
		expect(onMessage).toHaveBeenCalledTimes(1);
		expect(onMessage).toHaveBeenCalledWith({ v: 1, t: "pong" });
		client.close();
	});

	it("close() by caller stops retries permanently", async () => {
		const { openRoomSocket } = await import("../src/lib/api");
		const client = openRoomSocket("AB23", { onMessage: vi.fn(), onStatus: vi.fn() });
		lastSocket().serverAccept();
		client.close();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(FakeSocket.instances.length).toBe(1);
	});
});

describe("isValidCodeInput", () => {
	it("accepts only normalized 4-char codes", async () => {
		const { isValidCodeInput } = await import("../src/lib/api");
		expect(isValidCodeInput(" ab23 ")).toBe(true);
		expect(isValidCodeInput("AB0O")).toBe(false);
		expect(isValidCodeInput("ABC")).toBe(false);
	});
});

describe("createRoom", () => {
	it("posts to /api/rooms and resolves the code", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({ code: "KXQF" }), { status: 200 })
		);
		vi.stubGlobal("fetch", fetchMock);
		const { createRoom } = await import("../src/lib/api");
		await expect(createRoom()).resolves.toEqual({ code: "KXQF" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("/api/rooms");
		expect(init.method).toBe("POST");
	});

	it("throws on non-ok response", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
		const { createRoom } = await import("../src/lib/api");
		await expect(createRoom()).rejects.toThrow(/503/);
	});
});
