import { expect, test, type Browser, type Page } from '@playwright/test';
import { CODE_RE, clickUntil, joinRoom, open, watch } from './helpers';

/**
 * A complete game, played in real browsers, end to end.
 *
 * **Five contexts, not four, and that is load-bearing.** `MAX_STAGED` is 4, so
 * with four players every answer is staged and the un-staged case — the one
 * ROUND_END exists to cover, and the reason most of a big room ever gets seen —
 * never happens. Five players is the smallest room that produces one.
 *
 * What this asserts beyond "the phases advance":
 *
 *  - **The anonymity property, over the wire.** Every page records the frames
 *    its own socket receives. During WRITING no page may be sent another
 *    player's answer text; during GUESSING no page may be sent an `authorId`
 *    for the answer under scrutiny. Checking the DOM alone would prove only
 *    that the screen didn't render the secret — this proves the server never
 *    told the browser in the first place, which is where the guarantee lives.
 *  - **The author's screen is a different screen, not a disabled grid**
 *    (ledger ruling 55): zero candidate chips for the author while every
 *    guesser has a full grid.
 *  - **ROUND_END lists every answer with an author**, staged and un-staged.
 *  - **Scoring, arithmetically.** Each staged answer is guessed by exactly one
 *    guesser correctly (+2) and three incorrectly (+1 to the author each), so
 *    every answer moves exactly 5 points and a four-answer round must end on
 *    exactly 20. A game that awarded the wrong player the right number would
 *    still fail the per-reveal author assertion.
 *
 * **Nothing here sleeps.** Every wait is a poll on UI state (`toPass`, or a
 * locator expectation), per the ledger's rule — a fixed sleep flakes under load
 * and hides the real timing.
 *
 * Run it (not in CI, deliberately):
 *   pnpm --filter web exec playwright test e2e/round.spec.ts
 * The Playwright config starts both dev servers itself.
 */

test.describe.configure({ mode: 'serial' });

/** Answers are nonsense tokens on purpose: unique, greppable, and containing
    nothing that could be confused with a player's name. */
const ANSWERS = [
	'zulu-quartz-71',
	'nimbus-fondant-42',
	'ochre-pelican-08',
	'kestrel-mango-93',
	'vellum-tundra-56'
];

const NAMES = ['Ana', 'Bo', 'Cyd', 'Dov', 'Eli'];

interface Client {
	page: Page;
	name: string;
	answer: string;
	/** Raw text payloads this page's socket has received. */
	frames: string[];
	close: () => Promise<void>;
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
	room?: { phase?: string; settings?: { rounds?: number } };
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
	return {
		page,
		name: NAMES[i]!,
		answer: ANSWERS[i]!,
		frames: recordFrames(page),
		close: () => ctx.close()
	};
}

/** Wait until this page is showing GUESSING for the given 1-based answer. */
async function untilGuessing(page: Page, index: number, total: number) {
	await expect(async () => {
		expect(await page.getByTestId('reveal-author').count()).toBe(0);
		expect(await page.getByTestId('staged-answer').count()).toBe(1);
		expect(await page.getByTestId('answer-progress').textContent()).toBe(
			`Answer ${index} of ${total}`
		);
	}).toPass({ timeout: 30_000 });
}

