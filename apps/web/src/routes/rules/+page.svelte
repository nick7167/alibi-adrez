<script lang="ts">
	/**
	 * The rulebook. Re-skinned in T9 onto the AHA field, and its prose rewritten
	 * for this game — it described suspects and alibis until now.
	 *
	 * The reading surface is a white card with ink text, the same surface the
	 * game reserves for answers: 18.3:1 contrast, and long-form prose is the one
	 * place on this route where legibility beats atmosphere. Everything around
	 * it (the field, the yellow eyebrows, Fredoka for headings) is the AHA
	 * system as every other screen composes it.
	 */
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/i18n';
	import { rulesContent } from '$lib/content/rules';

	const sections = $derived(rulesContent(currentLocale()));
</script>

<svelte:head>
	<title>{m['app.title']()} · {m['rules.pageTitle']()}</title>
	<meta name="theme-color" content="#4A1FD6" />
	<!-- Static style text only: dynamic/{@html} styles in svelte:head break hydration and Svelte detaches the CSS links. -->
	<style>
		html,
		html > body {
			background-color: #4a1fd6;
		}
	</style>
</svelte:head>

<main class="relative flex fill-vp flex-col overflow-hidden bg-field text-white">
	<!-- Solid bar, not a floating button: the rulebook scrolls a long way and a
	     bare button let cards slide under it and swallow their own text. -->
	<div
		class="relative z-20 flex shrink-0 items-center gap-3 bg-field px-4 pt-safe pb-3 shadow-[0_6px_12px_-8px_rgba(0,0,0,0.5)]"
	>
		<button
			type="button"
			data-testid="back-home"
			aria-label={m['nav.back']()}
			onclick={() => void goto('/')}
			class="grid size-11 shrink-0 place-items-center rounded-full border-2 border-white/30 bg-white/10 text-white"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M15 5 8 12l7 7" />
			</svg>
		</button>
	</div>

	<div class="relative min-h-0 flex-1">
		<div class="h-full overflow-x-hidden overflow-y-auto px-5 pb-safe">
			<header class="ru-header mt-4 text-center">
				<span class="text-[11px] font-extrabold tracking-[0.18em] text-action uppercase">
					{m['rules.tag']()}
				</span>
				<h1 class="ru-title mt-2 font-display text-[34px] leading-tight font-bold tracking-tight">
					{m['rules.pageTitle']()}
				</h1>
			</header>

			<div class="mt-5 flex flex-col gap-4 pb-8">
				{#each sections as section, i (section.id)}
					<section
						data-testid="rules-section"
						class="rounded-card bg-surface p-4 text-ink shadow-[0_5px_0_rgba(22,11,61,0.4)]"
					>
						<div class="flex items-baseline gap-2">
							<span class="text-xs font-extrabold text-field tabular-nums" aria-hidden="true">
								{String(i + 1).padStart(2, '0')}
							</span>
							<h2 class="font-display text-[19px] leading-tight font-semibold text-ink">
								{section.heading}
							</h2>
						</div>

						<div class="mt-3 flex flex-col gap-3">
							{#each section.blocks as block, bi (bi)}
								{#if block.type === 'paragraph'}
									<p class="text-[15px] leading-relaxed font-medium text-ink/85">
										{block.text}
									</p>
								{:else if block.type === 'list'}
									<ul class="flex flex-col gap-2">
										{#each block.items as item, li (li)}
											<li class="flex items-start gap-2 text-[15px] leading-relaxed font-medium text-ink/85">
												<span
													class="mt-2 size-1.5 shrink-0 rounded-full bg-field"
													aria-hidden="true"
												></span>
												<span>{item}</span>
											</li>
										{/each}
									</ul>
								{:else if block.type === 'steps'}
									<ol class="flex flex-col">
										{#each block.items as step, si (si)}
											<li class="flex gap-3">
												<div class="flex shrink-0 flex-col items-center">
													<span
														class="grid size-7 shrink-0 place-items-center rounded-full bg-field text-[12px] font-extrabold text-white tabular-nums"
													>
														{si + 1}
													</span>
													{#if si < block.items.length - 1}
														<span class="mt-1 mb-1 w-px flex-1 bg-ink/15" aria-hidden="true"></span>
													{/if}
												</div>
												<div class="pb-3">
													<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
														<h3 class="font-display text-[17px] font-semibold text-ink">
															{step.title}
														</h3>
														{#if step.meta}
															<span
																class="rounded-full bg-field/10 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] text-field uppercase"
															>
																{step.meta}
															</span>
														{/if}
													</div>
													<p class="mt-1 text-[14px] leading-relaxed font-medium text-ink/80">
														{step.body}
													</p>
												</div>
											</li>
										{/each}
									</ol>
								{:else if block.type === 'table'}
									<div class="overflow-x-auto rounded-[14px] border-2 border-ink/10">
										<table class="w-full border-collapse text-[13px]">
											<thead>
												<tr class="bg-ink/5">
													{#each block.headers as head, hi (hi)}
														<th
															class="px-3 py-2 text-left text-[10px] font-extrabold tracking-[0.14em] text-ink/60 uppercase"
														>
															{head}
														</th>
													{/each}
												</tr>
											</thead>
											<tbody>
												{#each block.rows as row, ri (ri)}
													<tr class="border-t border-ink/10">
														{#each row as cell, ci (ci)}
															<td class="px-3 py-2 leading-snug font-semibold text-ink/85">
																{cell}
															</td>
														{/each}
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else if block.type === 'stamp'}
									<div class="flex flex-col gap-1.5 rounded-[14px] bg-field/[0.07] p-3">
										<span
											class="text-[10px] font-extrabold tracking-[0.16em] text-field uppercase"
										>
											{block.label}
										</span>
										<p class="text-[14px] leading-snug font-semibold text-ink">{block.text}</p>
									</div>
								{/if}
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
	</div>
</main>

<style>
	/* Short-viewport priority (ledger): the page title yields so the reading
	   surface keeps as much of a 420px-tall viewport as possible. */
	@media (max-height: 600px) {
		.ru-header {
			margin-top: 0.5rem;
		}

		.ru-title {
			font-size: 24px;
			margin-top: 0.25rem;
		}
	}
</style>
