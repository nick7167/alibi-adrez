<script lang="ts">
	/**
	 * REVEAL — the payoff. The answer everyone just guessed on gets its author,
	 * and the points land.
	 *
	 * Order on the screen is the order of the beat: the answer is still there
	 * (so the name lands *on* something), then the author with real weight, then
	 * who guessed whom and what it was worth.
	 *
	 * Rules this screen is bound by (docs/plans/plan3-ledger.md):
	 *
	 *  - `--color-accent-right` / `--color-accent-wrong` are Reveal-only. The
	 *    pink is 3.5:1 on the field, so it is a **large mark only** — it fills
	 *    the ✗ badge and never colours a word of body text.
	 *  - `awarded` already carries a line for every present player, zeros
	 *    included, in roster order (T3 ruling 22). It is rendered, never
	 *    recomputed (T4 ruling 32) — `guesses` likewise lists only the players
	 *    who actually cast one.
	 *  - The round counter is the answer counter: a round is one question and
	 *    one answer to it. `roundCount` is the server's effective count and
	 *    shrinks honestly when a leaver empties part of the pool.
	 *  - A REVEAL whose author leaves mid-phase collapses to the contentless
	 *    INTRO view. That is the router's business — this component is simply
	 *    unmounted, and must not treat it as an error.
	 *
	 * One presentation decision: the reader's own award line is hoisted to the
	 * top of the list. Everything else keeps the server's roster order. On a
	 * short viewport the list is the part that scrolls, so the line the reader
	 * actually cares about is the one guaranteed to be visible.
	 */
	import type { RevealView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import Countdown from '$lib/components/Countdown.svelte';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		you,
		offset,
		onLeave
	}: {
		room: RevealView;
		/** This reader's playerId, so their own line can be called out. */
		you: string;
		offset: number;
		onLeave: () => void;
	} = $props();

	const byId = $derived(new Map(room.players.map((p) => [p.id, p])));
	const author = $derived(byId.get(room.authorId));
	const youWrote = $derived(room.authorId === you);

	/* A round is one question and one answer to it, so the round counter IS
	   the answer counter — there is no separate within-round position any
	   more. `roundCount` is the server's effective count: it shrinks honestly
	   when a leaver takes answers out of the pool, so it never promises a
	   round that cannot happen. Rendered as given, never recomputed. */
	const dots = $derived(
		Array.from({ length: Math.max(room.roundCount, room.round, 1) }, (_, i) => i + 1)
	);

	/** One row per `awarded` line, joined to `guesses`. Nothing is recomputed:
	    the points are the server's numbers and the guess is the server's guess. */
	const rows = $derived.by(() => {
		const cast = new Map(room.guesses.map((g) => [g.playerId, g.guessedId]));
		const all = room.awarded.flatMap((a) => {
			const player = byId.get(a.playerId);
			if (player === undefined) return [];
			const guessedId = cast.get(a.playerId);
			return [
				{
					player,
					points: a.points,
					guessedId,
					guessed: guessedId === undefined ? undefined : byId.get(guessedId),
					correct: guessedId !== undefined && guessedId === room.authorId,
					isAuthor: a.playerId === room.authorId,
					isYou: a.playerId === you
				}
			];
		});
		return [...all.filter((r) => r.isYou), ...all.filter((r) => !r.isYou)];
	});
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} />

	<div class="flex shrink-0 items-center justify-between gap-3 pl-14">
		<div class="flex min-w-0 items-center gap-2.5">
			<div class="flex items-center gap-1.5" aria-hidden="true">
				{#each dots as n (n)}
					<span
						class="block rounded-full {n === room.round
							? 'size-3.5 bg-action ring-4 ring-action/25'
							: n < room.round
								? 'size-2.5 bg-action/60'
								: 'size-2.5 bg-white/30'}"
					></span>
				{/each}
			</div>
			<span data-testid="answer-progress" class="truncate text-[13px] font-semibold text-white/85">
				{m['game.round']({ round: room.round, roundCount: room.roundCount })}
			</span>
		</div>

		<div
			class="rv-countdown flex shrink-0 items-center gap-2 rounded-full bg-action px-4 pt-1.5 pb-2 text-ink shadow-[0_4px_0_rgba(22,11,61,0.35)]"
		>
			<Countdown deadline={room.deadline} {offset} class="" />
		</div>
	</div>

	<!-- The answer is still the one white surface, but it is no longer the
	     news — it shrinks so the name can be the biggest thing on screen. -->
	<div
		data-testid="answer-card"
		class="rv-card mt-3 flex shrink-0 flex-col gap-1.5 rounded-card bg-surface px-5 py-4 text-ink shadow-[0_6px_0_rgba(22,11,61,0.4)]"
	>
		<span class="text-[10px] font-extrabold tracking-[0.18em] text-surface-2 uppercase">
			{room.prompt}
		</span>
		<p
			data-testid="staged-answer"
			class="rv-answer font-display text-[22px] leading-[1.16] font-semibold tracking-[-0.01em] text-balance"
		>
			{room.answer.text}
		</p>
	</div>

	<!-- The moment, and what it was worth, as one vertically centred group:
	     spare height at the bottom of a tall phone reads as an unfinished
	     screen, so it is split above and below instead. -->
	<div class="flex min-h-0 flex-1 flex-col justify-center gap-3 py-2">
		<div class="rv-stage flex shrink-0 flex-col items-center gap-2 py-4">
			<span class="text-[11px] font-extrabold tracking-[0.18em] text-action uppercase">
				{youWrote ? m['reveal.yours']() : m['reveal.itWas']()}
			</span>
			<div
				data-testid="reveal-author"
				data-author={room.authorId}
				class="rv-author sticker flex max-w-full items-center gap-3 rounded-full bg-action py-2.5 pr-7 pl-2.5 text-ink"
			>
				<span
					class="rv-author-avatar grid size-14 shrink-0 place-items-center rounded-full bg-surface text-[30px] leading-none"
					aria-hidden="true">{author?.emoji ?? '👤'}</span
				>
				<span class="rv-author-name min-w-0 truncate font-display text-[34px] leading-none font-bold">
					{author?.name ?? '—'}
				</span>
			</div>
		</div>

		<!-- Who guessed whom, and what it was worth. The list is the flexible
		     element: on a short viewport it scrolls rather than pushing the
		     author reveal off the screen. -->
		<div class="flex min-h-0 shrink flex-col gap-1.5 pb-1">
			<span
				id="awarded-label"
				class="shrink-0 text-[11px] font-extrabold tracking-[0.16em] text-action uppercase"
			>
				{m['reveal.scores']()}
			</span>

			{#if room.guesses.length === 0}
				<p class="shrink-0 text-[13px] font-medium text-white/70">{m['reveal.nobodyGuessed']()}</p>
			{/if}

			<ul
				data-testid="reveal-rows"
				aria-labelledby="awarded-label"
				class="flex min-h-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto"
			>
				{#each rows as row (row.player.id)}
					<li
						data-testid="reveal-row"
						data-player={row.player.id}
						data-correct={row.isAuthor ? 'author' : row.guessedId === undefined ? 'none' : row.correct}
						class="rv-row flex shrink-0 items-center gap-2 rounded-2xl border-2 px-2.5 py-1.5 {row.isYou
							? 'border-white/45 bg-white/15'
							: 'border-white/12 bg-white/5'}"
					>
						<span
							class="rv-avatar grid size-8 shrink-0 place-items-center rounded-full bg-surface text-[17px] leading-none"
							aria-hidden="true">{row.player.emoji}</span
						>
						<span class="min-w-0 max-w-[38%] flex-shrink truncate font-display text-[16px] font-semibold">
							{row.isYou ? m['reveal.you']() : row.player.name}
						</span>

						<span class="flex min-w-0 flex-1 items-center justify-end gap-1.5">
							{#if row.isAuthor}
								<span class="truncate text-[12px] font-semibold text-white/70">
									{m['reveal.wroteIt']()}
								</span>
							{:else if row.guessedId === undefined}
								<span class="truncate text-[12px] font-semibold text-white/50">
									{m['reveal.noGuess']()}
								</span>
							{:else if row.correct}
								<!-- Large mark, not text: the accent fills the badge. -->
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full bg-accent-right text-ink"
									aria-hidden="true"
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="4.5"
										stroke-linecap="round"
										stroke-linejoin="round"><path d="m4 13 5 5L20 6" /></svg
									>
								</span>
								<span class="truncate text-[12px] font-bold text-white">{m['reveal.right']()}</span>
							{:else}
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full bg-accent-wrong text-ink"
									aria-hidden="true"
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="4.5"
										stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg
									>
								</span>
								<span class="shrink-0 text-[12px] font-semibold text-white/70">
									{m['reveal.guessed']()}
								</span>
								<span class="text-[15px] leading-none" aria-hidden="true">{row.guessed?.emoji}</span>
								<span class="min-w-0 truncate text-[12px] font-semibold text-white/85">
									{row.guessed?.name ?? '—'}
								</span>
							{/if}
						</span>

						<span
							data-testid="reveal-points"
							class="shrink-0 rounded-full px-2 py-0.5 text-[13px] font-extrabold tabular-nums {row.points >
							0
								? 'bg-accent-right text-ink'
								: 'bg-white/10 text-white/45'}"
							aria-label={m['reveal.pointsLabel']({ points: row.points })}
						>
							{row.points > 0 ? `+${row.points}` : '0'}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<style>
	/* Same :global override as every other phase pill (ledger ruling 50) —
	   Countdown is already Fredoka (font-display, ruling 87's resolution);
	   this only shrinks the size and drops the default letter-spacing. */
	.rv-countdown :global([data-testid='countdown']) {
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	/* The reveal itself. It is the one beat in the game that should feel like
	   a punchline, so the name pops in a hair after the card settles. */
	.rv-author {
		animation: reveal-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) 90ms both;
	}

	@keyframes reveal-pop {
		from {
			opacity: 0;
			transform: scale(0.7) rotate(-4deg);
		}
		60% {
			opacity: 1;
			transform: scale(1.06) rotate(1.5deg);
		}
		to {
			opacity: 1;
			transform: scale(1) rotate(-1.5deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rv-author {
			animation: none;
			rotate: -1.5deg;
		}
	}

	/* Short-viewport priority (ledger). The answer is context here — the name
	   and the points are the payoff — so the card yields first (two lines,
	   smaller type), then the paddings, and the award list keeps scrolling
	   inside its own box rather than pushing anything off screen. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}

		.rv-card {
			margin-top: 0.5rem;
			padding: 0.5rem 0.875rem;
			gap: 0.125rem;
		}

		.rv-answer {
			font-size: 17px;
			line-height: 1.18;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}

		.rv-stage {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
			gap: 0.25rem;
		}

		.rv-author {
			padding-right: 1rem;
		}

		.rv-author-avatar {
			width: 36px;
			height: 36px;
			font-size: 20px;
		}

		.rv-author-name {
			font-size: 24px;
		}

		.rv-row {
			padding-top: 0.125rem;
			padding-bottom: 0.125rem;
		}

		.rv-avatar {
			width: 28px;
			height: 28px;
			font-size: 15px;
		}
	}
</style>
