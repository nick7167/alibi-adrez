import { expect, test, type Page } from '@playwright/test';
import { appendFileSync } from 'node:fs';

const CODE_RE = /\/room\/[A-HJ-KMNP-Z2-9]{4}$/; // shared ROOM_CODE_ALPHABET (no I/L/O/0/1)
const TRACE_LOG = process.env.ALIBI_E2E_LOG ?? '';

/** Attach console/network diagnostics to a page (written when ALIBI_E2E_LOG is set). */
function watch(page: Page, label: string) {
	if (!TRACE_LOG) return;
	page.on('console', (msg) =>
		appendFileSync(TRACE_LOG, `${label} CONSOLE ${msg.type()} ${msg.text()}\n`)
	);
	page.on('pageerror', (err) => appendFileSync(TRACE_LOG, `${label} PAGEERROR ${err.message}\n`));
	page.on('requestfailed', (req) =>
		appendFileSync(TRACE_LOG, `${label} REQFAIL ${req.url()} ${req.failure()?.errorText}\n`)
	);
	page.on('response', (res) => {
		if (!res.ok()) appendFileSync(TRACE_LOG, `${label} HTTP ${res.status()} ${res.url()}\n`);
	});
}

/**
 * Navigate and wait until the dev-server module waterfall settles, so
 * SvelteKit has hydrated before interactions begin.
 */
async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Click a control and keep re-clicking until its expected effect shows up.
 * Guards against clicks landing before SvelteKit has finished hydrating.
 */
async function clickUntil(testid: string, page: Page, effect: () => Promise<unknown>) {
	await expect(async () => {
		await page.getByTestId(testid).click();
		await effect();
	}).toPass({ timeout: 15_000 });
}

test('create → guest joins → both see 2 players → host starts (INTRO splash)', async ({
	browser
}) => {
	// Host on a phone-sized viewport; guest on a desktop one.
	const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const guestCtx = await browser.newContext();
	const host = await hostCtx.newPage();
	const guest = await guestCtx.newPage();
	watch(host, 'HOST');
	watch(guest, 'GUEST');

	// 1. Host creates a room on the landing page.
	await open(host, '/');
	await clickUntil('create-room', host, () => host.waitForURL(CODE_RE));
	const code = new URL(host.url()).pathname.split('/').at(-1)!;
	expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);

	// 2. Host picks a nickname and enters the lobby.
	await open(host, `/room/${code}`);
	await host.getByTestId('nickname').fill('Host');
	await clickUntil('join-submit', host, () =>
		expect(host.getByTestId('players-heading')).toBeVisible()
	);

	// 3. Guest joins via the landing join box (input is uppercased).
	await open(guest, '/');
	await clickUntil('join-toggle', guest, () => expect(guest.getByTestId('join-input')).toBeVisible());
	await guest.getByTestId('join-input').fill(code.toLowerCase());
	await clickUntil('join-go', guest, () => guest.waitForURL(CODE_RE));
	expect(new URL(guest.url()).pathname.split('/').at(-1)).toBe(code); // uppercased by the UI
	await guest.getByTestId('nickname').fill('Guest');
	await clickUntil('join-submit', guest, () =>
		expect(guest.getByTestId('players-heading')).toBeVisible()
	);

	// 4. Both clients see the same two-player lobby.
	await expect(host.getByTestId('player-card')).toHaveCount(2);
	await expect(guest.getByTestId('player-card')).toHaveCount(2);
	await expect(guest.getByText('Host', { exact: true })).toBeVisible();
	await expect(host.getByText('Guest', { exact: true })).toBeVisible();

	// 5. Only the host sees settings + start; non-host sees the waiting note.
	await expect(guest.getByTestId('start-game')).toHaveCount(0);
	await expect(guest.getByTestId('waiting-host')).toBeVisible();

	// 6. Host tweaks a setting (debounced patch round-trips through the server).
	await expect(host.getByTestId('value-rounds')).toHaveText('3');
	await host.getByTestId('inc-rounds').click();
	await expect(host.getByTestId('value-rounds')).toHaveText('4');
	await host.waitForTimeout(700); // debounce (300ms) + server broadcast round-trip
	await expect(host.getByTestId('value-rounds')).toHaveText('4'); // not reverted

	// 7. Host starts the game → INTRO splash on both clients.
	await clickUntil('start-game', host, () => expect(host.getByTestId('intro-splash')).toBeVisible());
	await expect(guest.getByTestId('intro-splash')).toBeVisible();

	await hostCtx.close();
	await guestCtx.close();
});
