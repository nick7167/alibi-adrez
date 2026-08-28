import { expect, test, type Browser, type Page } from '@playwright/test';
import { CODE_RE, clickUntil, joinRoom, open, watch } from './helpers';

/**
 * A complete game, played in real browsers, end to end.
 *
 * What this asserts beyond "the phases advance":
 *
 *  - **The anonymity property, over the wire.** Every page records the frames
 *    its own socket receives. During ANSWERING no page may be sent another
 *    player's answer text; during GUESSING no page may be sent an `authorId`
 *    at any depth. Checking the DOM alone would prove only that the screen
 *    didn't render the secret — this proves the server never told the browser
 *    in the first place, which is where the guarantee actually lives.
 *  - **Everyone answers everything up front.** All the questions are on one
 *    clock, reachable with Back/Next, and a player hands in when they choose.
 *  - **The same question never runs twice in a row** — the rule the whole
 *    mixed pool exists for, checked across every round of a real game.
 *  - **The author's screen is a different screen, not a disabled grid**: zero
 *    candidate chips for the author while every guesser has a full grid.
 *  - **Scoring, arithmetically.** Every round is guessed correctly by exactly
 *    one player (+2) and wrongly by the rest (+1 to the author each), so each
 *    round moves exactly 5 points in a 5-player room and the finale total is
 *    exactly 5 x rounds. A game that awarded the right number to the wrong
 *    player would still fail the per-reveal author assertion.
 *
 * **Nothing here sleeps.** Every wait is a poll on UI state (`toPass`, or a
 * locator expectation) — a fixed sleep flakes under load and hides the real
 * timing.
 *
 * Run it (not in CI, deliberately):
 *   pnpm --filter web exec playwright test e2e/round.spec.ts
 * The Playwright config starts both dev servers itself.
 */

test.describe.configure({ mode: 'serial' });

const NAMES = ['Ana', 'Bo', 'Cyd', 'Dov', 'Eli'];

/** How many questions and rounds the tests configure. Small on purpose: every
    round costs a real guess clock plus a real reveal clock. */
const QUESTIONS = 2;
const ROUNDS = 3;

interface Client {
	page: Page;
	name: string;
	/** Raw text payloads this page's socket has received. */
	frames: string[];
	close: () => Promise<void>;
}

/** A player's answer to one question: unique, greppable, and containing
    nothing that could be confused with a player's name. */
function answerOf(name: string, q: number): string {
	return `${name.toLowerCase()}-zulu-quartz-q${q}`;
}

/** Record every WebSocket frame the page receives, before it navigates. */
function recordFrames(page: Page): string[] {
	const frames: string[] = [];
	page.on('websocket', (ws) => {
		ws.on('framereceived', (frame) => {
			if (typeof frame.payload === 'string') frames.push(frame.payload);
		});
	});
	return frames;
}

interface StateFrame {
	t?: string;
	room?: { phase?: string; settings?: Record<string, unknown> };
}

/** Frames that carried a room snapshot in the given phase. */
function statesIn(frames: string[], phase: string): StateFrame[] {
	return frames.flatMap((raw) => {
		let msg: StateFrame;
		try {
			msg = JSON.parse(raw) as StateFrame;
		} catch {
			return [];
		}
		return msg.t === 'state' && msg.room?.phase === phase ? [msg] : [];
	});
}

/** Every key appearing anywhere in a parsed payload. A leak hidden one level
    down is still a leak, so this walks rather than inspecting the top level. */
function deepKeys(value: unknown, out = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const v of value) deepKeys(v, out);
	} else if (value !== null && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) {
			out.add(k);
			deepKeys(v, out);
		}
	}
	return out;
}

async function newClient(browser: Browser, i: number): Promise<Client> {
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await ctx.newPage();
	watch(page, NAMES[i]!.toUpperCase());
	return { page, name: NAMES[i]!, frames: recordFrames(page), close: () => ctx.close() };
}

/** Seat a host plus `count - 1` guests in a fresh room. */
async function seatRoom(browser: Browser, count: number) {
	const clients: Client[] = [];
	for (let i = 0; i < count; i++) clients.push(await newClient(browser, i));
	const host = clients[0]!;

	await open(host.page, '/');
	await clickUntil('create-room', host.page, () => host.page.waitForURL(CODE_RE));
	const code = new URL(host.page.url()).pathname.split('/').at(-1)!;

	await open(host.page, `/room/${code}`);
	await host.page.getByTestId('nickname').fill(host.name);
	await clickUntil('join-submit', host.page, () =>
		expect(host.page.getByTestId('players-heading')).toBeVisible()
	);
	for (const guest of clients.slice(1)) await joinRoom(guest.page, code, guest.name);
	for (const c of clients) await expect(c.page.getByTestId('player-card')).toHaveCount(count);
	return { clients, host, code };
}

