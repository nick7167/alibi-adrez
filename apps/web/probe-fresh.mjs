import { webkit, devices } from '@playwright/test';
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13 Pro'] });
const page = await ctx.newPage();
await page.goto('http://localhost:4178/?fresh=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(800);
const info = await page.evaluate(() => ({
	htmlBg: getComputedStyle(document.documentElement).backgroundColor,
	bodyBg: getComputedStyle(document.body).backgroundColor
}));
console.log('FRESH SSR LOAD:', JSON.stringify(info));
await browser.close();
