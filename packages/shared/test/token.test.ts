import { expect, it } from "vitest";
import { hashToken } from "../src/token";

it("hashes deterministically and differs per input", async () => {
  expect(await hashToken("a")).toBe(await hashToken("a"));
  expect(await hashToken("a")).not.toBe(await hashToken("b"));
});
