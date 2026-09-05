<script lang="ts">
	/**
	 * The landing page — the first thing anyone sees, and until T9 it was still
	 * Alibi's: a manila case-file card on sunshine yellow with a "case open"
	 * stamp and a tagline about busted alibis.
	 *
	 * It now wears the AHA field like every other screen (ledger, "Chosen
	 * identity — A · AHA"), which is what finally frees the last Alibi CSS
	 * primitives — `.stamp`, `.ruled`, `--color-manila` and the whole legacy
	 * alias block are deleted from `app.css` in the same change.
	 *
	 * The one job of this screen is to make a first-time player understand the
	 * game before they tap anything, so the three-beat strip (write → guess →
	 * AHA) sits above the buttons: it is the whole game in three words, and it
	 * costs less height than a paragraph nobody reads.
	 */
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale, setLocale, type Locale } from '$lib/i18n';
	import { createRoom, getRoomAvailability, isValidCodeInput } from '$lib/api';

	const locales: Locale[] = ['en', 'da'];

	let creating = $state(false);
	let showJoin = $state(false);
	let code = $state('');
	let codeInputValid = $derived(isValidCodeInput(code));
	let joining = $state(false);
	let codeEl = $state<HTMLInputElement | null>(null);
	let toastMsg = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function toast(text: string) {
		toastMsg = text;
		if (toastTimer !== null) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = null), 4000);
	}

	$effect(() => {
		return () => {
			if (toastTimer !== null) clearTimeout(toastTimer);
		};
	});

	async function create() {
		if (creating) return;
		creating = true;
		try {
			const { code: c } = await createRoom();
			await goto(`/room/${c}`);
		} catch {
			toast(m['errors.generic']());
		} finally {
			// Reset unless navigation actually took us into a room (guards
			// against wedging the button when a redirect bounces us home).
			if (!location.pathname.startsWith('/room/')) creating = false;
		}
	}

	function toggleJoin() {
		showJoin = !showJoin;
	}

	function normalize(e: Event) {
		code = (e.currentTarget as HTMLInputElement).value.toUpperCase();
	}

	async function join(e: SubmitEvent) {
		e.preventDefault();
		const target = code.trim().toUpperCase();
		if (!isValidCodeInput(target) || joining) return;
		joining = true;
		try {
			const room = await getRoomAvailability(target);
			if (!room.exists) {
				toast(m['errors.noRoom']());
				return;
			}
			await goto(`/room/${target}`);
		} catch {
			toast(m['errors.generic']());
		} finally {
			if (!location.pathname.startsWith('/room/')) joining = false;
		}
	}

	$effect(() => {
		if (showJoin) codeEl?.focus();
	});

	const STEPS = [
		{ key: 'home.stepWrite', tone: 'text-white' },
		{ key: 'home.stepGuess', tone: 'text-white' },
		{ key: 'home.stepAha', tone: 'text-action' }
	] as const;
</script>

<svelte:head>
	<title>{m['app.title']()}</title>
	<meta name="theme-color" content="#4A1FD6" />
	<!-- Static style text only: dynamic/{@html} styles in svelte:head break hydration and Svelte detaches the CSS links. -->
	<style>
		html,
		html > body {
			background-color: #4a1fd6;
		}
	</style>
</svelte:head>

