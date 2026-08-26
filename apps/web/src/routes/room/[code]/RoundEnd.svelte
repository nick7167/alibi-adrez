<script lang="ts">
	/**
	 * ROUND_END — the round is over and nothing is secret any more.
	 *
	 * This is the screen the whole game leans on socially. Only `MAX_STAGED` (4)
	 * answers ever go on the stage, so in a room of eight or ten most people
	 * write something the room is never asked about. Here every answer of the
	 * round appears with its author — staged and un-staged alike — which is the
	 * only moment those players get seen. `RoundEndView.answers` already arrives
	 * in the right order (staged first, in the order the room guessed them, then
	 * the rest in roster order) and each one carries `staged`, so this screen
	 * renders the list exactly as given and marks, rather than sorts.
	 *
	 * Rules this screen is bound by (docs/plans/plan3-ledger.md):
	 *
	 *  - **Short-viewport priority.** The answer list is the element that grows
	 *    with the room, so it is the one that scrolls inside its own box. The
	 *    prompt yields (smaller type, clamped) and the scoreboard is a
	 *    *horizontally* scrolling strip with a fixed height — a vertical
	 *    scoreboard next to a vertical answer list is two things fighting for
	 *    the same axis, and at 390×420 both lose.
	 *  - **`Countdown` is restyled from outside** with a `:global` override
	 *    (ruling 50/60); the component itself stays untouched.
	 *  - **`LeaveButton` is composed, not reinvented** (ruling 44), and it
	 *    confirms here: the game is still running and a leaver's score is gone.
	 *  - Fredoka carries answers and names, Figtree every label and count.
	 */
	import type { RoundEndView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import Countdown from '$lib/components/Countdown.svelte';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		you,
		offset,
		onLeave
	}: {
		room: RoundEndView;
		/** This reader's playerId, so their own answer and score stand out. */
		you: string;
		offset: number;
		onLeave: () => void;
	} = $props();

	const byId = $derived(new Map(room.players.map((p) => [p.id, p])));
	const roundDots = $derived(Array.from({ length: room.roundCount }, (_, i) => i + 1));

	/** After the last round the countdown runs into the finale, not a prompt.
	    Saying "next round" there would promise a round that never comes. */
	const lastRound = $derived(room.round >= room.roundCount);

	const board = $derived(
		room.scoreboard.flatMap((entry, i) => {
			const player = byId.get(entry.playerId);
			return player === undefined ? [] : [{ player, score: entry.score, rank: i + 1 }];
		})
	);
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} />

	<!-- Top bar. `pl-14` clears the leave button, absolutely placed in the same
	     spot on every screen. -->
	<div class="flex shrink-0 items-start justify-between gap-3 pl-14">
		<div class="flex min-w-0 flex-col gap-1.5 pt-0.5">
			<div class="flex items-center gap-1.5" aria-hidden="true">
				{#each roundDots as n (n)}
					<span
						class="block size-2.5 rounded-full {n === room.round
							? 'bg-action ring-4 ring-action/25'
							: n < room.round
								? 'bg-action/60'
								: 'bg-white/30'}"
					></span>
				{/each}
			</div>
			<span data-testid="round-counter" class="truncate text-[13px] font-semibold text-white/85">
				{m['game.round']({ round: room.round, roundCount: room.roundCount })}
			</span>
		</div>

		<!-- The pill says what the clock is counting down *to*: after the last
		     round it is the results, not another prompt. -->
		<div
			class="re-countdown flex shrink-0 flex-col items-center rounded-2xl bg-action px-3 pt-1 pb-1.5 text-ink shadow-[0_4px_0_rgba(22,11,61,0.35)]"
		>
			<span class="text-[9px] leading-tight font-extrabold tracking-[0.14em] uppercase">
				{lastRound ? m['roundEnd.nextFinale']() : m['roundEnd.nextRound']()}
			</span>
			<Countdown deadline={room.deadline} {offset} class="" />
		</div>
	</div>

	<!-- The prompt, as context. It yields first on a short viewport. -->
	<div
		class="re-prompt mt-3 flex shrink-0 flex-col gap-1 rounded-[20px] border-2 border-white/20 bg-white/10 px-4 py-2.5"
	>
		<span class="text-[10px] font-extrabold tracking-[0.18em] text-action uppercase">
			{m['roundEnd.promptWas']()}
		</span>
		<span
			data-testid="prompt"
			class="re-prompt-text font-display text-[16px] leading-[1.25] font-medium"
		>
			{room.prompt}
		</span>
	</div>

	<div class="mt-3 flex shrink-0 items-baseline justify-between gap-2">
		<span id="answers-label" class="text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
			{m['roundEnd.everyAnswer']()}
		</span>
		<span class="text-[12px] font-semibold text-white/60 tabular-nums">{room.answers.length}</span>
	</div>

	{#if room.answers.length === 0}
		<p class="mt-3 shrink-0 text-[13px] font-medium text-white/70">{m['roundEnd.empty']()}</p>
	{/if}

	<!-- Every answer of the round with its author. The list is the flexible
	     element: it scrolls inside its own box rather than pushing the prompt
	     or the scoreboard off the screen. -->
	<ul
		data-testid="roundend-answers"
		aria-labelledby="answers-label"
		class="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto pb-1"
	>
		{#each room.answers as answer (answer.id)}
			{@const author = byId.get(answer.authorId)}
			<li
				data-testid="roundend-answer"
				data-author={answer.authorId}
				data-staged={answer.staged}
				class="re-card flex shrink-0 flex-col gap-1.5 rounded-2xl bg-surface px-3.5 py-2.5 text-ink shadow-[0_4px_0_rgba(22,11,61,0.4)] {answer.authorId ===
				you
					? 'ring-4 ring-action'
					: ''}"
			>
				<div class="flex items-center gap-2">
					<span
						class="re-avatar grid size-7 shrink-0 place-items-center rounded-full bg-ink/8 text-[16px] leading-none"
						aria-hidden="true">{author?.emoji ?? '👤'}</span
					>
					<span
						data-testid="roundend-author"
						class="min-w-0 flex-1 truncate font-display text-[15px] leading-tight font-semibold"
					>
						{answer.authorId === you ? m['reveal.you']() : (author?.name ?? '—')}
					</span>
					<!-- Marked, never re-sorted: the server already ordered these. -->
					<span
						data-testid="staged-badge"
						class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-[0.12em] uppercase {answer.staged
							? 'bg-action text-ink'
							: 'bg-ink/8 text-ink/70'}"
					>
						{answer.staged ? m['roundEnd.wasGuessed']() : m['roundEnd.notGuessed']()}
					</span>
				</div>
				<p
					data-testid="roundend-text"
					class="re-text font-display text-[17px] leading-[1.2] font-semibold tracking-[-0.005em]"
				>
					{answer.text}
				</p>
			</li>
		{/each}
	</ul>

	<!-- The running scoreboard. Horizontal on purpose (see the header comment):
	     it has a fixed height whatever the room size, so it can never crowd the
	     answer list, and the leader is always the first thing in it. -->
	<div class="flex shrink-0 flex-col gap-1.5 pt-1">
		<span id="board-label" class="text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
			{m['reveal.scores']()}
		</span>
		<ul
			data-testid="roundend-board"
			aria-labelledby="board-label"
			class="flex gap-2 overflow-x-auto overflow-y-hidden pb-0.5"
		>
			{#each board as row (row.player.id)}
				<li
					data-testid="board-chip"
					data-player={row.player.id}
					class="re-chip flex shrink-0 items-center gap-1.5 rounded-full border-2 px-2.5 py-1 {row.player
						.id === you
						? 'border-action bg-action text-ink'
						: 'border-white/15 bg-white/10 text-white'}"
				>
					<span class="text-[11px] font-bold opacity-60 tabular-nums">{row.rank}</span>
					<span class="text-[15px] leading-none" aria-hidden="true">{row.player.emoji}</span>
					<span class="max-w-[88px] truncate font-display text-[14px] font-semibold">
						{row.player.id === you ? m['reveal.you']() : row.player.name}
					</span>
					<span data-testid="board-score" class="text-[14px] font-extrabold tabular-nums">
						{row.score}
					</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	/* Countdown.svelte is already Fredoka (font-display, ruling 87's
	   resolution); the pill only restyles the size and letter-spacing from
	   outside (ledger rulings 50 and 60). */
	.re-countdown :global([data-testid='countdown']) {
		font-size: 20px;
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: 0;
	}

	/* Short-viewport priority (ledger). At ~390×420 the prompt is context and
	   yields — smaller type, clamped to two lines — and every answer clamps to
	   two lines so more of the room fits before the list has to be scrolled.
	   What must never be clipped: the answer list itself and the scoreboard
	   strip, both of which keep their own scroll. This query never matches at
	   full height, so the tall phone is provably unchanged. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}

		.re-prompt {
			margin-top: 0.5rem;
			padding: 0.375rem 0.75rem;
			gap: 0;
		}

		.re-prompt-text {
			font-size: 13px;
			line-height: 1.2;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}

		.re-card {
			padding: 0.375rem 0.625rem;
			gap: 0.125rem;
		}

		.re-avatar {
			width: 22px;
			height: 22px;
			font-size: 13px;
		}

		.re-text {
			font-size: 14px;
			line-height: 1.18;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}

		.re-chip {
			padding: 0.125rem 0.5rem;
		}
	}
</style>
