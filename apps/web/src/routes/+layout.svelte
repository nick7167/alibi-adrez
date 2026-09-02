<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { installAppLinkRouting } from '$lib/app-links';

	let { children } = $props();
	const loadNativeApp = import.meta.env.VITE_APP_PLATFORM === 'ios'
		? () => import('@capacitor/app')
		: null;

	/* iOS keeps the layout viewport fixed and lets the keyboard cover the
	   lower half, so once a text field gains focus (and the keyboard has
	   animated in), gently scroll it toward the middle where it's visible.
	   `interactive-widget=resizes-content` handles Android Chrome. */
	function handleFocusIn(event: Event) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
		setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
	}

	/* Universal links use the same /room/<code> path in the browser and native
	   app. The official App plugin covers both a cold launch and a link received
	   while the app is already running. It is loaded only by the iOS build, and
	   the parser accepts only the canonical HTTPS origin and valid room codes. */
	onMount(() => {
		if (loadNativeApp === null) return;

		let mounted = true;
		let stopRouting: (() => void) | undefined;

		void loadNativeApp()
			.then(({ App }) => {
				if (!mounted) return;
				stopRouting = installAppLinkRouting(App, (route) => {
					if (route !== window.location.pathname) void goto(route);
				});
			})
			.catch(() => {
				// Keep the static app usable if its native bridge cannot load.
			});

		return () => {
			mounted = false;
			stopRouting?.();
		};
	});
</script>

<svelte:window onfocusin={handleFocusIn} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
