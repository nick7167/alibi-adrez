import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSocket {
	static instances: FakeSocket[] = [];
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	readyState: number = FakeSocket.CONNECTING;
	sent: string[] = [];
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	constructor(public url: string) { FakeSocket.instances.push(this); }
	send(data: string) { this.sent.push(data); }
	close() { this.onclose?.(); }        // simulate abnormal server close
	serverAccept() {                     // simulate connection established
		this.readyState = FakeSocket.OPEN;
		this.onopen?.();
	}
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
		const sock = lastSocket();
		expect(sock.readyState).toBe(FakeSocket.CONNECTING);
		client.send({ v: 1, t: "join", name: "Nick", emoji: "🦊" });
		client.send({ v: 1, t: "ping" });
		expect(sock.sent).toEqual([]); // queued while connecting, NOT sent
		sock.serverAccept();
		expect(sock.readyState).toBe(FakeSocket.OPEN);
		expect(sock.sent).toEqual([
			JSON.stringify({ v: 1, t: "join", name: "Nick", emoji: "🦊" }),
			JSON.stringify({ v: 1, t: "ping" }),
		]); // flushed in order on open
		client.send({ v: 1, t: "ping" }); // post-open sends go direct
		expect(sock.sent.length).toBe(3);
		expect(sock.sent.at(-1)).toBe(JSON.stringify({ v: 1, t: "ping" }));
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

	it("invokes onOpen on every socket so a replacement gets re-authenticated", async () => {
		const reconnectFrame = JSON.stringify({
			v: 1,
			t: "reconnect",
			playerId: "p1",
			token: "tok"
		});
		const { openRoomSocket } = await import("../src/lib/api");
		let client: import("../src/lib/api").RoomSocket | null = null;
		const onOpen = vi.fn(() => {
			client?.send({ v: 1, t: "reconnect", playerId: "p1", token: "tok" });
		});
		client = openRoomSocket("AB23", { onMessage: vi.fn(), onStatus: vi.fn(), onOpen });
		const first = lastSocket();
		first.serverAccept();
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(first.sent).toEqual([reconnectFrame]);
		first.close(); // abnormal drop (lock screen / network blip)
		await vi.advanceTimersByTimeAsync(500);
		const second = lastSocket();
		expect(second).not.toBe(first);
		expect(second.readyState).toBe(FakeSocket.CONNECTING);
		expect(second.sent).toEqual([]); // nothing sent before the new socket opens
		second.serverAccept();
		expect(onOpen).toHaveBeenCalledTimes(2);
		expect(second.sent).toEqual([reconnectFrame]); // replacement socket re-authenticates
		client?.close();
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
