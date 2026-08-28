<script lang="ts">
	/**
	 * LOBBY — the room fills up and the host sets the game up.
	 *
	 * What changed in T8: the settings are this game's, not Alibi's. Three
	 * numeric dials (`rounds`, `writeSec`, `guessSec`) and the prompt-pack
	 * selection, which is the only setting with a social consequence.
	 *
	 * Two rules the pack UI exists to honour:
	 *
	 *  - **`nextSettings` refuses to leave `packs` empty** — a patch that would
	 *    empty it is ignored rather than half-applied, because a room with no
	 *    packs has nothing to ask. So the UI must never *try*: the last enabled
	 *    pack's toggle is disabled, with a line saying why. A control that
	 *    silently does nothing is worse than one that is visibly unavailable.
	 *  - **Spicy is opt-in and labelled plainly, not cutely.** A host turning it
	 *    on in mixed company has to know what they are enabling, so the pack is
	 *    called what it is — confessions — and its line names the material
	 *    rather than winking at it.
	 *
	 * T9 added the third rule: **the enabled packs are visible to everyone**,
	 * not just to the host. Only the host has the switches, but a guest can be
	 * asked to answer a personal prompt, so they get a read-only summary of what
	 * is on before they agree to play. Consent only the host can see is not
	 * consent.
	 *
	 * The screen wears the AHA field like every other screen on this route (the
	 * ledger's "Chosen identity" ruling), which is also what released the last
	 * Alibi CSS primitives it was built on: `.stamp-frame` (the room code) and
	 * `.leader` (the settings rows). The rest went with T9's landing page and
	 * rulebook rewrite.
	 */
	import { tick } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import {
		DEFAULT_SETTINGS,
		MAX_PLAYERS,
		MIN_PLAYERS,
		PACK_IDS,
		PROMPTS,
		SETTINGS_BOUNDS,
		INTRO_MS,
		STANDINGS_MS,
		type LobbyView,
		type PackId,
		type Settings
	} from '@aha/shared';
	import LeaveButton from '$lib/components/LeaveButton.svelte';

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

	/* Confetti burst on player join/leave */
	const CONFETTI = [
		{ left: '8%', top: '20%', tx: '-70px', ty: '40px', tr: '-220deg', color: 'bg-action' },
		{ left: '20%', top: '10%', tx: '-30px', ty: '-50px', tr: '160deg', color: 'bg-accent-right' },
		{ left: '34%', top: '24%', tx: '10px', ty: '60px', tr: '-140deg', color: 'bg-accent-wrong' },
		{ left: '48%', top: '8%', tx: '40px', ty: '-45px', tr: '200deg', color: 'bg-surface' },
		{ left: '62%', top: '22%', tx: '65px', ty: '35px', tr: '-180deg', color: 'bg-action' },
		{ left: '76%', top: '12%', tx: '85px', ty: '-30px', tr: '120deg', color: 'bg-accent-right' },
		{ left: '88%', top: '26%', tx: '55px', ty: '55px', tr: '-160deg', color: 'bg-accent-wrong' },
		{ left: '12%', top: '40%', tx: '-55px', ty: '-35px', tr: '170deg', color: 'bg-surface' },
		{ left: '42%', top: '42%', tx: '0px', ty: '-65px', tr: '-120deg', color: 'bg-action' },
		{ left: '68%', top: '44%', tx: '45px', ty: '-40px', tr: '210deg', color: 'bg-accent-right' },
		{ left: '28%', top: '34%', tx: '-20px', ty: '55px', tr: '150deg', color: 'bg-surface' },
		{ left: '82%', top: '38%', tx: '70px', ty: '45px', tr: '-200deg', color: 'bg-accent-wrong' }
	];

	let burstKey = $state(0);
	let prevPlayerCount = -1;

	$effect(() => {
		const n = room.players.length;
		if (prevPlayerCount !== -1 && n !== prevPlayerCount) burstKey++;
		prevPlayerCount = n;
	});

	/* ---- host settings ------------------------------------------------ */

	/* Bounds come from SETTINGS_BOUNDS in the protocol — the same table
	   `nextSettings` clamps against, so a stepper can never offer a tap the
	   server would clamp away and the numbers live in exactly one place.

	   Two groups: what the game IS (visible), and how long each beat lasts
	   (behind a disclosure). Six dials plus four pack switches do not fit flat
	   at 390×420, and the short-viewport rule is not negotiable. */
	const BASIC_FIELDS = [
		{ key: 'questions', unit: '', labelKey: 'lobby.settings.questions', helpKey: 'lobby.help.questions' },
		{ key: 'rounds', unit: '', labelKey: 'lobby.settings.rounds', helpKey: 'lobby.help.rounds' }
	] as const;

	const TIMING_FIELDS = [
		{ key: 'answerSec', unit: 's', labelKey: 'lobby.settings.answering', helpKey: 'lobby.help.answerSec' },
		{ key: 'guessSec', unit: 's', labelKey: 'lobby.settings.guessing', helpKey: 'lobby.help.guessSec' },
		{ key: 'revealSec', unit: 's', labelKey: 'lobby.settings.reveal', helpKey: 'lobby.help.revealSec' },
		{ key: 'standingsEvery', unit: '', labelKey: 'lobby.settings.standings', helpKey: 'lobby.help.standingsEvery' }
	] as const;

	type FieldKey = (typeof BASIC_FIELDS)[number]['key'] | (typeof TIMING_FIELDS)[number]['key'];
	/** Keeps `m[labelKey]` typed: the catalogue has no string index signature,
	    so the snippet takes the literal union the field lists actually carry. */
	type LabelKey =
		| (typeof BASIC_FIELDS)[number]['labelKey']
		| (typeof TIMING_FIELDS)[number]['labelKey'];
	type HelpKey =
		| (typeof BASIC_FIELDS)[number]['helpKey']
		| (typeof TIMING_FIELDS)[number]['helpKey'];

	/* Which dial is explaining itself, if any. One at a time: the panel sits in
	   a scroll region on a 420px-tall screen, and six open paragraphs would
	   bury the steppers under prose the host has already read. */
	let openHelp = $state<FieldKey | null>(null);

	/**
	 * Open a dial's explanation and make sure it is actually on screen.
	 *
	 * The settings panel scrolls inside its own box, so a dial near the bottom
	 * expands text below the fold — the host taps the (i) and, as far as they
	 * can tell, nothing happens. Measured at 390x420: opening the standings
	 * help left it entirely out of view. `block: 'nearest'` scrolls the
	 * minimum needed rather than yanking the panel around.
	 */
	async function toggleHelp(key: FieldKey) {
		const opening = openHelp !== key;
		openHelp = opening ? key : null;
		if (!opening) return;
		await tick();
		const reduced =
			typeof matchMedia === 'function' &&
			matchMedia('(prefers-reduced-motion: reduce)').matches;
		document
			.getElementById(`help-text-${key}`)
			?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
	}

	let showTimings = $state(false);

	/** Order is the reading order of the panel; `spicy` sits last and off. */
	const PACKS = [
		{ id: 'everyday', nameKey: 'lobby.packs.everyday', bodyKey: 'lobby.packs.everydayBody' },
		{ id: 'opinions', nameKey: 'lobby.packs.opinions', bodyKey: 'lobby.packs.opinionsBody' },
		{ id: 'absurd', nameKey: 'lobby.packs.absurd', bodyKey: 'lobby.packs.absurdBody' },
		{ id: 'spicy', nameKey: 'lobby.packs.spicy', bodyKey: 'lobby.packs.spicyBody' }
	] as const satisfies readonly { id: PackId; nameKey: string; bodyKey: string }[];

	// Seeded neutrally; the sync effect below immediately adopts the
	// authoritative settings from the latest server snapshot.
	let draft = $state<Settings>(structuredClone(DEFAULT_SETTINGS));
	let pendingPatch: Partial<Settings> = {};
	let patchTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const s = room.settings;
		for (const f of [...BASIC_FIELDS, ...TIMING_FIELDS]) {
			if (!(f.key in pendingPatch)) draft[f.key] = s[f.key];
		}
		if (!('packs' in pendingPatch)) draft.packs = [...s.packs];
	});

	/** Merge into the in-flight patch and restart the debounce. One timer for
	    every field, so a host fiddling with three dials sends one message. */
	function queue(patch: Partial<Settings>) {
		pendingPatch = { ...pendingPatch, ...patch };
		if (patchTimer !== null) clearTimeout(patchTimer);
		patchTimer = setTimeout(() => {
			onUpdate(pendingPatch);
			pendingPatch = {};
			patchTimer = null;
		}, 300);
	}

	function bump(key: FieldKey, dir: 1 | -1) {
		const b = SETTINGS_BOUNDS[key];
		const next = Math.min(b.max, Math.max(b.min, draft[key] + dir * b.step));
		if (next === draft[key]) return;
		draft[key] = next;
		queue({ [key]: next });
	}

	/* ---- hold to repeat ------------------------------------------------ */

	/* Rounds runs to 40 and answer time to 600s at a 15s step, so reaching the
	   far end is ~30 taps. A press-and-hold that accelerates makes the long
	   ranges usable without shrinking the 44px touch targets or splitting the
	   dials into coarse and fine controls. Pointer events, so it works for
	   touch and mouse alike; every exit path clears the timer. */
	let holdTimer: ReturnType<typeof setTimeout> | null = null;

	function stopHold() {
		if (holdTimer !== null) clearTimeout(holdTimer);
		holdTimer = null;
	}

	function startHold(key: FieldKey, dir: 1 | -1) {
		stopHold();
		let delay = 340;
		const tick = () => {
			bump(key, dir);
			delay = Math.max(40, delay * 0.82);
			holdTimer = setTimeout(tick, delay);
		};
		holdTimer = setTimeout(tick, delay);
	}

	/* ---- what the host is actually choosing ---------------------------- */

	/** Distinct prompts the chosen packs hold. Every question in a game is
	    distinct, so this is the real ceiling on the questions dial — a host on
	    one small pack cannot have twenty. */
	const packCapacity = $derived(PROMPTS.filter((p) => enabledPacks.has(p.pack)).length);
	const questionsCapped = $derived(draft.questions > packCapacity);
	/** The answer pool: everyone's answers to every question. Rounds cannot
	    exceed it — the game cannot ask about an answer nobody wrote. */
	const poolSize = $derived(Math.min(draft.questions, packCapacity) * room.players.length);
	const roundsCapped = $derived(draft.rounds > poolSize);

	/** Roughly how long this game will run, so a host choosing an hour is
	    choosing it rather than discovering it. Uses the same numbers the
	    engine does. */
	const estimateMinutes = $derived.by(() => {
		const rounds = Math.min(draft.rounds, poolSize);
		const beats =
			draft.standingsEvery > 0 ? Math.max(0, Math.ceil(rounds / draft.standingsEvery) - 1) : 0;
		const ms =
			INTRO_MS +
			draft.answerSec * 1000 +
			rounds * (draft.guessSec + draft.revealSec) * 1000 +
			beats * STANDINGS_MS;
		return Math.max(1, Math.round(ms / 60000));
	});

	const enabledPacks = $derived(new Set<PackId>(draft.packs));
	const enabled = $derived(enabledPacks);
	/** The server ignores a patch that would empty `packs`, so the UI must not
	    offer the tap at all — see the header comment. */
	const lastPackOn = $derived(enabled.size <= 1);

	function togglePack(id: PackId) {
		const on = enabled.has(id);
		if (on && lastPackOn) return;
		const next = PACK_IDS.filter((p) => (p === id ? !on : enabled.has(p)));
		draft.packs = [...next];
		queue({ packs: [...next] });
	}

	/** Send whatever is still debounced, right now, synchronously. Used by
	    `startGame` below so a patch made moments ago is never in flight when
	    the room leaves LOBBY. Not used on teardown — see the comment there. */
	function flushPatch() {
		if (patchTimer !== null) {
			clearTimeout(patchTimer);
			patchTimer = null;
		}
		if (Object.keys(pendingPatch).length > 0) {
			onUpdate(pendingPatch);
			pendingPatch = {};
		}
	}

	/** The host is still in LOBBY when this runs, so a queued patch is still
	    legal — flush it before the `startGame` message so the server applies
	    the setting the host actually chose before it starts the round. */
	function startGame() {
		flushPatch();
		onStart();
	}

	/* On teardown: cancel the debounced patch (dropping it deliberately —
	   a stray updateSettings must not fire after the phase leaves LOBBY,
	   see ledger ruling 84: flushing here is what T8 removed and is not
	   coming back — `startGame` above is the one place a flush is safe)
	   and clear the "copied" chip timer. */
	$effect(() => {
		return () => {
			if (patchTimer !== null) clearTimeout(patchTimer);
			patchTimer = null;
			pendingPatch = {};
			if (copiedTimer !== null) clearTimeout(copiedTimer);
			copiedTimer = null;
			stopHold();
		};
	});

	const canStart = $derived(room.players.length >= MIN_PLAYERS);

	/* Move focus to the lobby heading when the form swaps over to this screen. */
	let headingEl = $state<HTMLElement | null>(null);

	$effect(() => {
		headingEl?.focus();
	});
