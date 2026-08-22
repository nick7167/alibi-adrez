import type { RequestHandler } from "./$types";

const handler: RequestHandler = async ({ platform, request }) => {
	const binding = platform?.env?.ROOMS;
	if (!binding) return new Response("rooms unavailable", { status: 503 });

	// Same-origin /api/* facade: rewrite only the origin, keep path + query.
	// Passing the original request as init preserves method, headers, the
	// streaming body untouched, and WebSocket upgrade headers (service
	// bindings pass upgrades through fetch).
	const incoming = new URL(request.url);
	const target = new URL(incoming.pathname + incoming.search, "https://rooms.internal");
	return binding.fetch(new Request(target, request));
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const HEAD = handler;
export const OPTIONS = handler;
