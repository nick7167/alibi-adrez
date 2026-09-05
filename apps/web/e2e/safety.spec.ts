import { expect, test } from '@playwright/test';
import { CODE_RE, clickUntil, joinRoom, open, watch } from './helpers';

test('filters names, persists local blocking, exposes reporting, and lets the host remove a player', async ({
	browser
}) => {
	const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const rejectedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const host = await hostContext.newPage();
	const guest = await guestContext.newPage();
	const rejected = await rejectedContext.newPage();
	watch(host, 'SAFETY-HOST');
	watch(guest, 'SAFETY-GUEST');
	watch(rejected, 'SAFETY-REJECTED');

	await open(host, '/');
	await clickUntil('create-room', host, () => host.waitForURL(CODE_RE));
	const code = new URL(host.url()).pathname.split('/').at(-1)!;
	await open(host, `/room/${code}`);
	await host.getByTestId('nickname').fill('Host');
	await clickUntil('join-submit', host, () => expect(host.getByTestId('players-heading')).toBeVisible());
	await joinRoom(guest, code, 'Guest');

	// The deterministic server filter rejects the name before a room identity
	// is issued; the join form remains usable for a rewritten nickname.
	await open(rejected, `/room/${code}`);
	await rejected.getByTestId('nickname').fill('N1gg3r');
	await rejected.getByTestId('join-submit').click();
	await expect(rejected.getByText('That text cannot be used. Please rewrite it.')).toBeVisible();
	await expect(rejected.getByTestId('join-submit')).toBeVisible();

	// A guest can mask another participant locally. Protocol ids and the room
	// roster remain intact, and the choice survives a reload/reconnect.
	await guest.getByTestId('player-actions').first().click();
	await expect(guest.getByTestId('player-safety-actions')).toBeVisible();
	await expect(guest.getByText('Report player')).toBeVisible();
	await guest.getByText('Hide player').click();
	await expect(guest.getByTestId('player-name')).toHaveText(['Hidden player', 'Guest']);
	await guest.reload();
	await expect(guest.getByTestId('players-heading')).toBeVisible();
	await expect(guest.getByTestId('player-name')).toHaveText(['Hidden player', 'Guest']);

	// The host removal revokes the guest's active session and returns that
	// client to the landing page with a human-readable explanation.
	await host.getByTestId('player-actions').click();
	await host.getByText('Remove from room').click();
	await host.getByTestId('kick-confirm-confirm').click();
	await expect(host.getByTestId('player-card')).toHaveCount(1);
	await expect(guest.getByText('The host removed you from the room.')).toBeVisible();
	await expect(guest).toHaveURL('/');

	await hostContext.close();
	await guestContext.close();
	await rejectedContext.close();
});

test('community rules and support are reachable from the landing page', async ({ page }) => {
	await open(page, '/');
	await page.getByRole('link', { name: 'Community rules' }).click();
	await expect(page.getByRole('heading', { name: 'Community rules' })).toBeVisible();
	await page.goto('/');
	await page.getByRole('link', { name: 'Support' }).click();
	await expect(page.getByRole('heading', { name: 'Support and reports' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'support@adrez.dev' })).toBeVisible();
});

for (const lang of ['en', 'da'] as const) {
test(`saved room logins require confirmation and safety preferences survive deletion (${lang})`, async ({ page, baseURL }) => {
	await page.context().addCookies([{ name: 'PARAGLIDE_LOCALE', value: lang, url: baseURL! }]);
	await open(page, '/support');
	await page.evaluate(() => {
		localStorage.setItem('aha:identity:AB23', 'expired login');
		localStorage.setItem('aha:identity:CD45', 'another login');
		localStorage.setItem('aha:safety:blocked:AB23', '["hidden-player"]');
	});
	const trigger = page.getByTestId('delete-room-logins');
	await expect(trigger).toHaveText(lang === 'da' ? 'Slet gemte rumlogin' : 'Delete saved room logins');
	await trigger.click();
	await expect(page.getByTestId('delete-logins-confirm-cancel')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(trigger).toBeFocused();
	expect(await page.evaluate(() => localStorage.getItem('aha:identity:AB23'))).toBe('expired login');
	await trigger.click();
	await page.getByTestId('delete-logins-confirm-confirm').click();
	await expect(page.getByRole('status')).toHaveText(lang === 'da'
		? 'Dine gemte rumlogin er slettet fra denne enhed.'
		: 'Your saved room logins have been deleted from this device.');
	await expect(trigger).toBeFocused();
	await page.reload();
	expect(await page.evaluate(() => ({
		first: localStorage.getItem('aha:identity:AB23'),
		second: localStorage.getItem('aha:identity:CD45'),
		blocked: localStorage.getItem('aha:safety:blocked:AB23')
	}))).toEqual({ first: null, second: null, blocked: '["hidden-player"]' });
});
}

test('the current anonymous answer can be hidden, restored, and reported', async ({ browser }) => {
	const contexts = await Promise.all([
		browser.newContext({ viewport: { width: 390, height: 844 } }),
		browser.newContext({ viewport: { width: 390, height: 844 } }),
		browser.newContext({ viewport: { width: 390, height: 844 } }),
	]);
	const pages = await Promise.all(contexts.map((context) => context.newPage()));
	pages.forEach((page, index) => watch(page, `ANSWER-SAFETY-${index}`));
	const [host, guestA, guestB] = pages as [typeof pages[number], typeof pages[number], typeof pages[number]];

	await open(host, '/');
	await clickUntil('create-room', host, () => host.waitForURL(CODE_RE));
	const code = new URL(host.url()).pathname.split('/').at(-1)!;
	await open(host, `/room/${code}`);
	await host.getByTestId('nickname').fill('Host');
	await clickUntil('join-submit', host, () => expect(host.getByTestId('players-heading')).toBeVisible());
	await joinRoom(guestA, code, 'GuestA');
	await joinRoom(guestB, code, 'GuestB');

	// One question gets the test to the anonymous stage without waiting for
	// unused form pages. startGame flushes the lobby's debounced patch.
	for (let i = 0; i < 4; i++) await host.getByTestId('dec-questions').click();
	await host.getByTestId('start-game').click();
	for (const page of pages) await expect(page.getByTestId('entry-field')).toBeVisible({ timeout: 30_000 });
	for (const [index, page] of pages.entries()) {
		await page.getByTestId('entry-field').fill(`safe-answer-${index}`);
		await page.getByTestId('hand-in').click();
	}
	await expect(host.getByTestId('staged-answer')).toBeVisible({ timeout: 30_000 });
	const original = await host.getByTestId('staged-answer').textContent();

	await host.getByRole('button', { name: 'Answer safety options' }).click();
	await expect(host.getByRole('button', { name: 'Report answer' })).toBeVisible();
	await host.getByRole('button', { name: 'Hide answer' }).click();
	await expect(host.getByTestId('staged-answer')).toHaveText('Hidden answer');
	await host.getByRole('button', { name: 'Answer safety options' }).click();
	await host.getByRole('button', { name: 'Show answer' }).click();
	await expect(host.getByTestId('staged-answer')).toHaveText(original ?? '');

	await Promise.all(contexts.map((context) => context.close()));
});
