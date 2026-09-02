import type { Lang, Player, RoomView } from "@aha/shared";

export const SUPPORT_EMAIL = "support@adrez.dev";

const BLOCKED_KEY_PREFIX = "aha:safety:blocked:";
const HIDDEN_ANSWER_KEY_PREFIX = "aha:safety:hidden-answers:";

function loadIds(key: string): string[] {
	if (typeof localStorage === "undefined") return [];
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
		return Array.isArray(parsed)
			? [...new Set(parsed.filter((id): id is string => typeof id === "string"))]
			: [];
	} catch {
		return [];
	}
}

function saveIds(key: string, ids: string[]): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
	} catch {
		// Safety controls still work for the current render if storage is full.
	}
}

const normalizedCode = (code: string) => code.trim().toUpperCase();

export function loadBlockedPlayers(code: string): string[] {
	return loadIds(BLOCKED_KEY_PREFIX + normalizedCode(code));
}

export function saveBlockedPlayers(code: string, ids: string[]): void {
	saveIds(BLOCKED_KEY_PREFIX + normalizedCode(code), ids);
}

export function loadHiddenAnswers(code: string): string[] {
	return loadIds(HIDDEN_ANSWER_KEY_PREFIX + normalizedCode(code));
}

export function saveHiddenAnswers(code: string, ids: string[]): void {
	saveIds(HIDDEN_ANSWER_KEY_PREFIX + normalizedCode(code), ids);
}

export function redactRoom<T extends RoomView>(
	room: T,
	blockedPlayerIds: ReadonlySet<string>,
	hiddenAnswerIds: ReadonlySet<string>,
	labels: { player: string; answer: string }
): T {
	const players = room.players.map((player): Player =>
		blockedPlayerIds.has(player.id)
			? { ...player, name: labels.player, emoji: "👤" }
			: player
	);
	const redacted = { ...room, players } as T;
	if (redacted.phase === "GUESSING" || redacted.phase === "REVEAL") {
		const hidden = hiddenAnswerIds.has(redacted.answer.id)
			|| (redacted.phase === "REVEAL" && blockedPlayerIds.has(redacted.authorId));
		if (hidden) redacted.answer = { ...redacted.answer, text: labels.answer };
	}
	return redacted;
}

function localizedReport(lang: Lang, kind: "player" | "answer"): { subject: string; intro: string } {
	if (lang === "da") {
		return {
			subject: `Rapport om ${kind === "player" ? "spiller" : "svar"} i AHA`,
			intro: "Jeg vil rapportere skadeligt eller stødende indhold i AHA.",
		};
	}
	return {
		subject: `AHA ${kind} report`,
		intro: "I want to report harmful or offensive content in AHA.",
	};
}

export function reportPlayerUrl(args: {
	lang: Lang;
	roomCode: string;
	playerId: string;
	playerName: string;
}): string {
	const copy = localizedReport(args.lang, "player");
	const body = [
		copy.intro,
		"",
		`Room / rum: ${args.roomCode}`,
		`Player / spiller: ${args.playerName}`,
		`Player ID / spiller-id: ${args.playerId}`,
		"",
		"Describe what happened / Beskriv hvad der skete:",
		"",
	].join("\n");
	return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(body)}`;
}

export function reportAnswerUrl(args: {
	lang: Lang;
	roomCode: string;
	answerId: string;
	answerText: string;
	author?: { id: string; name: string };
}): string {
	const copy = localizedReport(args.lang, "answer");
	const body = [
		copy.intro,
		"",
		`Room / rum: ${args.roomCode}`,
		`Answer ID / svar-id: ${args.answerId}`,
		`Answer / svar: ${args.answerText}`,
		...(args.author
			? [`Author / forfatter: ${args.author.name}`, `Author ID / forfatter-id: ${args.author.id}`]
			: ["Author unknown during guessing / Forfatteren er ukendt under gætterunden"]),
		"",
		"Add context / Tilføj sammenhæng:",
		"",
	].join("\n");
	return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(copy.subject)}&body=${encodeURIComponent(body)}`;
}
