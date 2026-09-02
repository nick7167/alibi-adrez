/**
 * Move programmatic focus to the heading that introduces a newly mounted
 * single-page-app screen. Waiting one frame lets the DOM swap finish first,
 * while preventScroll keeps the carefully sized game shell in place.
 */
export function focusOnMount(node: HTMLElement) {
	const frame = requestAnimationFrame(() => node.focus({ preventScroll: true }));

	return {
		destroy() {
			cancelAnimationFrame(frame);
		}
	};
}