/**
 * Configure the game through the host's real controls, then wait for the
 * SERVER's echo rather than for the number on screen.
 *
 * The steppers are debounced 300ms client-side; the on-screen value is the
 * local draft and proves nothing about what the server holds. `startGame`
 * flushes the pending patch, but the wait is what makes this deterministic.
 */
async function configure(host: Client, patch: Record<string, number>) {
	await host.page.getByTestId('toggle-timings').click();
	await expect(host.page.getByTestId('timing-fields')).toBeVisible();

	for (const [key, target] of Object.entries(patch)) {
		// Read the raw value, not the label: `standingsEvery` renders "Off" at
		// zero, so the on-screen text is not always a number.
		const dial = host.page.getByTestId(`value-${key}`);
		const read = async () => Number(await dial.getAttribute('data-value'));
		for (let guard = 0; guard < 80; guard++) {
			const shown = await read();
			if (shown === target) break;
			await host.page.getByTestId(shown < target ? `inc-${key}` : `dec-${key}`).click();
		}
		expect(await read(), `${key} should have reached ${target}`).toBe(target);
	}

	await expect
		.poll(
			() =>
				statesIn(host.frames, 'LOBBY').some((s) =>
					Object.entries(patch).every(([k, v]) => s.room?.settings?.[k] === v)
				),
			{ timeout: 15_000 }
		)
		.toBe(true);
}

