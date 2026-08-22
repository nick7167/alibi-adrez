import { makeRoomCode, isValidRoomCode } from "@alibi/shared";
import { RoomDurableObject } from "./do";
import type { Env } from "./env";

export { RoomDurableObject };

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

async function roomMeta(env: Env, code: string): Promise<{ exists: boolean; open: boolean }> {
  const stub = env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code));
  const res = await stub.fetch("https://do/meta");
  return (await res.json()) as { exists: boolean; open: boolean };
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/rooms" && request.method === "POST") {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode(cryptoRandom);
      const stub = env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code));
      const init = await stub.fetch("https://do/init", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      if (init.status === 409) continue;
      if (!init.ok) return Response.json({ error: "INTERNAL" }, { status: 500 });
      return Response.json({ code }, { status: 201 });
    }
    return Response.json({ error: "INTERNAL" }, { status: 500 });
  }
  const match = /^\/api\/rooms\/([A-Za-z0-9]{4})$/.exec(url.pathname);
  if (match && request.method === "GET") {
    const code = match[1]!;
    if (isValidRoomCode(code)) {
      const meta = await roomMeta(env, code);
      if (!meta.exists) return Response.json({ exists: false }, { status: 404 });
      return Response.json({ exists: true, open: meta.open });
    }
  }
  return Response.json({ error: "NOT_FOUND" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    return handleApi(request, env, url);
  }
} satisfies ExportedHandler<Env>;
