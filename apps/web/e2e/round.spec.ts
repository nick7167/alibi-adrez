import { expect, test, type Page } from '@playwright/test';
import { CODE_RE, clickUntil, joinRoom, open, watch } from './helpers';

/**
 * Plays a complete 4-player game from LOBBY to FINALE, driving every phase
 * by waiting for the UI state to change — never by sleeping a guessed
 * duration (ledger ruling: "never sleep for a socket frame"). INTRO (5s),
 * PLANNING (shortened to its 15s minimum) and REVEAL (10s) are real,
 * server-timed waits with no skip control, so the test still takes ~30s of
 * forced real time; everything else advances the instant the right message
 * is sent.
 */
test.describe('full round loop', () => {
	test('4 players play a complete round to FINALE, and detectives never see the story', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const p2Ctx = await browser.newContext();
		const p3Ctx = await browser.newContext();
		const p4Ctx = await browser.newContext();
		const host = await hostCtx.newPage();
		const p2 = await p2Ctx.newPage();
		const p3 = await p3Ctx.newPage();
		const p4 = await p4Ctx.newPage();
		watch(host, 'P1');
		watch(p2, 'P2');
		watch(p3, 'P3');
		watch(p4, 'P4');
		const pages = [host, p2, p3, p4];

		// Sniff the host's own `state` frames so settings changes can be
		// confirmed server-side before starting the game, instead of sleeping
		// past the settings debounce and hoping the round trip landed. Must be
		// registered before the room websocket is opened, so attach it now.
		const getLatestState = attachStateWatcher(host);

		// 1. Host creates a room and enters the lobby.
		await open(host, '/');
		await clickUntil('create-room', host, () => host.waitForURL(CODE_RE));
		const code = new URL(host.url()).pathname.split('/').at(-1)!;
		await open(host, `/room/${code}`);
		await host.getByTestId('nickname').fill('P1');
		await clickUntil('join-submit', host, () =>
			expect(host.getByTestId('players-heading')).toBeVisible()
		);

		// 2. Three more players join.
		await joinRoom(p2, code, 'P2');
		await joinRoom(p3, code, 'P3');
		await joinRoom(p4, code, 'P4');
		await expect(host.getByTestId('player-card')).toHaveCount(4);

		// 3. Shorten the round to its minimums so the test is fast without
		// faking anything: 1 round, 15s planning, 3 questions.
		for (let i = 0; i < 2; i++) await host.getByTestId('dec-rounds').click();
		for (let i = 0; i < 6; i++) await host.getByTestId('dec-planningSec').click();
		const QUESTION_COUNT = 3;
		for (let i = 0; i < 3; i++) await host.getByTestId('dec-questionCount').click();
		await expect(host.getByTestId('value-rounds')).toHaveText('1');
		await expect(host.getByTestId('value-planningSec')).toHaveText('15');
		await expect(host.getByTestId('value-questionCount')).toHaveText(String(QUESTION_COUNT));
		await waitForSettings(getLatestState, {
			rounds: 1,
			planningSec: 15,
			questionCount: QUESTION_COUNT
		});

		// 4. Start → INTRO splash for everyone.
		await clickUntil('start-game', host, () => expect(host.getByTestId('intro-splash')).toBeVisible());
		await Promise.all(
			pages.map((p) => expect(p.getByTestId('intro-splash')).toBeVisible({ timeout: 10_000 }))
		);

		// 5. INTRO → PLANNING (5s, real server timer). Sort the four clients
		// into suspects/detectives by which branch of Planning.svelte they land
		// on — never assumed ahead of time, since suspect pairing is random.
		const roles = await Promise.all(pages.map(waitForPlanningRole));
		const suspects = pages.filter((_, i) => roles[i] === 'suspect');
		const detectives = pages.filter((_, i) => roles[i] === 'detective');
		expect(suspects).toHaveLength(2);
		expect(detectives).toHaveLength(2);

		// The security property, checkpoint 1: detectives get nothing of the
		// suspects' scenario the instant PLANNING starts.
		const storyText = ((await suspects[0]!
			.getByTestId('scenario-card')
			.locator('p')
			.first()
			.textContent()) ?? ''
		).trim();
		expect(storyText.length).toBeGreaterThan(10);
		await assertNoStory(detectives, storyText);

		// 6. A suspect sends a planning chat line; only the two suspects see it.
		const chatLine = "Let's keep the story straight: we were at the diner the whole time.";
		await suspects[0]!.locator('#planning-chat-input').fill(chatLine);
		await suspects[0]!.getByTestId('chat-send').click();
		await expect(suspects[0]!.getByTestId('chat-log')).toContainText(chatLine);
		await expect(suspects[1]!.getByTestId('chat-log')).toContainText(chatLine);

		// 7. PLANNING → INTERROGATION (15s, real server timer). `progress-stamp`
		// is in the shared header, so it's present for both roles.
		await Promise.all(
			pages.map((p) => expect(p.getByTestId('progress-stamp')).toBeVisible({ timeout: 25_000 }))
		);

		// Checkpoint 2: still nothing of the story on a detective's page.
		await assertNoStory(detectives, storyText);

		// 8. A detective submits a question (queues into a later slot).
		await detectives[0]!
			.locator('#interrogation-question-input')
			.fill('Where exactly were you standing when it happened?');
		await detectives[0]!.getByTestId('question-send').click();

		// 9. Whichever suspect is on the clock answers, alternating turns,
		// until every question has both answers (2 answers × questionCount).
		const totalAnswers = QUESTION_COUNT * 2;
		for (let i = 0; i < totalAnswers; i++) {
			const answerer = await waitForAnswerer(suspects);
			await answerer.locator('#interrogation-answer-input').fill(`Answer ${i + 1}: the kitchen, the whole time.`);
			await answerer.getByTestId('answer-send').click();
			await expect(answerer.getByTestId('answer-form')).toBeHidden({ timeout: 10_000 });
		}

		// 10. INTERROGATION → DELIBERATION happens the instant the last answer
		// lands — no timer to wait for.
		await Promise.all(
			detectives.map((p) => expect(p.getByTestId('vote-controls')).toBeVisible({ timeout: 15_000 }))
		);

		// Checkpoint 3: still nothing of the story during DELIBERATION.
		await assertNoStory(detectives, storyText);

		// 11. Both detectives vote Consistent → unanimous verdict. The last
		// vote resolves deliberation immediately (everyone has now voted), so
		// that detective's page swaps straight to Reveal — only assert the
		// "locked in" readout for votes that aren't the resolving one.
		for (let i = 0; i < detectives.length; i++) {
			const d = detectives[i]!;
			await d.getByTestId('vote-consistent').click();
			if (i < detectives.length - 1) {
				await expect(d.getByTestId('vote-locked')).toBeVisible();
			}
		}

		// 12. DELIBERATION → REVEAL, immediately once both detectives voted.
		await Promise.all(
			pages.map((p) => expect(p.getByTestId('verdict-stamp')).toBeVisible({ timeout: 15_000 }))
		);
		await expect(host.getByTestId('unanimous-stamp')).toBeVisible();
		// The scenario is public now — everyone, detectives included, sees it.
		for (const d of detectives) {
			await expect(d.getByTestId('scenario-card')).toContainText(storyText);
		}
		await expect(host.getByTestId('scoreboard').locator('li')).toHaveCount(4);

		// 13. REVEAL → FINALE (10s, real server timer; only 1 round was set).
		await Promise.all(
			pages.map((p) => expect(p.getByTestId('podium')).toBeVisible({ timeout: 20_000 }))
		);

		// 14. Podium (top 3) + full scoreboard (all 4) + the three superlative
		// awards, translated — never a raw key.
		await expect(host.getByTestId('podium-entry')).toHaveCount(3);
		await expect(host.getByTestId('scoreboard').locator('li')).toHaveCount(4);
		const awardLabels = await host.getByTestId('award-label').allTextContents();
		expect(awardLabels.sort()).toEqual(
			['Most convincing liar', 'Sharpest detective', 'Most curious'].sort()
		);

		// 15. No server "return to lobby" capability exists yet, so FINALE's
		// exit takes the player home instead of a dead-end control.
		await host.getByTestId('finale-leave').click();
		await host.waitForURL('/');
		await expect(host.getByTestId('create-room')).toBeVisible();

		await hostCtx.close();
		await p2Ctx.close();
		await p3Ctx.close();
		await p4Ctx.close();
	});
});

