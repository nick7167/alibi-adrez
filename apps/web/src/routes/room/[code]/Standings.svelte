<script lang="ts">
	/**
	 * STANDINGS — the periodic beat, every `standingsEvery` rounds.
	 *
	 * The point of this screen is *movement*, not numbers. A scoreboard the room
	 * has already seen on the reveal screen is not worth six seconds; "you just
	 * went past two people" is. So every row leads with its change since the
	 * last beat and the rank arrives with it.
	 *
	 * Rules this screen is bound by (docs/plans/plan3-ledger.md):
	 *
	 *  - **`delta` comes from the server and is not recomputed.** Movement is
	 *    measured against the ranks as they stood at the previous beat, which a
	 *    reconnecting client has no way to remember. Positive is a climb.
	 *  - **Rank is dense, so a tie reads as a tie** — the server already shares
	 *    a rank between equal scores, and this screen renders that as given
	 *    rather than falling back to row position.
	 *  - `--color-accent-right` / `--color-accent-wrong` are large marks only.
	 *    They fill the movement chevrons here and never colour a word of text:
	 *    the pink is 3.5:1 on the field.
	 *  - `Countdown` is restyled from outside with a `:global` override; the
	 *    component itself stays untouched.
	 *  - `LeaveButton` is composed, not reinvented, and it confirms here — the
	 *    game is still running and a leaver's score is gone.
	 *
	 * Short-viewport: the standings list is the element that grows with the room
	 * (up to 16), so it is the one that scrolls inside its own box. The heading
	 * and the countdown keep their place.
	 */
	import type { StandingsView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import { focusOnMount } from '$lib/focus-on-mount';
	import Countdown from '$lib/components/Countdown.svelte';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		you,
		offset,
		onLeave
	}: {
		room: StandingsView;
		/** This reader's playerId, so their own row is called out. */
		you: string;
		offset: number;
		onLeave: () => void;
	} = $props();

	const byId = $derived(new Map(room.players.map((p) => [p.id, p])));

	/** Rows as the server ordered them, joined to the roster. Nothing sorted,
	    nothing recomputed — `rank` and `delta` are the server's numbers. */
	const rows = $derived(
		room.lines.flatMap((line) => {
			const player = byId.get(line.playerId);
			return player === undefined
				? []
				: [{ ...line, player, isYou: line.playerId === you, leader: line.rank === 1 }];
		})
	);
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} />

	<div class="flex shrink-0 items-center justify-between gap-3 pl-14">
		<span data-testid="round-counter" class="truncate text-[13px] font-semibold text-white/85">
			{m['standings.subtitle']({ round: room.round, roundCount: room.roundCount })}
		</span>
		<div
			class="countdown-pill flex shrink-0 items-center gap-2 rounded-full bg-action px-4 pt-1.5 pb-2 text-ink shadow-[0_4px_0_rgba(22,11,61,0.35)]"
		>
			<Countdown deadline={room.deadline} {offset} class="" />
		</div>
	</div>

	<h1
		data-testid="standings-title"
		tabindex="-1"
		use:focusOnMount
		class="st-title mt-4 shrink-0 text-center font-display text-[40px] leading-[1.05] font-bold tracking-[-0.02em] text-white outline-none"
	>
		{m['standings.title']()}
	</h1>

	<!-- The one scroll region. -->
	<div
		data-testid="standings-rows"
		class="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto"
	>
		{#each rows as row (row.playerId)}
			<div
				data-testid="standings-row"
				class="st-row flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 {row.isYou
					? 'bg-action text-ink'
					: 'bg-surface-2 text-white'}"
			>
				<!-- Movement, as a large mark. The label beside it carries the
				     meaning for anyone who cannot see the colour. -->
				<span
					data-testid="standings-delta"
					class="grid size-8 shrink-0 place-items-center rounded-full {row.delta > 0
						? 'bg-accent-right text-ink'
						: row.delta < 0
							? 'bg-accent-wrong text-ink'
							: row.isYou
								? 'bg-ink/10 text-ink/50'
								: 'bg-white/15 text-white/50'}"
					aria-label={row.delta > 0
						? m['standings.up']({ places: row.delta })
						: row.delta < 0
							? m['standings.down']({ places: -row.delta })
							: m['standings.same']()}
				>
					{#if row.delta > 0}
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="4"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m5 15 7-7 7 7" />
						</svg>
					{:else if row.delta < 0}
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="4"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m5 9 7 7 7-7" />
						</svg>
					{:else}
						<span class="block h-[3px] w-3 rounded-full bg-current"></span>
					{/if}
				</span>

				{#if row.delta !== 0}
					<span
						class="w-4 shrink-0 text-[12px] font-extrabold tabular-nums {row.isYou
							? 'text-ink/70'
							: 'text-white/70'}">{Math.abs(row.delta)}</span
					>
				{:else}
					<span class="w-4 shrink-0"></span>
				{/if}

				<span
					class="w-6 shrink-0 text-[13px] font-extrabold tabular-nums {row.isYou
						? 'text-ink/60'
						: 'text-white/60'}">#{row.rank}</span
				>

				<span class="shrink-0 text-xl" aria-hidden="true">{row.player.emoji}</span>

				<span
					data-testid="standings-name"
					class="min-w-0 flex-1 truncate font-display text-[17px] font-semibold">{row.player.name}</span
				>

				{#if row.leader}
					<span class="shrink-0 text-base" aria-label={m['standings.leader']()}>👑</span>
				{/if}

				<span
					data-testid="standings-score"
					class="shrink-0 font-display text-[19px] font-bold tabular-nums">{row.score}</span
				>
			</div>
		{/each}
	</div>

	<p class="st-next mt-3 shrink-0 text-center text-[13px] font-semibold text-white/70">
		{m['standings.next']()}
	</p>
</div>

<style>
	.countdown-pill :global([data-testid='countdown']) {
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	/* Short-viewport: the heading shrinks and the rows tighten, but every row
	   keeps enough height to stay readable and the list keeps scrolling inside
	   its own box rather than pushing the countdown off the screen. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(1rem, env(safe-area-inset-bottom));
		}

		.st-title {
			margin-top: 0.5rem;
			font-size: 26px;
		}

		.st-row {
			padding-top: 0.375rem;
			padding-bottom: 0.375rem;
		}

		.st-next {
			margin-top: 0.5rem;
		}
	}
</style>
