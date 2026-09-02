import { describe, expect, it } from "vitest";
import type { GuessingView, RevealView } from "@aha/shared";
import { redactRoom, reportAnswerUrl, SUPPORT_EMAIL } from "../src/lib/safety";

const common = {
	code: "SAFE",
	round: 1,
	roundCount: 1,
	deadline: null,
	players: [
		{ id: "p1", name: "One", emoji: "🦊", lang: "en" as const },
		{ id: "p2", name: "Two", emoji: "🐸", lang: "en" as const },
	],
	scoreboard: [],
};

describe("local safety redaction", () => {
	it("masks a blocked player without changing protocol identifiers", () => {
		const room: GuessingView = {
			...common,
			phase: "GUESSING",
			prompt: "Prompt",
			answer: { id: "a1", text: "Answer" },
			candidates: ["p2"],
			guessedCount: 0,
		};
		const safe = redactRoom(room, new Set(["p2"]), new Set(), {
			player: "Hidden player",
			answer: "Hidden answer",
		});
		expect(safe.players[1]).toMatchObject({ id: "p2", name: "Hidden player", emoji: "👤" });
		expect(safe.candidates).toEqual(["p2"]);
		expect(room.players[1]?.name).toBe("Two");
	});

	it("hides a blocked author's answer only once authorship is public", () => {
		const room: RevealView = {
			...common,
			phase: "REVEAL",
			prompt: "Prompt",
			answer: { id: "a1", text: "Answer" },
			authorId: "p2",
			guesses: [],
			awarded: [],
		};
		const safe = redactRoom(room, new Set(["p2"]), new Set(), {
			player: "Hidden player",
			answer: "Hidden answer",
		});
		expect(safe.answer.text).toBe("Hidden answer");
	});

	it("builds an explicit user-initiated support report", () => {
		const url = reportAnswerUrl({
			lang: "en",
			roomCode: "SAFE",
			answerId: "a1",
			answerText: "Example",
		});
		expect(url).toContain(`mailto:${SUPPORT_EMAIL}`);
		expect(decodeURIComponent(url)).toContain("Author unknown during guessing");
	});
});
