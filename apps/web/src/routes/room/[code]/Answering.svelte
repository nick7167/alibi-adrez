<script lang="ts">
	/**
	 * ANSWERING — everybody answers every question, on one clock.
	 *
	 * This is the screen the loop change is really about. A player used to write
	 * one line per round; now they work through the whole set in one sitting,
	 * at their own pace, and press a button when they are done.
	 *
	 * Five things the protocol makes true and this screen has to honour:
	 *
	 *  1. **One clock, not one per question.** `room.deadline` covers the whole
	 *     phase. A player can spend it however they like — skip a hard one, come
	 *     back, bank time on an easy one — so the countdown belongs to the
	 *     screen, not to the question showing.
	 *  2. **Every answer is an independent upsert.** `submitEntry` carries a
	 *     `questionIndex` and the server mints that answer's id once, so editing
	 *     never re-slots it. Answers are sent as the player moves off a
	 *     question, not batched at the end — a phone that dies mid-phase should
	 *     lose the current line, not the whole set.
	 *  3. **`doneCount` is a count, and naming nobody is the point.** "3 of 5
	 *     done" — no names, nothing a client could remember into GUESSING to
	 *     rule a non-answerer out.
	 *  4. **Handing in is allowed with blanks.** Skipping a question you hate is
	 *     a feature, not an error state, so the button never demands a full set
	 *     — it just says how many are filled.
	 *  5. **Handing in never locks the field.** The phase runs until everyone is
	 *     done or the clock ends, so a player who hands in early can still come
	 *     back and change something.
	 *
	 * Short-viewport priority (docs/plans/plan3-ledger.md): checked at 390×844
	 * and 390×420, the height iOS leaves with the keyboard up. When space is
	 * short the question yields — smaller type, clamped — and the entry card,
	 * the pager and the hand-in button do not.
	 */
	import { MAX_ENTRY_LENGTH, type AnsweringView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import Countdown from '$lib/components/Countdown.svelte';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		offset,
		onSubmit,
		onHandIn,
		onLeave
	}: {
		room: AnsweringView;
		offset: number;
		onSubmit: (questionIndex: number, text: string) => void;
		onHandIn: () => void;
		onLeave: () => void;
	} = $props();

	/** Which question is showing. Local — the server has no opinion about it. */
	let index = $state(0);

	/**
	 * The player's working text for every question, keyed by index.
	 *
	 * Seeded once from the server's echo. The server rebroadcasts a full
	 * snapshot every time *anybody* acts, so re-assigning on each update would
	 * wipe an edit in progress mid-keystroke — the same hazard the old Writing
	 * screen had with `myEntry`, one level deeper.
	 */
	let drafts = $state<Record<number, string>>({});
	let seeded = false;

	$effect(() => {
		const mine = room.myAnswers;
		if (seeded) return;
		// A reconnect mid-phase repopulates every field the server holds.
		drafts = { ...mine };
		seeded = true;
	});

	const total = $derived(room.questions.length);
	const current = $derived(room.questions[index] ?? '');
	const text = $derived(drafts[index] ?? '');
	const remaining = $derived(MAX_ENTRY_LENGTH - text.length);
	const filled = $derived(
		room.questions.reduce((n, _q, i) => ((drafts[i] ?? '').trim().length > 0 ? n + 1 : n), 0)
	);
	const dots = $derived(Array.from({ length: total }, (_, i) => i));

	/** What the server currently holds for a question, if anything. */
	function serverHas(i: number): string | undefined {
		return room.myAnswers[i];
	}

	/**
	 * Send question `i` if the player has actually changed it. Called when they
	 * navigate away from a question and when they hand in — never on every
	 * keystroke, which would be a message per character.
	 */
	function flush(i: number) {
		const value = (drafts[i] ?? '').trim();
		if (value.length === 0) return; // nothing to send; blank is legal but not stored
		if (value === serverHas(i)) return; // unchanged since the server's copy
		onSubmit(i, value);
	}

	function go(to: number) {
		if (to < 0 || to >= total || to === index) return;
		flush(index);
		index = to;
	}

	function handIn() {
		flush(index);
		onHandIn();
	}

	/* One line per answer, not a paragraph (MAX_ENTRY_LENGTH is 140 for exactly
	   that reason). A textarea so a long sentence wraps and stays readable in
	   the display face, but Enter moves to the next question rather than
	   inserting a newline, and a pasted newline is flattened to a space. */
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		if (index < total - 1) go(index + 1);
		else handIn();
	}

	function onInput(e: Event) {
		const el = e.currentTarget as HTMLTextAreaElement;
		if (el.value.includes('\n')) el.value = el.value.replace(/\s*\n+\s*/g, ' ');
		drafts[index] = el.value;
	}

	/* Leaving the screen must not lose the line the player is on: the phase can
	   end under them (everyone else hands in, or the clock runs out) while a
	   question is half-typed and unsent. */
	$effect(() => {
		return () => flush(index);
	});
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} />

	<!-- Top bar. `pl-14` clears the leave button, which is absolutely placed
	     in the same spot on every screen. -->
	<div class="flex shrink-0 items-center justify-between gap-3 pl-14">
		<div class="flex min-w-0 flex-col gap-1.5">
			<div class="flex flex-wrap items-center gap-1.5" aria-hidden="true">
				{#each dots as i (i)}
					<span
						class="block size-2.5 rounded-full {i === index
							? 'bg-action ring-4 ring-action/25'
							: (drafts[i] ?? '').trim().length > 0
								? 'bg-action/60'
								: 'bg-white/30'}"
					></span>
				{/each}
			</div>
			<span data-testid="question-counter" class="truncate text-[13px] font-semibold text-white/85">
				{m['answering.counter']({ index: index + 1, total })}
			</span>
		</div>

		<div
			class="countdown-pill flex shrink-0 items-center gap-2 rounded-full bg-action px-4 pt-1.5 pb-2 text-ink shadow-[0_4px_0_rgba(22,11,61,0.35)]"
		>
			<Countdown deadline={room.deadline} {offset} class="" />
		</div>
	</div>

	<div class="mt-4 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
		<div class="shrink-0">
			<p class="text-[10px] font-extrabold tracking-[0.18em] text-action uppercase">
				{m['answering.eyebrow']()}
			</p>
			<h1
				data-testid="prompt"
				class="an-prompt-title mt-2 font-display text-[30px] leading-[1.08] font-semibold tracking-[-0.015em] text-balance text-white"
			>
				{current}
			</h1>
		</div>

		<div class="an-card-wrap flex flex-1 shrink-0 flex-col justify-center py-4">
			<!-- White is the answer card and only the answer card. -->
			<div
				class="an-card flex min-h-[190px] flex-col rounded-card bg-surface p-6 text-ink shadow-[0_8px_0_rgba(22,11,61,0.45)]"
			>
				<label for="entry" class="sr-only">{m['answering.placeholder']()}</label>
				<!-- Keyed on the index so switching question gives a fresh field
				     rather than one Svelte reuses with a stale DOM value. -->
				{#key index}
					<textarea
						id="entry"
						data-testid="entry-field"
						rows="3"
						maxlength={MAX_ENTRY_LENGTH}
						enterkeyhint={index < total - 1 ? 'next' : 'done'}
						autocomplete="off"
						autocapitalize="sentences"
						placeholder={m['answering.placeholder']()}
						value={text}
						oninput={onInput}
						onkeydown={onKeydown}
						class="an-textarea w-full flex-1 resize-none bg-transparent font-display text-[24px] leading-[1.18] font-semibold tracking-[-0.01em] text-ink outline-none placeholder:font-normal placeholder:text-ink/25"
					></textarea>
				{/key}

				<div class="mt-2 flex shrink-0 items-center justify-between gap-3">
					<span class="an-skip-hint text-[11px] font-medium text-ink/35">
						{m['answering.skipHint']()}
					</span>
					<span
						data-testid="remaining"
						class="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums {remaining <=
						20
							? 'bg-action text-ink'
							: 'text-ink/40'}"
						aria-live="polite"
					>
						{m['answering.remaining']({ remaining })}
					</span>
				</div>
			</div>

			<!-- The pager. Both controls keep a 44px touch target at every
			     viewport height; only their padding tightens when space is short. -->
			<div class="an-pager mt-3 flex shrink-0 items-center justify-between gap-3">
				<button
					type="button"
					data-testid="prev-question"
					disabled={index === 0}
					onclick={() => go(index - 1)}
					class="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-white/25 bg-white/10 px-5 text-[14px] font-bold text-white disabled:opacity-30"
				>
					<svg
						width="16"
						height="16"
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
					{m['answering.back']()}
				</button>
				<button
					type="button"
					data-testid="next-question"
					disabled={index >= total - 1}
					onclick={() => go(index + 1)}
					class="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-white/25 bg-white/10 px-5 text-[14px] font-bold text-white disabled:opacity-30"
				>
					{m['answering.next']()}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m9 5 7 7-7 7" />
					</svg>
				</button>
			</div>
		</div>
	</div>

	<!-- Footer: hand in, then the roomful counter. Handing in does not disable
	     anything — the player can keep editing until the phase actually ends. -->
	<div class="an-footer shrink-0 pt-3">
		{#if room.handedIn}
			<div
				data-testid="handed-in-chip"
				class="mb-2 flex items-center justify-center gap-2 rounded-full bg-accent-right px-4 py-2 text-[12px] font-extrabold tracking-[0.1em] text-ink uppercase"
			>
				<svg
					width="13"
					height="13"
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
				{m['answering.handedIn']()}
			</div>
			<p class="an-edit-hint mb-2 text-center text-[13px] font-medium text-white/70">
				{m['answering.editHint']()}
			</p>
		{:else}
			<button
				type="button"
				data-testid="hand-in"
				onclick={handIn}
				class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-action px-8 text-lg font-extrabold text-ink"
			>
				{m['answering.doneWith']({ filled, total })}
			</button>
		{/if}

		<p
			data-testid="done-count"
			class="an-done-count mt-2 text-center text-[13px] font-semibold text-white/70"
			aria-live="polite"
		>
			{m['answering.progress']({ count: room.doneCount, total: room.players.length })}
		</p>
	</div>
</div>

<style>
	/* Countdown.svelte owns its own font/size classes, so the pill restyles it
	   from outside rather than growing a prop (ledger ruling 50/60). */
	.countdown-pill :global([data-testid='countdown']) {
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	/* Short-viewport priority (docs/plans/plan3-ledger.md): at ≈390×420 — the
	   height iOS leaves with the keyboard up — the question is context and the
	   entry card, the pager and the hand-in button are the task. The question
	   yields (smaller type, clamped to two lines) and the paddings tighten;
	   the card keeps a real floor and the touch targets keep their 44px.
	   At full height this query never matches. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(1rem, env(safe-area-inset-bottom));
		}

		.an-prompt-title {
			margin-top: 0.25rem;
			font-size: 18px;
			line-height: 1.15;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}

		.an-card-wrap {
			padding-top: 0.375rem;
			padding-bottom: 0.375rem;
		}

		.an-card {
			min-height: 104px;
			padding: 0.75rem;
		}

		.an-textarea {
			font-size: 18px;
			line-height: 1.25;
		}

		.an-skip-hint {
			display: none;
		}

		.an-pager {
			margin-top: 0.5rem;
		}

		.an-footer {
			padding-top: 0.375rem;
		}

		.an-edit-hint {
			margin-bottom: 0.25rem;
		}

		.an-done-count {
			margin-top: 0.25rem;
		}
	}
</style>
