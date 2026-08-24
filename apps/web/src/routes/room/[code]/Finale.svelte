<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { Award, FinaleView, Player } from '@alibi/shared';

	let {
		room,
		you,
		onLeave
	}: {
		room: FinaleView;
		you: string;
		onLeave: () => void;
	} = $props();

	function playerFor(id: string): Player | undefined {
		return room.players.find((p) => p.id === id);
	}

	// Ranks 1-3, top of the (already score-desc / id-asc) scoreboard.
	const podium = $derived(room.scoreboard.slice(0, 3));
	// Classic podium reading order left-to-right is 2nd, 1st, 3rd; DOM order
	// stays rank order (1st, 2nd, 3rd) so e2e assertions don't have to know
	// about the visual reshuffle.
	const PODIUM_VISUAL_ORDER = [2, 1, 3];
	const PODIUM_BADGE = [
		'bg-sunshine text-ink',
		'bg-paper text-ink',
		'bg-coral text-white'
	];

	// Award keys are stable strings the server may extend later (ledger
	// ruling 21); an unrecognized key still gets a translated, non-raw label
	// rather than leaking the key itself.
	const AWARD_LABELS: Record<string, () => string> = {
		mostConvincingLiar: m['finale.award.mostConvincingLiar'],
		sharpestDetective: m['finale.award.sharpestDetective'],
		mostCurious: m['finale.award.mostCurious']
	};

	function awardLabel(award: Award): string {
		return (AWARD_LABELS[award.key] ?? m['finale.award.other'])();
	}
</script>

<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-grape text-paper">
	<div class="flex shrink-0 items-center justify-between px-5 pt-safe">
		<span class="field-label-invert">{m['game.phase.finale']()}</span>
		<span
			class="stamp-frame bg-paper px-3 pt-1 pb-0.5 font-mono text-sm font-bold tracking-[0.14em] text-coral tabular-nums"
		>
			{room.code}
		</span>
	</div>

	<div class="relative mt-2 min-h-0 flex-1">
		<div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-5 pb-3">
			<h1 class="pt-3 text-center text-4xl font-extrabold text-paper">{m['finale.headline']()}</h1>

			<section data-testid="podium" class="mt-6 shrink-0">
				<h2 class="field-label-invert text-center">{m['finale.podium.title']()}</h2>
				<ol class="mt-4 flex items-end justify-center gap-3">
					{#each podium as entry, i (entry.playerId)}
						{@const p = playerFor(entry.playerId)}
						<li
							data-testid="podium-entry"
							data-rank={i + 1}
							class="flex flex-col items-center gap-2"
							style="order: {PODIUM_VISUAL_ORDER[i]}"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full border-[3px] border-ink font-mono text-xs font-extrabold tabular-nums {PODIUM_BADGE[
									i
								] ?? PODIUM_BADGE[2]}"
							>
								{i + 1}
							</span>
							<span class="grid size-14 place-items-center rounded-full bg-white/15 text-2xl">
								{p?.emoji ?? '❓'}
							</span>
							<span class="max-w-[9ch] truncate text-center text-sm font-extrabold text-paper">
								{p ? p.name : entry.playerId}
							</span>
							<span class="podium-block flex w-20 flex-col items-center justify-start rounded-t-[14px] bg-paper/15 pt-2 podium-block--{i + 1}">
								<span class="font-mono text-lg font-extrabold text-sunshine tabular-nums">
									{entry.score}
								</span>
							</span>
						</li>
					{/each}
				</ol>
			</section>

			{#if room.awards.length > 0}
				<section data-testid="awards" class="mt-6 shrink-0">
					<h2 class="field-label-invert">{m['finale.awards.title']()}</h2>
					<ul class="mt-2 flex flex-col gap-1.5">
						{#each room.awards as award (award.key + ':' + award.playerId)}
							{@const p = playerFor(award.playerId)}
							<li
								data-testid="award-entry"
								class="flex min-h-11 items-center gap-2.5 rounded-[14px] bg-paper/10 px-3 py-2 {award.playerId ===
								you
									? 'ring-2 ring-sunshine'
									: ''}"
							>
								<span class="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-lg">
									{p?.emoji ?? '❓'}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-bold text-paper">{p ? p.name : award.playerId}</span>
									<span class="field-label-invert" data-testid="award-label">{awardLabel(award)}</span>
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section data-testid="scoreboard" class="mt-6 mb-2 shrink-0">
				<h2 class="field-label-invert">{m['reveal.scoreboard.title']()}</h2>
				<ol class="mt-2 flex flex-col gap-1.5">
					{#each room.scoreboard as entry, i (entry.playerId)}
						{@const p = playerFor(entry.playerId)}
						<li
							class="flex min-h-11 items-center gap-2 rounded-[14px] bg-paper/10 px-3 py-2 {entry.playerId ===
							you
								? 'ring-2 ring-sunshine'
								: ''}"
						>
							<span class="w-5 shrink-0 font-mono text-xs font-bold text-sunshine tabular-nums"
								>{i + 1}</span
							>
							<span class="shrink-0 text-lg">{p?.emoji ?? '❓'}</span>
							<span class="flex-1 truncate font-bold text-paper">{p ? p.name : entry.playerId}</span>
							<span class="font-mono font-extrabold text-paper tabular-nums">{entry.score}</span>
						</li>
					{/each}
				</ol>
			</section>
		</div>
	</div>

	<div class="shrink-0 px-5 pt-2 pb-safe">
		<button
			type="button"
			data-testid="finale-leave"
			onclick={onLeave}
			class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-paper px-8 text-lg font-bold text-grape"
		>
			{m['finale.leave']()}
		</button>
	</div>
</div>

<style>
	/* Same evidence typography as app.css's `.field-label`, recolored for
	   this screen's dark grape field — the shared primitive is tuned for
	   paper/manila and would go near-invisible here. */
	.field-label-invert {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--color-paper) 70%, transparent);
	}

	.podium-block--1 {
		height: 3.25rem;
	}

	.podium-block--2 {
		height: 2.25rem;
	}

	.podium-block--3 {
		height: 1.5rem;
	}
</style>
