import { RoomDurableObject } from "./do";
import type { Env } from "./env";

export { RoomDurableObject };
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
} satisfies ExportedHandler<Env>;
