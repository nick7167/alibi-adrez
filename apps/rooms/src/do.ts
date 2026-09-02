import {
  ROOM_SCHEMA,
  advance,
  applyEvent,
  createRoom,
  parseClientMessage,
  resolveIfEveryoneReady,
  snapshotForPlayer,
  type ClientMessage,
  type EventDeps,
  type ErrorCode,
  type InternalRoom,
} from "@aha/shared";
import type { Env } from "./env";

const SELF_DESTRUCT_MS = 600_000;
const WS_READY_STATE_OPEN = 1;
const SOCKET_MESSAGE_WINDOW_MS = 10_000;
const SOCKET_MESSAGE_LIMIT = 50;
const STATE_KEY = "state";
/**
 * Epoch ms at which an abandoned room deletes itself. Stored in its own key
 * rather than inferred from the alarm, because the single alarm slot is now
 * shared with the phase deadline (see `rescheduleAlarm`).
 */
const DESTROY_AT_KEY = "destroyAt";
/**
 * Safety bound on the catch-up loop. `advance` re-bases every deadline off the
 * current clock, so it always terminates after one step in practice; the cap
 * just guarantees a bug upstream can never spin a Durable Object forever.
 */
const MAX_ADVANCE_STEPS = 16;

type WsAttachment = { authed: false } | { authed: true; playerId: string };

const eventDeps = (): EventDeps => ({
  newId: () => crypto.randomUUID(),
  newToken: () => crypto.randomUUID(),
  now: () => Date.now(),
  random: () => Math.random(),
});

