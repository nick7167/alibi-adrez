<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { DEFAULT_SETTINGS, MAX_PLAYERS, type LobbyView, type Settings } from '@alibi/shared';

	let {
		isHost,
		room,
		onStart,
		onUpdate
	}: {
		isHost: boolean;
		room: LobbyView;
		onStart: () => void;
		onUpdate: (patch: Partial<Settings>) => void;
	} = $props();

	/* Share banner: tap-to-copy (+ native share sheet when available) */
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	async function shareCode() {
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ title: 'ALIBI', text: room.code });
				return;
			}
			await navigator.clipboard.writeText(room.code);
			copied = true;
			if (copiedTimer !== null) clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 1600);
		} catch {
			// share sheet dismissed / clipboard unavailable — no feedback needed
		}
	}

	/* Rotated sticker cards cycling palette fills */
	const STICKERS = [
		'bg-sunshine text-ink -rotate-2',
		'bg-cobalt text-white rotate-1',
		'bg-coral text-white -rotate-1',
		'bg-mint text-ink rotate-2',
		'bg-grape text-white -rotate-2'
	];

	/* Confetti burst on player join/leave */
	const CONFETTI = [
		{ left: '8%', top: '20%', tx: '-70px', ty: '40px', tr: '-220deg', color: 'bg-sunshine' },
		{ left: '20%', top: '10%', tx: '-30px', ty: '-50px', tr: '160deg', color: 'bg-cobalt' },
		{ left: '34%', top: '24%', tx: '10px', ty: '60px', tr: '-140deg', color: 'bg-coral' },
		{ left: '48%', top: '8%', tx: '40px', ty: '-45px', tr: '200deg', color: 'bg-mint' },
		{ left: '62%', top: '22%', tx: '65px', ty: '35px', tr: '-180deg', color: 'bg-grape' },
		{ left: '76%', top: '12%', tx: '85px', ty: '-30px', tr: '120deg', color: 'bg-sunshine' },
		{ left: '88%', top: '26%', tx: '55px', ty: '55px', tr: '-160deg', color: 'bg-cobalt' },
		{ left: '12%', top: '40%', tx: '-55px', ty: '-35px', tr: '170deg', color: 'bg-mint' },
		{ left: '42%', top: '42%', tx: '0px', ty: '-65px', tr: '-120deg', color: 'bg-coral' },
		{ left: '68%', top: '44%', tx: '45px', ty: '-40px', tr: '210deg', color: 'bg-grape' },
		{ left: '28%', top: '34%', tx: '-20px', ty: '55px', tr: '150deg', color: 'bg-paper' },
		{ left: '82%', top: '38%', tx: '70px', ty: '45px', tr: '-200deg', color: 'bg-sunshine' }
	];

	let burstKey = $state(0);
	let prevPlayerCount = -1;

	$effect(() => {
		const n = room.players.length;
		if (prevPlayerCount !== -1 && n !== prevPlayerCount) burstKey++;
		prevPlayerCount = n;
	});

	/* Host-only numeric steppers → debounced updateSettings patches */
	const NUM_FIELDS = [
		{ key: 'rounds', min: 1, max: 10, step: 1, labelKey: 'lobby.settings.rounds' },
		{ key: 'planningSec', min: 15, max: 120, step: 5, labelKey: 'lobby.settings.planning' },
		{ key: 'answerSec', min: 10, max: 90, step: 5, labelKey: 'lobby.settings.answers' },
		{ key: 'questionCount', min: 3, max: 10, step: 1, labelKey: 'lobby.settings.questions' }
	] as const;

	// Seeded neutrally; the sync effect below immediately adopts the
	// authoritative settings from the latest server snapshot.
	let draft = $state<Settings>(structuredClone(DEFAULT_SETTINGS));
	let pendingPatch: Partial<Settings> = {};
	let patchTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const s = room.settings;
		for (const f of NUM_FIELDS) {
			if (!(f.key in pendingPatch)) draft[f.key] = s[f.key];
		}
	});

	function bump(f: (typeof NUM_FIELDS)[number], dir: 1 | -1) {
		const next = Math.min(f.max, Math.max(f.min, draft[f.key] + dir * f.step));
		draft[f.key] = next;
		pendingPatch = { ...pendingPatch, [f.key]: next };
		if (patchTimer !== null) clearTimeout(patchTimer);
		patchTimer = setTimeout(() => {
			onUpdate(pendingPatch);
			pendingPatch = {};
			patchTimer = null;
		}, 300);
	}

	/* On teardown: cancel the debounced patch (dropping it deliberately —
	   a stray updateSettings must not fire after the phase leaves LOBBY)
	   and clear the "copied" chip timer. */
	$effect(() => {
		return () => {
			if (patchTimer !== null) clearTimeout(patchTimer);
			patchTimer = null;
			pendingPatch = {};
			if (copiedTimer !== null) clearTimeout(copiedTimer);
			copiedTimer = null;
		};
	});

	const canStart = $derived(room.players.length >= 2);

	/* Move focus to the lobby heading when the form swaps over to this screen. */
	let headingEl = $state<HTMLElement | null>(null);

	$effect(() => {
		headingEl?.focus();
	});
