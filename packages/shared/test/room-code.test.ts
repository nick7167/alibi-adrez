import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  isValidRoomCode,
  makeRoomCode,
} from "../src/room-code";

describe("makeRoomCode", () => {
  it("returns 4 chars from the unambiguous alphabet", () => {
    const code = makeRoomCode();
    expect(code).toHaveLength(4);
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
  });

  it("never contains ambiguous characters", () => {
    for (let i = 0; i < 1000; i++) {
      expect(makeRoomCode()).not.toMatch(/[01OIL]/);
    }
  });

  it("is deterministic given an injected RNG", () => {
    const makeRng = () => {
      let n = 0;
      return () => (n++ % 26) / 26;
    };
    expect(makeRoomCode(makeRng())).toBe(makeRoomCode(makeRng()));
  });
});

describe("isValidRoomCode", () => {
  it("accepts codes drawn from the unambiguous alphabet", () => {
    expect(isValidRoomCode("AB2D")).toBe(true);
    expect(isValidRoomCode(makeRoomCode())).toBe(true);
    for (const ch of ROOM_CODE_ALPHABET) {
      expect(isValidRoomCode(`X${ch}Y9`)).toBe(true);
    }
  });

  it("rejects ambiguous characters, wrong length, and non-strings", () => {
    for (const ch of ["0", "1", "O", "I", "L"]) {
      expect(isValidRoomCode(`AB${ch}D`)).toBe(false);
    }
    expect(isValidRoomCode("ABCD2")).toBe(false);
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode("ab2d")).toBe(false);
    expect(isValidRoomCode(1234)).toBe(false);
    expect(isValidRoomCode(null)).toBe(false);
  });
});
