import { expect, test } from '@playwright/test';
import { CODE_RE, clickUntil, open, watch } from './helpers';

interface StateFrame {
	t?: string;
	room?: {
		phase?: string;
		myAnswers?: Record<string, string>;
		answer?: { id?: string };
	};
}

test('a reviewer can complete the real game alone, reconnect, moderate, and leave', async ({
	browser
}) => {
	test.setTimeout(180_000);
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		reducedMotion: 'reduce'
	});
	const page = await context.newPage();
	watch(page, 'PRACTICE');

	const frames: StateFrame[] = [];
	page.on('websocket', (socket) => {
		socket.on('framereceived', (frame) => {
			if (typeof frame.payload !== 'string') return;
			try {
				frames.push(JSON.parse(frame.payload) as StateFrame);
			} catch {
				// Non-JSON frames are irrelevant to this protocol assertion.
			}
		});
	});

	await open(page, '/');
	await clickUntil('create-room', page, () => page.waitForURL(CODE_RE));
	const code = new URL(page.url()).pathname.split('/').at(-1)!;
	await open(page, `/room/${code}`);
	await page.getByTestId('nickname').fill('Reviewer');
	await clickUntil('join-submit', page, () =>
		expect(page.getByTestId('players-heading')).toBeVisible()
	);

	await expect(page.getByTestId('player-card')).toHaveCount(1);
	await expect(page.getByTestId('start-game')).toBeDisabled();
	await expect(page.getByTestId('practice-game')).toBeVisible();
	expect(
		await page.getByTestId('practice-game').evaluate((element) =>
			getComputedStyle(element).transitionDuration
		)
	).toBe('0s');
	await page.setViewportSize({ width: 390, height: 420 });
	const practiceBox = await page.getByTestId('practice-game').boundingBox();
	expect(practiceBox, 'practice action has no box at keyboard height').not.toBeNull();
	expect(practiceBox!.height).toBeGreaterThanOrEqual(43.5);
	expect(practiceBox!.y + practiceBox!.height).toBeLessThanOrEqual(420.5);
	expect(
		await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)
	).toBe(true);
	await page.setViewportSize({ width: 390, height: 844 });
	await clickUntil('practice-game', page, () =>
		expect(page.getByTestId('intro-splash')).toBeVisible()
	);
	await expect(page.getByTestId('intro-title')).toBeFocused();

	await expect(page.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('prompt')).toBeFocused();
	await expect(page.getByTestId('question-counter')).toContainText('1');
	await expect(page.getByTestId('question-counter')).toContainText('3');
	const firstAnswer = 'A tiny reviewer answer';
	await page.getByTestId('entry-field').fill(firstAnswer);
	await page.getByTestId('next-question').click();
	await expect
		.poll(
			() =>
				frames.some(
					(frame) =>
						frame.t === 'state' &&
						frame.room?.phase === 'ANSWERING' &&
						frame.room.myAnswers?.['0'] === firstAnswer
				),
			{ timeout: 15_000 }
		)
		.toBe(true);

	// Reload uses the persisted room identity and repopulates the server-held
	// answer, proving the reviewer path is a real reconnect rather than a mock.
	await page.reload();
	await expect(page.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('entry-field')).toHaveValue(firstAnswer);
	await page.getByTestId('next-question').click();
	await page.getByTestId('entry-field').fill('Coffee and toast');
	await page.getByTestId('next-question').click();
	await page.getByTestId('entry-field').fill('Recognising songs quickly');
	await page.getByTestId('hand-in').click();

	let safetyChecked = false;
	let guesses = 0;
	for (let guard = 0; guard < 12; guard++) {
		await expect
			.poll(
				async () =>
					(await page.getByTestId('guess-grid').count()) +
					(await page.getByTestId('reveal-author').count()) +
					(await page.getByTestId('standings-rows').count()) +
					(await page.getByTestId('finale-headline').count()),
				{ timeout: 45_000 }
			)
			.toBeGreaterThan(0);

		if ((await page.getByTestId('finale-headline').count()) === 1) break;
		if ((await page.getByTestId('standings-rows').count()) === 1) {
			await expect(page.getByTestId('standings-title')).toBeFocused();
			await expect(page.getByTestId('standings-rows')).toHaveCount(0, { timeout: 15_000 });
			continue;
		}

		if ((await page.getByTestId('guess-grid').count()) === 1) {
			await expect(page.getByTestId('prompt')).toBeFocused();
			await expect(page.getByTestId('guess-chip')).toHaveCount(2);
			if (!safetyChecked) {
				const answer = (await page.getByTestId('staged-answer').textContent())?.trim() ?? '';
				expect(answer.length).toBeGreaterThan(0);
				await page.getByRole('button', { name: 'Answer safety options' }).click();
				await expect(page.getByRole('button', { name: 'Report answer' })).toBeVisible();
				await page.getByRole('button', { name: 'Hide answer' }).click();
				await expect(page.getByTestId('staged-answer')).toHaveText('Hidden answer');
				await page.getByRole('button', { name: 'Answer safety options' }).click();
				await page.getByRole('button', { name: 'Show answer' }).click();
				await expect(page.getByTestId('staged-answer')).toHaveText(answer);
				safetyChecked = true;
			}
			await page.getByTestId('guess-chip').first().click();
			guesses++;
			await expect(page.getByTestId('guess-grid')).toHaveCount(0, { timeout: 40_000 });
		}

		if ((await page.getByTestId('reveal-author').count()) === 1) {
			await expect(page.getByTestId('reveal-author')).toBeFocused();
			await expect(page.getByTestId('reveal-rows')).toBeVisible();
			const answer = (await page.getByTestId('staged-answer').textContent())?.trim() ?? '';
			expect(answer.length).toBeGreaterThan(0);
			await expect(page.getByTestId('reveal-author')).toHaveCount(0, { timeout: 40_000 });
		}
	}

	await expect(page.getByTestId('finale-headline')).toBeVisible({ timeout: 60_000 });
	await expect(page.getByTestId('finale-headline')).toBeFocused();
	expect(guesses).toBeGreaterThan(0);
	expect(safetyChecked).toBe(true);
	const revealedAnswers = new Set(
		frames
			.filter((frame) => frame.t === 'state' && frame.room?.phase === 'REVEAL')
			.map((frame) => frame.room?.answer?.id)
			.filter((answerId): answerId is string => typeof answerId === 'string')
	);
	expect(revealedAnswers.size, 'all three real server rounds reached REVEAL').toBe(3);
	await expect(page.getByTestId('finale-row')).toHaveCount(3);
	await page.getByTestId('finale-lobby').click();
	await expect(page.getByTestId('players-heading')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('player-card')).toHaveCount(3);
	await expect(page.getByTestId('bot-tag')).toHaveCount(2);

	// The generated participants use the same local safety controls as people.
	await page.getByTestId('player-actions').first().click();
	await expect(page.getByText('Report player')).toBeVisible();
	await page.getByText('Hide player').click();
	await expect(page.getByTestId('player-name').filter({ hasText: 'Hidden player' })).toHaveCount(1);
	await page.reload();
	await expect(page.getByTestId('players-heading')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('player-name').filter({ hasText: 'Hidden player' })).toHaveCount(1);

	await page.getByTestId('leave-game').click();
	await expect(page).toHaveURL('/');
	await context.close();
});
