import { createRoom, type InternalRoom } from "@alibi/shared";
import type { Env } from "./env";

export class RoomDurableObject implements DurableObject {
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
      const existing = await this.ctx.storage.get<InternalRoom>("state");
      if (existing) return Response.json({ error: "EXISTS" }, { status: 409 });
      const { code } = (await request.json()) as { code: string };
      await this.ctx.storage.put("state", createRoom(code));
      return Response.json({ ok: true });
    }
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
