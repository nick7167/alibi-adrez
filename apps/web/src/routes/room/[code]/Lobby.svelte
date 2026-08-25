<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import {
		DEFAULT_SETTINGS,
		MAX_PLAYERS,
		MIN_PLAYERS,
		type LobbyView,
		type Settings
	} from '@aha/shared';

	let {
		isHost,
		room,
		onStart,
		onUpdate,
		onLeave
	}: {
		isHost: boolean;
		room: LobbyView;
		onStart: () => void;
		onUpdate: (patch: Partial<Settings>) => void;
		onLeave: () => void;
	} = $props();

	/* Share banner: tap-to-copy (+ native share sheet when available) */
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	async function shareCode() {
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ title: 'AHA', text: room.code });
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

	/* Compact player chips cycling palette fills */
	const STICKERS = [
		'bg-sunshine text-ink',
		'bg-cobalt text-white',
		'bg-coral text-white',
		'bg-mint text-ink',
		'bg-grape text-white'
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

	const canStart = $derived(room.players.length >= MIN_PLAYERS);

	/* Move focus to the lobby heading when the form swaps over to this screen. */
	let headingEl = $state<HTMLElement | null>(null);

	$effect(() => {
		headingEl?.focus();
	});
</script>

<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col px-5 pt-safe pb-safe">
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
		data-testid="leave-room"
		aria-label={m['lobby.leave']()}
		title={m['lobby.leave']()}
		onclick={onLeave}
		class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 grid size-11 place-items-center rounded-full border-4 border-coral bg-paper text-coral"
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

	<!-- The room code is evidence: mono, coral, stamped. -->
	<button
		type="button"
		data-testid="share-code"
		onclick={shareCode}
		class="flex shrink-0 flex-col items-center justify-center px-6 py-2"
	>
		<span class="field-label flex items-center gap-2">
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path
					d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
				/>
			</svg>
			{m['lobby.share']()}
			{#if copied}
				<span
					class="rounded-full bg-mint px-2 py-0.5 font-mono text-[10px] tracking-normal text-ink normal-case"
					role="status"
				>
					{m['lobby.copied']()}
				</span>
			{/if}
		</span>
		<span
			class="stamp-frame mt-2 bg-paper px-4 pt-1.5 pb-1 font-mono text-[42px] leading-tight font-bold tracking-[0.12em] text-coral tabular-nums"
		>
			{room.code}
		</span>
		<span class="mt-1.5 font-mono text-xs text-ink/50">{m['lobby.copyHint']()}</span>
	</button>

	<div class="relative min-h-0 flex-1">
		<div class="h-full overflow-x-hidden overflow-y-auto px-1">
			<div class="mt-5 flex items-baseline justify-between">
				<h2
					bind:this={headingEl}
					data-testid="players-heading"
					tabindex="-1"
					class="reveal text-2xl font-extrabold text-ink outline-none"
				>
					{m['lobby.players']()}
				</h2>
				<span class="font-mono text-[13px] font-bold text-ink/55 tabular-nums">
					{room.players.length}/{MAX_PLAYERS}
				</span>
			</div>

			<ul class="mt-3 flex flex-col gap-2" role="list">
				{#each room.players as player, i (player.id)}
					<li
						data-testid="player-card"
						class={`pop-in relative flex min-h-[52px] items-center gap-2.5 rounded-[14px] px-3 py-2 shadow-[0_2px_0_rgba(23,21,49,0.15)] ${
							STICKERS[i % STICKERS.length]
						}`}
						style="animation-delay: {i * 60}ms"
					>
						<span class="font-mono text-xs font-bold opacity-70 tabular-nums" aria-hidden="true">
							{String(i + 1).padStart(2, '0')}
						</span>
						<span class="grid size-9 shrink-0 place-items-center rounded-full bg-white/70 text-xl">
							{player.emoji}
						</span>
						<span data-testid="player-name" class="flex-1 truncate text-base font-bold">{player.name}</span>
						{#if player.id === room.hostId}
							<span class="stamp shrink-0" title={m['lobby.hostTag']()}>
								{m['lobby.hostTag']()}
							</span>
						{/if}
					</li>
				{/each}
			</ul>

			{#if isHost}
				<section
					class="reveal mt-5 rounded-card border-[3px] border-ink bg-manila p-4 shadow-[0_5px_0_rgba(23,21,49,0.18)]"
					style="animation-delay: {room.players.length * 60}ms"
				>
					<h3 class="field-label">{m['lobby.settings.title']()}</h3>
					<div class="mt-1 flex flex-col">
						{#each NUM_FIELDS as f (f.key)}
							<div class="flex min-h-[52px] items-center gap-2.5 py-1">
								<span class="font-semibold text-ink" id={`setting-${f.key}`}>{m[f.labelKey]()}</span>
								<span class="leader" aria-hidden="true"></span>
								<span
									class="flex shrink-0 items-center gap-2"
									role="group"
									aria-labelledby={`setting-${f.key}`}
								>
									<button
										type="button"
										data-testid={`dec-${f.key}`}
										aria-label={`− ${m[f.labelKey]()}`}
										disabled={draft[f.key] <= f.min}
										onclick={() => bump(f, -1)}
										class="grid size-11 place-items-center rounded-full bg-cobalt text-white disabled:opacity-30"
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
											<path d="M6 12h12" />
										</svg>
									</button>
									<span
										class="w-8 text-center font-mono text-lg font-bold tabular-nums"
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
										class="grid size-11 place-items-center rounded-full bg-cobalt text-white disabled:opacity-30"
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
											<path d="M12 6v12M6 12h12" />
										</svg>
									</button>
								</span>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</div>
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-paper"
			aria-hidden="true"
		></div>
	</div>

	<div class="shrink-0 pt-4">
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
				<p class="mt-3 text-center font-semibold text-ink/70">{m['lobby.needThree']()}</p>
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

	@media (prefers-reduced-motion: reduce) {
		.pop-in,
		.reveal,
		.confetti-bit {
			animation: none;
		}
	}
</style>
