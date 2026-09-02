import { describe, expect, it } from "vitest";
import {
  AVATARS,
  DEFAULT_SETTINGS,
  MAX_ENTRY_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  parseClientMessage,
} from "../src/protocol";

describe("parseClientMessage", () => {
  it("parses a valid join", () => {
    expect(parseClientMessage('{"v":1,"t":"join","name":"Nick","emoji":"🦊"}'))
      .toEqual({ v: 1, t: "join", name: "Nick", emoji: "🦊" });
  });
  it("rejects wrong version", () =>
    expect(parseClientMessage('{"v":2,"t":"ping"}')).toBeNull());
  it("rejects unknown type", () =>
    expect(parseClientMessage('{"v":1,"t":"hack"}')).toBeNull());
  it("rejects the messages the old game used", () => {
    expect(parseClientMessage('{"v":1,"t":"submitQuestion","text":"hi"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"suspectChat","text":"hi"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitAnswer","text":"hi"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"castVote","verdict":"busted"}')).toBeNull();
  });
  it("rejects oversized or malformed JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("x".repeat(2049))).toBeNull();
  });
  it("parses host removal only with a bounded target id", () => {
    expect(parseClientMessage('{"v":1,"t":"kick","targetPlayerId":"p2"}'))
      .toEqual({ v: 1, t: "kick", targetPlayerId: "p2" });
    expect(parseClientMessage('{"v":1,"t":"kick","targetPlayerId":""}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"kick"}')).toBeNull();
  });
});

describe("constants", () => {
  it("has 16 avatars and MAX_PLAYERS 16", () => {
    expect(AVATARS).toHaveLength(16);
    expect(MAX_PLAYERS).toBe(16);
  });
  it("MIN_PLAYERS is 3", () => {
    expect(MIN_PLAYERS).toBe(3);
  });
  it("MAX_ENTRY_LENGTH is 140", () => {
    expect(MAX_ENTRY_LENGTH).toBe(140);
  });
  it("defaults to 5 questions, 10 rounds, 180s answering, 25s guessing, spicy off", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      questions: 5,
      rounds: 10,
      answerSec: 180,
      guessSec: 25,
      revealSec: 7,
      standingsEvery: 3,
      packs: ["everyday", "opinions", "absurd"],
    });
  });
});

describe("parseClientMessage submitEntry", () => {
  it("parses a valid entry and trims the text", () => {
    expect(parseClientMessage('{"v":1,"t":"submitEntry","questionIndex":0,"text":"  a cold pizza  "}'))
      .toEqual({ v: 1, t: "submitEntry", questionIndex: 0, text: "a cold pizza" });
  });
  it("rejects empty and whitespace-only text", () => {
    expect(parseClientMessage('{"v":1,"t":"submitEntry","questionIndex":0,"text":""}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitEntry","questionIndex":0,"text":"   "}')).toBeNull();
  });
  it("rejects text over 140 characters", () => {
    const text = "a".repeat(MAX_ENTRY_LENGTH + 1);
    expect(parseClientMessage(`{"v":1,"t":"submitEntry","questionIndex":0,"text":${JSON.stringify(text)}}`)).toBeNull();
  });
  it("accepts text at exactly 140 characters", () => {
    const text = "a".repeat(MAX_ENTRY_LENGTH);
    expect(parseClientMessage(`{"v":1,"t":"submitEntry","questionIndex":0,"text":${JSON.stringify(text)}}`))
      .toEqual({ v: 1, t: "submitEntry", questionIndex: 0, text });
  });
  it("rejects non-string or missing text", () => {
    expect(parseClientMessage('{"v":1,"t":"submitEntry","questionIndex":0,"text":42}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitEntry"}')).toBeNull();
  });
});

describe("parseClientMessage submitGuess", () => {
  it("parses a valid guess, carrying the answerId explicitly", () => {
    expect(parseClientMessage('{"v":1,"t":"submitGuess","answerId":"a7","playerId":"p3"}'))
      .toEqual({ v: 1, t: "submitGuess", answerId: "a7", playerId: "p3" });
  });
  it("rejects a guess missing either id", () => {
    expect(parseClientMessage('{"v":1,"t":"submitGuess","answerId":"a7"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitGuess","playerId":"p3"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitGuess"}')).toBeNull();
  });
  it("rejects empty, oversized or non-string ids", () => {
    expect(parseClientMessage('{"v":1,"t":"submitGuess","answerId":"","playerId":"p3"}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitGuess","answerId":"a7","playerId":""}')).toBeNull();
    expect(parseClientMessage('{"v":1,"t":"submitGuess","answerId":"a7","playerId":3}')).toBeNull();
    const long = "x".repeat(65);
    expect(parseClientMessage(`{"v":1,"t":"submitGuess","answerId":${JSON.stringify(long)},"playerId":"p3"}`))
      .toBeNull();
  });
});
