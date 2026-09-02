import { expect, test, type Browser, type Page } from '@playwright/test';
import { CODE_RE, clickUntil, joinRoom, open } from './helpers';

/**
 * Short-viewport priority, measured rather than reasoned about.
 *
 * The standing rule (docs/plans/plan3-ledger.md): every screen is checked at
 * 390x844 *and* 390x420 — the height iOS leaves with the software keyboard up.
 * When space is short the context yields and the input plus the primary action
 * do not. A screen that only works at 844px tall does not work on a phone.
 *
 * What this asserts on every screen it reaches, at both heights:
 *
 *  - **no page scroll in either axis** — `scrollHeight === innerHeight`, which
 *    is the single check that catches a clipped control, an overlapping card
 *    and a layout that overflows its box;
 *  - **every touch target is at least 44px tall**;
 *  - **the primary action of the screen is fully inside the viewport.**
 *
 * These are the two new screens plus the lobby, which gained four dials.
 */

test.describe.configure({ mode: 'serial' });

const TALL = { width: 390, height: 844 };
const SHORT = { width: 390, height: 420 };
const IPAD_PORTRAIT = { width: 1032, height: 1376 };

/** No page scroll in either axis, at the size the page is currently at. */
async function expectNoPageScroll(page: Page, where: string) {
	const box = await page.evaluate(() => ({
		scrollHeight: document.documentElement.scrollHeight,
		innerHeight: window.innerHeight,
		scrollWidth: document.documentElement.scrollWidth,
		innerWidth: window.innerWidth
	}));
	expect(box.scrollHeight, `${where}: vertical page scroll`).toBeLessThanOrEqual(box.innerHeight);
	expect(box.scrollWidth, `${where}: horizontal page scroll`).toBeLessThanOrEqual(box.innerWidth);
}

/**
 * A control is reachable and tall enough to hit with a thumb.
 *
 * Reachable, not necessarily already on screen: the lobby's settings sit in a
 * scroll region by design, so a dial below the fold at 420px is correct — it
 * scrolls into reach and the page itself still does not scroll. What would be
 * a bug is a control that cannot be brought into view at all, which is what
 * scrolling to it and then measuring catches.
 */
async function expectUsable(page: Page, testid: string, where: string) {
	const el = page.getByTestId(testid).first();
	await el.scrollIntoViewIfNeeded();
	const box = await el.boundingBox();
	expect(box, `${where}: ${testid} has no box`).not.toBeNull();
	expect(box!.height, `${where}: ${testid} is under the 44px touch target`).toBeGreaterThanOrEqual(
		43.5
	);
	const inner = await page.evaluate(() => window.innerHeight);
	expect(box!.y, `${where}: ${testid} cannot be scrolled into view`).toBeGreaterThanOrEqual(-0.5);
	expect(box!.y + box!.height, `${where}: ${testid} is cut off even after scrolling`)
		.toBeLessThanOrEqual(inner + 0.5);
}

/**
 * The screen's primary action, which must be visible WITHOUT scrolling — the
 * short-viewport rule's actual promise: "the context yields, the input and the
 * primary action do not".
 */
async function expectPinned(page: Page, testid: string, where: string) {
	const box = await page.getByTestId(testid).first().boundingBox();
	expect(box, `${where}: ${testid} has no box`).not.toBeNull();
	expect(box!.height, `${where}: ${testid} is under the 44px touch target`).toBeGreaterThanOrEqual(
		43.5
	);
	const inner = await page.evaluate(() => window.innerHeight);
	expect(box!.y + box!.height, `${where}: ${testid} is not visible without scrolling`)
		.toBeLessThanOrEqual(inner + 0.5);
}

test('the landing page uses the iPad canvas instead of a phone-width column', async ({ page }) => {
	await page.setViewportSize(IPAD_PORTRAIT);
	await open(page, '/');
	await expectNoPageScroll(page, 'landing iPad portrait');

	const create = await page.getByTestId('create-room').boundingBox();
	const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
	expect(create, 'iPad create action has no box').not.toBeNull();
	expect(heading, 'iPad wordmark has no box').not.toBeNull();
	expect(create!.width, 'iPad actions are still phone-width').toBeGreaterThanOrEqual(560);
	expect(create!.height, 'iPad action did not receive tablet scale').toBeGreaterThanOrEqual(71.5);
	expect(heading!.height, 'iPad identity did not receive tablet scale').toBeGreaterThanOrEqual(125);
});

