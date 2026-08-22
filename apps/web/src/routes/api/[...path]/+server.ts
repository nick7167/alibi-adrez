import type { RequestHandler } from "./$types";

const handler: RequestHandler = async ({ platform, request }) => {
	const binding = platform?.env?.ROOMS;
	if (!binding) return new Response("rooms unavailable", { status: 503 });

	// Same-origin /api/* facade: rewrite only the origin, keep path + query.
	// Called as fetch(url, init) with primitive inputs on purpose: a Request
	// object built by the Node-side runtime cannot be re-wrapped by the
	// platform proxy's own Request implementation (it would be stringified),
	// whereas url + plain init round-trips everywhere — workerd included.
	// Method, headers and the streaming body carry over, so REST bodies and
	// WebSocket upgrade handshakes both survive the hop.
	const incoming = new URL(request.url);
	const target = new URL(incoming.pathname + incoming.search, "https://rooms.internal");
	const init: RequestInit & { duplex?: "half" } = {
		method: request.method,
		headers: request.headers,
		body: request.body
	};
	if (init.body) init.duplex = "half";
	return binding.fetch(target, init);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const HEAD = handler;
export const OPTIONS = handler;
