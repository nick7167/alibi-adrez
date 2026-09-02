import { isValidRoomCode } from '@aha/shared';

export const AHA_APP_LINK_ORIGIN = 'https://aha.adrez.dev';

interface AppUrlListenerHandle {
	remove(): Promise<void>;
}

export interface AppLinkPlugin {
	addListener(
		eventName: 'appUrlOpen',
		listener: (event: { url: string }) => void
	): Promise<AppUrlListenerHandle>;
	getLaunchUrl(): Promise<{ url: string } | undefined>;
}

/**
 * Turn an AHA room universal link into the equivalent in-app route.
 *
 * Only the canonical HTTPS origin and a single room path are accepted. Keeping
 * this parser deliberately narrow prevents an external URL from becoming an
 * open redirect or from navigating the native web view to an unsupported page.
 */
export function appRouteFromUrl(value: string): string | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (url.origin !== AHA_APP_LINK_ORIGIN || url.username !== '' || url.password !== '') return null;
	const match = /^\/room\/([^/]+)\/?$/.exec(url.pathname);
	const rawCode = match?.[1];
	if (rawCode === undefined) return null;

	let code: string;
	try {
		code = decodeURIComponent(rawCode).toUpperCase();
	} catch {
		return null;
	}

	return isValidRoomCode(code) ? `/room/${code}` : null;
}

/**
 * Bridge both warm-link events and a cold-launch URL into the app router.
 * Returns synchronously so a Svelte onMount cleanup can stop a listener even
 * while the native plugin promises are still settling.
 */
export function installAppLinkRouting(
	app: AppLinkPlugin,
	navigate: (route: string) => void
): () => void {
	let disposed = false;
	let handle: AppUrlListenerHandle | undefined;
	const open = (url: string) => {
		if (disposed) return;
		const route = appRouteFromUrl(url);
		if (route !== null) navigate(route);
	};

	void (async () => {
		const installed = await app.addListener('appUrlOpen', ({ url }) => open(url));
		if (disposed) {
			await installed.remove();
			return;
		}
		handle = installed;
		const launch = await app.getLaunchUrl();
		if (launch !== undefined) open(launch.url);
	})().catch(() => {
		// A missing native bridge must leave the static app usable. Do not log
		// the incoming URL because a room code is user/session context.
	});

	return () => {
		disposed = true;
		void handle?.remove();
	};
}
