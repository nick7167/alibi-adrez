import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { isValidRoomCode } from "@alibi/shared";

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
