<script lang="ts">
	/**
	 * Generic confirmation dialog (docs/plans/plan3-ledger.md, "Navigation and
	 * leave confirmation"). Built once here so T7/T8 compose it rather than
	 * each inventing one; nothing about it knows what it is confirming.
	 *
	 * Accessibility contract, all of it load-bearing:
	 *  - `role="dialog"` + `aria-modal`, labelled by its own title and
	 *    described by its body.
	 *  - Focus moves into the dialog on open — onto **cancel**, the dismissive
	 *    action, so a stray Enter never destroys anything — and returns to
	 *    whatever was focused before (the trigger) when it closes.
	 *  - Escape and a backdrop tap both cancel. On a phone the backdrop tap is
	 *    the one people actually use.
	 *  - Cancel sits **below** confirm, nearest the thumb, so the stray tap at
	 *    the bottom of a phone is the harmless one.
	 *  - Tab is trapped between the two buttons, because an "unmodal" modal
	 *    lets a keyboard user act on the screen the dialog is warning them
	 *    about.
	 *
	 * Colour: the card is ink, not white. On this palette white is the answer
	 * card and only the answer card (the AHA identity ruling), so an overlay
	 * that also went white would read as game content. `--color-accent-wrong`
	 * is 6.6:1 on the ink card, which is why the destructive action can use it
	 * here even though it is a "large marks only" colour on the field.
	 */
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages';

	let {
		open,
		title,
		body,
		confirmLabel,
		cancelLabel = m['common.cancel'](),
		destructive = false,
		onConfirm,
		onCancel,
		testid = 'confirm-dialog'
	}: {
		open: boolean;
		title: string;
		body: string;
		confirmLabel: string;
		cancelLabel?: string;
		/** Styles the confirm action as the dangerous one. */
		destructive?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
		testid?: string;
	} = $props();

	let dialogEl = $state<HTMLElement | null>(null);
	let cancelEl = $state<HTMLButtonElement | null>(null);

	/** One id pair per instance, so two dialogs on a page never collide. */
	const uid = $props.id();
	const titleId = `${uid}-title`;
	const bodyId = `${uid}-body`;

	/* Focus in on open, back to the trigger on close. `untrack` keeps this
	   effect keyed on `open` alone — re-running it when a ref lands would
	   re-capture the element to return to, which by then is the dialog. */
	$effect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		untrack(() => cancelEl?.focus());
		return () => {
			if (previous?.isConnected) previous.focus();
		};
	});

	function onWindowKeydown(e: KeyboardEvent) {
		if (!open || e.key !== 'Escape') return;
		e.preventDefault();
		onCancel();
	}

	/** Keep Tab inside the dialog — both directions. */
	function trapTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || dialogEl === null) return;
		const focusable = [
			...dialogEl.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')
		];
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (first === undefined || last === undefined) return;
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
	<!-- The backdrop is a dismiss target, not a control: role="presentation"
	     says so, and Escape (above) is the keyboard equivalent. -->
	<div
		class="fixed inset-0 z-[70] grid place-items-end bg-ink/75 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:place-items-center"
		role="presentation"
		data-testid="{testid}-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) onCancel();
		}}
	>
		<div
			bind:this={dialogEl}
			data-testid={testid}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby={titleId}
			aria-describedby={bodyId}
			onkeydown={trapTab}
			class="pop-in w-full max-w-md rounded-card border-2 border-white/15 bg-ink p-6 text-left text-white shadow-[0_10px_0_rgba(0,0,0,0.35)]"
		>
			<h2 id={titleId} class="font-display text-[26px] leading-tight font-bold text-white">
				{title}
			</h2>
			<p id={bodyId} class="mt-3 text-[15px] leading-snug font-medium text-white/75">
				{body}
			</p>
			<div class="mt-6 flex flex-col gap-2.5">
				<button
					type="button"
					data-testid="{testid}-confirm"
					onclick={onConfirm}
					class="sticker flex min-h-12 w-full items-center justify-center rounded-full px-6 font-bold text-ink {destructive
						? 'bg-accent-wrong'
						: 'bg-action'}"
				>
					{confirmLabel}
				</button>
				<button
					bind:this={cancelEl}
					type="button"
					data-testid="{testid}-cancel"
					onclick={onCancel}
					class="sticker flex min-h-12 w-full items-center justify-center rounded-full border-2 border-white/25 bg-white/10 px-6 font-bold text-white"
				>
					{cancelLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.pop-in {
		animation: pop-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pop-in {
			animation: none;
		}
	}
</style>
