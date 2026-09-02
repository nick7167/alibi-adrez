import { getLocale, setLocale as paraglideSetLocale } from '$lib/paraglide/runtime';

export type Locale = 'en' | 'da';

export function currentLocale(): Locale {
	return getLocale() as Locale;
}

/**
 * Sets the locale via Paraglide's configured persistence strategy. The web
 * build uses a cookie; the Capacitor build uses localStorage because it runs
 * on a custom URL scheme. Paraglide reloads the document by default.
 */
export async function setLocale(locale: Locale): Promise<void> {
	await paraglideSetLocale(locale);
}
