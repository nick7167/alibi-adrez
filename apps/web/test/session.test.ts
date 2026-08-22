import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearIdentity, loadIdentity, saveIdentity } from "../src/lib/stores/session.svelte";

const backing = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (k: string) => backing.get(k) ?? null,
	setItem: (k: string, v: string) => void backing.set(k, v),
	removeItem: (k: string) => void backing.delete(k),
});
beforeEach(() => backing.clear());

describe("identity store", () => {
	it("roundtrips an identity per room code", () => {
		expect(loadIdentity("AB23")).toBeNull();
		const id = { playerId: "p1", token: "t", name: "Nick", emoji: "🦊" };
		saveIdentity("AB23", id);
		expect(loadIdentity("AB23")).toEqual(id);
		expect(loadIdentity("ab23")).toEqual(id); // codes normalized uppercase
		clearIdentity("AB23");
		expect(loadIdentity("AB23")).toBeNull();
	});
});
