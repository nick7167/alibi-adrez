<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { DeliberationView, Player, Verdict } from '@aha/shared';
	import Countdown from '$lib/components/Countdown.svelte';

	let {
		room,
		you,
		offset,
		onCastVote
	}: {
		room: DeliberationView;
		you: string;
		offset: number;
		onCastVote: (verdict: Verdict) => void;
	} = $props();

	function playerFor(id: string): Player | undefined {
		return room.players.find((p) => p.id === id);
	}
</script>

{#snippet header()}
	<div class="flex shrink-0 items-center justify-between px-5 pt-safe">
		<span class="field-label-invert">
			{m['game.round']({ round: room.round, roundCount: room.roundCount })}
		</span>
		<div class="flex flex-col items-end">
			<span class="field-label-invert">{m['game.timeLeft']()}</span>
			<Countdown deadline={room.deadline} {offset} class="text-sunshine" />
		</div>
	</div>
	<div class="mt-3 flex shrink-0 items-center justify-center px-5">
		<span class="stamp" data-testid="votes-stamp">
			{m['deliberation.votesProgress']({ cast: room.votesCast, needed: room.votesNeeded })}
		</span>
	</div>
{/snippet}

<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-cobalt text-paper">
	{@render header()}

	<div class="relative mt-3 min-h-0 flex-1">
		<div class="h-full overflow-x-hidden overflow-y-auto px-5 pb-3">
			<ul class="mt-1 flex flex-col gap-3 pb-1" data-testid="transcript">
				{#each room.transcript as entry, i (i)}
					<li
						class="rounded-card border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
					>
						<span class="font-mono text-xs font-bold text-coral tabular-nums" aria-hidden="true"
							>{String(i + 1).padStart(2, '0')}</span
						>
						<p class="mt-1 text-lg leading-snug font-bold">{entry.question}</p>
						<div class="mt-3 grid gap-2">
							{#each entry.answers as a (a.playerId)}
								{@const p = playerFor(a.playerId)}
								<div class="rounded-[14px] bg-paper/60 p-2.5">
									<div class="flex items-center gap-1.5">
										<span class="text-base leading-none" aria-hidden="true">{p?.emoji ?? '❓'}</span>
										<span class="field-label">{p ? p.name : a.playerId}</span>
									</div>
									{#if a.text === ''}
										<p class="mt-1 text-sm font-bold text-ink/50 italic">
											{m['interrogation.noAnswer']()}
										</p>
									{:else}
										<p class="mt-1 text-[15px] leading-snug font-semibold">{a.text}</p>
									{/if}
								</div>
							{/each}
						</div>
					</li>
				{:else}
					<li class="text-center text-sm font-bold text-paper/70" data-testid="transcript-empty">
						{m['interrogation.transcriptEmpty']()}
					</li>
				{/each}
			</ul>
		</div>
	</div>

	{#if room.role === 'detective'}
		<div class="shrink-0 px-5 pt-2 pb-safe">
			{#if room.myVote}
				<div
					class="flex flex-col items-center gap-1 rounded-[20px] bg-paper/10 py-3 text-center"
					data-testid="vote-locked"
				>
					<span class="text-lg font-extrabold text-paper">
						{room.myVote === 'consistent'
							? m['deliberation.myVote.consistent']()
							: m['deliberation.myVote.busted']()}
					</span>
					<span class="field-label-invert">{m['deliberation.myVote.locked']()}</span>
				</div>
			{:else}
				<p class="field-label-invert mb-2 text-center">{m['deliberation.vote.prompt']()}</p>
				<div class="grid grid-cols-2 gap-3" data-testid="vote-controls">
					<button
						type="button"
						onclick={() => onCastVote('consistent')}
						data-testid="vote-consistent"
						class="sticker min-h-11 rounded-full bg-mint px-4 py-3 text-base font-extrabold text-ink"
					>
						{m['deliberation.vote.consistent']()}
					</button>
					<button
						type="button"
						onclick={() => onCastVote('busted')}
						data-testid="vote-busted"
						class="sticker min-h-11 rounded-full bg-coral px-4 py-3 text-base font-extrabold text-white"
					>
						{m['deliberation.vote.busted']()}
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<div class="shrink-0 px-5 pt-2 pb-safe text-center" data-testid="suspect-waiting">
			<h2 class="text-lg font-extrabold text-paper">{m['deliberation.suspect.waiting.title']()}</h2>
			<p class="mt-1 font-semibold text-paper/75">{m['deliberation.suspect.waiting.body']()}</p>
		</div>
	{/if}
</div>

<style>
	/* Same evidence typography as app.css's `.field-label`, recolored for
	   this screen's dark cobalt field — the shared primitive is tuned for
	   paper/manila and would go near-invisible here. Scoped to this
	   component so the light-background labels inside the manila transcript
	   cards keep using the real `.field-label`. */
	.field-label-invert {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--color-paper) 70%, transparent);
	}
</style>
