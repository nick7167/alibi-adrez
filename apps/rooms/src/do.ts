import type { Env } from "./env";

export class RoomDurableObject implements DurableObject {
  constructor(private ctx: DurableObjectState, private env: Env) {}
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ping") return Response.json({ pong: this.ctx.id.name ?? "unknown" });
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