test('five players play a full round: write → guess/reveal ×4 → round end → finale', async ({
	browser
}) => {
	// Four reveals at 7s plus a round-end at 8s is ~40s of unavoidable
	// server-side clock, before any setup.
	test.setTimeout(240_000);

	const clients: Client[] = [];
	for (let i = 0; i < 5; i++) clients.push(await newClient(browser, i));
	const host = clients[0]!;
	const guests = clients.slice(1);
	const pages = clients.map((c) => c.page);

	// ---------------------------------------------------------------- lobby
	await open(host.page, '/');
	await clickUntil('create-room', host.page, () => host.page.waitForURL(CODE_RE));
	const code = new URL(host.page.url()).pathname.split('/').at(-1)!;

	await open(host.page, `/room/${code}`);
	await host.page.getByTestId('nickname').fill(host.name);
	await clickUntil('join-submit', host.page, () =>
		expect(host.page.getByTestId('players-heading')).toBeVisible()
	);
	for (const guest of guests) await joinRoom(guest.page, code, guest.name);

	for (const page of pages) await expect(page.getByTestId('player-card')).toHaveCount(5);

	// Guests can see which packs are in play without being host (ledger,
	// "Non-hosts cannot see whether Confessions is on").
	await expect(guests[0]!.page.getByTestId('packs-summary')).toBeVisible();
	await expect(guests[0]!.page.getByTestId('pack-chip')).toHaveCount(4);

	// One round. Both phase timers are left at their defaults: every phase this
	// test waits on resolves early, so the clocks only bound the failure case,
	// and a floor-value writing timer could expire before five browsers have
	// typed. Steppers, not a settings message — this is the host's real path.
	for (let i = 0; i < 3; i++) await host.page.getByTestId('dec-rounds').click();
	await expect(host.page.getByTestId('value-rounds')).toHaveText('1');
	// The stepper is debounced 300ms client-side and the lobby DROPS a pending
	// patch when it unmounts, so starting the game too quickly loses the
	// setting. Wait for the server's own echo — the number on screen is the
	// local draft and proves nothing.
	await expect
		.poll(() => statesIn(host.frames, 'LOBBY').some((s) => s.room?.settings?.rounds === 1), {
			timeout: 10_000
		})
		.toBe(true);

	await clickUntil('start-game', host.page, () =>
		expect(host.page.getByTestId('intro-splash')).toBeVisible()
	);

	// -------------------------------------------------------------- writing
	for (const page of pages) await expect(page.getByTestId('entry-field')).toBeVisible({ timeout: 20_000 });

	const prompt = (await host.page.getByTestId('prompt').textContent())!.trim();
	expect(prompt.length).toBeGreaterThan(0);
	for (const page of pages) {
		expect((await page.getByTestId('prompt').textContent())!.trim()).toBe(prompt);
	}

	// Hand in four of the five, then check the fifth screen — and every other
	// one — while the room is still writing. Submitting all five would
	// early-resolve WRITING and close the window this assertion needs.
	for (const client of clients.slice(0, 4)) {
		await client.page.getByTestId('entry-field').fill(client.answer);
		await client.page.getByTestId('submit-entry').click();
		await expect(client.page.getByTestId('submitted-chip')).toBeVisible();
	}
	await expect(host.page.getByTestId('written-count')).toContainText('4 of 5');

	// ANONYMITY, during WRITING: nobody's browser has been told anyone else's
	// answer — not on screen, and not in the frames behind it.
	for (const client of clients) {
		const dom = await client.page.content();
		const writing = statesIn(client.frames, 'WRITING').map((s) => JSON.stringify(s));
		for (const other of clients) {
			if (other === client) continue;
			expect(dom, `${client.name} sees ${other.name}'s answer`).not.toContain(other.answer);
			for (const frame of writing) {
				expect(frame, `${client.name} was sent ${other.name}'s answer`).not.toContain(other.answer);
			}
		}
	}

	const last = clients[4]!;
	await last.page.getByTestId('entry-field').fill(last.answer);
	await last.page.getByTestId('submit-entry').click();

	// ------------------------------------------------- guess / reveal, ×4
	const STAGED = 4; // MAX_STAGED, with 5 writers
	const revealedAuthors: string[] = [];

	for (let n = 1; n <= STAGED; n++) {
		for (const page of pages) await untilGuessing(page, n, STAGED);

		const stagedText = (await host.page.getByTestId('staged-answer').textContent())!.trim();
		const author = clients.find((c) => stagedText.includes(c.answer));
		expect(author, `staged answer ${n} matched no known entry`).toBeTruthy();
		revealedAuthors.push(author!.name);
		const guessers = clients.filter((c) => c !== author);

		// The author gets no grid at all — not a disabled one (ruling 55).
		await expect(author!.page.getByTestId('guess-grid')).toHaveCount(0);
		await expect(author!.page.getByTestId('guess-chip')).toHaveCount(0);
		await expect(author!.page.getByTestId('guessing-yours')).toBeVisible();

		for (const guesser of guessers) {
			await expect(guesser.page.getByTestId('guess-grid')).toHaveCount(1);
			await expect(guesser.page.getByTestId('guess-chip')).toHaveCount(4);
			// ANONYMITY, during GUESSING: nothing on a guesser's page names an
			// author, and no frame carrying a GUESSING snapshot carries one
			// either — for this answer or any earlier one.
			await expect(guesser.page.locator('[data-author]')).toHaveCount(0);
			for (const state of statesIn(guesser.frames, 'GUESSING')) {
				expect(
					[...deepKeys(state)],
					`${guesser.name} was sent an authorId during GUESSING`
				).not.toContain('authorId');
			}
		}

		// Exactly one guesser is right; the rest name someone who isn't the
		// author (and isn't themselves). 2 + 1 + 1 + 1 = 5 points per answer.
		const [right, ...wrong] = guessers;
		await right!.page
			.getByTestId('guess-chip')
			.filter({ hasText: author!.name })
			.click();
		for (const guesser of wrong) {
			const decoy = clients.find((c) => c !== author && c !== guesser)!;
			await guesser.page.getByTestId('guess-chip').filter({ hasText: decoy.name }).click();
		}

		for (const page of pages) {
			await expect(page.getByTestId('reveal-author')).toBeVisible({ timeout: 30_000 });
		}
		// The reveal names the player who actually wrote it, on every screen.
		for (const client of clients) {
			const shown = (await client.page.getByTestId('reveal-author').textContent())!;
			expect(shown, `${client.name} saw the wrong author for answer ${n}`).toContain(author!.name);
		}
		// Every present player gets a row, zeros included.
		await expect(host.page.getByTestId('reveal-row')).toHaveCount(5);
	}

	// Four different answers were staged, so four different authors — the
	// staging rotation put nobody up twice in one round.
	expect(new Set(revealedAuthors).size).toBe(STAGED);

	// ------------------------------------------------------------ round end
	for (const page of pages) {
		await expect(page.getByTestId('roundend-answers')).toBeVisible({ timeout: 30_000 });
	}

	// Every answer of the round, staged and un-staged, each with an author.
	const rows = host.page.getByTestId('roundend-answer');
	await expect(rows).toHaveCount(5);
	await expect(host.page.locator('[data-testid="roundend-answer"][data-staged="true"]')).toHaveCount(
		STAGED
	);
	await expect(
		host.page.locator('[data-testid="roundend-answer"][data-staged="false"]')
	).toHaveCount(1);

	for (let i = 0; i < 5; i++) {
		const row = rows.nth(i);
		const text = (await row.getByTestId('roundend-text').textContent())!.trim();
		const shownAuthor = (await row.getByTestId('roundend-author').textContent())!.trim();
		const expected = clients.find((c) => text.includes(c.answer));
		expect(expected, `round-end row ${i} showed an answer nobody wrote`).toBeTruthy();
		// The reader's own row says "You" rather than repeating their name.
		expect(shownAuthor).toBe(expected === host ? 'You' : expected!.name);
	}

	// ---------------------------------------------------------------- finale
	for (const page of pages) {
		await expect(page.getByTestId('finale-headline')).toBeVisible({ timeout: 30_000 });
	}
	await expect(host.page.getByTestId('finale-row')).toHaveCount(5);

	const scores = await host.page.getByTestId('finale-score').allTextContents();
	const total = scores.reduce((sum, s) => sum + Number(s.trim()), 0);
	// 4 staged answers × (one +2 guess + three +1 fools).
	expect(total).toBe(20);

	for (const client of clients) await client.close();
});

