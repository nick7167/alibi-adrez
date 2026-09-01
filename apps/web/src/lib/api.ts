import { isValidRoomCode, PROTOCOL_VERSION } from "@aha/shared";
import type { ClientMessage, Lang, ServerMessage } from "@aha/shared";
import { apiUrl, websocketUrl } from './client';

export async function createRoom(): Promise<{ code: string }> {
	const res = await fetch(apiUrl('/api/rooms'), { method: "POST" });
	if (!res.ok) throw new Error(`createRoom failed with status ${res.status}`);
	const data: unknown = await res.json();
	if (typeof data !== "object" || data === null) {
		throw new Error("createRoom: unexpected response body");
	}
	const code = (data as Record<string, unknown>).code;
	if (typeof code !== "string") {
		throw new Error("createRoom: response is missing a room code");
	}
	return { code };
}

/** Trim/uppercase user input, then validate against the room-code alphabet. */
export function isValidCodeInput(v: string): boolean {
	return isValidRoomCode(v.trim().toUpperCase());
}

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

export interface RoomSocketOptions {
	onMessage(msg: ServerMessage): void;
	onStatus(s: "connecting" | "open" | "closed" | "reconnecting"): void;
	onOpen?(): void;
}

export interface RoomSocket {
	send(msg: ClientMessage): void;
	close(): void;
	leave(): void;
	/** ANSWERING: answer one question. An upsert — send it again to edit; the
	    server mints that answer's id once, so an edit never re-slots it. */
	submitEntry(questionIndex: number, text: string): void;
	/** ANSWERING: "I'm done." Idempotent, and legal with questions left blank. */
	handIn(): void;
	/** GUESSING: accuse `playerId` of writing `answerId`. The answerId is sent
	    explicitly so a tap that lands after the stage moved on is rejected
	    rather than applied to whatever is on screen now. */
	submitGuess(answerId: string, playerId: string): void;
	/** Any phase: follow the reader to a new language. */
	setLang(lang: Lang): void;
}

/**
 * `offset = now - Date.now()`, from the server's clock on a `state` frame.
 * Pure so it's trivially testable; the caller stores the result (in Svelte
 * state) and renders countdowns as `deadline - (Date.now() + offset)`, which
 * a skewed device clock can't desync. See the ledger's "countdowns are
 * deadline-based, not ticked" ruling — there is no tick message.
 */
export function computeClockOffset(serverNow: number): number {
	return serverNow - Date.now();
}

function parseServerFrame(raw: unknown): ServerMessage | null {
	if (typeof raw !== "string") return null;
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof data !== "object" || data === null) return null;
	const frame = data as Record<string, unknown>;
	if (frame.v !== PROTOCOL_VERSION) return null;
	switch (frame.t) {
		case "welcome":
		case "state":
		case "error":
		case "pong":
			return frame as unknown as ServerMessage;
		default:
			return null;
	}
}

/**
 * Room websocket with automatic reconnection (exponential backoff
 * 0.5s → 8s with jitter). Messages sent while the socket is down are
 * queued and flushed in order once it opens again — so a join/reconnect
 * sent during a drop is delivered on reconnect.
 */
export function openRoomSocket(code: string, opts: RoomSocketOptions): RoomSocket {
	const url = websocketUrl(`/api/room/${code}/ws`);

	let ws: WebSocket | null = null;
	let closedByCaller = false;
	let authed = false; // flipped when the server sends a welcome frame
	let attempt = 0;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let queue: ClientMessage[] = [];

	function clearRetryTimer() {
		if (retryTimer !== null) {
			clearTimeout(retryTimer);
			retryTimer = null;
		}
	}

	function connect() {
		if (closedByCaller) return;
		opts.onStatus("connecting");
		const sock = new WebSocket(url);
		ws = sock;

		sock.onopen = () => {
			if (ws !== sock || closedByCaller) return;
			attempt = 0;
			opts.onStatus("open");
			opts.onOpen?.();
			const pending = queue;
			queue = [];
			for (const msg of pending) sock.send(JSON.stringify(msg));
		};

		sock.onclose = () => {
			if (ws !== sock || closedByCaller) return;
			ws = null;
			scheduleReconnect();
		};

		sock.onmessage = (e: MessageEvent) => {
			if (ws !== sock) return;
			const msg = parseServerFrame(e.data);
			if (!msg) return;
			if (msg.t === "welcome") authed = true;
			opts.onMessage(msg);
		};
	}

	function scheduleReconnect() {
		const jitter = 1 - Math.random() * 0.25; // [0.75, 1] — never exceeds nominal delay
		const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt) * jitter;
		attempt++;
		opts.onStatus("reconnecting");
		retryTimer = setTimeout(connect, delay);
	}

	function shutdown() {
		closedByCaller = true;
		clearRetryTimer();
		queue = [];
		ws?.close();
		ws = null;
		opts.onStatus("closed");
	}

	connect();

	function send(msg: ClientMessage): void {
		if (closedByCaller) return;
		if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
		else queue.push(msg);
	}

	return {
		send,
		close(): void {
			shutdown();
		},
		/** Tell the server we're leaving (only if joined + connected), then
		    close for good. Best-effort by design — never throws. */
		leave(): void {
			if (!closedByCaller && authed && ws?.readyState === WebSocket.OPEN) {
				try {
					ws.send(JSON.stringify({ v: PROTOCOL_VERSION, t: "leave" }));
				} catch {
					// send raced a closing socket — the close below is what matters
				}
			}
			shutdown();
		},
		submitEntry(questionIndex: number, text: string): void {
			send({ v: PROTOCOL_VERSION, t: "submitEntry", questionIndex, text });
		},
		handIn(): void {
			send({ v: PROTOCOL_VERSION, t: "handIn" });
		},
		submitGuess(answerId: string, playerId: string): void {
			send({ v: PROTOCOL_VERSION, t: "submitGuess", answerId, playerId });
		},
		setLang(lang: Lang): void {
			send({ v: PROTOCOL_VERSION, t: "setLang", lang });
		},
	};
}
