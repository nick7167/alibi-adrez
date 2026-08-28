import { expect, test } from '@playwright/test';
import { CODE_RE, clickUntil, joinRoom, open, watch } from './helpers';

test('create → two guests join → all see 3 players → host starts (INTRO splash)', async ({
	browser
}) => {
	// Host on a phone-sized viewport; guests on desktop ones.
	const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const guestCtx = await browser.newContext();
	const guest2Ctx = await browser.newContext();
	const host = await hostCtx.newPage();
	const guest = await guestCtx.newPage();
	const guest2 = await guest2Ctx.newPage();
	watch(host, 'HOST');
	watch(guest, 'GUEST');
	watch(guest2, 'GUEST2');

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
	await joinRoom(guest, code, 'Guest');
	expect(new URL(guest.url()).pathname.split('/').at(-1)).toBe(code); // uppercased by the UI

	// 4. Both clients see the same two-player lobby — but the game can't
	// start yet (MIN_PLAYERS is 3). The host sees the "need 3" note and a
	// disabled button.
	await expect(host.getByTestId('player-card')).toHaveCount(2);
	await expect(guest.getByTestId('player-card')).toHaveCount(2);
	await expect(host.getByTestId('start-game')).toBeDisabled();
	await expect(host.getByText('Need at least 3 players to start.')).toBeVisible();

	// 5. Second guest joins → three players.
	await joinRoom(guest2, code, 'Guest2');

	// 6. All three clients see the same three-player lobby.
	await expect(host.getByTestId('player-card')).toHaveCount(3);
	await expect(guest.getByTestId('player-card')).toHaveCount(3);
	await expect(guest2.getByTestId('player-card')).toHaveCount(3);
	// Target the name explicitly: the host's row also carries a "Host" stamp,
	// so a bare text lookup matches two elements.
	await expect(guest.getByTestId('player-name')).toHaveText(['Host', 'Guest', 'Guest2']);
	await expect(host.getByTestId('player-name')).toHaveText(['Host', 'Guest', 'Guest2']);

	// 7. Only the host sees settings + start; non-hosts see the waiting note.
	await expect(guest.getByTestId('start-game')).toHaveCount(0);
	await expect(guest.getByTestId('waiting-host')).toBeVisible();
	await expect(guest2.getByTestId('waiting-host')).toBeVisible();

	// 8. Host tweaks a setting (debounced patch round-trips through the server).
	await expect(host.getByTestId('value-questions')).toHaveText('5'); // DEFAULT_SETTINGS.questions
	await host.getByTestId('inc-questions').click();
	await expect(host.getByTestId('value-questions')).toHaveText('6');
	await host.waitForTimeout(700); // debounce (300ms) + server broadcast round-trip
	await expect(host.getByTestId('value-questions')).toHaveText('6'); // not reverted

	// 8b. The timing dials live behind a disclosure — six dials plus four pack
	// switches do not fit flat at 390x420.
	await expect(host.getByTestId('timing-fields')).toHaveCount(0);
	await host.getByTestId('toggle-timings').click();
	await expect(host.getByTestId('timing-fields')).toBeVisible();
	await expect(host.getByTestId('value-answerSec')).toHaveText('180'); // DEFAULT answerSec
	await expect(host.getByTestId('length-estimate')).toBeVisible();

	// 9. Start is now enabled with three players → host starts the game →
	// INTRO splash on every client.
	await expect(host.getByTestId('start-game')).toBeEnabled();
	await clickUntil('start-game', host, () => expect(host.getByTestId('intro-splash')).toBeVisible());
	await expect(guest.getByTestId('intro-splash')).toBeVisible();
	await expect(guest2.getByTestId('intro-splash')).toBeVisible();

	await hostCtx.close();
	await guestCtx.close();
	await guest2Ctx.close();
});
