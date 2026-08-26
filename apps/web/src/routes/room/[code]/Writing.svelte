<script lang="ts">
	/**
	 * WRITING — everyone answers the same prompt, anonymously, under a clock.
	 *
	 * Design direction A · AHA (docs/plans/plan3-ledger.md, "Chosen identity"):
	 * electric-grape field, the entry card is the one white surface on the
	 * screen, the yellow action colour carries the countdown and the primary
	 * button. Fredoka for the prompt and the player's own words; Figtree for
	 * every label, count and hint.
	 *
	 * Three things the protocol makes true and this screen has to honour:
	 *
	 *  1. **Submitting is an upsert.** `submitEntry` overwrites, there is no
	 *     `ALREADY_ANSWERED`, and a player can keep editing until the deadline.
	 *     So handing in never disables the field — it swaps the button to
	 *     "change my answer" and says so out loud. A submitted-then-edited
	 *     state is normal, not an error.
	 *  2. **`submittedCount` is a count, and naming nobody is the point** (the
	 *     ledger's `submittedIds` ruling). "4 of 6 written" — no names, no
	 *     avatars, nothing a client could remember into GUESSING to rule a
	 *     non-writer out.
	 *  3. **The countdown is deadline-based**, never ticked by the server. The
	 *     shared `Countdown` renders `deadline - (Date.now() + offset)`.
	 */
	import { MAX_ENTRY_LENGTH, type WritingView } from '@aha/shared';
	import { m } from '$lib/paraglide/messages';
	import Countdown from '$lib/components/Countdown.svelte';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

	let {
		room,
		offset,
		onSubmit,
		onLeave
	}: {
		room: WritingView;
		offset: number;
		onSubmit: (text: string) => void;
		onLeave: () => void;
	} = $props();

	let text = $state('');
	/** Whether the field has already been filled from the server's echo. */
	let seeded = false;

	/* Prefill from `myEntry` so a reconnect — or a re-render after somebody
	   else hands in — comes back to the player's own text. Seeded **once**:
	   the server broadcasts a fresh snapshot every time anyone submits, and
	   blindly re-assigning would wipe an edit-in-progress mid-keystroke. */
	$effect(() => {
		const mine = room.myEntry;
		if (!seeded && mine !== undefined) {
			text = mine;
			seeded = true;
		}
	});

	const trimmed = $derived(text.trim());
	const remaining = $derived(MAX_ENTRY_LENGTH - text.length);
	/** What the server currently holds for this player, if anything. */
	const submitted = $derived(room.myEntry);
	const hasSubmitted = $derived(submitted !== undefined);
	const changed = $derived(trimmed.length > 0 && trimmed !== submitted);
	const canSend = $derived(hasSubmitted ? changed : trimmed.length > 0);

	function send() {
		if (!canSend) return;
		onSubmit(trimmed);
	}

	/* One line, not a paragraph (MAX_ENTRY_LENGTH is 140 for exactly that
	   reason). A textarea so a long sentence wraps and stays readable in the
	   display face, but Enter hands in rather than inserting a newline, and a
	   pasted newline is flattened to a space. */
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		send();
	}

	function onInput(e: Event) {
		const el = e.currentTarget as HTMLTextAreaElement;
		if (el.value.includes('\n')) el.value = el.value.replace(/\s*\n+\s*/g, ' ');
		text = el.value;
	}

	const roundDots = $derived(Array.from({ length: room.roundCount }, (_, i) => i + 1));
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
	<LeaveButton {onLeave} />

	<!-- Top bar. `pl-14` clears the leave button, which is absolutely placed
	     in the same spot on every screen. -->
	<div class="flex shrink-0 items-center justify-between gap-3 pl-14">
		<div class="flex min-w-0 flex-col gap-1.5">
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

		<div
			class="countdown-pill flex shrink-0 items-center gap-2 rounded-full bg-action px-4 pt-1.5 pb-2 text-ink shadow-[0_4px_0_rgba(22,11,61,0.35)]"
		>
			<Countdown deadline={room.deadline} {offset} class="" />
		</div>
	</div>

	<!-- The one scroll region: the prompt sits under the top bar, the card
	     floats in whatever height is left, exactly as the artboard has it. -->
	<div class="mt-4 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
		<div class="shrink-0">
			<p class="text-[10px] font-extrabold tracking-[0.18em] text-action uppercase">
				{m['writing.eyebrow']()}
			</p>
			<h1
				data-testid="prompt"
				class="wr-prompt-title mt-2 font-display text-[34px] leading-[1.08] font-semibold tracking-[-0.015em] text-balance text-white"
			>
				{room.prompt}
			</h1>
		</div>

		<div class="wr-card-wrap flex flex-1 shrink-0 flex-col justify-center py-5">
			<!-- White is the answer card and only the answer card. Short-viewport
			     priority (docs/plans/plan3-ledger.md): when the keyboard eats the
			     height, this card is the one thing that must never be clipped —
			     the compact media query below shrinks the prompt and paddings
			     around it instead, never this. -->
			<div
				class="wr-card flex min-h-[240px] flex-col rounded-card bg-surface p-6 text-ink shadow-[0_8px_0_rgba(22,11,61,0.45)]"
			>
				<label for="entry" class="sr-only">{m['writing.placeholder']()}</label>
				<textarea
					id="entry"
					data-testid="entry-field"
					rows="3"
					maxlength={MAX_ENTRY_LENGTH}
					enterkeyhint="send"
					autocomplete="off"
					autocapitalize="sentences"
					placeholder={m['writing.placeholder']()}
					value={text}
					oninput={onInput}
					onkeydown={onKeydown}
					class="wr-textarea w-full flex-1 resize-none bg-transparent font-display text-[26px] leading-[1.18] font-semibold tracking-[-0.01em] text-ink outline-none placeholder:font-normal placeholder:text-ink/25"
				></textarea>

				<div class="mt-2 flex shrink-0 items-center justify-between gap-3">
					{#if hasSubmitted}
						<span
							data-testid="submitted-chip"
							class="inline-flex items-center gap-1.5 rounded-full bg-accent-right px-3 py-1 text-[11px] font-extrabold tracking-[0.1em] text-ink uppercase"
						>
							<svg
								width="12"
								height="12"
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
							{m['writing.submitted']()}
						</span>
					{:else}
						<span></span>
					{/if}
					<span
						data-testid="remaining"
						class="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums {remaining <=
						20
							? 'bg-action text-ink'
							: 'text-ink/40'}"
						aria-live="polite"
					>
						{m['writing.remaining']({ remaining })}
					</span>
				</div>
			</div>

			{#if hasSubmitted}
				<p class="wr-edit-hint mt-3 text-center text-[13px] font-medium text-white/70">
					{m['writing.editHint']()}
				</p>
			{/if}
		</div>
	</div>

	<!-- Footer: the one primary action, then the roomful counter. -->
	<div class="wr-footer shrink-0 pt-4">
		<button
			type="button"
			data-testid="submit-entry"
			disabled={!canSend}
			onclick={send}
			class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-action px-8 text-lg font-extrabold text-ink disabled:opacity-40"
		>
			{hasSubmitted ? m['writing.update']() : m['writing.submit']()}
		</button>
		<p
			data-testid="written-count"
			class="wr-written-count mt-3 text-center text-[13px] font-semibold text-white/75"
			aria-live="polite"
		>
			{m['writing.progress']({ count: room.submittedCount, total: room.players.length })}
		</p>
	</div>
</div>

<style>
	/* Countdown.svelte owns its own font/size classes, so the pill restyles it
	   from outside rather than growing a prop. It is already Fredoka
	   (font-display); this override only shrinks it to the size the pill
	   wants and drops the default letter-spacing, as the artboard has it. */
	.countdown-pill :global([data-testid='countdown']) {
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	/* Short-viewport priority (docs/plans/plan3-ledger.md, "Short-viewport
	   priority" — binding on this screen): when the keyboard eats the
	   height (≈390×420, the height iOS leaves while a player is typing),
	   the prompt is context and the entry card is the task. The prompt
	   yields — smaller type, clamped to two lines — so the card keeps a
	   real minimum height and the "Hand it in" button never gets clipped
	   or overlapped. At full height this query never matches, so the
	   screen renders exactly as it always has — nothing below changes
	   that case.

	   These rules are unlayered Svelte component styles, which is what
	   lets a two-class selector (scoped class + component hash) or even a
	   single new class outrank Tailwind's own (layered) utility classes and
	   app.css's unlayered `.pt-safe`/`.pb-safe` (see app.css's comment on
	   why those are unlayered) without touching either. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(1rem, env(safe-area-inset-bottom));
		}

		.wr-prompt-title {
			margin-top: 0.25rem;
			font-size: 19px;
			line-height: 1.15;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}

		.wr-card-wrap {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}

		.wr-card {
			min-height: 128px;
			padding: 0.75rem;
		}

		.wr-textarea {
			font-size: 19px;
			line-height: 1.25;
		}

		.wr-edit-hint {
			margin-top: 0.375rem;
		}

		.wr-footer {
			padding-top: 0.5rem;
		}

		.wr-written-count {
			margin-top: 0.25rem;
		}
	}
</style>
