import { describe, expect, it } from "vitest";
import { AVATARS, MAX_PLAYERS, MAX_TEXT_LENGTH, parseClientMessage } from "../src/protocol";

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
  it("MAX_TEXT_LENGTH is 240", () => {
    expect(MAX_TEXT_LENGTH).toBe(240);
  });
});

describe.each([
  ["submitQuestion", "submitQuestion"],
  ["suspectChat", "suspectChat"],
  ["submitAnswer", "submitAnswer"],
] as const)("parseClientMessage %s", (_label, t) => {
  it("parses a valid message and trims the text", () => {
    expect(parseClientMessage(`{"v":1,"t":"${t}","text":"  Where were you?  "}`))
      .toEqual({ v: 1, t, text: "Where were you?" });
  });
  it("rejects empty text", () => {
    expect(parseClientMessage(`{"v":1,"t":"${t}","text":""}`)).toBeNull();
  });
  it("rejects whitespace-only text", () => {
    expect(parseClientMessage(`{"v":1,"t":"${t}","text":"   "}`)).toBeNull();
  });
  it("rejects text over 240 characters", () => {
    const text = "a".repeat(241);
    expect(parseClientMessage(`{"v":1,"t":"${t}","text":${JSON.stringify(text)}}`)).toBeNull();
  });
  it("accepts text at exactly 240 characters", () => {
    const text = "a".repeat(240);
    expect(parseClientMessage(`{"v":1,"t":"${t}","text":${JSON.stringify(text)}}`))
      .toEqual({ v: 1, t, text });
  });
  it("rejects non-string text", () => {
    expect(parseClientMessage(`{"v":1,"t":"${t}","text":42}`)).toBeNull();
    expect(parseClientMessage(`{"v":1,"t":"${t}"}`)).toBeNull();
  });
});

describe("parseClientMessage castVote", () => {
  it("parses a valid consistent vote", () => {
    expect(parseClientMessage('{"v":1,"t":"castVote","verdict":"consistent"}'))
      .toEqual({ v: 1, t: "castVote", verdict: "consistent" });
  });
  it("parses a valid busted vote", () => {
    expect(parseClientMessage('{"v":1,"t":"castVote","verdict":"busted"}'))
      .toEqual({ v: 1, t: "castVote", verdict: "busted" });
  });
  it("rejects any other verdict string", () => {
    expect(parseClientMessage('{"v":1,"t":"castVote","verdict":"guilty"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"castVote","verdict":""}')).toBeNull();
  });
  it("rejects non-string verdict", () => {
    expect(parseClientMessage('{"v":1,"t":"castVote","verdict":1}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"castVote"}')).toBeNull();
  });
});
