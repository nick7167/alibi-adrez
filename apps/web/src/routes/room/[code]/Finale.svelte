<script lang="ts">
	/**
	 * FINALE — the terminal screen. The game is over, the scores are final.
	 *
	 * `FinaleView` carries `code`, `players` and `scoreboard` and nothing else:
	 * there is **no `deadline`** (so no countdown, and none is faked) and **no
	 * `awards`**. T2 deliberately did not invent superlatives the engine does
	 * not produce (ledger ruling 10), so this screen shows what actually
	 * happened — a podium for the top of the board and the full standings —
	 * rather than made-up "most fooled" trophies.
	 *
	 * Two details that are decisions, not defaults:
	 *
	 *  - **The leave control does not confirm** (`confirm={false}`). The ledger
	 *    is explicit: guarding a screen where nothing is lost trains players to
	 *    dismiss the dialog unread, which is what makes the real warning on the
	 *    in-game screens useless.
	 *  - **Rank is computed from the score, not from the row index,** so a tie
	 *    shows as a tie. The server sorts by score and breaks ties by playerId
	 *    for stability; that tiebreak is an ordering, not a placing, and
	 *    printing it as one would invent a result.
	 *
	 * The podium is a presentation of the first three rows: the slot order is
	 * the usual silver-gold-bronze arrangement, but the plinth's colour, its
	 * height and its `#n` tag all come from the row's *rank* — so two players
	 * tied at the top get two identical gold plinths rather than one of them
	 * being quietly demoted by an alphabetical tiebreak. Nothing else is
	 * recomputed.
	 */
	import type { FinaleView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		you,
		onLeave
	}: {
		room: FinaleView;
		/** This reader's playerId, so their own line is called out. */
		you: string;
		onLeave: () => void;
	} = $props();

	const byId = $derived(new Map(room.players.map((p) => [p.id, p])));

	/** The standings as rows, with a rank that ties share. */
	const rows = $derived.by(() => {
		let rank = 0;
		let prevScore: number | null = null;
		return room.scoreboard.flatMap((entry, i) => {
			if (prevScore === null || entry.score !== prevScore) rank = i + 1;
			prevScore = entry.score;
			const player = byId.get(entry.playerId);
			return player === undefined ? [] : [{ player, score: entry.score, rank, isYou: entry.playerId === you }];
		});
	});

	const top = $derived(rows.filter((r) => r.rank === 1));
	/** Visual podium order: silver, gold, bronze. Short rooms simply have fewer
	    plinths — a game can end below three players when someone walks out. */
	const podium = $derived(
		[
			{ row: rows[1], place: 2 },
			{ row: rows[0], place: 1 },
			{ row: rows[2], place: 3 }
		].flatMap((slot) =>
			slot.row === undefined
				? []
				// `tier` drives the plinth's colour, height and tag, and it comes
				// from the rank rather than the slot — see the header comment.
				: [{ ...slot, row: slot.row, tier: Math.min(slot.row.rank, 3) }]
		)
	);

	/** Indexed by *rank*, not by slot position: a shared first place gets two
	    gold plinths of the same height, which is what a tie looks like. */
	const PLINTH = ['bg-action', 'bg-white/20', 'bg-white/12'];
	const PLINTH_H = [96, 74, 60];

	/* Confetti, once, on the one screen in the game where it is the point. */
	const CONFETTI = [
		{ left: '6%', tx: '-60px', ty: '70px', tr: '-220deg', color: 'bg-action' },
		{ left: '18%', tx: '-20px', ty: '110px', tr: '160deg', color: 'bg-accent-right' },
		{ left: '30%', tx: '15px', ty: '90px', tr: '-140deg', color: 'bg-accent-wrong' },
		{ left: '44%', tx: '35px', ty: '130px', tr: '200deg', color: 'bg-surface' },
		{ left: '58%', tx: '60px', ty: '80px', tr: '-180deg', color: 'bg-action' },
		{ left: '72%', tx: '80px', ty: '120px', tr: '120deg', color: 'bg-accent-right' },
		{ left: '86%', tx: '45px', ty: '95px', tr: '-160deg', color: 'bg-accent-wrong' },
		{ left: '94%', tx: '-30px', ty: '140px', tr: '170deg', color: 'bg-surface' }
	];
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col overflow-hidden bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} confirm={false} />

	<div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-40" aria-hidden="true">
		{#each CONFETTI as c (c.left)}
			<span
				class="fi-bit absolute top-0 h-3 w-2.5 {c.color}"
				style="left:{c.left}; --tx:{c.tx}; --ty:{c.ty}; --tr:{c.tr};"
			></span>
		{/each}
	</div>

	<!-- The headline. A shared top score is a tie and says so; the server's
	     playerId tiebreak is an ordering, not a winner. -->
	<div class="relative z-10 flex shrink-0 flex-col items-center gap-1 pt-1">
		<span class="fi-eyebrow text-[11px] font-extrabold tracking-[0.22em] text-action uppercase">
			{m['finale.title']()}
		</span>
		<h1
			data-testid="finale-headline"
			tabindex="-1"
			class="fi-headline max-w-full truncate text-center font-display text-[34px] leading-tight font-bold outline-none"
		>
			{top.length > 1 ? m['finale.tie']() : m['finale.winner']({ name: top[0]?.player.name ?? '—' })}
		</h1>
	</div>

	<!-- Podium: the first three rows of the same board rendered below. -->
	<div
		data-testid="finale-podium"
		class="relative z-10 mt-3 flex shrink-0 items-end justify-center gap-2"
	>
		{#each podium as slot (slot.row.player.id)}
			<div
				data-testid="podium-slot"
				data-place={slot.place}
				data-rank={slot.row.rank}
				data-player={slot.row.player.id}
				class="flex w-1/3 max-w-[124px] min-w-0 flex-col items-center gap-1.5"
			>
				<span
					class="fi-avatar grid size-12 shrink-0 place-items-center rounded-full bg-surface text-[26px] leading-none"
					aria-hidden="true">{slot.row.player.emoji}</span
				>
				<span class="w-full truncate text-center font-display text-[15px] leading-tight font-semibold">
					{slot.row.isYou ? m['reveal.you']() : slot.row.player.name}
				</span>
				<div
					class="fi-plinth flex w-full flex-col items-center justify-center gap-0.5 rounded-t-xl {PLINTH[
						slot.tier - 1
					]} {slot.tier === 1 ? 'text-ink' : 'text-white'}"
					style="--plinth-h: {PLINTH_H[slot.tier - 1]}px"
				>
					<span class="text-[10px] font-extrabold tracking-[0.14em] uppercase opacity-70">
						#{slot.row.rank}
					</span>
					<span class="font-display text-[26px] leading-none font-bold tabular-nums">
						{slot.row.score}
					</span>
					<span class="fi-pts text-[9px] font-extrabold tracking-[0.14em] uppercase opacity-70">
						{m['finale.pts']()}
					</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- The full standings — everyone, not just the podium. -->
	<div class="relative z-10 mt-3 flex min-h-0 flex-1 flex-col justify-center gap-1.5">
		<span id="final-label" class="shrink-0 text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
			{m['finale.scores']()}
		</span>
		<ul
			data-testid="finale-board"
			aria-labelledby="final-label"
			class="flex min-h-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto pb-1"
		>
			{#each rows as row (row.player.id)}
				<li
					data-testid="finale-row"
					data-player={row.player.id}
					data-rank={row.rank}
					class="fi-row flex shrink-0 items-center gap-2.5 rounded-2xl border-2 px-3 py-1.5 {row.isYou
						? 'border-white/45 bg-white/15'
						: 'border-white/12 bg-white/5'}"
				>
					<span class="w-5 shrink-0 text-[13px] font-extrabold text-white/55 tabular-nums">
						{row.rank}
					</span>
					<span
						class="fi-row-avatar grid size-8 shrink-0 place-items-center rounded-full bg-surface text-[17px] leading-none"
						aria-hidden="true">{row.player.emoji}</span
					>
					<span class="min-w-0 flex-1 truncate font-display text-[16px] font-semibold">
						{row.isYou ? m['reveal.you']() : row.player.name}
					</span>
					<span
						data-testid="finale-score"
						class="shrink-0 text-[16px] font-extrabold tabular-nums"
						aria-label={m['reveal.pointsLabel']({ points: row.score })}
					>
						{row.score}
					</span>
				</li>
			{/each}
		</ul>
	</div>

	<!-- A terminal screen needs an obvious way onward. It does the same thing
	     as the leave chip top-left (which stays where it is on every screen so
	     the position is learnable) — nothing is lost here, so neither asks. -->
	<div class="relative z-10 shrink-0 pt-2">
		<button
			type="button"
			data-testid="finale-home"
			onclick={onLeave}
			class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-action px-8 font-display text-[19px] font-bold text-ink"
		>
			{m['finale.home']()}
		</button>
	</div>
