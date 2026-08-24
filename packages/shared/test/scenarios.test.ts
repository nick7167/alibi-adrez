import { describe, expect, it } from "vitest";
import { resolveScenario, scenarioById, SCENARIOS } from "../content/scenarios";

function isNonEmpty(s: string): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

describe("SCENARIOS", () => {
  it("has exactly 20 entries", () => {
    expect(SCENARIOS).toHaveLength(20);
  });

  it("has unique ids", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has both languages, a non-empty story, and exactly 4 non-empty details on every entry", () => {
    for (const scenario of SCENARIOS) {
      for (const lang of ["en", "da"] as const) {
        const text = scenario[lang];
        expect(text).toBeDefined();
        expect(isNonEmpty(text.story)).toBe(true);
        expect(text.details).toHaveLength(4);
        for (const detail of text.details) {
          expect(isNonEmpty(detail)).toBe(true);
        }
      }
    }
  });

  it("has non-empty, unique ids", () => {
    for (const scenario of SCENARIOS) {
      expect(isNonEmpty(scenario.id)).toBe(true);
    }
  });
});

describe("scenarioById", () => {
  it("returns the matching scenario for a known id", () => {
    const first = SCENARIOS[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(scenarioById(first.id)).toEqual(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(scenarioById("not-a-real-scenario")).toBeUndefined();
    expect(scenarioById("")).toBeUndefined();
  });
});

describe("resolveScenario", () => {
  it("returns the English text for a known id", () => {
    const first = SCENARIOS[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(resolveScenario(first.id, "en")).toEqual(first.en);
  });

  it("returns the Danish text for a known id", () => {
    const first = SCENARIOS[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(resolveScenario(first.id, "da")).toEqual(first.da);
  });

  it("returns undefined for an unknown id in either language", () => {
    expect(resolveScenario("not-a-real-scenario", "en")).toBeUndefined();
    expect(resolveScenario("not-a-real-scenario", "da")).toBeUndefined();
  });
});
