<script lang="ts">
	/** Paint the html+body canvas with this screen's field color.
	 *
	 * iOS exposes the canvas in the system zones (status bar, home
	 * indicator); if it doesn't match the active screen those zones show
	 * the wrong color. Rendered via {@html} ON PURPOSE: Svelte scopes
	 * normal component styles (even in svelte:head when dynamic), which
	 * produces selectors like `html.svelte-xxx` that match nothing. Raw
	 * injection stays global, SSRs correctly, and beats every bundle rule.
	 *
	 * Usage: <CanvasColor color="#3d50e0" /> — one per page, in any position.
	 */
	let { color }: { color: string } = $props();
</script>

<svelte:head>
	{@html `<style>html,html>body{background-color:${color}}</style>`}
</svelte:head>
