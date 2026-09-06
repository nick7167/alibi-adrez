import { expect, test } from '@playwright/test';
import { CODE_RE, clickUntil, open } from './helpers';

test('a lone host sees the normal multiplayer lobby without practice bots', async ({ page }) => {
	await open(page, '/');
	await clickUntil('create-room', page, () => page.waitForURL(CODE_RE));
	await page.getByTestId('nickname').fill('Reviewer');
	await clickUntil('join-submit', page, () => expect(page.getByTestId('players-heading')).toBeVisible());
	await expect(page.getByTestId('player-card')).toHaveCount(1);
	await expect(page.getByTestId('start-game')).toBeDisabled();
	await expect(page.getByTestId('practice-game')).toHaveCount(0);
	await expect(page.getByTestId('bot-tag')).toHaveCount(0);
	await page.reload();
	await expect(page.getByTestId('player-card')).toHaveCount(1);
	await expect(page.getByTestId('practice-game')).toHaveCount(0);
	await page.getByTestId('leave-game').click();
	await expect(page).toHaveURL('/');
});