export class RoomDurableObject implements DurableObject {
  private room?: InternalRoom;
  private tail: Promise<unknown> = Promise.resolve();
  private socketBudgets = new WeakMap<WebSocket, { startedAt: number; count: number }>();

  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ping") return Response.json({ pong: this.ctx.id.name ?? "unknown" });
    if (url.pathname === "/meta") {
      // Through loadRoom, so a room this build cannot read reports as absent
      // rather than sending a player into a room that will never work.
      const state = await this.loadRoom();
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
        const existing = await this.ctx.storage.get<InternalRoom>(STATE_KEY);
        // A room from an older build is not an occupant: it can never be
        // played, so its code is free to be handed out again.
        if (existing !== undefined && existing.schema === ROOM_SCHEMA) return false;
        await this.ctx.storage.put(STATE_KEY, createRoom(code));
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
        await this.ctx.storage.put(DESTROY_AT_KEY, Date.now() + SELF_DESTRUCT_MS);
        await this.rescheduleAlarm(await this.loadRoom());
        return;
      }
      // A locked phone is not a leave — but it can be the last thing the room
      // was waiting for. Everyone else has handed in (or guessed) and the
      // phase would otherwise sit out its whole timer for a hand-in that
      // cannot arrive. No client message follows a disconnect, so the close
      // itself is the only chance to re-run the early-resolve check.
      const room = await this.catchUp();
      if (room === undefined) return;
      const result = resolveIfEveryoneReady(room, eventDeps(), this.connectedPlayerIds(ws));
      if (result.changed) {
        await this.save(result.room);
        this.broadcastState(result.room);
      }
      await this.rescheduleAlarm(result.room);
    });
  }

  /**
   * The players this object holds a live socket for, hibernated ones included.
   *
   * Passed into the engine as an argument for **early-resolve decisions only**
   * — never stored. `InternalRoom` is persisted, so a socket set written into
   * it would survive a restart as a lie, and scoring, staging and the
   * candidate list must keep counting a disconnected player as present.
   *
   * `exclude` is the socket currently being closed: it is still listed by
   * `getWebSockets()` inside the close handler.
   */
  private connectedPlayerIds(exclude?: WebSocket): Set<string> {
    const ids = new Set<string>();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude || socket.readyState !== WS_READY_STATE_OPEN) continue;
      const attachment = socket.deserializeAttachment() as WsAttachment | null;
      if (attachment !== null && attachment.authed) ids.add(attachment.playerId);
    }
    return ids;
  }

  /**
   * One alarm slot, two timers. The alarm is a general wake-up: whichever of
   * the phase deadline and the idle self-destruct is due gets serviced, and
   * the alarm is then re-armed for whichever comes next (or cleared).
   */
  async alarm(): Promise<void> {
    await this.serialized(async () => {
      const now = Date.now();
      const room = await this.catchUp();
      const destroyAt = await this.ctx.storage.get<number>(DESTROY_AT_KEY);
      // Never destroy a room somebody is still attached to, even a hibernated
      // socket: the idle clock is restarted the moment they all drop off.
      if (destroyAt !== undefined && now >= destroyAt && this.ctx.getWebSockets().length === 0) {
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.room = undefined;
        return;
      }
      await this.rescheduleAlarm(room);
    });
  }

  // Serialize socket events through an in-instance promise chain so that
  // concurrent messages cannot interleave the read-modify-write cycles around
  // applyEvent (input gates only cover individual storage calls).
  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => undefined);
    return run;
  }

  /**
   * Runs every phase transition whose deadline has passed, then broadcasts
   * once. `advance` moves at most one phase per call and re-bases the next
   * deadline off the current clock, so a Durable Object that slept through a
   * phase resumes on a fresh timer instead of fast-forwarding to the finale.
   *
   * Called from the alarm *and* before every client message, so a message can
   * never be judged against a phase whose time is already up (an alarm can be
   * delivered late; a socket message wakes the object just the same).
   */
  private async catchUp(): Promise<InternalRoom | undefined> {
    let room = await this.loadRoom();
    if (room === undefined) return undefined;
    let changed = false;
    for (let step = 0; step < MAX_ADVANCE_STEPS; step++) {
      const result = advance(room, eventDeps());
      if (!result.changed) break;
      room = result.room;
      changed = true;
    }
    if (changed) {
      await this.save(room);
      this.broadcastState(room);
    }
    return room;
  }

  /** Arms the single alarm for the earlier of the two deadlines, if any. */
  private async rescheduleAlarm(room: InternalRoom | undefined): Promise<void> {
    const destroyAt = await this.ctx.storage.get<number>(DESTROY_AT_KEY);
    const candidates: number[] = [];
    if (destroyAt !== undefined) candidates.push(destroyAt);
    if (room?.deadline != null) candidates.push(room.deadline);
    if (candidates.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...candidates));
  }

  private async handleSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    // A burst can already have queued more message events when the limiter
    // closes the socket. Those queued callbacks become no-ops rather than
    // attempting a second error frame on a closed connection.
    if (ws.readyState !== WS_READY_STATE_OPEN) return;
    if (!this.consumeSocketBudget(ws)) {
      this.rejectAndClose(ws, "RATE_LIMITED");
      return;
    }
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

  /**
   * A per-connection burst guard keeps one client from monopolizing the
   * Durable Object's serialized message queue. It is intentionally in-memory:
   * this protects CPU/queue health, while the edge binding handles repeated
   * reconnect attempts across object restarts.
   */
  private consumeSocketBudget(ws: WebSocket): boolean {
    const now = Date.now();
    const current = this.socketBudgets.get(ws);
    if (current === undefined || now - current.startedAt >= SOCKET_MESSAGE_WINDOW_MS) {
      this.socketBudgets.set(ws, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= SOCKET_MESSAGE_LIMIT;
  }

  private async authenticate(ws: WebSocket, msg: ClientMessage & ({ t: "join" } | { t: "reconnect" })): Promise<void> {
    let room = await this.catchUp();
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
    // Somebody is here again: cancel the idle countdown, but keep (or arm)
    // the phase alarm for a game already in progress.
    await this.ctx.storage.delete(DESTROY_AT_KEY);
    await this.rescheduleAlarm(result.room);
    if (msg.t === "join") {
      const { playerId, token } = result.welcome!;
      ws.serializeAttachment({ authed: true, playerId });
      ws.send(JSON.stringify({ v: 1, t: "welcome", playerId, token }));
      this.broadcastState(result.room);
    } else {
      ws.serializeAttachment({ authed: true, playerId: msg.playerId });
      ws.send(JSON.stringify({ v: 1, t: "welcome", playerId: msg.playerId, token: msg.token }));
      ws.send(JSON.stringify(snapshotForPlayer(result.room, msg.playerId, Date.now())));
    }
  }

  private async dispatch(ws: WebSocket, playerId: string, msg: ClientMessage): Promise<void> {
    switch (msg.t) {
      case "ping":
        ws.send(JSON.stringify({ v: 1, t: "pong" }));
        return;
      case "leave":
      case "kick":
      case "updateSettings":
      case "startGame":
      case "returnToLobby":
      case "setLang":
      case "submitEntry":
      case "submitGuess":
      case "handIn": {
        // catchUp() first: the phase this message is judged against must be
        // the phase the clock says we are in, not the one we went to sleep in.
        const room = await this.catchUp();
        if (room === undefined) {
          this.rejectAndClose(ws, "INTERNAL");
          return;
        }
        // The connected set is what makes a locked phone not a leave: the
        // engine uses it to decide it has stopped waiting for somebody, and
        // for nothing else.
        const result = await applyEvent(room, playerId, msg, eventDeps(), this.connectedPlayerIds());
        if (!result.ok) {
          ws.send(JSON.stringify({ v: 1, t: "error", code: result.code } satisfies ServerError));
          // catchUp may have moved the phase on even though the message failed.
          await this.rescheduleAlarm(room);
          return;
        }
        await this.save(result.room);
        if (msg.t === "kick") this.disconnectPlayer(msg.targetPlayerId, "KICKED");
        this.broadcastState(result.room);
        // Starting the game, the last guess landing early, a leave that ends
        // the game — any of these moves the phase deadline.
        await this.rescheduleAlarm(result.room);
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
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as WsAttachment | null;
      if (attachment === null || !attachment.authed) continue;
      if (!room.players.some((p) => p.id === attachment.playerId)) continue;
      socket.send(JSON.stringify(snapshotForPlayer(room, attachment.playerId, now)));
    }
  }

  /** Revoke every live socket for a player whose room session was removed. */
  private disconnectPlayer(playerId: string, code: ErrorCode): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as WsAttachment | null;
      if (
        socket.readyState === WS_READY_STATE_OPEN
        && attachment !== null
        && attachment.authed
        && attachment.playerId === playerId
      ) {
        this.rejectAndClose(socket, code);
      }
    }
  }

  private rejectAndClose(ws: WebSocket, code: ErrorCode): void {
    ws.send(JSON.stringify({ v: 1, t: "error", code } satisfies ServerError));
    ws.close(1000, code);
  }

  /**
   * The room as persisted, or `undefined` — which now includes a room this
   * build cannot read.
   *
   * Storage outlives deploys, so a room written by an older build is still
   * sitting there when new code loads it. Half-reading one is not a crash,
   * which would at least be loud; it is a **hot loop**. A pre-`ROOM_SCHEMA`
   * room's phase is not in the current `Phase` union, so `advance` can never
   * move it on, its already-passed deadline is re-armed on every alarm, and
   * the alarm fires again immediately, forever. (Snapshots throw as well: the
   * private store it expects does not exist on an old room.)
   *
   * So a stale room is discarded outright — storage wiped, alarm cleared — and
   * the code behaves as if the room never existed, which is exactly what an
   * unplayable room is. Whoever connects next creates a fresh one.
   */
  private async loadRoom(): Promise<InternalRoom | undefined> {
    if (this.room === undefined) {
      const stored = await this.ctx.storage.get<InternalRoom>(STATE_KEY);
      if (stored !== undefined && stored.schema !== ROOM_SCHEMA) {
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        return undefined;
      }
      this.room = stored;
    }
    return this.room;
  }

  private async save(room: InternalRoom): Promise<void> {
    this.room = room;
    await this.ctx.storage.put(STATE_KEY, room);
  }
}

type ServerError = { v: 1; t: "error"; code: ErrorCode };
