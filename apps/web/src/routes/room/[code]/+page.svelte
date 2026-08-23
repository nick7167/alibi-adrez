<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { openRoomSocket, type RoomSocket } from '$lib/api';
	import { clearIdentity, loadIdentity, saveIdentity } from '$lib/stores/session.svelte';
	import type { Identity } from '$lib/stores/session.svelte';
	import type { RoomView, ServerMessage, Settings } from '@alibi/shared';
	import JoinForm from './JoinForm.svelte';
	import Lobby from './Lobby.svelte';

	let { data } = $props();

	type Screen = 'join' | 'lobby' | 'intro';

	let screen = $state<Screen>('join');
	let status = $state<'connecting' | 'open' | 'closed' | 'reconnecting'>('connecting');
	let view = $state<{ you: string; isHost: boolean; room: RoomView } | null>(null);
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
				joining = false;
				screen = msg.room.phase === 'LOBBY' ? 'lobby' : 'intro';
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
				if (id) sock.send({ v: 1, t: 'reconnect', playerId: id.playerId, token: id.token });
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
		sockRef?.send({ v: 1, t: 'join', name, emoji });
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
	<meta name="theme-color" content="#FFF6EA" />
</svelte:head>

<main class="relative flex fill-vp flex-col overflow-hidden bg-paper text-ink">
	{#if screen === 'join'}
		<button
			type="button"
			data-testid="back-home"
			aria-label={m['nav.back']()}
			onclick={() => void goto('/')}
			class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 grid size-11 place-items-center rounded-full border-4 border-ink bg-paper text-xl font-bold text-ink"
		>
			←
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
	{:else}
		<section
			data-testid="intro-splash"
			class="pop-in grid fill-vp place-items-center bg-night px-4 text-center"
		>
			<div class="pb-safe">
				<div class="pixel-loader mx-auto" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<h1 tabindex="-1" class="mt-8 text-6xl font-extrabold tracking-tight text-paper">
					{m['intro.starting']()}
				</h1>
				<p class="mt-3 text-sm font-bold uppercase tracking-widest text-paper/50">{data.code}</p>
			</div>
		</section>
	{/if}

	{#if offlineLong && screen !== 'intro'}
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
				<p class="font-semibold text-ink/60">{m['offline.retry']()}</p>
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
