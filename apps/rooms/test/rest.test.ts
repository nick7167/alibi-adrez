import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { isValidRoomCode } from "@aha/shared";

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
