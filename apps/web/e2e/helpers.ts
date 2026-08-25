import { expect, type Page } from '@playwright/test';
import { appendFileSync } from 'node:fs';

export const CODE_RE = /\/room\/[A-HJ-KMNP-Z2-9]{4}$/; // shared ROOM_CODE_ALPHABET (no I/L/O/0/1)

const TRACE_LOG = process.env.AHA_E2E_LOG ?? '';

/** Attach console/network diagnostics to a page (written when AHA_E2E_LOG is set). */
export function watch(page: Page, label: string) {
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
export async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Click a control and keep re-clicking until its expected effect shows up.
 * Guards against clicks landing before SvelteKit has finished hydrating.
 */
export async function clickUntil(testid: string, page: Page, effect: () => Promise<unknown>) {
	await expect(async () => {
		await page.getByTestId(testid).click();
		await effect();
	}).toPass({ timeout: 15_000 });
}

/** Guest join flow via the landing page's join box, ending inside the lobby. */
export async function joinRoom(page: Page, code: string, name: string) {
	await open(page, '/');
	await clickUntil('join-toggle', page, () => expect(page.getByTestId('join-input')).toBeVisible());
	await page.getByTestId('join-input').fill(code.toLowerCase());
	await clickUntil('join-go', page, () => page.waitForURL(CODE_RE));
	await page.getByTestId('nickname').fill(name);
	await clickUntil('join-submit', page, () =>
		expect(page.getByTestId('players-heading')).toBeVisible()
	);
}
