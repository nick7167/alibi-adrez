import { expect, test } from '@playwright/test';
import { CODE_RE, clickUntil, open } from './helpers';

for (const locale of ['da', 'en']) {
for (const size of [
	{ width: 390, height: 844, label: 'iphone' },
	{ width: 390, height: 420, label: 'iphone-keyboard-height' },
	{ width: 320, height: 420, label: 'small-phone-keyboard-height' },
	{ width: 1032, height: 1376, label: 'ipad' }
]) {
	test(`join navigation stays clear of the form: ${locale} ${size.label}`, async ({ page }, testInfo) => {
		await page.setViewportSize(size);
		await open(page, '/');
		await expect(async () => {
			await page.getByRole('button', { name: locale, exact: true }).click();
			await expect(page.getByTestId('create-room')).toHaveText(locale === 'da' ? 'Opret rum' : 'Create room');
		}).toPass();
		await clickUntil('create-room', page, () => page.waitForURL(CODE_RE));
		const input = page.getByTestId('nickname');
		await expect(input).toBeVisible();
		// Desktop browser engines expose zero safe-area insets. Emulate the
		// resulting iPhone top padding, not a real software keyboard or native test.
		await page.addStyleTag({ content: '.join-navigation { padding-top: 59px !important; }' });
		await input.fill('Nicklas');
		await page.waitForTimeout(400); // let the existing card entrance settle

		const back = page.getByTestId('back-home');
		const navigation = (await back.boundingBox())!;
		const scroll = (await page.getByTestId('join-scroll').boundingBox())!;
		expect(navigation.height).toBeGreaterThanOrEqual(44);
		expect(navigation.y).toBeGreaterThanOrEqual(59);
		expect(scroll.y - navigation.y - navigation.height).toBeGreaterThanOrEqual(16);
		await expect(back).toBeVisible();
		await back.click({ trial: true }); // catches any overlay intercepting taps
		const field = (await input.boundingBox())!;
		expect(field.y).toBeGreaterThanOrEqual(scroll.y);
		expect(field.y + field.height).toBeLessThanOrEqual(size.height);
		const submit = (await page.getByTestId('join-submit').boundingBox())!;
		expect(submit.y + submit.height).toBeLessThanOrEqual(size.height);
		expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(size.height);
		await page.screenshot({ path: testInfo.outputPath(`${size.label}.png`) });

		// Scrolling the avatar picker must never scroll the card over navigation.
		await page.getByTestId('join-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
		await back.click();
		await expect(page).toHaveURL('/');
		await expect(page.getByTestId('create-room')).toBeVisible();
	});
}
}
