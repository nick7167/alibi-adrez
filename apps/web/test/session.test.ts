import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearIdentity, clearSavedIdentities, loadIdentity, saveIdentity } from "../src/lib/stores/session.svelte";

const backing = new Map<string, string>();
vi.stubGlobal("localStorage", {
	get length() { return backing.size; },
	key: (i: number) => [...backing.keys()][i] ?? null,
	getItem: (k: string) => backing.get(k) ?? null,
	setItem: (k: string, v: string) => void backing.set(k, v),
	removeItem: (k: string) => void backing.delete(k),
});
beforeEach(() => backing.clear());
afterEach(() => vi.restoreAllMocks());

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

	it('deletes every room login without deleting safety, locale, or other data', () => {
		backing.set('aha:identity:AB23', 'old login');
		backing.set('aha:identity:CD45', 'malformed login');
		backing.set('aha:safety:blocked:AB23', '["p1"]');
		backing.set('aha:safety:hidden-answers:AB23', '["a1"]');
		backing.set('PARAGLIDE_LOCALE', 'da');
		backing.set('other-app', 'untouched');
		expect(clearSavedIdentities()).toBe(true);
		expect([...backing.keys()]).toEqual([
			'aha:safety:blocked:AB23', 'aha:safety:hidden-answers:AB23',
			'PARAGLIDE_LOCALE', 'other-app'
		]);
		expect(clearSavedIdentities()).toBe(true);
	});

	it('reports storage access failure without throwing', () => {
		vi.spyOn(localStorage, 'key').mockImplementation(() => { throw new Error('denied'); });
		backing.set('aha:identity:AB23', 'login');
		expect(clearSavedIdentities()).toBe(false);
		expect(backing.size).toBe(1);
	});

	it('reports partial deletion as failure and allows retry', () => {
		backing.set('aha:identity:AB23', 'login');
		backing.set('aha:identity:CD45', 'login');
		const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
			if (key.endsWith('CD45')) throw new Error('denied');
			backing.delete(key);
		});
		expect(clearSavedIdentities()).toBe(false);
		expect(backing.has('aha:identity:CD45')).toBe(true);
		remove.mockRestore();
		expect(clearSavedIdentities()).toBe(true);
		expect(backing.size).toBe(0);
	});
});
