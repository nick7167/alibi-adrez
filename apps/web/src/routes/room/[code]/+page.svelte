<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { computeClockOffset, openRoomSocket, type RoomSocket } from '$lib/api';
	import { clearIdentity, loadIdentity, saveIdentity } from '$lib/stores/session.svelte';
	import type { Identity } from '$lib/stores/session.svelte';
	import { currentLocale } from '$lib/i18n';
	import type { Phase, RoomView, ServerMessage, Settings, Verdict } from '@aha/shared';
	import Countdown from '$lib/components/Countdown.svelte';
	import JoinForm from './JoinForm.svelte';
	import Lobby from './Lobby.svelte';
	import Planning from './Planning.svelte';
	import Interrogation from './Interrogation.svelte';
	import Deliberation from './Deliberation.svelte';
	import Reveal from './Reveal.svelte';
	import Finale from './Finale.svelte';

	let { data } = $props();

	type Screen = 'join' | Phase;

	let screen = $state<Screen>('join');
	let status = $state<'connecting' | 'open' | 'closed' | 'reconnecting'>('connecting');
	let view = $state<{ you: string; isHost: boolean; room: RoomView } | null>(null);
	/** `now - Date.now()` from the latest `state` frame's server clock. Every
	    countdown on this route renders `deadline - (Date.now() + offset)` so a
	    skewed device clock can't desync it. No tick message exists — see the
	    ledger's "countdowns are deadline-based, not ticked" ruling. */
	let offset = $state(0);
	let joining = $state(false);
	let errorNonce = $state(0);
	let toastMsg = $state<string | null>(null);

	let sockRef: RoomSocket | null = null;
	let pendingIdentity: { name: string; emoji: string } | null = null;
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function toast(text: string) {
		toastMsg = text;
		if (toastTimer !== null) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = null), 4000);
	}

	/** Show a toast, then navigate once it has been readable. */
	function toastThen(text: string, go: () => void) {
		toast(text);
		if (toastTimer !== null) clearTimeout(toastTimer);
		toastTimer = setTimeout(go, 1200);
	}

	$effect(() => {
		return () => {
			if (toastTimer !== null) clearTimeout(toastTimer);
		};
	});

	function onStatus(s: typeof status) {
		status = s;
	}

	function handleMessage(msg: ServerMessage, code: string, saved: Identity | null) {
		switch (msg.t) {
			case 'welcome': {
				const base = pendingIdentity ?? saved;
				saveIdentity(code, {
					playerId: msg.playerId,
					token: msg.token,
					name: base?.name ?? 'Player',
					emoji: base?.emoji ?? '🦊'
				});
				pendingIdentity = null;
				break;
			}
			case 'state': {
				view = msg;
				offset = computeClockOffset(msg.now);
				joining = false;
				screen = msg.room.phase;
				break;
			}
			case 'error': {
				joining = false;
				if (msg.code === 'NAME_TAKEN') {
					toast(m['errors.nameTaken']());
					screen = 'join';
					errorNonce++;
			} else if (msg.code === 'ROOM_FULL') {
				toastThen(m['errors.fullRoom'](), () => void goto('/'));
			} else {
					if (msg.code === 'UNKNOWN_PLAYER') clearIdentity(code);
					toast(m['errors.generic']());
					screen = 'join';
				}
				break;
			}
			case 'pong':
				break;
		}
	}

	$effect(() => {
		const code = data.code;
		const saved = loadIdentity(code);
		const sock = openRoomSocket(code, {
			onStatus,
			onMessage: (msg) => handleMessage(msg, code, saved),
			onOpen: () => {
				const id = loadIdentity(code);
				if (id) {
					sock.send({ v: 1, t: 'reconnect', playerId: id.playerId, token: id.token });
					// `setLocale` (landing page's EN/DA switcher, or any future
					// in-room one) reloads the document by default, so a locale
					// change surfaces here as a fresh socket open, not an
					// in-place reactive change. Re-announcing on every open is a
					// harmless no-op for a plain network-drop reconnect and is
					// what actually delivers "locale change while in a room" —
					// see the T6 report for why there's no in-room switcher yet.
					sock.send({ v: 1, t: 'setLang', lang: currentLocale() });
				}
			}
		});
		sockRef = sock;
		return () => {
			sock.close();
			sockRef = null;
		};
	});

	function join(name: string, emoji: string) {
		joining = true;
		pendingIdentity = { name, emoji };
		sockRef?.send({ v: 1, t: 'join', name, emoji, lang: currentLocale() });
	}

	function startGame() {
		sockRef?.send({ v: 1, t: 'startGame' });
	}

	/** Leave the room politely, drop the local identity, head home. */
	function leaveRoom() {
		sockRef?.leave();
		clearIdentity(data.code);
		void goto('/');
	}

	function updateSettings(patch: Partial<Settings>) {
		sockRef?.send({ v: 1, t: 'updateSettings', patch });
	}

	function sendChat(text: string) {
		sockRef?.suspectChat(text);
	}

	function sendQuestion(text: string) {
		sockRef?.submitQuestion(text);
	}

	function sendAnswer(text: string) {
		sockRef?.submitAnswer(text);
	}

	function sendVote(verdict: Verdict) {
		sockRef?.castVote(verdict);
	}

	/** Which field the room route is showing — the ONE place this branch lives.
	    The browser-chrome tint, the canvas style block, and the placeholder
	    phase screens below all key off it, so they can never drift apart. */
	const field = $derived(screen);

	/** Field colours per the ledger's fixed table (deliberately repeated for
	    INTRO/INTERROGATION and PLANNING/FINALE — those phases never sit next
	    to each other). Kept as one literal ternary (not a lookup object) so
	    apps/web/test/head-canvas.test.ts can statically diff this against the
	    canvas style blocks below (see the svelte:head block for why literal
	    "style" tag text can't appear in a comment up here — it confuses
	    svelte-check's tag scanner into reporting a bogus unclosed script). */
	const themeColor = $derived(
		field === 'join'
			? '#3d50e0'
			: field === 'LOBBY'
				? '#fff6ea'
				: field === 'REVEAL'
					? '#ffc93c'
					: field === 'DELIBERATION'
						? '#3d50e0'
						: field === 'PLANNING' || field === 'FINALE'
							? '#7a3be0'
							: '#171531' // INTRO, INTERROGATION
	);

	/** Text/background utility classes for full-bleed phase screens that
	    aren't Lobby/JoinForm (which manage their own). Matches themeColor
	    above 1:1 but isn't read by the canvas test (Tailwind classes, not
	    hexes), so it can live as a lookup. */
	const PHASE_SURFACE: Partial<Record<Phase, string>> = {
		INTRO: 'bg-night text-paper',
		INTERROGATION: 'bg-night text-paper',
		DELIBERATION: 'bg-cobalt text-paper',
		REVEAL: 'bg-sunshine text-ink',
		FINALE: 'bg-grape text-paper'
	};

	/* Offline overlay: connection has been down for over 5 seconds.
	   The very first handshake gets a grace period; once the socket has
	   been open, any non-open status starts the countdown. */
	let offlineLong = $state(false);
	let everOpened = false;

	$effect(() => {
		if (status === 'open') {
			everOpened = true;
			offlineLong = false;
			return;
		}
		if (!everOpened && status === 'connecting') return;
		const start = Date.now();
		const tick = () => (offlineLong = Date.now() - start > 5000);
		tick();
		const t = setInterval(tick, 500);
		return () => clearInterval(t);
	});
