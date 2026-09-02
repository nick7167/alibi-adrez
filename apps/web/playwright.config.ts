import { defineConfig } from '@playwright/test';

const webPort = Number(process.env.AHA_E2E_WEB_PORT ?? 5173);
const roomsPort = Number(process.env.AHA_E2E_ROOMS_PORT ?? 8787);

export default defineConfig({
	testDir: 'e2e',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${webPort}`,
		headless: true
	},
	webServer: [
		{
			command: `pnpm --filter @aha/rooms exec wrangler dev --port ${roomsPort} --var ALLOWED_ORIGINS:http://localhost:${webPort}`,
			url: `http://localhost:${roomsPort}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000
		},
		{
			command: `AHA_ROOMS_DEV_ORIGIN=http://localhost:${roomsPort} pnpm --filter web dev --port ${webPort} --strictPort`,
			url: `http://localhost:${webPort}`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000
		}
	]
});