</script>

<div
	class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-field px-5 pt-safe pb-safe text-white"
>
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

	<!-- Nothing is lost by leaving a lobby, so this one does not confirm
	     (ledger, "Navigation and leave confirmation"). Same control, same
	     place, on every screen. -->
	<LeaveButton {onLeave} confirm={false} label={m['lobby.leave']()} />

	<!-- The room code is the one thing a host has to read aloud across a room. -->
	<button
		type="button"
		data-testid="share-code"
		onclick={shareCode}
		class="lo-code flex shrink-0 flex-col items-center justify-center gap-1.5 pt-1 pb-1"
	>
		<span class="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-action uppercase">
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.6"
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
					class="rounded-full bg-accent-right px-2 py-0.5 text-[10px] tracking-normal text-ink normal-case"
					role="status"
				>
					{m['lobby.copied']()}
				</span>
			{/if}
		</span>
		<span
			class="lo-code-text rounded-2xl border-2 border-white/25 bg-white/10 px-5 pt-1 pb-2 font-display text-[44px] leading-none font-bold tracking-[0.14em] text-action"
		>
			{room.code}
		</span>
		<span class="text-[11px] font-medium text-white/55">{m['lobby.copyHint']()}</span>
	</button>

	<div class="relative min-h-0 flex-1">
		<div class="h-full overflow-x-hidden overflow-y-auto px-0.5">
			{#if !isHost}
				<!-- Consent only the host can see is not consent (ledger, "Non-hosts
				     cannot see whether Confessions is on"). A guest cannot change the
				     packs, but they are about to be asked personal questions if the
				     confessions pack is on, so they get to read that before they agree
				     to play. All four are listed, on and off: a pack simply missing
				     from a list of enabled ones is ambiguous — off has to be visibly
				     off. When confessions IS on, the same line the host read is
				     repeated here, because that is the line that names the material. -->
				<section
					data-testid="packs-summary"
					class="reveal mt-3 flex flex-col gap-2 rounded-card border-2 border-white/15 bg-white/10 p-3.5"
				>
					<h3 class="text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
						{m['lobby.settings.packs']()}
					</h3>
					<p data-testid="guest-shape" class="text-[12px] font-semibold text-white/70">
						{m['lobby.settings.questions']()}: {room.settings.questions} ·
						{m['lobby.settings.rounds']()}: {room.settings.rounds}
					</p>
					<div class="flex flex-wrap gap-1.5">
						{#each PACKS as pack (pack.id)}
							{@const on = room.settings.packs.includes(pack.id)}
							<span
								data-testid="pack-chip"
								data-pack={pack.id}
								data-on={on}
								class="rounded-full px-2.5 py-1 text-[12px] font-bold {on
									? 'bg-action text-ink'
									: 'bg-white/5 text-white/40 line-through'}"
							>
								{m[pack.nameKey]()}
							</span>
						{/each}
					</div>
					{#if room.settings.packs.includes('spicy')}
						<p data-testid="spicy-note" class="text-[11.5px] leading-snug font-medium text-white/70">
							{m['lobby.packs.spicyBody']()}
						</p>
					{/if}
				</section>
			{/if}

			<div class="mt-3 flex items-baseline justify-between">
				<h2
					bind:this={headingEl}
					data-testid="players-heading"
					tabindex="-1"
					class="reveal text-[11px] font-extrabold tracking-[0.16em] text-action uppercase outline-none"
				>
					{m['lobby.players']()}
				</h2>
				<span class="text-[12px] font-semibold text-white/55 tabular-nums">
					{room.players.length}/{MAX_PLAYERS}
				</span>
			</div>

			<ul class="mt-2 flex flex-col gap-1.5" role="list">
				{#each room.players as player, i (player.id)}
					<li
						data-testid="player-card"
						class="lo-player pop-in flex min-h-[48px] items-center gap-2.5 rounded-2xl border-2 border-white/15 bg-white/10 px-2.5 py-1.5"
						style="animation-delay: {i * 60}ms"
					>
						<span
							class="lo-avatar grid size-9 shrink-0 place-items-center rounded-full bg-surface text-[20px] leading-none"
							aria-hidden="true"
						>
							{player.emoji}
						</span>
						<span
							data-testid="player-name"
							class="min-w-0 flex-1 truncate font-display text-[17px] font-semibold"
						>
							{player.name}
						</span>
						{#if player.id === room.hostId}
							<span
								class="shrink-0 rounded-full bg-action px-2 py-0.5 text-[9px] font-extrabold tracking-[0.14em] text-ink uppercase"
								title={m['lobby.hostTag']()}
							>
								{m['lobby.hostTag']()}
							</span>
						{/if}
					</li>
				{/each}
			</ul>

			{#if isHost}
				<section
					class="reveal mt-4 flex flex-col gap-3 rounded-card border-2 border-white/15 bg-white/10 p-3.5"
					style="animation-delay: {room.players.length * 60}ms"
				>
					<h3 class="text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
						{m['lobby.settings.title']()}
					</h3>

					<!-- A stepper row. One snippet for both groups, so the touch
					     targets, the hold-to-repeat wiring and the disabled bounds
					     cannot drift apart between them. -->
					{#snippet dial(key: FieldKey, unit: string, labelKey: LabelKey, helpKey: HelpKey)}
						{@const b = SETTINGS_BOUNDS[key]}
						{@const explaining = openHelp === key}
						<div class="flex min-h-[48px] items-center gap-2">
							<!-- The whole label is the disclosure, not just the 16px
							     glyph: a tappable icon that small fails the 44px touch
							     target, and padding it out to 44px would cost the row
							     width the steppers need at 390px. So the label and the
							     icon are one control, and the row keeps its height. -->
							<button
								type="button"
								data-testid={`help-${key}`}
								aria-expanded={explaining}
								aria-controls={`help-text-${key}`}
								onclick={() => toggleHelp(key)}
								class="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-left"
							>
								<span class="min-w-0 truncate text-[14px] font-semibold" id={`setting-${key}`}>
									{m[labelKey]()}
								</span>
								<span
									class="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] text-[11px] font-extrabold transition-colors {explaining
										? 'border-action bg-action text-ink'
										: 'border-white/40 text-white/60'}"
									aria-hidden="true">i</span
								>
								<span class="sr-only">{m['lobby.help.open']()}</span>
							</button>
							<span
								class="flex shrink-0 items-center gap-1.5"
								role="group"
								aria-labelledby={`setting-${key}`}
							>
								<button
									type="button"
									data-testid={`dec-${key}`}
									aria-label={`− ${m[labelKey]()}`}
									disabled={draft[key] <= b.min}
									onclick={() => bump(key, -1)}
									onpointerdown={() => startHold(key, -1)}
									onpointerup={stopHold}
									onpointerleave={stopHold}
									onpointercancel={stopHold}
									class="grid size-11 place-items-center rounded-full bg-surface-2 text-white disabled:opacity-25"
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
									class="w-[52px] text-center font-display text-[19px] font-bold text-action tabular-nums"
								>
									<!-- `data-value` carries the raw number because the label
									     does not always contain one: the standings dial reads
									     "Off" at zero. -->
									{#if key === 'standingsEvery' && draft[key] === 0}
										<span data-testid={`value-${key}`} data-value={draft[key]}
											>{m['lobby.settings.standingsOff']()}</span
										>
									{:else}
										<span data-testid={`value-${key}`} data-value={draft[key]}>{draft[key]}</span
										>{unit}
									{/if}
								</span>
								<button
									type="button"
									data-testid={`inc-${key}`}
									aria-label={`+ ${m[labelKey]()}`}
									disabled={draft[key] >= b.max}
									onclick={() => bump(key, 1)}
									onpointerdown={() => startHold(key, 1)}
									onpointerup={stopHold}
									onpointerleave={stopHold}
									onpointercancel={stopHold}
									class="grid size-11 place-items-center rounded-full bg-surface-2 text-white disabled:opacity-25"
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
						{#if explaining}
							<p
								id={`help-text-${key}`}
								data-testid={`help-text-${key}`}
								class="-mt-0.5 mb-1 rounded-xl bg-ink/25 px-3 py-2 text-[12px] leading-snug font-medium text-white/85"
							>
								{m[helpKey]()}
							</p>
						{/if}
					{/snippet}

					<!-- What the game IS: always visible. -->
					<div class="flex flex-col gap-1">
						{#each BASIC_FIELDS as f (f.key)}
							{@render dial(f.key, f.unit, f.labelKey, f.helpKey)}
						{/each}
					</div>

					<!-- The two caps the host cannot see from the numbers alone.
					     Both are enforced by the engine; saying so beats letting a
					     host set 20 questions and quietly get 15. -->
					{#if questionsCapped}
						<p data-testid="questions-cap" class="text-[11.5px] leading-snug font-medium text-white/70">
							{m['lobby.settings.questionsCapped']({ max: packCapacity })}
						</p>
					{/if}
					{#if roundsCapped}
						<p data-testid="rounds-cap" class="text-[11.5px] leading-snug font-medium text-white/70">
							{m['lobby.settings.roundsCapped']({ players: room.players.length, max: poolSize })}
						</p>
					{/if}

					<!-- How long each beat lasts: behind a disclosure, because six
					     dials plus four pack switches do not fit at 390×420 and the
					     answering/guessing counts are what a host actually tunes. -->
					<button
						type="button"
						data-testid="toggle-timings"
						aria-expanded={showTimings}
						onclick={() => {
							showTimings = !showTimings;
							// Don't leave a hidden dial's explanation open behind the
							// disclosure — reopening it would show prose nobody asked for.
							if (!showTimings) openHelp = null;
						}}
						class="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-white/10 px-3 text-left"
					>
						<span class="text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
							{m['lobby.settings.timings']()}
						</span>
						<span class="flex items-center gap-2">
							<span data-testid="length-estimate" class="text-[12px] font-semibold text-white/70">
								{m['lobby.settings.estimate']({ minutes: estimateMinutes })}
							</span>
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
								class="text-white/70 transition-transform {showTimings ? 'rotate-180' : ''}"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</span>
					</button>

					{#if showTimings}
						<div data-testid="timing-fields" class="flex flex-col gap-1">
							{#each TIMING_FIELDS as f (f.key)}
								{@render dial(f.key, f.unit, f.labelKey, f.helpKey)}
							{/each}
						</div>
					{/if}

					<div class="flex flex-col gap-1.5">
						<h4 id="packs-label" class="text-[11px] font-extrabold tracking-[0.16em] text-action uppercase">
							{m['lobby.settings.packs']()}
						</h4>
						<div class="flex flex-col gap-1.5" role="group" aria-labelledby="packs-label">
							{#each PACKS as pack (pack.id)}
								{@const on = enabled.has(pack.id)}
								<!-- The last pack still on is `disabled` but deliberately NOT
								     dimmed: the one pack keeping the game alive should not be the
								     thing on this panel that looks switched off. The line under
								     the group is what explains why it will not turn off. -->
								<button
									type="button"
									role="switch"
									aria-checked={on}
									data-testid={`pack-${pack.id}`}
									disabled={on && lastPackOn}
									onclick={() => togglePack(pack.id)}
									class="lo-pack flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border-2 px-2.5 py-1.5 text-left {on
										? 'border-action bg-action/15'
										: 'border-white/20 bg-white/5'}"
								>
									<span
										class="grid size-6 shrink-0 place-items-center rounded-lg border-2 {on
											? 'border-action bg-action text-ink'
											: 'border-white/40 text-transparent'}"
										aria-hidden="true"
									>
										<svg
											width="13"
											height="13"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="4.5"
											stroke-linecap="round"
											stroke-linejoin="round"><path d="m4 13 5 5L20 6" /></svg
										>
									</span>
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="truncate text-[14px] font-bold">{m[pack.nameKey]()}</span>
										<span class="lo-pack-body text-[11.5px] leading-snug font-medium text-white/65">
											{m[pack.bodyKey]()}
										</span>
									</span>
								</button>
							{/each}
						</div>
						{#if lastPackOn}
							<p data-testid="pack-floor" class="text-[11px] font-medium text-white/60">
								{m['lobby.packs.lastOne']()}
							</p>
						{/if}
					</div>
				</section>
			{/if}
		</div>
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-field"
			aria-hidden="true"
		></div>
	</div>

	<div class="shrink-0 pt-3">
		{#if isHost}
			<button
				type="button"
				data-testid="start-game"
				disabled={!canStart}
				onclick={startGame}
				class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-action px-8 font-display text-[19px] font-bold text-ink disabled:opacity-40"
			>
				{m['lobby.start']()}
			</button>
			{#if !canStart}
				<p class="mt-2 text-center text-[13px] font-semibold text-white/75">
					{m['lobby.needThree']()}
				</p>
			{/if}
		{:else}
			<p
				data-testid="waiting-host"
				class="flex min-h-14 items-center justify-center rounded-full border-2 border-dashed border-white/35 px-6 text-center text-[15px] font-semibold text-white/75"
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

	/* Short-viewport priority (ledger). At ~390×420 the room code yields — it
	   is the biggest thing here and the least urgent once everyone has joined —
	   while the roster and the settings keep scrolling inside their own box and
	   the start button keeps its full height. The steppers and the pack
	   switches keep a 44px touch target throughout: they are the controls, and
	   controls do not shrink below the thumb. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}

		.lo-code {
			gap: 0.125rem;
			padding-top: 0;
			padding-bottom: 0;
		}

		.lo-code-text {
			font-size: 30px;
			padding: 0.125rem 0.875rem 0.25rem;
		}

		.lo-player {
			min-height: 40px;
		}

		.lo-avatar {
			width: 28px;
			height: 28px;
			font-size: 16px;
		}

		.lo-pack {
			min-height: 44px;
		}

		.lo-pack-body {
			font-size: 11px;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			line-clamp: 2;
			overflow: hidden;
		}
	}
</style>