/**
 * The gap T7 ruling 63 and T8 ruling 77(c) both left open: a player leaving
 * while their own answer is the one under scrutiny. The engine voids the
 * answer, `view.ts` falls back to the contentless INTRO projection and the
 * screen unmounts mid-phase (rulings 29 / 40) — all of which was unit-tested
 * and reasoned about, never driven in a browser.
 *
 * Four players so the room stays at or above `MIN_PLAYERS` (3) afterwards and
 * the game is expected to finish rather than end early.
 */
test('the staged author leaving mid-guess does not hang the room', async ({ browser }) => {
	test.setTimeout(240_000);

	const clients: Client[] = [];
	for (let i = 0; i < 4; i++) clients.push(await newClient(browser, i));
	const host = clients[0]!;
	const guests = clients.slice(1);
	const pages = clients.map((c) => c.page);

	await open(host.page, '/');
	await clickUntil('create-room', host.page, () => host.page.waitForURL(CODE_RE));
	const code = new URL(host.page.url()).pathname.split('/').at(-1)!;
	await open(host.page, `/room/${code}`);
	await host.page.getByTestId('nickname').fill(host.name);
	await clickUntil('join-submit', host.page, () =>
		expect(host.page.getByTestId('players-heading')).toBeVisible()
	);
	for (const guest of guests) await joinRoom(guest.page, code, guest.name);
	await expect(host.page.getByTestId('player-card')).toHaveCount(4);

	for (let i = 0; i < 3; i++) await host.page.getByTestId('dec-rounds').click();
	await expect(host.page.getByTestId('value-rounds')).toHaveText('1');
	await expect
		.poll(() => statesIn(host.frames, 'LOBBY').some((s) => s.room?.settings?.rounds === 1), {
			timeout: 10_000
		})
		.toBe(true);

	await clickUntil('start-game', host.page, () =>
		expect(host.page.getByTestId('intro-splash')).toBeVisible()
	);

	for (const page of pages) await expect(page.getByTestId('entry-field')).toBeVisible({ timeout: 20_000 });
	for (const client of clients) {
		await client.page.getByTestId('entry-field').fill(client.answer);
		await client.page.getByTestId('submit-entry').click();
	}

	// First answer up. Its author walks out rather than guessing.
	for (const page of pages) await untilGuessing(page, 1, 4);
	const stagedText = (await host.page.getByTestId('staged-answer').textContent())!.trim();
	const author = clients.find((c) => stagedText.includes(c.answer))!;

	await author.page.getByTestId('leave-game').click();
	if (await author.page.getByTestId('leave-confirm-confirm').count()) {
		await author.page.getByTestId('leave-confirm-confirm').click();
	}
	await author.page.waitForURL('**/');

	const staying = clients.filter((c) => c !== author);

	// The room keeps moving: the voided answer is skipped, and the remaining
	// three reach the finale. Guesses are cast opportunistically — the phase
	// may already have moved on by the time a tap lands, which is exactly the
	// race the client-side grid lock exists for, so a missed tap is fine.
	await expect(async () => {
		for (const client of staying) {
			const chips = client.page.getByTestId('guess-chip');
			if ((await chips.count()) > 0 && (await chips.first().isEnabled())) {
				await chips.first().click({ timeout: 2000 }).catch(() => {});
			}
		}
		for (const client of staying) {
			expect(await client.page.getByTestId('finale-headline').count()).toBe(1);
		}
	}).toPass({ timeout: 180_000, intervals: [1000] });

	// Three players left, three rows, and the leaver's answer is gone with them.
	// Asserted on a player who stayed — the leaver may well be the host, who is
	// back on the landing page by now.
	const survivor = staying[0]!.page;
	await expect(survivor.getByTestId('finale-row')).toHaveCount(3);
	expect(await survivor.content()).not.toContain(author.answer);

	for (const client of clients) await client.close();
});
