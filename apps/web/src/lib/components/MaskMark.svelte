<script lang="ts">
	/** The Alibi mark: a comedy/tragedy mask pair, drawn (never the 🎭 glyph)
	 *  so it scales, recolours and prints. Part of the concept-D system —
	 *  the mark itself is "play", so it stays in the bright palette. */
	let { size = 92, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={Math.round((size * 76) / 104)}
	viewBox="0 0 104 76"
	fill="none"
	class={className}
	aria-hidden="true"
>
	<path
		d="M6 20c0-6 5-10 19-10s19 4 19 10c0 22-8 36-19 36S6 42 6 20Z"
		fill="var(--color-cobalt)"
		stroke="var(--color-ink)"
		stroke-width="4"
		stroke-linejoin="round"
	/>
	<path d="M6 20c-3-1-5 1-5 4s2 5 5 5" stroke="var(--color-ink)" stroke-width="4" stroke-linecap="round" />
	<path d="M44 20c3-1 5 1 5 4s-2 5-5 5" stroke="var(--color-ink)" stroke-width="4" stroke-linecap="round" />
	<ellipse cx="18" cy="27" rx="3.6" ry="4.4" fill="var(--color-paper)" />
	<ellipse cx="32" cy="27" rx="3.6" ry="4.4" fill="var(--color-paper)" />
	<path d="M18 39c4 4 10 4 14 0" stroke="var(--color-paper)" stroke-width="3.6" stroke-linecap="round" />

	<path
		d="M60 26c0-6 5-10 19-10s19 4 19 10c0 22-8 36-19 36S60 48 60 26Z"
		fill="var(--color-coral)"
		stroke="var(--color-ink)"
		stroke-width="4"
		stroke-linejoin="round"
	/>
	<path d="M60 26c-3-1-5 1-5 4s2 5 5 5" stroke="var(--color-ink)" stroke-width="4" stroke-linecap="round" />
	<path d="M98 26c3-1 5 1 5 4s-2 5-5 5" stroke="var(--color-ink)" stroke-width="4" stroke-linecap="round" />
	<ellipse cx="72" cy="33" rx="3.6" ry="4.4" fill="var(--color-paper)" />
	<ellipse cx="86" cy="33" rx="3.6" ry="4.4" fill="var(--color-paper)" />
	<path d="M72 48c4-4 10-4 14 0" stroke="var(--color-paper)" stroke-width="3.6" stroke-linecap="round" />
</svg>
