import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale))
		}).then((response) => {
			// HTML documents must never be reused across deploys: a stale
			// document references hashed chunks that no longer exist, which
			// crashes the app on load. Immutable /_app/* assets keep their
			// own long-lived caching (served by the assets layer, not here).
			const isHtml = (response.headers.get('content-type') ?? '').includes('text/html');
			if (isHtml && !response.headers.has('cache-control')) {
				response.headers.set('cache-control', 'no-store');
			}
			return response;
		});
	});

export const handle: Handle = handleParaglide;