// ---------------------------------------------------------------- helpers

interface StateFrame {
	t: 'state';
	room: { phase: string; settings?: Record<string, unknown> };
}

/**
 * Sniffs `state` frames off the page's room websocket and returns a getter
 * for the latest one — used to confirm a settings patch actually reached the
 * server instead of sleeping past the debounce and hoping. Must be attached
 * before the websocket is created (i.e. before the page ever navigates to a
 * room), since the `websocket` page event only fires once, at creation.
 */
function attachStateWatcher(page: Page): () => StateFrame | null {
	let latest: StateFrame | null = null;
	page.on('websocket', (ws) => {
		ws.on('framereceived', (frame) => {
			if (typeof frame.payload !== 'string') return;
			let msg: unknown;
			try {
				msg = JSON.parse(frame.payload);
			} catch {
				return;
			}
			if (msg && typeof msg === 'object' && (msg as { t?: unknown }).t === 'state') {
				latest = msg as StateFrame;
			}
		});
	});
	return () => latest;
}

/** Waits for the sniffed `state` frame's room settings to match `expected`. */
async function waitForSettings(
	getLatest: () => StateFrame | null,
	expected: Record<string, unknown>
) {
	await expect(async () => {
		const settings = getLatest()?.room.settings;
		expect(settings).toBeTruthy();
		for (const [key, value] of Object.entries(expected)) {
			expect(settings?.[key]).toBe(value);
		}
	}).toPass({ timeout: 10_000 });
}

/** Which branch of Planning.svelte a page landed on. */
async function waitForPlanningRole(page: Page): Promise<'suspect' | 'detective'> {
	const scenario = page.getByTestId('scenario-card');
	const waitingRoom = page.getByTestId('detective-waiting-title');
	await expect(async () => {
		const isSuspect = await scenario.isVisible().catch(() => false);
		const isDetective = await waitingRoom.isVisible().catch(() => false);
		expect(isSuspect || isDetective).toBeTruthy();
	}).toPass({ timeout: 20_000 });
	return (await scenario.isVisible().catch(() => false)) ? 'suspect' : 'detective';
}

/** Whichever suspect page currently shows the answer form (i.e. is "on the clock"). */
async function waitForAnswerer(suspects: Page[]): Promise<Page> {
	let winner: Page | null = null;
	await expect(async () => {
		for (const p of suspects) {
			if (await p.getByTestId('answer-form').isVisible().catch(() => false)) {
				winner = p;
				return;
			}
		}
		throw new Error('no suspect is on the clock yet');
	}).toPass({ timeout: 20_000 });
	return winner!;
}

/** The detective-visible security property: never the suspects' story text. */
async function assertNoStory(detectives: Page[], storyText: string) {
	for (const d of detectives) {
		await expect(d.locator('body')).not.toContainText(storyText);
	}
}
