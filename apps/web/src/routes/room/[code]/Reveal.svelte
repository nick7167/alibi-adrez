<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { RevealView, Player } from '@aha/shared';
	import Countdown from '$lib/components/Countdown.svelte';

	let {
		room,
		you,
		offset
	}: {
		room: RevealView;
		you: string;
		offset: number;
	} = $props();

	function playerFor(id: string): Player | undefined {
		return room.players.find((p) => p.id === id);
	}

	const consistent = $derived(room.verdict === 'consistent');
</script>

<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-sunshine text-ink">
	<div class="flex shrink-0 items-center justify-between px-5 pt-safe">
		<span class="field-label">
			{m['game.round']({ round: room.round, roundCount: room.roundCount })}
		</span>
		<div class="flex flex-col items-end">
			<span class="field-label">{m['game.timeLeft']()}</span>
			<Countdown deadline={room.deadline} {offset} class="text-coral" />
		</div>
	</div>

	<div class="relative mt-2 min-h-0 flex-1">
		<div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-5 pb-3">
			<div class="flex shrink-0 flex-col items-center gap-2 pt-2 pb-1 text-center">
				<div
					class="verdict-stamp {consistent ? 'verdict-stamp--consistent' : 'verdict-stamp--busted'}"
					data-testid="verdict-stamp"
				>
					<span class="verdict-stamp__label">
						{consistent ? m['reveal.verdict.consistent']() : m['reveal.verdict.busted']()}
					</span>
				</div>
				<p class="max-w-[26ch] text-base leading-snug font-bold text-ink/80" data-testid="verdict-subline">
					{consistent
						? m['reveal.verdict.consistent.body']()
						: m['reveal.verdict.busted.body']()}
				</p>
				{#if room.unanimous}
					<span class="stamp mt-1" data-testid="unanimous-stamp">{m['reveal.unanimous']()}</span>
				{/if}
			</div>

			<section
				data-testid="scenario-card"
				class="ruled rounded-card mt-4 shrink-0 border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
			>
				<h2 class="field-label">{m['planning.scenario.title']()}</h2>
				<p class="mt-2 text-base leading-snug font-bold">{room.scenario.story}</p>

				<h3 class="field-label mt-4">{m['planning.details.title']()}</h3>
				<ol class="mt-2 flex flex-col gap-2">
					{#each room.scenario.details as detail, i (i)}
						<li class="flex items-start gap-2 text-[14px] leading-snug">
							<span class="font-mono text-xs font-bold text-coral tabular-nums" aria-hidden="true">
								{String(i + 1).padStart(2, '0')}
							</span>
							<span>{detail}</span>
						</li>
					{/each}
				</ol>
			</section>

			<section data-testid="awarded" class="mt-4 shrink-0">
				<h2 class="field-label">{m['reveal.awarded.title']()}</h2>
				<ul class="mt-2 flex flex-col gap-1.5">
					{#each room.awarded as entry (entry.playerId)}
						{@const p = playerFor(entry.playerId)}
						<li
							class="flex min-h-11 items-center justify-between gap-2 rounded-[14px] bg-manila/70 px-3 py-2 {entry.playerId ===
							you
								? 'ring-2 ring-coral'
								: ''}"
						>
							<div class="flex min-w-0 items-center gap-2">
								<span class="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-lg">
									{p?.emoji ?? '❓'}
								</span>
								<span class="truncate font-bold">{p ? p.name : entry.playerId}</span>
								{#if room.suspectIds.includes(entry.playerId)}
									<span class="stamp shrink-0">{m['reveal.tag.suspect']()}</span>
								{/if}
							</div>
							<span
								class="font-mono text-lg font-extrabold tabular-nums {entry.points > 0
									? 'text-coral'
									: 'text-ink/40'}"
							>
								{entry.points > 0 ? `+${entry.points}` : entry.points}
							</span>
						</li>
					{/each}
				</ul>
			</section>

			<section data-testid="scoreboard" class="mt-4 mb-2 shrink-0">
				<h2 class="field-label">{m['reveal.scoreboard.title']()}</h2>
				<ol class="mt-2 flex flex-col gap-1.5">
					{#each room.scoreboard as entry, i (entry.playerId)}
						{@const p = playerFor(entry.playerId)}
						<li
							class="flex min-h-11 items-center gap-2 rounded-[14px] bg-manila/70 px-3 py-2 {entry.playerId ===
							you
								? 'ring-2 ring-coral'
								: ''}"
						>
							<span class="w-5 shrink-0 font-mono text-xs font-bold text-coral tabular-nums"
								>{i + 1}</span
							>
							<span class="shrink-0 text-lg">{p?.emoji ?? '❓'}</span>
							<span class="flex-1 truncate font-bold">{p ? p.name : entry.playerId}</span>
							<span class="font-mono font-extrabold tabular-nums">{entry.score}</span>
						</li>
					{/each}
				</ol>
			</section>
		</div>
	</div>
</div>

<style>
	.verdict-stamp {
		display: inline-block;
		border: 5px double var(--color-ink);
		border-radius: 14px;
		padding: 0.6rem 1.75rem;
		rotate: -4deg;
		box-shadow: 0 6px 0 rgba(20, 20, 51, 0.18);
	}

	.verdict-stamp--busted {
		rotate: 3deg;
	}

	.verdict-stamp__label {
		display: block;
		font-family: var(--font-sans);
		font-size: clamp(1.75rem, 8vw, 2.75rem);
		font-weight: 800;
		letter-spacing: 0.01em;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.verdict-stamp--consistent {
		background: var(--color-mint);
		color: var(--color-ink);
	}

	.verdict-stamp--busted {
		background: var(--color-coral);
		color: white;
	}
</style>
