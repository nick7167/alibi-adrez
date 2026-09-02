<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages';

	let {
		hidden,
		hiddenByPlayer = false,
		onToggleHidden,
		onReport
	}: {
		hidden: boolean;
		hiddenByPlayer?: boolean;
		onToggleHidden: () => void;
		onReport: () => void;
	} = $props();

	let open = $state(false);
	let firstAction = $state<HTMLButtonElement | null>(null);
	let reportAction = $state<HTMLButtonElement | null>(null);
	let dialogEl = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		untrack(() => (firstAction ?? reportAction)?.focus());
		return () => {
			if (previous?.isConnected) previous.focus();
		};
	});

	function trapTab(event: KeyboardEvent) {
		if (event.key !== 'Tab' || dialogEl === null) return;
		const focusable = [...dialogEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
		const first = focusable[0];
		const last = focusable.at(-1);
		if (first === undefined || last === undefined) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function toggleHidden() {
		onToggleHidden();
		open = false;
	}

	function report() {
		onReport();
		open = false;
	}
</script>

<button
	type="button"
	aria-label={m['safety.answerActions']()}
	aria-expanded={open}
	aria-haspopup="dialog"
	onclick={() => (open = true)}
	class="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink/15 bg-ink/5 font-bold text-ink"
>•••</button>

{#if open}
	<div
		class="fixed inset-0 z-[70] grid place-items-end bg-ink/55 p-4 pb-safe"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) open = false;
		}}
	>
		<div
			bind:this={dialogEl}
			role="dialog"
			aria-modal="true"
			aria-label={m['safety.answerActions']()}
			tabindex="-1"
			onkeydown={trapTab}
			class="pop-in relative z-10 mx-auto flex w-full max-w-md flex-col gap-2 rounded-card bg-surface p-4 text-ink shadow-xl"
		>
			{#if hiddenByPlayer}
				<p class="rounded-2xl bg-field/10 px-4 py-3 text-sm font-semibold text-ink/75">
					{m['safety.hiddenByPlayer']()}
				</p>
			{:else}
				<button
					bind:this={firstAction}
					type="button"
					onclick={toggleHidden}
					class="min-h-12 rounded-full bg-field px-5 font-display text-base font-semibold text-white"
				>
					{hidden ? m['safety.showAnswer']() : m['safety.hideAnswer']()}
				</button>
			{/if}
			<button
				bind:this={reportAction}
				type="button"
				onclick={report}
				class="min-h-12 rounded-full bg-accent-wrong px-5 font-display text-base font-semibold text-ink"
			>
				{m['safety.reportAnswer']()}
			</button>
			<button
				type="button"
				onclick={() => (open = false)}
				class="min-h-12 rounded-full border-2 border-ink/15 px-5 font-display text-base font-semibold"
			>
				{m['common.cancel']()}
			</button>
		</div>
	</div>
{/if}

<svelte:window onkeydown={(event) => {
	if (open && event.key === 'Escape') open = false;
}} />
