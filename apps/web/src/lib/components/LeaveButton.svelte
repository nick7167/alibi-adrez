<script lang="ts">
	/**
	 * The way out, in the same place on every screen (docs/plans/plan3-ledger.md,
	 * "Navigation and leave confirmation"). Alibi's game screens had no exit at
	 * all; this game's do, and they all share this one.
	 *
	 * Position and shape match the existing back button on the join screen and
	 * the leave button in the lobby exactly: absolutely placed top-left,
	 * `size-11` (44px, the minimum touch target), a round bordered chip with an
	 * X. The host must be `relative`.
	 *
	 * `confirm` (default true) wires up the destructive confirmation itself, so
	 * a screen only ever writes `<LeaveButton onLeave={leaveRoom} />` and
	 * cannot forget the warning. Pass `confirm={false}` where nothing is lost —
	 * the ledger names those: the join screen, the lobby and the finale.
	 * Guarding a screen with no consequence trains players to dismiss the
	 * dialog unread, which is what makes a real warning useless.
	 */
	import { m } from '$lib/paraglide/messages';
	import ConfirmDialog from './ConfirmDialog.svelte';

	let {
		onLeave,
		confirm = true,
		label = m['nav.leave']()
	}: {
		onLeave: () => void;
		/** False only where leaving costs nothing (join, lobby, finale). */
		confirm?: boolean;
		label?: string;
	} = $props();

	let asking = $state(false);

	function tapped() {
		if (confirm) asking = true;
		else onLeave();
	}
</script>

<button
	type="button"
	data-testid="leave-game"
	aria-label={label}
	title={label}
	onclick={tapped}
	class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-30 grid size-11 place-items-center rounded-full border-2 border-white/30 bg-surface-2 text-white shadow-[0_3px_0_rgba(22,11,61,0.45)]"
>
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="3.5"
		stroke-linecap="round"
		aria-hidden="true"
	>
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
</button>

<ConfirmDialog
	open={asking}
	testid="leave-confirm"
	title={m['leave.title']()}
	body={m['leave.body']()}
	confirmLabel={m['leave.confirm']()}
	destructive
	onCancel={() => (asking = false)}
	onConfirm={() => {
		asking = false;
		onLeave();
	}}
/>
