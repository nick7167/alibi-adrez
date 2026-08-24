<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { currentLocale, setLocale, type Locale } from '$lib/i18n';
	import { createRoom, isValidCodeInput } from '$lib/api';
	import MaskMark from '$lib/components/MaskMark.svelte';

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
		await goto(`/room/${target}`);
	}

	$effect(() => {
		if (showJoin) codeEl?.focus();
	});
</script>

<svelte:head>
	<title>{m['app.title']()} 🎭</title>
	<meta name="theme-color" content="#FFC93C" />
	<!-- Static style text only: dynamic/{@html} styles in svelte:head break hydration and Svelte detaches the CSS links. -->
	<style>
		html,
		html > body {
			background-color: #ffc93c;
		}
	</style>
</svelte:head>

<main class="relative fill-vp overflow-hidden bg-sunshine text-ink">
	<!-- pixel-confetti layer (decorative) -->
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<span class="absolute top-[9%] left-[6%] h-3 w-3 rotate-12 bg-cobalt opacity-15"></span>
		<span class="absolute top-[15%] right-[9%] h-2.5 w-2.5 rotate-45 bg-coral opacity-20"></span>
		<span class="absolute top-[34%] left-[12%] h-2 w-2 -rotate-6 bg-grape opacity-15"></span>
		<span class="absolute bottom-[30%] left-[8%] h-3.5 w-3.5 rotate-3 bg-grape opacity-10"></span>
		<span class="absolute right-[12%] bottom-[20%] h-2.5 w-2.5 -rotate-12 bg-mint opacity-20"></span>
		<span class="absolute bottom-[9%] left-[26%] h-2.5 w-2.5 rotate-45 bg-paper opacity-25"></span>
		<span class="absolute right-[6%] bottom-[8%] h-3 w-3 -rotate-45 bg-mint opacity-15"></span>
	</div>

	<div
		class="relative z-10 mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-5 pt-16 pb-safe"
	>
		<header class="relative">
			<!-- File card: the mark and wordmark live on manila, the one surface
			     the system reserves for things that behave like paperwork. -->
			<div
				class="absolute -top-[22px] left-6 h-[26px] w-[108px] rounded-t-[10px] border-[3px] border-b-0 border-ink bg-manila"
				aria-hidden="true"
			></div>

			<div
				class="reveal ruled relative rounded-[20px] border-[3px] border-ink bg-manila px-5 pt-6 pb-6 shadow-[0_6px_0_rgba(20,20,51,0.3)]"
				style="animation-delay: 0ms"
			>
				<span class="stamp absolute -top-3.5 -right-1.5 !rotate-[-6deg] text-[11px] tracking-[0.2em]">
					{m['home.caseOpen']()}
				</span>

				<div class="flex justify-center">
					<MaskMark size={92} />
				</div>

				<h1 class="mt-3 text-center text-[68px] leading-[0.94] font-extrabold tracking-tight">
					{m['app.title']()}
				</h1>
			</div>
		</header>

		<p
			class="reveal mx-auto mt-6 max-w-[300px] text-center font-mono text-[15px] leading-relaxed"
			style="animation-delay: 100ms"
		>
			{m['home.tagline']()}
		</p>

		<div class="mt-auto flex flex-col gap-4 pt-10">
			<button
				type="button"
				data-testid="create-room"
				disabled={creating}
				onclick={create}
				class="reveal sticker flex min-h-14 w-full items-center justify-center rounded-full bg-cobalt px-8 text-lg font-bold text-white"
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
				class="reveal flex min-h-14 w-full items-center justify-center rounded-full border-4 border-dashed border-cobalt bg-transparent px-8 text-lg font-bold text-cobalt"
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
						class="min-h-14 min-w-0 flex-1 rounded-full border-4 border-ink bg-paper px-4 text-center font-mono text-2xl font-bold tracking-[0.25em] text-ink uppercase caret-coral placeholder:text-base placeholder:tracking-[0.12em] placeholder:text-ink/35 focus:outline-none focus-visible:ring-4 focus-visible:ring-cobalt"
					/>
					<button
						type="submit"
						data-testid="join-go"
						disabled={!codeInputValid || joining}
						aria-label={m['home.join']()}
						class="sticker grid min-h-14 shrink-0 place-items-center rounded-full bg-cobalt px-7 text-white disabled:opacity-40"
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

		<div
			class="reveal mt-5 flex items-center justify-end gap-1.5 font-mono text-[13px] font-bold tracking-[0.14em] opacity-65"
			style="animation-delay: 400ms"
		>
			{#each locales as locale, i (locale)}
				{#if i > 0}<span aria-hidden="true">|</span>{/if}
				<button
					type="button"
					lang={locale}
					aria-pressed={currentLocale() === locale}
					class:underline={currentLocale() === locale}
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
			class="pop-in fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-full bg-coral px-6 py-3 text-center font-bold text-white shadow-[0_6px_0_rgba(23,21,49,0.25)]"
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

	@media (prefers-reduced-motion: reduce) {
		.reveal,
		.pop-in {
			animation: none;
		}
	}
</style>
