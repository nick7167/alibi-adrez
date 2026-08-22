import { getLocale, setLocale as paraglideSetLocale } from '$lib/paraglide/runtime';

export type Locale = 'en' | 'da';

export function currentLocale(): Locale {
	return getLocale() as Locale;
}

/**
 * Sets the locale via Paraglide's configured strategies (cookie) — the runtime
 * reloads the document by default so the middleware resolves the new locale server-side.
 */
export async function setLocale(locale: Locale): Promise<void> {
	await paraglideSetLocale(locale);
}