</script>

<div class="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-10">
	{#if burstKey > 0}
		{#key burstKey}
			<!-- confetti burst (decorative) -->
			<div class="pointer-events-none absolute inset-x-0 top-24 z-20" aria-hidden="true">
				{#each CONFETTI as c (c.left)}
					<span
						class="confetti-bit absolute h-3 w-3 {c.color}"
						style="left:{c.left}; top:{c.top}; --tx:{c.tx}; --ty:{c.ty}; --tr:{c.tr};"
					></span>
				{/each}
			</div>
		{/key}
	{/if}

	<button
		type="button"
		data-testid="share-code"
		onclick={shareCode}
		class="sticker mt-2 flex min-h-14 flex-col items-center justify-center rounded-card px-6 py-4"
	>
		<span class="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink/70">
			{m['lobby.share']()}
			{#if copied}
				<span class="rounded-full bg-mint px-2 py-0.5 text-xs font-bold normal-case tracking-normal text-ink" role="status">
					{m['lobby.copied']()}
				</span>
			{/if}
		</span>
		<span class="mt-1 text-6xl leading-none font-extrabold tracking-[0.18em] text-cobalt tabular-nums sm:text-7xl">
			{room.code}
		</span>
	</button>

	<h2
		bind:this={headingEl}
		data-testid="players-heading"
		tabindex="-1"
		class="reveal mt-10 text-2xl font-extrabold text-ink outline-none"
	>
		{m['lobby.players']()} <span class="text-ink/50">{room.players.length}/{MAX_PLAYERS}</span>
	</h2>

	<ul class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
		{#each room.players as player, i (player.id)}
			<li
				data-testid="player-card"
				class={`pop-in relative flex min-h-16 items-center gap-3 rounded-card px-4 py-3 shadow-[0_4px_0_rgba(23,21,49,0.18)] ${
					STICKERS[i % STICKERS.length]
				}`}
				style="animation-delay: {i * 60}ms"
			>
				<span class="grid size-12 shrink-0 place-items-center rounded-full bg-white/70 text-2xl">
					{player.emoji}
				</span>
				<span class="truncate text-lg font-bold">{player.name}</span>
				{#if player.id === room.hostId}
					<span
						class="starburst absolute -top-3 -right-2 grid size-11 rotate-12 place-items-center bg-grape text-lg"
						title={m['lobby.hostTag']()}
					>
						👑
					</span>
				{/if}
			</li>
		{/each}
	</ul>

	{#if isHost}
		<section
			class="reveal mt-8 rounded-card border-[3px] border-ink bg-paper p-5 shadow-[0_5px_0_rgba(23,21,49,0.15)]"
			style="animation-delay: {room.players.length * 60}ms"
		>
			<h3 class="text-sm font-bold uppercase tracking-widest text-ink/70">{m['lobby.settings.title']()}</h3>
			<div class="mt-3 flex flex-col divide-y divide-ink/10">
				{#each NUM_FIELDS as f (f.key)}
					<div class="flex min-h-14 items-center justify-between gap-3 py-1">
						<span class="font-semibold text-ink" id={`setting-${f.key}`}>{m[f.labelKey]()}</span>
						<span class="flex items-center gap-2" role="group" aria-labelledby={`setting-${f.key}`}>
							<button
								type="button"
								data-testid={`dec-${f.key}`}
								aria-label={`− ${m[f.labelKey]()}`}
								disabled={draft[f.key] <= f.min}
								onclick={() => bump(f, -1)}
								class="grid size-11 place-items-center rounded-full bg-cobalt text-xl font-bold text-white disabled:opacity-30"
							>
								−
							</button>
							<span
								class="w-9 text-center text-lg font-extrabold tabular-nums"
								data-testid={`value-${f.key}`}
							>
								{draft[f.key]}
							</span>
							<button
								type="button"
								data-testid={`inc-${f.key}`}
								aria-label={`+ ${m[f.labelKey]()}`}
								disabled={draft[f.key] >= f.max}
								onclick={() => bump(f, 1)}
								class="grid size-11 place-items-center rounded-full bg-cobalt text-xl font-bold text-white disabled:opacity-30"
							>
								+
							</button>
						</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<div class="mt-auto pt-8">
		{#if isHost}
			<button
				type="button"
				data-testid="start-game"
				disabled={!canStart}
				onclick={onStart}
				class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-cobalt px-8 text-lg font-bold text-white disabled:opacity-40"
			>
				{m['lobby.start']()}
			</button>
			{#if !canStart}
				<p class="mt-3 text-center font-semibold text-ink/70">{m['lobby.needTwo']()}</p>
			{/if}
		{:else}
			<p
				data-testid="waiting-host"
				class="flex min-h-14 items-center justify-center rounded-full border-[3px] border-dashed border-ink/30 px-6 text-center font-bold text-ink/70"
			>
				{m['lobby.waitingHost']()}
			</p>
		{/if}
	</div>
</div>

<style>
	.pop-in {
		animation: pop-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.reveal {
		animation: reveal-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes reveal-in {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* 14-point sticker burst for the host tag */
	.starburst {
		clip-path: polygon(
			100% 50%, 90.2% 60.9%, 96.6% 74.1%, 82.6% 77.7%, 80.4% 92.4%, 67.3% 86.6%,
			58.7% 98.5%, 50% 87.5%, 41.3% 98.5%, 32.7% 86.6%, 19.6% 92.4%, 17.4% 77.7%,
			3.4% 74.1%, 9.8% 60.9%, 0% 50%, 9.8% 39.1%, 3.4% 25.9%, 17.4% 22.3%,
			19.6% 7.6%, 32.7% 13.4%, 41.3% 1.5%, 50% 12.5%, 58.7% 1.5%, 67.3% 13.4%,
			80.4% 7.6%, 82.6% 22.3%, 96.6% 25.9%, 90.2% 39.1%
		);
	}

	.confetti-bit {
		animation: confetti-pop 900ms ease-out forwards;
	}

	@keyframes confetti-pop {
		0% {
			transform: translate(0, 0) rotate(0deg);
			opacity: 0.9;
		}
		100% {
			transform: translate(var(--tx), var(--ty)) rotate(var(--tr));
			opacity: 0;
		}
	}

	.sticker {
		box-shadow: 0 5px 0 rgba(23, 21, 49, 0.2);
		background-color: var(--color-paper);
		border: 3px solid var(--color-ink);
		transition: box-shadow 100ms ease, transform 100ms ease;
	}

	.sticker:active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 rgba(23, 21, 49, 0.2);
	}

	@media (prefers-reduced-motion: reduce) {
		.pop-in,
		.reveal,
		.confetti-bit {
			animation: none;
		}
		.sticker {
			transition: none;
		}
	}
</style>
