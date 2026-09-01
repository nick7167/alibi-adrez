import { makeRoomCode, isValidRoomCode } from "@aha/shared";
import { RoomDurableObject } from "./do";
import type { Env } from "./env";

export { RoomDurableObject };

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  if (!origin) return headers;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

function withCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  corsHeaders(origin).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

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

    const origin = allowedOrigin(request, env);
    if (origin === "") return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders(origin ?? "") });
    }

    const wsMatch = /^\/api\/room\/([A-HJ-KMNP-Z2-9]{4})\/ws$/.exec(url.pathname);
    if (wsMatch) {
      const stub = env.ROOMS_DO.get(env.ROOMS_DO.idFromName(wsMatch[1]!));
      return stub.fetch(new Request("https://do/ws", request));
    }
    return withCors(await handleApi(request, env, url), origin ?? "");
  }
} satisfies ExportedHandler<Env>;
