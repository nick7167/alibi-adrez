import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { isValidRoomCode } from "@aha/shared";
import { isRateLimited } from "../src/index";

class FakeRateLimit implements RateLimit {
  readonly keys: string[] = [];

  constructor(private success: boolean) {}

  async limit(options: RateLimitOptions): Promise<RateLimitOutcome> {
    this.keys.push(options.key);
    return { success: this.success };
  }
}

describe("rate-limit actor keys", () => {
  it("bypasses local requests without Cloudflare's client header", async () => {
    const limiter = new FakeRateLimit(false);
    expect(await isRateLimited(new Request("https://example.com/api/rooms"), limiter)).toBe(false);
    expect(limiter.keys).toEqual([]);
  });

  it("uses a stable hash instead of passing the raw IP to the counter", async () => {
    const limiter = new FakeRateLimit(false);
    const request = new Request("https://example.com/api/rooms", {
      headers: { "CF-Connecting-IP": "203.0.113.7" },
    });
    expect(await isRateLimited(request, limiter)).toBe(true);
    expect(await isRateLimited(request, limiter)).toBe(true);
    expect(limiter.keys).toHaveLength(2);
    expect(limiter.keys[0]).toBe(limiter.keys[1]);
    expect(limiter.keys[0]).not.toContain("203.0.113.7");
    expect(limiter.keys[0]).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("POST /api/rooms", () => {
  it("returns a valid fresh code", async () => {
    const res = await SELF.fetch("https://example.com/api/rooms", { method: "POST" });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect(isValidRoomCode(code)).toBe(true);
  });
  it("does not reuse an existing open code", async () => {
    const first = ((await (await SELF.fetch("https://example.com/api/rooms", { method: "POST" })).json()) as { code: string }).code;
    const second = ((await (await SELF.fetch("https://example.com/api/rooms", { method: "POST" })).json()) as { code: string }).code;
    expect(second).not.toBe(first);
  });
});
describe("GET /api/rooms/:code", () => {
  it("404s unknown codes", async () => {
    const res = await SELF.fetch("https://example.com/api/rooms/ZZZZ");
    expect(res.status).toBe(404);
  });
  it("reports existing open rooms", async () => {
    const { code } = (await (await SELF.fetch("https://example.com/api/rooms", { method: "POST" })).json()) as { code: string };
    const res = await SELF.fetch(`https://example.com/api/rooms/${code}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: true, open: true });
  });
});

describe("native and web origin policy", () => {
  it("answers native preflight only for the configured Capacitor origin", async () => {
    const res = await SELF.fetch("https://example.com/api/rooms", {
      method: "OPTIONS",
      headers: {
        Origin: "capacitor://localhost",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("adds CORS to native REST responses", async () => {
    const res = await SELF.fetch("https://example.com/api/rooms", {
      method: "POST",
      headers: { Origin: "capacitor://localhost" },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
  });

  it("rejects an untrusted browser origin", async () => {
    const res = await SELF.fetch("https://example.com/api/rooms", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ORIGIN_NOT_ALLOWED" });
  });
});