</div>

<style>
	.fi-headline {
		animation: fi-pop 460ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	/* Height travels as a custom property rather than an inline `height`, so
	   the short-viewport query below can scale all three plinths together
	   without an !important that would flatten the ranking. */
	.fi-plinth {
		height: var(--plinth-h);
		animation: fi-rise 520ms cubic-bezier(0.34, 1.3, 0.64, 1) 120ms both;
		transform-origin: bottom;
	}

	.fi-bit {
		animation: fi-fall 1400ms ease-in forwards;
	}

	@keyframes fi-pop {
		from {
			opacity: 0;
			transform: scale(0.75);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes fi-rise {
		from {
			transform: scaleY(0.2);
			opacity: 0.4;
		}
		to {
			transform: scaleY(1);
			opacity: 1;
		}
	}

	@keyframes fi-fall {
		0% {
			transform: translate(0, -20px) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translate(var(--tx), var(--ty)) rotate(var(--tr));
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fi-headline,
		.fi-plinth,
		.fi-bit {
			animation: none;
		}

		.fi-bit {
			display: none;
		}
	}

	/* Short-viewport priority (ledger). At ~390×420 the celebration yields and
	   the information does not: the headline and the plinths shrink, the
	   standings keep scrolling inside their own box, and the primary action
	   keeps its full 56px height. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}

		.fi-eyebrow {
			font-size: 9px;
		}

		.fi-headline {
			font-size: 24px;
		}

		.fi-avatar {
			width: 34px;
			height: 34px;
			font-size: 19px;
		}

		.fi-plinth {
			height: calc(var(--plinth-h) * 0.55);
			gap: 0;
		}

		.fi-pts {
			display: none;
		}

		.fi-row {
			padding-top: 0.125rem;
			padding-bottom: 0.125rem;
		}

		.fi-row-avatar {
			width: 26px;
			height: 26px;
			font-size: 15px;
		}
	}
</style>
