import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { RoomDurableObject } from "../src/do";

describe("worker", () => {
  it("answers /health", async () => {
    const res = await SELF.fetch("https://example.com/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("creates a DO per room code", async () => {
    const id = env.ROOMS_DO.idFromName("TEST");
    const stub = env.ROOMS_DO.get(id);
    const res = await stub.fetch("https://do/ping");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: "TEST" });
  });
});
