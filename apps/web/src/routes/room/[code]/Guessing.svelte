<script lang="ts">
	/**
	 * GUESSING — one anonymous answer is on the stage and everyone except its
	 * author taps who they think wrote it.
	 *
	 * Composition follows the artboard (scratchpad `identity/GuessingA.dc.html`):
	 * the prompt stays as context in a translucent block, the staged answer is
	 * the hero on the one white surface this screen is allowed, and the
	 * candidates are a two-column grid of tappable chips under a yellow label.
	 *
	 * Four protocol facts this screen exists to honour, all of them load-bearing:
	 *
	 *  1. **`candidates` is rendered exactly as it arrives.** The server already
	 *     computes "everyone except me" — including players who wrote nothing.
	 *     Filtering it here to writers, or dropping the author, is precisely the
	 *     leak the whole view shape is designed to prevent, so this screen never
	 *     touches the array (docs/plans/plan3-ledger.md, T4 ruling 27).
	 *  2. **`guessedCount` is a count and stays one.** The author never guesses,
	 *     so a list of guessers would name them by omission the instant everyone
	 *     else had voted (ledger, `submittedIds` ruling).
	 *  3. **`myGuess` is latched once per staged answer.** The server rebroadcasts
	 *     a full snapshot every time *anybody* guesses; re-seeding local state
	 *     from each one fights the reader's own selection. Same hazard as
	 *     `myEntry` on the Writing screen (ledger ruling 46) — with the extra
	 *     twist that the latch has to reset when the stage moves to a new
	 *     `answer.id`, which can happen without an intervening REVEAL when the
	 *     staged author leaves (T3 ruling 23).
	 *  4. **The grid locks client-side the moment the phase is over,** rather than
	 *     waiting for the server's `STALE_ANSWER`. A tap landing 200ms after the
	 *     stage advanced is a real race on a phone: the server rejects it
	 *     correctly, but the player would see their chip light up and then
	 *     silently do nothing. The lock is driven by a local ticker against the
	 *     deadline, so it engages the instant the clock runs out — before the
	 *     next snapshot has crossed the wire.
	 *
	 * The author's variant is a *different screen*, not a disabled one: they see
	 * that the answer is theirs and get no candidate grid at all.
	 */
	import { untrack } from 'svelte';
	import type { GuessingView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import Countdown from '$lib/components/Countdown.svelte';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		offset,
		onGuess,
		onLeave
	}: {
		room: GuessingView;
		offset: number;
		onGuess: (answerId: string, playerId: string) => void;
		onLeave: () => void;
	} = $props();

	const byId = $derived(new Map(room.players.map((p) => [p.id, p])));

	/* Rendered as given — never recomputed from `order`, which counts voided
	   slots too. A leaver turns "2 of 4" into "2 of 3" mid-round and that is
	   the honest reading (ledger, "The staged counter after a void"). */
	const dots = $derived(
		Array.from({ length: Math.max(room.answerTotal, room.answerIndex, 1) }, (_, i) => i + 1)
	);
	/** Everyone but the author guesses, so the denominator is players − 1. */
	const guesserTotal = $derived(Math.max(0, room.players.length - 1));

	/* ---- the latch (see 3 above) ------------------------------------- */

	/** The `answer.id` the selection below belongs to. Deliberately not $state:
	    it is bookkeeping for the effect, never rendered. */
	let seededFor: string | null = null;
	let selected = $state<string | null>(null);

	$effect(() => {
		const id = room.answer.id;
		const mine = room.myGuess;
		untrack(() => {
			if (seededFor !== id) {
				// New answer on the stage — start clean, seeded from whatever the
				// server already holds for it (a reconnect mid-answer).
				seededFor = id;
				selected = mine ?? null;
			} else if (selected === null && mine !== undefined) {
				// First time the server echoes a guess for THIS answer. Every
				// later snapshot is ignored, so another player guessing cannot
				// disturb what this reader sees.
				selected = mine;
			}
		});
	});

	/* ---- the lock (see 4 above) -------------------------------------- */

	/* A ticker rather than a one-shot timeout at the deadline: a timeout
	   scheduled before a phone sleeps fires late, and re-deriving from the
	   clock on every tick is the same discipline `Countdown` already uses. */
	let nowMs = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (nowMs = Date.now()), 250);
		return () => clearInterval(id);
	});

	/** The phase's own clock has run out; the server's next frame is in flight. */
	const expired = $derived(room.deadline !== null && room.deadline - (nowMs + offset) <= 0);
	/** One guess per answer, and it is final — so a cast guess locks too. */
	const locked = $derived(expired || selected !== null);

	function tap(id: string) {
		if (locked) return;
		// Optimistic, then confirmed by the server's echo through the latch.
		selected = id;
		onGuess(room.answer.id, id);
	}
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} />

	<!-- Top bar. `pl-14` clears the leave button, which is absolutely placed in
	     the same spot on every screen. -->
	<div class="flex shrink-0 items-center justify-between gap-3 pl-14">
		<div class="flex min-w-0 items-center gap-2.5">
			<div class="flex items-center gap-1.5" aria-hidden="true">
				{#each dots as n (n)}
					<span
						class="block rounded-full {n === room.answerIndex
							? 'size-3.5 bg-action ring-4 ring-action/25'
							: n < room.answerIndex
								? 'size-2.5 bg-action/60'
								: 'size-2.5 bg-white/30'}"
					></span>
				{/each}
			</div>
			<span data-testid="answer-progress" class="truncate text-[13px] font-semibold text-white/85">
				{m['game.answerProgress']({ index: room.answerIndex, total: room.answerTotal })}
			</span>
		</div>

		<div
			class="gu-countdown flex shrink-0 items-center gap-2 rounded-full bg-action px-4 pt-1.5 pb-2 text-ink shadow-[0_4px_0_rgba(22,11,61,0.35)]"
		>
			<Countdown deadline={room.deadline} {offset} class="" />
		</div>
	</div>

	<!-- The prompt: context, and secondary to the answer. -->
	<div
		class="gu-prompt mt-3 flex shrink-0 flex-col gap-1.5 rounded-[20px] border-2 border-white/20 bg-white/10 px-4 py-3"
	>
		<span class="text-[10px] font-extrabold tracking-[0.18em] text-action uppercase">
			{m['guessing.eyebrow']()}
		</span>
		<span data-testid="prompt" class="gu-prompt-text font-display text-[17px] leading-[1.25] font-medium">
			{room.prompt}
		</span>
	</div>

	<!-- The hero. White is the answer card and only the answer card. -->
	<div class="gu-stage flex min-h-[104px] flex-[1_1_auto] items-center py-3">
		<div
			data-testid="answer-card"
			class="gu-card flex max-h-full w-full min-h-[272px] -rotate-[1deg] flex-col justify-center gap-4 rounded-card bg-surface p-6 text-ink shadow-[0_8px_0_rgba(22,11,61,0.45)]"
		>
			<div class="flex shrink-0 items-center gap-2">
				<span
					class="grid size-6 shrink-0 place-items-center rounded-full bg-ink font-display text-[15px] font-bold text-action"
					aria-hidden="true">?</span
				>
				<span class="text-[10px] font-extrabold tracking-[0.18em] text-surface-2 uppercase">
					<!-- The author already knows; telling them "somebody wrote"
					     would read as the app not knowing either. -->
					{room.youWrote ? m['guessing.youWrote']() : m['guessing.somebodyWrote']()}
				</span>
			</div>
			<p
				data-testid="staged-answer"
				class="gu-answer min-h-0 overflow-y-auto font-display text-[33px] leading-[1.14] font-semibold tracking-[-0.012em] text-balance"
			>
				{room.answer.text}
			</p>
		</div>
	</div>

	{#if room.youWrote}
		<!-- The author's variant. Not a disabled grid — no grid at all. -->
		<div data-testid="guessing-yours" class="flex shrink-0 flex-col gap-2 pt-1">
			<div
				class="gu-yours flex items-center gap-3 rounded-[20px] border-2 border-action/50 bg-action/15 px-4 py-3"
			>
				<span class="text-[26px] leading-none" aria-hidden="true">🤫</span>
				<div class="flex min-w-0 flex-col">
					<span class="font-display text-[19px] leading-tight font-semibold text-action">
						{m['guessing.yours.title']()}
					</span>
					<span class="text-[13px] leading-snug font-medium text-white/75">
						{m['guessing.yours.body']()}
					</span>
				</div>
			</div>
			<p
				data-testid="guessed-count"
				class="text-center text-[13px] font-semibold text-white/75"
				aria-live="polite"
			>
				{m['guessing.progress']({ count: room.guessedCount, total: guesserTotal })}
			</p>
		</div>
	{:else}
		<div class="flex min-h-0 shrink-[2] flex-col gap-2 pt-1">
			<span
				id="who-label"
				class="shrink-0 text-[11px] font-extrabold tracking-[0.16em] text-action uppercase"
			>
				{m['guessing.who']()}
			</span>

			<!-- `candidates` straight through, in the order the server sent it.
			     Scrolls rather than pushing the answer card out of a short
			     viewport; at typical room sizes it never needs to. -->
			<div
				data-testid="guess-grid"
				role="group"
				aria-labelledby="who-label"
				class="grid min-h-0 grid-cols-2 gap-2.5 overflow-x-hidden overflow-y-auto"
			>
				{#each room.candidates as id (id)}
					{@const p = byId.get(id)}
					{#if p}
						<button
							type="button"
							data-testid="guess-chip"
							data-player={id}
							disabled={locked}
							aria-pressed={selected === id}
							onclick={() => tap(id)}
							class="gu-chip sticker flex min-h-[56px] items-center gap-2.5 rounded-[18px] border-2 px-3 py-2 text-left transition-opacity {selected ===
							id
								? 'border-ink/25 bg-action text-ink'
								: 'border-white/25 bg-surface-2 text-white'} {locked && selected !== id
								? 'opacity-40'
								: ''}"
						>
							<span
								class="gu-avatar grid size-[34px] shrink-0 place-items-center rounded-full bg-surface text-[19px] leading-none"
								aria-hidden="true">{p.emoji}</span
							>
							<span class="gu-name min-w-0 flex-1 truncate font-display text-[17px] font-semibold">
								{p.name}
							</span>
							{#if selected === id}
								<svg
									class="shrink-0"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="4"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m4 13 5 5L20 6" />
								</svg>
							{/if}
						</button>
					{/if}
				{/each}
			</div>

			<p
				data-testid="guess-hint"
				class="shrink-0 text-center text-[12px] font-medium text-white/70"
				aria-live="polite"
			>
				{#if selected !== null}
					{m['guessing.locked']()} · {m['guessing.progress']({
						count: room.guessedCount,
						total: guesserTotal
					})}
				{:else if expired}
					{m['guessing.timeUp']()}
				{:else}
					{m['guessing.hint']()}
				{/if}
			</p>
		</div>
	{/if}
</div>

<style>
	/* Countdown.svelte hardcodes `font-mono text-2xl` and is on the plan's
	   untouched list, so the pill restyles it from outside with a :global
	   override rather than the component growing a prop (ledger ruling 50). */
	.gu-countdown :global([data-testid='countdown']) {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	/* Short-viewport priority (ledger, "Short-viewport priority" — binding on
	   this screen). At ~390×420 the prompt is context and yields: smaller type,
	   clamped to two lines. What must never be clipped is the answer under
	   scrutiny and the chips the player has to hit — so the card keeps a real
	   floor, and every chip keeps its 44px minimum touch target rather than
	   shrinking below it. At full height this query never matches. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}

		.gu-prompt {
			margin-top: 0.5rem;
			padding: 0.5rem 0.75rem;
			gap: 0.125rem;
		}

		.gu-prompt-text {
			font-size: 14px;
			line-height: 1.2;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}

		.gu-stage {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}

		.gu-card {
			min-height: 92px;
			padding: 0.875rem 1rem;
			gap: 0.375rem;
		}

		.gu-answer {
			font-size: 21px;
			line-height: 1.16;
		}

		.gu-chip {
			min-height: 44px;
			padding: 0.25rem 0.625rem;
			gap: 0.5rem;
		}

		.gu-avatar {
			width: 28px;
			height: 28px;
			font-size: 16px;
		}

		.gu-name {
			font-size: 15px;
		}

		.gu-yours {
			padding: 0.5rem 0.75rem;
		}
	}
</style>
