import {
  applyEvent,
  createRoom,
  parseClientMessage,
  snapshotForPlayer,
  type ClientMessage,
  type EventDeps,
  type ErrorCode,
  type InternalRoom,
} from "@alibi/shared";
import type { Env } from "./env";

const SELF_DESTRUCT_MS = 600_000;
const WS_READY_STATE_OPEN = 1;

type WsAttachment = { authed: false } | { authed: true; playerId: string };

const eventDeps = (): EventDeps => ({
  newId: () => crypto.randomUUID(),
  newToken: () => crypto.randomUUID(),
});

export class RoomDurableObject implements DurableObject {
  private room?: InternalRoom;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ping") return Response.json({ pong: this.ctx.id.name ?? "unknown" });
    if (url.pathname === "/meta") {
      const state = await this.ctx.storage.get<InternalRoom>("state");
      return Response.json({
        exists: state !== undefined,
        open: state?.phase === "LOBBY",
      });
    }
    if (url.pathname === "/init" && request.method === "POST") {
      const { code } = (await request.json()) as { code: string };
      // Atomic check-and-write: blockConcurrencyWhile blocks all other events
      // until the callback completes, closing the TOCTOU window between the
      // storage.get() and storage.put() that let two concurrent /init calls
      // both succeed and merge two lobbies into one identity.
      const created = await this.ctx.blockConcurrencyWhile(async () => {
        const existing = await this.ctx.storage.get<InternalRoom>("state");
        if (existing !== undefined) return false;
        await this.ctx.storage.put("state", createRoom(code));
        return true;
      });
      return created
        ? Response.json({ ok: true })
        : Response.json({ error: "EXISTS" }, { status: 409 });
    }
    if (url.pathname === "/ws") return this.upgrade(request);
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  private upgrade(request: Request): Response {
    if ((request.headers.get("Upgrade") ?? "").toLowerCase() !== "websocket") {
      return Response.json({ error: "UPGRADE_REQUIRED" }, { status: 426 });
    }
    const pair = new WebSocketPair();
    // The Hibernation API replaces the standard accept(): workerd rejects a
    // later acceptWebSocket() on a socket already accepted via ws.accept()
    // ("Cannot call acceptWebSocket() if the WebSocket was already accepted"),
    // so we register with the runtime up front and track auth progress via
    // the socket attachment instead of deferring acceptWebSocket.
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ authed: false } satisfies WsAttachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.serialized(() => this.handleSocketMessage(ws, message));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.serialized(async () => {
      // M2 disconnect grace: keep the player record so they can reconnect.
      const stillConnected = this.ctx.getWebSockets().filter(
        (socket) => socket !== ws && socket.readyState === WS_READY_STATE_OPEN,
      );
      if (stillConnected.length === 0) {
        await this.ctx.storage.setAlarm(Date.now() + SELF_DESTRUCT_MS);
      }
    });
  }

  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      this.room = undefined;
    }
  }

  // Serialize socket events through an in-instance promise chain so that
  // concurrent messages cannot interleave the read-modify-write cycles around
  // applyEvent (input gates only cover individual storage calls).
  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async handleSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const msg = typeof raw === "string" ? parseClientMessage(raw) : null;
    if (msg === null) {
      this.rejectAndClose(ws, "BAD_MESSAGE");
      return;
    }
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (attachment === null || !attachment.authed) {
      if (msg.t === "join" || msg.t === "reconnect") {
        await this.authenticate(ws, msg);
      } else {
        this.rejectAndClose(ws, "BAD_MESSAGE");
      }
      return;
    }
    await this.dispatch(ws, attachment.playerId, msg);
  }

  private async authenticate(ws: WebSocket, msg: ClientMessage & ({ t: "join" } | { t: "reconnect" })): Promise<void> {
    let room = await this.loadRoom();
    if (room === undefined) {
      // First joiner claims an empty-host room even if /init never ran.
      // Kept in memory until applyEvent succeeds; a failed auth attempt
      // must not materialize persistent state.
      room = createRoom(this.ctx.id.name ?? "");
    }
    const result = await applyEvent(room, "", msg, eventDeps());
    if (!result.ok) {
      ws.send(JSON.stringify({ v: 1, t: "error", code: result.code } satisfies ServerError));
      return;
    }
    await this.save(result.room);
    await this.ctx.storage.deleteAlarm();
    if (msg.t === "join") {
      const { playerId, token } = result.welcome!;
      ws.serializeAttachment({ authed: true, playerId });
      ws.send(JSON.stringify({ v: 1, t: "welcome", playerId, token }));
      this.broadcastState(result.room);
    } else {
      ws.serializeAttachment({ authed: true, playerId: msg.playerId });
      ws.send(JSON.stringify({ v: 1, t: "welcome", playerId: msg.playerId, token: msg.token }));
      ws.send(JSON.stringify(snapshotForPlayer(result.room, msg.playerId)));
    }
  }

  private async dispatch(ws: WebSocket, playerId: string, msg: ClientMessage): Promise<void> {
    switch (msg.t) {
      case "ping":
        ws.send(JSON.stringify({ v: 1, t: "pong" }));
        return;
      case "leave":
      case "updateSettings":
      case "startGame": {
        const room = await this.loadRoom();
        if (room === undefined) {
          this.rejectAndClose(ws, "INTERNAL");
          return;
        }
        const result = await applyEvent(room, playerId, msg, eventDeps());
        if (!result.ok) {
          ws.send(JSON.stringify({ v: 1, t: "error", code: result.code } satisfies ServerError));
          return;
        }
        await this.save(result.room);
        this.broadcastState(result.room);
        if (msg.t === "leave") ws.close(1000, "left");
        return;
      }
      case "join":
      case "reconnect":
        ws.send(JSON.stringify({ v: 1, t: "error", code: "BAD_MESSAGE" } satisfies ServerError));
        return;
    }
  }

  private broadcastState(room: InternalRoom): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as WsAttachment | null;
      if (attachment === null || !attachment.authed) continue;
      if (!room.players.some((p) => p.id === attachment.playerId)) continue;
      socket.send(JSON.stringify(snapshotForPlayer(room, attachment.playerId)));
    }
  }

  private rejectAndClose(ws: WebSocket, code: ErrorCode): void {
    ws.send(JSON.stringify({ v: 1, t: "error", code } satisfies ServerError));
    ws.close(1000, code);
  }

  private async loadRoom(): Promise<InternalRoom | undefined> {
    if (this.room === undefined) this.room = await this.ctx.storage.get<InternalRoom>("state");
    return this.room;
  }

  private async save(room: InternalRoom): Promise<void> {
    this.room = room;
    await this.ctx.storage.put("state", room);
  }
}

type ServerError = { v: 1; t: "error"; code: ErrorCode };
