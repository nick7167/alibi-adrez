import { test, expect } from '@playwright/test';

test('approved identity and localized privacy link fit phone and tablet screens', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 420 }, { width: 1032, height: 1376 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hvem mon?');
    await expect(page).toHaveTitle('Hvem mon?');
    const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(heading).not.toBeNull();
    expect(heading!.x).toBeGreaterThanOrEqual(0);
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.locator('h1').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const [language, label, url] of [
      ['da', 'Privatliv', 'https://adrez.dev/aha/privacy'],
      ['en', 'Privacy', 'https://adrez.dev/aha/en/privacy'],
    ]) {
      const privacy = page.getByRole('link', { name: label, exact: true });
      // SSR text can be visible before handlers hydrate. Retry the language
      // action until its resulting localized link is present.
      await expect(async () => {
        await page.getByRole('button', { name: language, exact: true }).click();
        await expect(privacy).toHaveAttribute('href', url, { timeout: 1000 });
      }).toPass({ timeout: 15000 });
      await expect(privacy).toHaveAttribute('target', '_blank');
    }
  }
});
