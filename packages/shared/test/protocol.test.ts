import { describe, expect, it } from "vitest";
import { AVATARS, MAX_PLAYERS, parseClientMessage } from "../src/protocol";

describe("parseClientMessage", () => {
  it("parses a valid join", () => {
    expect(parseClientMessage('{"v":1,"t":"join","name":"Nick","emoji":"🦊"}'))
      .toEqual({ v: 1, t: "join", name: "Nick", emoji: "🦊" });
  });
  it("rejects wrong version", () =>
    expect(parseClientMessage('{"v":2,"t":"ping"}')).toBeNull());
  it("rejects unknown type", () =>
    expect(parseClientMessage('{"v":1,"t":"hack"}')).toBeNull());
  it("rejects oversized or malformed JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("x".repeat(2049))).toBeNull();
  });
});

describe("constants", () => {
  it("has 16 avatars and MAX_PLAYERS 16", () => {
    expect(AVATARS).toHaveLength(16);
    expect(MAX_PLAYERS).toBe(16);
  });
});
