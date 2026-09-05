/**
 * Per-room player identity persisted in localStorage so a player keeps
 * their identity across refreshes and sleep/wake. Keyed by normalized
 * (uppercase) room code. Plain functions only — no runes — so the module
 * stays unit-testable in a node environment.
 */

export type Identity = { playerId: string; token: string; name: string; emoji: string };

const IDENTITY_KEY_PREFIX = 'aha:identity:';
const storageKey = (code: string) => `${IDENTITY_KEY_PREFIX}${code.trim().toUpperCase()}`;

function isIdentity(v: unknown): v is Identity {
	if (typeof v !== "object" || v === null) return false;
	const r = v as Record<string, unknown>;
	return (
		typeof r.playerId === "string" &&
		typeof r.token === "string" &&
		typeof r.name === "string" &&
		typeof r.emoji === "string"
	);
}

export function loadIdentity(code: string): Identity | null {
	try {
		const raw = localStorage.getItem(storageKey(code));
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isIdentity(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function saveIdentity(code: string, id: Identity): void {
	try {
		localStorage.setItem(storageKey(code), JSON.stringify(id));
	} catch {
		// Storage unavailable/full: identity simply won't survive reload.
	}
}

export function clearIdentity(code: string): void {
	try {
		localStorage.removeItem(storageKey(code));
	} catch {
		// Ignore — nothing to clean up if storage is unavailable.
	}
}

/** Explicit device cleanup. Keep safety preferences and unrelated storage intact.
 * Return failure if storage access/removal fails, including a partial deletion. */
export function clearSavedIdentities(): boolean {
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(IDENTITY_KEY_PREFIX)) keys.push(key);
		}
		for (const key of keys) localStorage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}
