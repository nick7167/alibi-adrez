import { describe, expect, it } from "vitest";
import { containsObjectionableContent } from "../src/moderation";

describe("player-authored content filter", () => {
  it("catches direct and commonly obfuscated abuse", () => {
    expect(containsObjectionableContent("heil hitler")).toBe(true);
    expect(containsObjectionableContent("k1ll y0urself")).toBe(true);
    expect(containsObjectionableContent("dræb dig selv")).toBe(true);
    expect(containsObjectionableContent("N1GG3R")).toBe(true);
  });

  it("does not block ordinary Danish or English game answers", () => {
    expect(containsObjectionableContent("Det er slut på fredag")).toBe(false);
    expect(containsObjectionableContent("I forgot my keys again")).toBe(false);
  });
});