async function seat(browser: Browser, count: number) {
	const pages: Page[] = [];
	const closers: (() => Promise<void>)[] = [];
	for (let i = 0; i < count; i++) {
		const ctx = await browser.newContext({ viewport: TALL });
		pages.push(await ctx.newPage());
		closers.push(() => ctx.close());
	}
	const host = pages[0]!;
	await open(host, '/');
	await clickUntil('create-room', host, () => host.waitForURL(CODE_RE));
	const code = new URL(host.url()).pathname.split('/').at(-1)!;
	await open(host, `/room/${code}`);
	await host.getByTestId('nickname').fill('Ana');
	await clickUntil('join-submit', host, () =>
		expect(host.getByTestId('players-heading')).toBeVisible()
	);
	const names = ['Bo', 'Cyd', 'Dov'];
	for (let i = 1; i < count; i++) await joinRoom(pages[i]!, code, names[i - 1]!);
	for (const p of pages) await expect(p.getByTestId('player-card')).toHaveCount(count);
	return { pages, host, close: async () => { for (const c of closers) await c(); } };
}

test('the lobby and the answering screen hold up at 390x420', async ({
	browser
}) => {
	test.setTimeout(300_000);
	const { pages, host, close } = await seat(browser, 3);

	// ------------------------------------------------------------ the lobby
	for (const size of [TALL, SHORT]) {
		await host.setViewportSize(size);
		await expectNoPageScroll(host, `lobby ${size.height}`);
		// Every dial's buttons keep their touch target, collapsed or expanded.
		for (const key of ['questions', 'rounds']) {
			await expectUsable(host, `inc-${key}`, `lobby ${size.height}`);
			await expectUsable(host, `dec-${key}`, `lobby ${size.height}`);
		}
		await expectUsable(host, 'toggle-timings', `lobby ${size.height}`);
		// Every dial explains itself, and the disclosure keeps a real touch
		// target — the label and the (i) are one control for exactly that reason.
		for (const key of ['questions', 'rounds']) {
			await expectUsable(host, `help-${key}`, `lobby ${size.height}`);
		}
		// Start is the lobby's primary action and is pinned, not scrolled to.
		await expectPinned(host, 'start-game', `lobby ${size.height}`);
	}

	// The timing disclosure open is the worst case for this screen.
	await host.setViewportSize(SHORT);
	// Opening a dial's explanation must not push the primary action off screen
	// or start the page scrolling — it lands inside the panel's scroll region.
	await host.getByTestId('help-questions').click();
	await expect(host.getByTestId('help-text-questions')).toBeVisible();
	await expectNoPageScroll(host, 'lobby 420 with help open');
	await expectPinned(host, 'start-game', 'lobby 420 with help open');
	// One at a time: opening another closes the first.
	await host.getByTestId('help-rounds').click();
	await expect(host.getByTestId('help-text-rounds')).toBeVisible();
	await expect(host.getByTestId('help-text-questions')).toHaveCount(0);
	await host.getByTestId('help-rounds').click();
	await expect(host.getByTestId('help-text-rounds')).toHaveCount(0);

	await host.getByTestId('toggle-timings').click();
	await expect(host.getByTestId('timing-fields')).toBeVisible();
	await expectNoPageScroll(host, 'lobby 420 with timings open');
	for (const key of ['answerSec', 'guessSec', 'revealSec', 'standingsEvery']) {
		await expectUsable(host, `inc-${key}`, 'lobby 420 timings');
		await expectUsable(host, `help-${key}`, 'lobby 420 timings');
	}
	// Every timing dial's explanation opens, reads, and — the part that was
	// broken until it was measured — ends up actually ON SCREEN. A dial near
	// the bottom of a scrolling panel otherwise expands below the fold, and the
	// host sees nothing happen at all.
	for (const key of ['answerSec', 'guessSec', 'revealSec', 'standingsEvery']) {
		await host.getByTestId(`help-${key}`).click();
		const text = host.getByTestId(`help-text-${key}`);
		await expect(text).toBeVisible();
		expect((await text.textContent())!.trim().length).toBeGreaterThan(30);
		await expectNoPageScroll(host, `lobby 420 with ${key} help open`);

		await host.waitForTimeout(450); // the scroll-into-view is smooth
		const box = (await text.boundingBox())!;
		const inner = await host.evaluate(() => window.innerHeight);
		// At least part of the explanation must be in the viewport.
		expect(box.y, `${key} help opened below the fold`).toBeLessThan(inner);
		expect(box.y + box.height, `${key} help opened above the fold`).toBeGreaterThan(0);

		await host.getByTestId(`help-${key}`).click();
	}
	await host.getByTestId('toggle-timings').click();

	await host.setViewportSize(TALL);
	await clickUntil('start-game', host, () => expect(host.getByTestId('intro-splash')).toBeVisible());

	// -------------------------------------------------------- the answering
	for (const p of pages) {
		await expect(p.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
	}
	for (const size of [TALL, SHORT]) {
		await host.setViewportSize(size);
		await expectNoPageScroll(host, `answering ${size.height}`);
		// Hand in is the primary action: pinned at both heights, never scrolled to.
		await expectPinned(host, 'hand-in', `answering ${size.height}`);
		await expectUsable(host, 'next-question', `answering ${size.height}`);
		await expectUsable(host, 'prev-question', `answering ${size.height}`);
		await expectUsable(host, 'leave-game', `answering ${size.height}`);
		// The entry card is the task and must be visible in full at both sizes.
		const field = await host.getByTestId('entry-field').boundingBox();
		const inner = await host.evaluate(() => window.innerHeight);
		expect(field!.y + field!.height, `answering ${size.height}: entry field clipped`)
			.toBeLessThanOrEqual(inner + 0.5);
	}

	// A deliberately long answer must not push anything off the screen.
	await host.setViewportSize(SHORT);
	await host.getByTestId('entry-field').fill('x'.repeat(140));
	await expectNoPageScroll(host, 'answering 420 with a full-length answer');
	await expectPinned(host, 'hand-in', 'answering 420 full answer');

	await host.setViewportSize(TALL);
	await close();
});

test('the standings beat holds up at 390x420', async ({ browser }) => {
	// Reaching STANDINGS costs a real guess clock and a real reveal clock, so
	// this is its own test rather than a tail on the one above.
	test.setTimeout(300_000);
	const { pages, host, close } = await seat(browser, 3);

	// One question, a beat after every round.
	await host.getByTestId('toggle-timings').click();
	await expect(host.getByTestId('timing-fields')).toBeVisible();
	const set = async (key: string, target: number) => {
		const dial = host.getByTestId(`value-${key}`);
		for (let guard = 0; guard < 80; guard++) {
			const shown = Number(await dial.getAttribute('data-value'));
			if (shown === target) break;
			await host.getByTestId(shown < target ? `inc-${key}` : `dec-${key}`).click();
		}
		expect(Number(await dial.getAttribute('data-value'))).toBe(target);
	};
	await set('questions', 1);
	await set('rounds', 2);
	await set('standingsEvery', 1);
	await host.waitForTimeout(700); // let the debounced patch reach the server

	await clickUntil('start-game', host, () => expect(host.getByTestId('intro-splash')).toBeVisible());

	for (const p of pages) {
		await expect(p.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
		await p.getByTestId('entry-field').fill(`answer from ${await p.title()}`);
		await p.getByTestId('hand-in').click();
	}

	await expect(host.getByTestId('standings-rows')).toBeVisible({ timeout: 120_000 });
	for (const size of [TALL, SHORT]) {
		await host.setViewportSize(size);
		await expectNoPageScroll(host, `standings ${size.height}`);
		await expect(host.getByTestId('standings-row')).toHaveCount(3);
		// The leave control is the only touch target on this screen and it keeps
		// its 44px at both heights.
		await expectUsable(host, 'leave-game', `standings ${size.height}`);
		// The rows scroll inside their own box, so the heading must stay put
		// rather than being pushed off by a room that grew.
		const title = await host.getByTestId('standings-title').boundingBox();
		const inner = await host.evaluate(() => window.innerHeight);
		expect(title!.y + title!.height, `standings ${size.height}: heading pushed off screen`)
			.toBeLessThanOrEqual(inner + 0.5);
	}

	await host.setViewportSize(TALL);
	await close();
});
