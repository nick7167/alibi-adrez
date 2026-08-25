/**
 * Per-room player identity persisted in localStorage so a player keeps
 * their identity across refreshes and sleep/wake. Keyed by normalized
 * (uppercase) room code. Plain functions only — no runes — so the module
 * stays unit-testable in a node environment.
 */

export type Identity = { playerId: string; token: string; name: string; emoji: string };

const storageKey = (code: string) => `aha:identity:${code.trim().toUpperCase()}`;

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
