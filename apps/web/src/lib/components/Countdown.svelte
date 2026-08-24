<script lang="ts">
	/**
	 * Deadline-based countdown (see the ledger's "countdowns are deadline-based,
	 * not ticked" ruling). The server never sends a tick — it sends `deadline`
	 * (epoch ms) once per phase change, plus its own clock on every `state`
	 * frame. The caller computes `offset = now - Date.now()` (api.ts's
	 * `computeClockOffset`) and passes it in here; a skewed device clock still
	 * renders the right remaining time because we always re-derive it from
	 * `Date.now() + offset`.
	 *
	 * Renders nothing when `deadline` is null (untimed phase).
	 */
	let {
		deadline,
		offset,
		class: className = ""
	}: { deadline: number | null; offset: number; class?: string } = $props();

	let remainingMs = $state(0);

	function tick() {
		remainingMs = deadline === null ? 0 : deadline - (Date.now() + offset);
	}

	$effect(() => {
		if (deadline === null) {
			remainingMs = 0;
			return;
		}
		tick();
		// ~4x/sec — smooth enough to read, cheap enough to leave running.
		const id = setInterval(tick, 250);
		return () => clearInterval(id);
	});

	const display = $derived.by(() => {
		if (deadline === null) return null;
		const ms = Math.max(0, remainingMs);
		if (ms <= 0) return "0:00";
		const totalSec = Math.ceil(ms / 1000);
		if (totalSec < 60) return String(totalSec);
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	});
</script>

{#if deadline !== null}
	<span
		class="font-mono text-2xl font-bold tracking-[0.08em] tabular-nums {className}"
		role="timer"
		data-testid="countdown"
	>
		{display}
	</span>
{/if}