<main class="relative fill-vp overflow-hidden bg-field text-white">
	<!-- confetti layer (decorative) -->
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<span class="absolute top-[9%] left-[6%] h-3 w-3 rotate-12 bg-action opacity-30"></span>
		<span class="absolute top-[15%] right-[9%] h-2.5 w-2.5 rotate-45 bg-accent-wrong opacity-35"></span>
		<span class="absolute top-[34%] left-[12%] h-2 w-2 -rotate-6 bg-accent-right opacity-30"></span>
		<span class="absolute bottom-[30%] left-[8%] h-3.5 w-3.5 rotate-3 bg-surface opacity-15"></span>
		<span class="absolute right-[12%] bottom-[20%] h-2.5 w-2.5 -rotate-12 bg-accent-right opacity-30"></span>
		<span class="absolute bottom-[9%] left-[26%] h-2.5 w-2.5 rotate-45 bg-action opacity-25"></span>
		<span class="absolute right-[6%] bottom-[8%] h-3 w-3 -rotate-45 bg-accent-wrong opacity-25"></span>
	</div>

	<div
		class="ho-shell relative z-10 mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-5 pt-safe pb-safe"
		class:ho-compact={showJoin}
	>
		<!-- The identity group takes the free height and centres inside it, so a
		     tall phone reads as a poster rather than as a screen with a hole in
		     the middle. The action block below it stays pinned to the bottom. -->
		<div class="ho-top flex min-h-0 flex-1 flex-col justify-center">
		<header class="reveal shrink-0 pt-2 text-center">
			<h1 class="ho-mark font-display text-[86px] leading-[0.9] font-bold tracking-tight text-action">
				{m['app.title']()}
			</h1>
			<p class="ho-tagline mx-auto mt-3 max-w-[300px] text-[15px] leading-snug font-semibold text-white/85">
				{m['home.tagline']()}
			</p>
		</header>

		<!-- The whole game in three beats. Reads in a second, and the last one
		     is the name of the game, in the colour the game reserves for its
		     primary action. -->
		<div
			class="reveal ho-steps mt-5 flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2.5"
			style="animation-delay: 80ms"
		>
			{#each STEPS as step, i (step.key)}
				{#if i > 0}
					<svg
						class="shrink-0 text-white/45"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M5 12h13" /><path d="m12 5 7 7-7 7" />
					</svg>
				{/if}
				<span class="font-display text-[17px] leading-none font-semibold {step.tone}">
					{m[step.key]()}
				</span>
			{/each}
		</div>

		<p class="ho-players reveal mt-3 shrink-0 text-center text-[12px] font-semibold text-white/60" style="animation-delay: 120ms">
			{m['home.players']()}
		</p>
		</div>

		<div class="ho-actions flex shrink-0 flex-col gap-3 pt-4">
			<button
				type="button"
				data-testid="create-room"
				disabled={creating}
				onclick={create}
				class="reveal sticker flex min-h-14 w-full items-center justify-center rounded-full bg-action px-8 font-display text-[19px] font-bold text-ink disabled:opacity-50"
				style="animation-delay: 200ms"
			>
				{creating ? m['home.creating']() : m['home.create']()}
			</button>
			<button
				type="button"
				data-testid="join-toggle"
				aria-expanded={showJoin}
				aria-controls="join-panel"
				onclick={toggleJoin}
				class="reveal flex min-h-14 w-full items-center justify-center rounded-full border-2 border-white/35 bg-white/10 px-8 font-display text-[19px] font-semibold text-white"
				style="animation-delay: 300ms"
			>
				{m['home.join']()}
			</button>

			{#if showJoin}
				<form id="join-panel" data-testid="join-panel" class="pop-in flex gap-2" onsubmit={join}>
					<label class="sr-only" for="room-code">{m['home.joinPrompt']()}</label>
					<input
						bind:this={codeEl}
						id="room-code"
						data-testid="join-input"
						value={code}
						oninput={normalize}
						placeholder={m['home.joinPrompt']()}
						maxlength={4}
						autocomplete="off"
						autocapitalize="characters"
						spellcheck="false"
						class="min-h-14 min-w-0 flex-1 rounded-full border-2 border-white/30 bg-surface px-4 text-center font-display text-2xl font-bold tracking-[0.2em] text-ink uppercase caret-field placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:tracking-normal placeholder:text-ink/35 focus:outline-none focus-visible:ring-4 focus-visible:ring-action"
					/>
					<button
						type="submit"
						data-testid="join-go"
						disabled={!codeInputValid || joining}
						aria-label={m['home.join']()}
						class="sticker grid min-h-14 shrink-0 place-items-center rounded-full bg-action px-7 text-ink disabled:opacity-40"
					>
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M5 12h13" /><path d="m12 5 7 7-7 7" />
						</svg>
					</button>
				</form>
			{/if}
		</div>

		<div class="reveal ho-rules mt-4 flex shrink-0 justify-center" style="animation-delay: 350ms">
			<a
				href="/rules"
				data-testid="rules-link"
				class="flex min-h-11 items-center gap-2 rounded-full border-2 border-white/25 px-5 text-[12px] font-extrabold tracking-[0.14em] text-white/80 uppercase"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
					<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
				</svg>
				{m['nav.rules']()}
			</a>
		</div>

		<nav
			class="reveal ho-legal mt-3 flex shrink-0 justify-center gap-4 text-[11px] font-bold text-white/65"
			aria-label="Safety"
			style="animation-delay: 375ms"
		>
			<a class="min-h-11 content-center underline underline-offset-4" href="/community-rules">
				{m['nav.community']()}
			</a>
			<a class="min-h-11 content-center underline underline-offset-4" href="/support">
				{m['nav.support']()}
			</a>
		</nav>

		<div
			class="reveal ho-locale mt-4 flex shrink-0 items-center justify-end gap-1.5 text-[13px] font-bold tracking-[0.14em] text-white/60"
			style="animation-delay: 400ms"
		>
			{#each locales as locale, i (locale)}
				{#if i > 0}<span aria-hidden="true">|</span>{/if}
				<button
					type="button"
					lang={locale}
					aria-pressed={currentLocale() === locale}
					class:underline={currentLocale() === locale}
					class:text-action={currentLocale() === locale}
					class="cursor-pointer uppercase"
					onclick={() => void setLocale(locale)}
				>
					{locale}
				</button>
			{/each}
		</div>
	</div>

	{#if toastMsg}
		<div
			class="pop-in fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-full bg-surface-2 px-6 py-3 text-center font-bold text-white shadow-[0_6px_0_rgba(22,11,61,0.35)]"
			role="status"
		>
			{toastMsg}
		</div>
	{/if}
</main>

<style>
	@keyframes rise-in {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.reveal {
		animation: rise-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.pop-in {
		animation: pop-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Short-viewport priority (ledger): the identity yields, the two buttons
	   and the join field never do. At ~390×420 the wordmark drops a third of
	   its size and the explanatory strip tightens; nothing below it moves. */
	@media (max-height: 600px) {
		.pt-safe {
			padding-top: max(0.75rem, env(safe-area-inset-top));
		}

		.pb-safe {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		}

		/* Centring inside a scrollable box clips the TOP of anything taller
		   than the box — the overflow spills both ways and only the bottom
		   half is reachable. With the join panel open at 420 the identity
		   group is taller than its share, so it aligns to the top and the
		   page scrolls instead. */
		.ho-top {
			justify-content: flex-start;
			overflow: hidden;
		}

		/* With the code panel open there is no room for the explanation as
		   well as the controls, and the controls win: whoever opened this was
		   handed a code and already knows what the game is. */
		.ho-compact .ho-steps {
			display: none;
		}

		.ho-mark {
			font-size: 52px;
		}

		/* The least load-bearing line on the screen, and 30px of a 420px
		   viewport. The rulebook says the same thing. */
		.ho-players {
			display: none;
		}

		.ho-tagline {
			margin-top: 0.375rem;
			font-size: 13px;
		}

		.ho-steps {
			margin-top: 0.75rem;
			padding-top: 0.375rem;
			padding-bottom: 0.375rem;
		}
	}

	/* A tablet is a shared game board, not a phone floating in a large purple
	   canvas. Keep the same poster hierarchy but give its identity and controls
	   a deliberate iPad scale. The phone breakpoint above remains untouched. */
	@media (min-width: 768px) and (min-height: 800px) {
		.ho-shell {
			max-width: 52rem;
			padding-right: 4rem;
			padding-left: 4rem;
		}

		.ho-mark {
			font-size: 144px;
		}

		.ho-tagline {
			margin-top: 1.25rem;
			max-width: 36rem;
			font-size: 24px;
			line-height: 1.3;
		}

		.ho-steps {
			align-self: center;
			width: 100%;
			max-width: 38rem;
			margin-top: 2rem;
			gap: 0.875rem;
			padding: 1rem 1.5rem;
			border-radius: 1.5rem;
		}

		.ho-steps span {
			font-size: 25px;
		}

		.ho-steps svg {
			width: 20px;
			height: 20px;
		}

		.ho-players {
			margin-top: 1rem;
			font-size: 17px;
		}

		.ho-actions {
			align-self: center;
			width: 100%;
			max-width: 38rem;
			gap: 1rem;
			padding-top: 2rem;
		}

		.ho-actions > button,
		.ho-actions > form input,
		.ho-actions > form button {
			min-height: 72px;
			font-size: 25px;
		}

		.ho-rules {
			margin-top: 1.5rem;
		}

		.ho-rules a {
			min-height: 56px;
			padding-right: 1.75rem;
			padding-left: 1.75rem;
			font-size: 15px;
		}

		.ho-locale {
			align-self: center;
			width: 100%;
			max-width: 38rem;
			margin-top: 1.5rem;
			font-size: 16px;
		}

		.ho-legal {
			font-size: 14px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.reveal,
		.pop-in {
			animation: none;
		}
	}
</style>