/** Everyone answers every question and hands in. */
async function answerAndHandIn(clients: Client[]) {
	for (const c of clients) {
		await expect(c.page.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
	}
	for (const c of clients) {
		for (let q = 0; q < QUESTIONS; q++) {
			await c.page.getByTestId('entry-field').fill(answerOf(c.name, q));
			if (q < QUESTIONS - 1) {
				await c.page.getByTestId('next-question').click();
				await expect(c.page.getByTestId('question-counter')).toContainText(`${q + 2}`);
			}
		}
	}
}

/** Wait until this page is showing a GUESSING screen. */
async function untilGuessing(page: Page) {
	await expect(async () => {
		expect(await page.getByTestId('reveal-author').count()).toBe(0);
		expect(await page.getByTestId('staged-answer').count()).toBe(1);
	}).toPass({ timeout: 40_000 });
}

test('a full game: answer everything, then guess round by round to the finale', async ({
	browser
}) => {
	// Three rounds at 25s guess + 7s reveal is ~35s of unavoidable server clock
	// even when every phase resolves early, before any setup.
	test.setTimeout(300_000);

	const { clients, host } = await seatRoom(browser, 5);
	const pages = clients.map((c) => c.page);

	// Guests can see which packs are in play without being host, and now also
	// the shape of the game they are agreeing to.
	await expect(clients[1]!.page.getByTestId('packs-summary')).toBeVisible();
	await expect(clients[1]!.page.getByTestId('pack-chip')).toHaveCount(4);
	await expect(clients[1]!.page.getByTestId('guest-shape')).toBeVisible();

	await configure(host, { questions: QUESTIONS, rounds: ROUNDS, standingsEvery: 0 });

	await clickUntil('start-game', host.page, () =>
		expect(host.page.getByTestId('intro-splash')).toBeVisible()
	);

	// ------------------------------------------------------------- answering
	for (const page of pages) {
		await expect(page.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
	}

	// Everyone gets the same questions, and there are as many as the host set.
	const firstPrompt = (await host.page.getByTestId('prompt').textContent())!.trim();
	expect(firstPrompt.length).toBeGreaterThan(0);
	for (const page of pages) {
		expect((await page.getByTestId('prompt').textContent())!.trim()).toBe(firstPrompt);
		await expect(page.getByTestId('question-counter')).toContainText(`1`);
		await expect(page.getByTestId('question-counter')).toContainText(`${QUESTIONS}`);
	}

	// Back is unavailable on the first question and Next is not.
	await expect(host.page.getByTestId('prev-question')).toBeDisabled();
	await expect(host.page.getByTestId('next-question')).toBeEnabled();

	await answerAndHandIn(clients);

	// Paging back must show what was typed, not an empty field: the drafts are
	// held locally and only sent when the player moves off a question.
	await host.page.getByTestId('prev-question').click();
	await expect(host.page.getByTestId('entry-field')).toHaveValue(answerOf(host.name, 0));
	await host.page.getByTestId('next-question').click();

	// Four of the five hand in, so the "not everyone is done" state is real
	// and observable. Handing in all five would resolve the phase immediately.
	for (const c of clients.slice(0, 4)) {
		await c.page.getByTestId('hand-in').click();
		await expect(c.page.getByTestId('handed-in-chip')).toBeVisible();
	}
	await expect(host.page.getByTestId('done-count')).toContainText('4 of 5');
	// Handing in never locks the field — the phase is still running.
	await expect(host.page.getByTestId('entry-field')).toBeVisible();

	// ANONYMITY, during ANSWERING: nobody's browser has been told anyone
	// else's answer text.
	for (const reader of clients) {
		const seen = statesIn(reader.frames, 'ANSWERING')
			.map((s) => JSON.stringify(s))
			.join('');
		for (const other of clients) {
			for (let q = 0; q < QUESTIONS; q++) {
				const secret = answerOf(other.name, q);
				if (other.name === reader.name) continue;
				expect(seen, `${reader.name} was sent ${other.name}'s answer`).not.toContain(secret);
			}
		}
	}

	// The fifth hand-in resolves the phase with no clock involved.
	await clients[4]!.page.getByTestId('hand-in').click();
	for (const page of pages) await untilGuessing(page);

	// --------------------------------------------------------------- rounds
	const questionsAsked: string[] = [];
	let totalAwarded = 0;

	for (let round = 1; round <= ROUNDS; round++) {
		for (const page of pages) await untilGuessing(page);

		questionsAsked.push((await host.page.getByTestId('prompt').textContent())!.trim());

		// The author sees a different screen, not a disabled grid.
		const authorClients: Client[] = [];
		const guessers: Client[] = [];
		for (const c of clients) {
			const isAuthor = (await c.page.getByTestId('guessing-yours').count()) === 1;
			(isAuthor ? authorClients : guessers).push(c);
		}
		expect(authorClients, `round ${round} must have exactly one author`).toHaveLength(1);
		const author = authorClients[0]!;
		await expect(author.page.getByTestId('guess-grid')).toHaveCount(0);
		await expect(author.page.getByTestId('guess-chip')).toHaveCount(0);
		for (const g of guessers) {
			await expect(g.page.getByTestId('guess-chip')).toHaveCount(4); // everyone except me
		}

		// ANONYMITY, during GUESSING: no page has been sent an authorId at any
		// depth, for any round so far.
		for (const reader of clients) {
			for (const frame of statesIn(reader.frames, 'GUESSING')) {
				expect(
					deepKeys(frame).has('authorId'),
					`${reader.name} was sent an authorId during GUESSING`
				).toBe(false);
			}
		}

		// Exactly one guesser is right (+2); the rest are wrong (+1 to the
		// author each). So every round moves exactly 5 points.
		const correct = guessers[0]!;
		await correct.page.getByTestId('guess-chip').filter({ hasText: author.name }).click();
		for (const wrong of guessers.slice(1)) {
			const notAuthor = clients.find((c) => c !== wrong && c !== author)!;
			await wrong.page.getByTestId('guess-chip').filter({ hasText: notAuthor.name }).click();
		}
		totalAwarded += 5;

		// The reveal names the player who actually wrote it.
		await expect(host.page.getByTestId('reveal-author')).toBeVisible({ timeout: 40_000 });
		await expect(host.page.getByTestId('reveal-author')).toContainText(author.name);

		if (round < ROUNDS) {
			await expect(async () => {
				expect(await host.page.getByTestId('reveal-author').count()).toBe(0);
			}).toPass({ timeout: 40_000 });
		}
	}

	// The rule the whole mixed pool exists for.
	for (let i = 1; i < questionsAsked.length; i++) {
		expect(questionsAsked[i], 'the same question ran twice in a row').not.toBe(
			questionsAsked[i - 1]
		);
	}

	// --------------------------------------------------------------- finale
	for (const page of pages) {
		await expect(page.getByTestId('finale-headline')).toBeVisible({ timeout: 60_000 });
	}
	const scores = await host.page.getByTestId('finale-score').allTextContents();
	const sum = scores.reduce((n, s) => n + Number(s.replace(/\D+/g, '')), 0);
	expect(sum, `${ROUNDS} rounds must total exactly ${totalAwarded} points`).toBe(totalAwarded);

	// -------------------------------------------------------- back to lobby
	// The finale has exactly one way onward and no leave control at all: a
	// party game should not end by scattering everyone to the landing page.
	for (const page of pages) {
		await expect(page.getByTestId('finale-lobby')).toBeVisible();
		await expect(page.getByTestId('leave-game')).toHaveCount(0);
		await expect(page.getByTestId('finale-home')).toHaveCount(0);
	}

	// Sent by a NON-host, because it is the only exit and must not be host-only.
	await clients[2]!.page.getByTestId('finale-lobby').click();
	for (const page of pages) {
		await expect(page.getByTestId('players-heading')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('player-card')).toHaveCount(5);
	}
	// The settings the host chose survive, so the group can just play again.
	await expect(host.page.getByTestId('value-rounds')).toHaveAttribute(
		'data-value',
		String(ROUNDS)
	);
	// And no trace of the finished game reaches the lobby snapshot.
	for (const reader of clients) {
		const seen = statesIn(reader.frames, 'LOBBY')
			.slice(-1)
			.map((s) => JSON.stringify(s))
			.join('');
		for (const other of clients) {
			for (let q = 0; q < QUESTIONS; q++) {
				expect(seen).not.toContain(answerOf(other.name, q));
			}
		}
	}
	// The same room starts a second game.
	await clickUntil('start-game', host.page, () =>
		expect(host.page.getByTestId('intro-splash')).toBeVisible()
	);

	for (const c of clients) await c.close();
});

test('the standings beat appears on the cadence the host set', async ({ browser }) => {
	test.setTimeout(300_000);

	const { clients, host } = await seatRoom(browser, 3);
	const pages = clients.map((c) => c.page);

	// A beat after every round, so the first one arrives as early as possible.
	await configure(host, { questions: QUESTIONS, rounds: 2, standingsEvery: 1 });
	await clickUntil('start-game', host.page, () =>
		expect(host.page.getByTestId('intro-splash')).toBeVisible()
	);

	await answerAndHandIn(clients);
	for (const c of clients) await c.page.getByTestId('hand-in').click();
	for (const page of pages) await untilGuessing(page);

	// Let round 1 run out on its own clocks and land on the beat.
	await expect(host.page.getByTestId('standings-rows')).toBeVisible({ timeout: 90_000 });
	await expect(host.page.getByTestId('standings-row')).toHaveCount(3);
	// Movement is rendered per row, and the beat carries no answer content.
	await expect(host.page.getByTestId('standings-delta').first()).toBeVisible();
	for (const reader of clients) {
		for (const frame of statesIn(reader.frames, 'STANDINGS')) {
			expect(deepKeys(frame).has('authorId')).toBe(false);
			expect(deepKeys(frame).has('answer')).toBe(false);
		}
	}

	for (const c of clients) await c.close();
});

test('the answer’s author leaving mid-guess does not hang the room', async ({ browser }) => {
	test.setTimeout(300_000);

	const { clients, host } = await seatRoom(browser, 4);
	const pages = clients.map((c) => c.page);

	await configure(host, { questions: QUESTIONS, rounds: 4, standingsEvery: 0 });
	await clickUntil('start-game', host.page, () =>
		expect(host.page.getByTestId('intro-splash')).toBeVisible()
	);

	await answerAndHandIn(clients);
	for (const c of clients) await c.page.getByTestId('hand-in').click();
	for (const page of pages) await untilGuessing(page);

	// Find the author of the answer on the stage and have them walk out.
	let author: Client | undefined;
	for (const c of clients) {
		if ((await c.page.getByTestId('guessing-yours').count()) === 1) author = c;
	}
	expect(author, 'exactly one player must be the author').toBeDefined();

	await author!.page.getByTestId('leave-game').click();
	await author!.page.getByTestId('leave-confirm-confirm').click();

	// The room voids that answer, skips it, and carries on with three players
	// rather than sitting on an answer nobody can be revealed as.
	const remaining = clients.filter((c) => c !== author);
	// The voided round can render as the guessing screen for the NEXT answer,
	// as the contentless splash for an instant, or straight as the finale if
	// the pool emptied. Any of the three means the room moved on; only a room
	// still showing the dead answer would be a hang.
	await expect(async () => {
		const finale = await remaining[0]!.page.getByTestId('finale-headline').count();
		const guessing = await remaining[0]!.page.getByTestId('staged-answer').count();
		const splash = await remaining[0]!.page.getByTestId('intro-splash').count();
		expect(finale + guessing + splash).toBeGreaterThan(0);
	}).toPass({ timeout: 60_000 });

	// And it reaches the finale rather than hanging.
	for (const c of remaining) {
		await expect(c.page.getByTestId('finale-headline')).toBeVisible({ timeout: 120_000 });
	}
	// The leaver's answers went with them.
	for (const c of remaining) {
		const body = (await c.page.textContent('body')) ?? '';
		for (let q = 0; q < QUESTIONS; q++) {
			expect(body).not.toContain(answerOf(author!.name, q));
		}
	}

	for (const c of clients) await c.close();
});