</script>

<svelte:head>
	<title>{m['app.title']()} · {data.code}</title>
	<meta name="theme-color" content={themeColor} />
	<!-- Static style blocks only (see landing page note): each branch's text is
	    fully static so Svelte renders it inline instead of compiling it into a
	    scoped stylesheet that could never match html/body. Hexes must match
	    themeColor above — test/head-canvas.test.ts fails the build if they drift. -->
	{#if field === 'join'}
		<style>
			html,
			html > body {
				background-color: #3d50e0;
			}
		</style>
	{:else if field === 'LOBBY'}
		<style>
			html,
			html > body {
				background-color: #fff6ea;
			}
		</style>
	{:else if field === 'REVEAL'}
		<style>
			html,
			html > body {
				background-color: #ffc93c;
			}
		</style>
	{:else if field === 'DELIBERATION'}
		<style>
			html,
			html > body {
				background-color: #3d50e0;
			}
		</style>
	{:else if field === 'PLANNING' || field === 'FINALE'}
		<style>
			html,
			html > body {
				background-color: #7a3be0;
			}
		</style>
	{:else}
		<style>
			html,
			html > body {
				background-color: #171531;
			}
		</style>
	{/if}
</svelte:head>

<main class="relative flex fill-vp flex-col overflow-hidden bg-paper text-ink">
	{#if screen === 'join'}
		<button
			type="button"
			data-testid="back-home"
			aria-label={m['nav.back']()}
			onclick={() => void goto('/')}
			class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 grid size-11 place-items-center rounded-full border-4 border-ink bg-paper text-ink"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M15 5 8 12l7 7" />
			</svg>
		</button>
		<JoinForm pending={joining} errorNonce={errorNonce} onJoin={join} />
	{:else if view?.room.phase === 'LOBBY'}
		<Lobby
			isHost={view.isHost}
			room={view.room}
			onStart={startGame}
			onUpdate={updateSettings}
			onLeave={leaveRoom}
		/>
	{:else if view?.room.phase === 'INTRO'}
		<section
			data-testid="intro-splash"
			class="pop-in grid fill-vp place-items-center bg-night px-4 text-center"
		>
			<div class="flex flex-col items-center pb-safe">
				<div class="pixel-loader" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<h1 tabindex="-1" class="mt-8 text-6xl font-extrabold tracking-tight text-paper">
					{m['intro.starting']()}
				</h1>
				<span
					class="stamp-frame mt-6 bg-night px-4 pt-1.5 pb-1 font-mono text-2xl font-bold tracking-[0.14em] text-coral tabular-nums"
				>
					{data.code}
				</span>
			</div>
		</section>
	{:else if view?.room.phase === 'PLANNING'}
		<Planning room={view.room} you={view.you} {offset} onSendChat={sendChat} />
	{:else if view?.room.phase === 'INTERROGATION'}
		<Interrogation
			room={view.room}
			you={view.you}
			{offset}
			onSubmitQuestion={sendQuestion}
			onSubmitAnswer={sendAnswer}
		/>
	{:else if view?.room.phase === 'DELIBERATION'}
		<Deliberation room={view.room} you={view.you} {offset} onCastVote={sendVote} />
	{:else if view?.room.phase === 'REVEAL'}
		<Reveal room={view.room} you={view.you} {offset} />
	{:else if view?.room.phase === 'FINALE'}
		<Finale room={view.room} you={view.you} onLeave={leaveRoom} />
	{/if}

	{#if offlineLong && screen !== 'INTRO'}
		<div
			data-testid="offline-overlay"
			class="fixed inset-0 z-50 grid place-items-center bg-paper/95"
			role="status"
		>
			<div class="flex flex-col items-center gap-4">
				<div class="pixel-loader mx-auto" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<p class="text-xl font-extrabold text-ink">{m['offline.title']()}</p>
				<p class="field-label">{m['offline.retry']()}</p>
			</div>
		</div>
	{/if}

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
	.pop-in {
		animation: pop-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
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

	/* Pixel-cube loader — three squares bouncing in sequence */
	.pixel-loader {
		display: flex;
		gap: 10px;
	}

	.pixel-loader span {
		width: 14px;
		height: 14px;
		background: var(--color-sunshine);
		animation: pixel-bounce 900ms ease-in-out infinite;
	}

	.pixel-loader span:nth-child(2) {
		background: var(--color-coral);
		animation-delay: 120ms;
	}

	.pixel-loader span:nth-child(3) {
		background: var(--color-mint);
		animation-delay: 240ms;
	}

	@keyframes pixel-bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-12px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pop-in,
		.pixel-loader span {
			animation: none;
		}
	}
</style>
