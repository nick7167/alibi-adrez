<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale } from '$lib/i18n';
	import { rulesContent } from '$lib/content/rules';

	const sections = $derived(rulesContent(currentLocale()));
</script>

<svelte:head>
	<title>{m['app.title']()} · {m['rules.pageTitle']()}</title>
	<meta name="theme-color" content="#fff6ea" />
	<!-- Static style text only: dynamic/{@html} styles in svelte:head break hydration and Svelte detaches the CSS links. -->
	<style>
		html,
		html > body {
			background-color: #fff6ea;
		}
	</style>
</svelte:head>

<main class="relative flex fill-vp flex-col overflow-hidden bg-paper text-ink">
	<button
		type="button"
		data-testid="back-home"
		aria-label={m['nav.back']()}
		onclick={() => void goto('/')}
		class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 grid size-11 place-items-center rounded-full border-4 border-ink bg-paper text-ink"
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

	<div class="relative min-h-0 flex-1 pt-safe">
		<div class="h-full overflow-x-hidden overflow-y-auto px-5 pb-safe">
			<header class="mt-14 text-center">
				<span class="stamp">{m['rules.tag']()}</span>
				<h1 class="mt-3 text-[32px] leading-tight font-extrabold tracking-tight">
					{m['rules.pageTitle']()}
				</h1>
			</header>

			<div class="mt-5 flex flex-col gap-4 pb-8">
				{#each sections as section, i (section.id)}
					<section
						data-testid="rules-section"
						class="ruled rounded-card border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
					>
						<div class="flex items-baseline gap-2">
							<span class="font-mono text-xs font-bold text-coral tabular-nums" aria-hidden="true">
								{String(i + 1).padStart(2, '0')}
							</span>
							<h2 class="field-label">{section.heading}</h2>
						</div>

						<div class="mt-3 flex flex-col gap-3">
							{#each section.blocks as block, bi (bi)}
								{#if block.type === 'paragraph'}
									<p class="text-[15px] leading-relaxed font-semibold text-ink/90">
										{block.text}
									</p>
								{:else if block.type === 'list'}
									<ul class="flex flex-col gap-2">
										{#each block.items as item, li (li)}
											<li class="flex items-start gap-2 text-[15px] leading-relaxed text-ink/90">
												<span
													class="mt-2 size-1.5 shrink-0 rounded-full bg-coral"
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
														class="grid size-7 shrink-0 place-items-center rounded-full border-2 border-coral font-mono text-[11px] font-bold text-coral tabular-nums"
													>
														{si + 1}
													</span>
													{#if si < block.items.length - 1}
														<span class="mt-1 mb-1 w-px flex-1 bg-ink/15" aria-hidden="true"></span>
													{/if}
												</div>
												<div class="pb-3">
													<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
														<h3 class="text-base font-extrabold text-ink">{step.title}</h3>
														{#if step.meta}
															<span class="stamp !rotate-0 text-[9px] tracking-[0.14em]"
																>{step.meta}</span
															>
														{/if}
													</div>
													<p class="mt-1 text-[14px] leading-relaxed text-ink/85">{step.body}</p>
												</div>
											</li>
										{/each}
									</ol>
								{:else if block.type === 'table'}
									<div class="overflow-x-auto rounded-[14px] border-2 border-ink/15">
										<table class="w-full border-collapse text-[13px]">
											<thead>
												<tr class="bg-ink/5">
													{#each block.headers as head, hi (hi)}
														<th class="field-label px-3 py-2 text-left">{head}</th>
													{/each}
												</tr>
											</thead>
											<tbody>
												{#each block.rows as row, ri (ri)}
													<tr class="border-t border-ink/10">
														{#each row as cell, ci (ci)}
															<td class="px-3 py-2 leading-snug font-semibold text-ink/90">
																{cell}
															</td>
														{/each}
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else if block.type === 'stamp'}
									<div
										class="flex items-start gap-3 rounded-[14px] border-2 border-dashed border-coral bg-coral/10 p-3"
									>
										<span class="stamp shrink-0">{block.label}</span>
										<p class="text-[14px] leading-snug font-bold text-ink">{block.text}</p>
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
