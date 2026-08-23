<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	/* iOS keeps the layout viewport fixed and lets the keyboard cover the
	   lower half, so once a text field gains focus (and the keyboard has
	   animated in), gently scroll it toward the middle where it's visible.
	   `interactive-widget=resizes-content` handles Android Chrome. */
	function handleFocusIn(event: Event) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
		setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
	}
</script>

<svelte:window onfocusin={handleFocusIn} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
