import { describe, expect, it } from "vitest";
import type { PackId } from "../content/prompts";
import { PROMPTS, promptById, promptsForPacks, resolvePrompt } from "../content/prompts";

const PACKS: readonly PackId[] = ["everyday", "opinions", "absurd", "spicy"];

/** A prompt has to fit on a phone card without wrapping into a paragraph. */
const MAX_PROMPT_LENGTH = 90;

function isNonEmpty(s: string): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

describe("PROMPTS", () => {
  it("has exactly 80 entries", () => {
    expect(PROMPTS).toHaveLength(80);
  });

  it("has the expected count in every pack", () => {
    const counts: Record<PackId, number> = {
      everyday: 0,
      opinions: 0,
      absurd: 0,
      spicy: 0,
    };
    for (const prompt of PROMPTS) counts[prompt.pack] += 1;
    expect(counts).toEqual({ everyday: 25, opinions: 20, absurd: 20, spicy: 15 });
  });

  it("has non-empty, unique ids", () => {
    const ids = PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(isNonEmpty(id)).toBe(true);
    }
  });

  it("uses kebab-case ids", () => {
    for (const prompt of PROMPTS) {
      expect(prompt.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("only uses known pack ids", () => {
    for (const prompt of PROMPTS) {
      expect(PACKS).toContain(prompt.pack);
    }
  });

  it("has non-empty text in both languages on every entry", () => {
    for (const prompt of PROMPTS) {
      for (const lang of ["en", "da"] as const) {
        expect(isNonEmpty(prompt[lang])).toBe(true);
      }
    }
  });

  it("keeps every prompt short enough for a phone card", () => {
    for (const prompt of PROMPTS) {
      for (const lang of ["en", "da"] as const) {
        expect(prompt[lang].length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
      }
    }
  });

  it("never repeats the English text as the Danish text", () => {
    for (const prompt of PROMPTS) {
      expect(prompt.da).not.toBe(prompt.en);
    }
  });

  it("has unique text within each language", () => {
    for (const lang of ["en", "da"] as const) {
      const texts = PROMPTS.map((p) => p[lang]);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe("promptById", () => {
  it("returns the matching prompt for a known id", () => {
    const first = PROMPTS[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(promptById(first.id)).toEqual(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(promptById("not-a-real-prompt")).toBeUndefined();
    expect(promptById("")).toBeUndefined();
  });
});

describe("resolvePrompt", () => {
  it("returns the English text for a known id", () => {
    const first = PROMPTS[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(resolvePrompt(first.id, "en")).toBe(first.en);
  });

  it("returns the Danish text for a known id", () => {
    const first = PROMPTS[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(resolvePrompt(first.id, "da")).toBe(first.da);
  });

  it("returns undefined for an unknown id in either language", () => {
    expect(resolvePrompt("not-a-real-prompt", "en")).toBeUndefined();
    expect(resolvePrompt("not-a-real-prompt", "da")).toBeUndefined();
  });
});

describe("promptsForPacks", () => {
  it("returns only the prompts in the requested pack", () => {
    const everyday = promptsForPacks(["everyday"]);
    expect(everyday).toHaveLength(25);
    for (const prompt of everyday) {
      expect(prompt.pack).toBe("everyday");
    }
  });

  it("returns the union of several packs", () => {
    const mixed = promptsForPacks(["opinions", "absurd"]);
    expect(mixed).toHaveLength(40);
    expect(new Set(mixed.map((p) => p.pack))).toEqual(new Set(["opinions", "absurd"]));
  });

  it("returns every prompt when all packs are enabled", () => {
    expect(promptsForPacks(PACKS)).toHaveLength(PROMPTS.length);
  });

  it("returns an empty list for no packs", () => {
    expect(promptsForPacks([])).toEqual([]);
  });

  it("ignores duplicate pack ids", () => {
    expect(promptsForPacks(["spicy", "spicy"])).toHaveLength(15);
  });

  it("keeps the declaration order of PROMPTS", () => {
    const spicy = promptsForPacks(["spicy"]);
    expect(spicy.map((p) => p.id)).toEqual(
      PROMPTS.filter((p) => p.pack === "spicy").map((p) => p.id),
    );
  });
});
