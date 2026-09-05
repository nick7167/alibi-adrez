<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { SUPPORT_EMAIL } from '$lib/safety';
	import type { Snippet } from 'svelte';

	let {
		title,
		tag,
		sections,
		showContact = false,
		children
	}: {
		title: string;
		tag: string;
		sections: { heading: string; body?: string; bullets?: string[] }[];
		showContact?: boolean;
		children?: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{m['app.title']()} · {title}</title>
	<meta name="theme-color" content="#4A1FD6" />
	<style>
		html,
		html > body {
			background-color: #4a1fd6;
		}
	</style>
</svelte:head>

<main class="relative flex fill-vp flex-col overflow-hidden bg-field text-white">
	<header class="relative z-20 flex shrink-0 items-center bg-field px-4 pt-safe pb-3 shadow-[0_6px_12px_-8px_rgba(0,0,0,0.5)]">
		<a
			href="/"
			aria-label={m['nav.back']()}
			class="grid size-11 place-items-center rounded-full border-2 border-white/30 bg-white/10"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M15 5 8 12l7 7" />
			</svg>
		</a>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-safe">
		<div class="mx-auto w-full max-w-2xl py-5">
			<div class="text-center">
				<span class="text-[11px] font-extrabold tracking-[0.18em] text-action uppercase">{tag}</span>
				<h1 class="mt-2 font-display text-[34px] leading-tight font-bold">{title}</h1>
			</div>

			<div class="mt-5 flex flex-col gap-4 pb-8">
				{#each sections as section (section.heading)}
					<section class="rounded-card bg-surface p-5 text-ink shadow-[0_5px_0_rgba(22,11,61,0.4)]">
						<h2 class="font-display text-xl font-semibold">{section.heading}</h2>
						{#if section.body}
							<p class="mt-3 text-[15px] leading-relaxed font-medium text-ink/85">{section.body}</p>
						{/if}
						{#if section.bullets}
							<ul class="mt-3 flex flex-col gap-2">
								{#each section.bullets as item (item)}
									<li class="flex items-start gap-2 text-[15px] leading-relaxed font-medium text-ink/85">
										<span class="mt-2 size-1.5 shrink-0 rounded-full bg-field" aria-hidden="true"></span>
										<span>{item}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/each}

				{@render children?.()}

				{#if showContact}
					<a
						href={`mailto:${SUPPORT_EMAIL}`}
						class="flex min-h-14 items-center justify-center rounded-full bg-action px-6 font-display text-lg font-bold text-ink shadow-[0_5px_0_rgba(22,11,61,0.4)]"
					>{SUPPORT_EMAIL}</a>
				{/if}
			</div>
		</div>
	</div>
</main>
