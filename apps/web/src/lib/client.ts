export const IS_IOS_APP = import.meta.env.VITE_APP_PLATFORM === 'ios';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0-web';

const apiOrigin = normalizeOrigin(import.meta.env.VITE_API_BASE_URL || '');
const websocketOrigin = normalizeOrigin(import.meta.env.VITE_WS_BASE_URL || '');

export function normalizeOrigin(origin: string): string {
	return origin.trim().replace(/\/+$/, '');
}

export function apiUrl(path: string, origin = apiOrigin): string {
	const normalized = normalizeOrigin(origin);
	return normalized ? `${normalized}${path}` : path;
}

export function websocketUrl(
	path: string,
	origin = websocketOrigin,
	pageLocation?: Pick<Location, 'protocol' | 'host'>
): string {
	const normalized = normalizeOrigin(origin);
	if (normalized) return `${normalized}${path}`;
	const currentLocation = pageLocation ?? location;
	const protocol = currentLocation.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${protocol}//${currentLocation.host}${path}`;
}
