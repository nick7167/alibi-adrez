import { expect } from "vitest";

/**
 * Shared test helpers for the anonymity proofs.
 *
 * `deepKeys` and the raw-JSON absence harness below were written for Alibi's
 * `test/snapshot.test.ts` (deleted in T2) and are ported here VERBATIM because
 * they are how secrecy is proven, and the new game needs the same proof for a
 * different secret: T4's anonymity matrix asserts that no other player's entry
 * text and no `authorId` for an unrevealed answer ever reaches a reader.
 *
 * Why two checks and not one:
 *
 *  - `deepKeys` walks *every* key at *every* depth of the serialized snapshot,
 *    so a secret smuggled inside a nested array of objects is still caught. A
 *    shallow `expect(view).not.toHaveProperty("authorId")` is not enough.
 *  - the raw-JSON scan catches the other half — a secret that leaks as a
 *    *value* under an innocent key (the author's id copied into `candidates`,
 *    an entry's text echoed into a label). Keys alone would miss it.
 *
 * Both run against `JSON.parse(JSON.stringify(snapshot))`, i.e. exactly the
 * bytes that go over the wire, not the in-memory object — a getter or a
 * non-enumerable field that never serializes is not a leak, and one that does
 * serialize cannot hide from this.
 */

/** Every key at every depth of the serialized snapshot. */
export function deepKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) deepKeys(item, into);
    return into;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      deepKeys(child, into);
    }
  }
  return into;
}

/** A snapshot as it actually goes over the wire: its JSON and every key in it. */
export function overTheWire(snapshot: unknown): { json: string; keys: Set<string> } {
  const json = JSON.stringify(snapshot);
  return { json, keys: deepKeys(JSON.parse(json)) };
}

/**
 * The absence harness: assert that a snapshot carries none of `keys` and that
 * none of `strings` appears anywhere in its serialized form. Absent, never
 * blanked — a hidden field is missing from the object, not present-and-empty
 * (Alibi ledger, T4 ruling 18), so a key check is a real assertion.
 */
export function expectAbsent(
  snapshot: unknown,
  absent: { keys?: readonly string[]; strings?: readonly string[] },
): void {
  const { json, keys } = overTheWire(snapshot);
  for (const key of absent.keys ?? []) {
    expect(keys.has(key), `key "${key}" must be absent from the snapshot`).toBe(false);
  }
  for (const secret of absent.strings ?? []) {
    expect(json, `"${secret}" must not appear anywhere in the snapshot`).not.toContain(secret);
  }
}
