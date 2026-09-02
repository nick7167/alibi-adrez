import { describe, expect, it } from 'vitest';
import {
	appRouteFromUrl,
	installAppLinkRouting,
	type AppLinkPlugin
} from '../src/lib/app-links';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('native app-link routing', () => {
	it('routes canonical room links and normalizes the room code', () => {
		expect(appRouteFromUrl('https://aha.adrez.dev/room/AB23')).toBe('/room/AB23');
		expect(appRouteFromUrl('https://aha.adrez.dev/room/ab23/?invite=1#join')).toBe('/room/AB23');
	});

	it.each([
		'http://aha.adrez.dev/room/AB23',
		'https://aha.adrez.dev:444/room/AB23',
		'https://rooms.aha.adrez.dev/room/AB23',
		'https://aha.adrez.dev.evil.test/room/AB23',
		'https://user:pass@aha.adrez.dev/room/AB23',
		'https://aha.adrez.dev/',
		'https://aha.adrez.dev/room/AB23/extra',
		'https://aha.adrez.dev/room/AI01',
		'https://aha.adrez.dev/room/%20AB23',
		'https://aha.adrez.dev/room/AB%2F23',
		'not a URL'
	])('rejects an unsupported or untrusted URL: %s', (url) => {
		expect(appRouteFromUrl(url)).toBeNull();
	});

	it('routes both a cold launch and a warm appUrlOpen event', async () => {
		let listener: ((event: { url: string }) => void) | undefined;
		let removed = false;
		const app: AppLinkPlugin = {
			async addListener(_eventName, next) {
				listener = next;
				return { remove: async () => void (removed = true) };
			},
			async getLaunchUrl() {
				return { url: 'https://aha.adrez.dev/room/AB23' };
			}
		};
		const routes: string[] = [];
		const stop = installAppLinkRouting(app, (route) => routes.push(route));
		await settle();

		expect(routes).toEqual(['/room/AB23']);
		listener?.({ url: 'https://aha.adrez.dev/room/CD45' });
		listener?.({ url: 'https://evil.test/room/EF67' });
		expect(routes).toEqual(['/room/AB23', '/room/CD45']);

		stop();
		expect(removed).toBe(true);
		listener?.({ url: 'https://aha.adrez.dev/room/GH78' });
		expect(routes).toEqual(['/room/AB23', '/room/CD45']);
	});

	it('removes a listener that settles after teardown', async () => {
		let release: (() => void) | undefined;
		let removed = false;
		const app: AppLinkPlugin = {
			async addListener() {
				await new Promise<void>((resolve) => (release = resolve));
				return { remove: async () => void (removed = true) };
			},
			async getLaunchUrl() {
				return undefined;
			}
		};
		const stop = installAppLinkRouting(app, () => {});
		stop();
		release?.();
		await settle();
		expect(removed).toBe(true);
	});
});
