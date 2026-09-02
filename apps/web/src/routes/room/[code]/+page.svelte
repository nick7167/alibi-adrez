<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { computeClockOffset, openRoomSocket, type RoomSocket } from '$lib/api';
	import { clearIdentity, loadIdentity, saveIdentity } from '$lib/stores/session.svelte';
	import type { Identity } from '$lib/stores/session.svelte';
	import { currentLocale } from '$lib/i18n';
	import {
		loadBlockedPlayers,
		loadHiddenAnswers,
		redactRoom,
		reportAnswerUrl,
		reportPlayerUrl,
		saveBlockedPlayers,
		saveHiddenAnswers
	} from '$lib/safety';
	import type { Phase, RoomView, ServerMessage, Settings } from '@aha/shared';
	import JoinForm from './JoinForm.svelte';
	import Lobby from './Lobby.svelte';
	import Answering from './Answering.svelte';
	import Guessing from './Guessing.svelte';
	import Reveal from './Reveal.svelte';
	import Standings from './Standings.svelte';
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
	let blockedPlayerIds = $state<string[]>([]);
	let hiddenAnswerIds = $state<string[]>([]);

	let sockRef: RoomSocket | null = null;
	let pendingIdentity: { name: string; emoji: string } | null = null;
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	const blockedPlayers = $derived(new Set(blockedPlayerIds));
	const hiddenAnswers = $derived(new Set(hiddenAnswerIds));
	const displayedRoom = $derived(
		view === null
			? null
			: redactRoom(view.room, blockedPlayers, hiddenAnswers, {
					player: m['safety.hiddenPlayer'](),
					answer: m['safety.hiddenAnswer']()
				})
	);

	$effect(() => {
		blockedPlayerIds = loadBlockedPlayers(data.code);
		hiddenAnswerIds = loadHiddenAnswers(data.code);
	});

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
				} else if (msg.code === 'CONTENT_BLOCKED') {
					toast(m['errors.contentBlocked']());
					if (screen === 'join') errorNonce++;
				} else if (msg.code === 'ROOM_FULL') {
					toastThen(m['errors.fullRoom'](), () => void goto('/'));
				} else if (msg.code === 'KICKED') {
					clearIdentity(code);
					sockRef?.close();
					toastThen(m['errors.kicked'](), () => void goto('/'));
				} else if (msg.code === 'RATE_LIMITED') {
					toast(m['errors.rateLimited']());
				} else if (msg.code === 'UNKNOWN_PLAYER') {
					clearIdentity(code);
					toast(m['errors.generic']());
					screen = 'join';
					errorNonce++;
				} else {
					toast(m['errors.generic']());
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

	function startPractice() {
		sockRef?.send({ v: 1, t: 'startPractice' });
	}

	/** FINALE: put the room back in the lobby, same players, same settings.
	    Any player may send it — it is the finale's only way onward, so a
	    host-only reset would strand everyone else on a terminal screen. */
	function backToLobby() {
		sockRef?.send({ v: 1, t: 'returnToLobby' });
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

	/** ANSWERING: answer one question. An upsert — send it again to edit, and
	    the server keeps the same answerId so an edit never re-slots it. */
	function submitEntry(questionIndex: number, text: string) {
		sockRef?.submitEntry(questionIndex, text);
	}

	/** ANSWERING: "I have written what I am going to write." Legal with
	    questions left blank, and idempotent — the screen may send it again
	    after an edit without any special casing. */
	function handIn() {
		sockRef?.handIn();
	}

	/** GUESSING: accuse one player of writing the answer on screen. The
	    `answerId` travels with the tap so a guess that lands after the round
	    advanced is rejected as STALE_ANSWER rather than applied to the next
	    answer — the screen locks its grid client-side for the same race. */
	function submitGuess(answerId: string, playerId: string) {
		sockRef?.submitGuess(answerId, playerId);
	}

	function kickPlayer(playerId: string) {
		sockRef?.send({ v: 1, t: 'kick', targetPlayerId: playerId });
	}

	function toggleBlockedPlayer(playerId: string) {
		blockedPlayerIds = blockedPlayers.has(playerId)
			? blockedPlayerIds.filter((id) => id !== playerId)
			: [...blockedPlayerIds, playerId];
		saveBlockedPlayers(data.code, blockedPlayerIds);
	}

	function toggleHiddenAnswer(answerId: string) {
		hiddenAnswerIds = hiddenAnswers.has(answerId)
			? hiddenAnswerIds.filter((id) => id !== answerId)
			: [...hiddenAnswerIds, answerId];
		saveHiddenAnswers(data.code, hiddenAnswerIds);
	}

	function reportPlayer(playerId: string) {
		const player = view?.room.players.find((candidate) => candidate.id === playerId);
		if (player === undefined) return;
		window.location.href = reportPlayerUrl({
			lang: currentLocale(),
			roomCode: data.code,
			playerId,
			playerName: player.name
		});
	}

	function reportAnswer(answerId: string) {
		const room = view?.room;
		if (room?.phase !== 'GUESSING' && room?.phase !== 'REVEAL') return;
		if (room.answer.id !== answerId) return;
		const author = room.phase === 'REVEAL'
			? room.players.find((player) => player.id === room.authorId)
			: undefined;
		window.location.href = reportAnswerUrl({
			lang: currentLocale(),
			roomCode: data.code,
			answerId,
			answerText: room.answer.text,
			...(author === undefined ? {} : { author: { id: author.id, name: author.name } })
		});
	}

	/** AHA has one field colour and every screen wears it (see the ledger's
	    "Chosen identity — A · AHA" ruling): join, lobby, and every phase.
	    Kept as a literal inside the $derived — never a lookup object — because
	    apps/web/test/head-canvas.test.ts statically extracts the hexes from
	    here and diffs them against the canvas style blocks below. A screen
	    that ever needs a different field turns this back into a literal
	    ternary over `field` and adds the matching branch in the head. */
	const themeColor = $derived('#4A1FD6');

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
	<!-- Static style text only: each branch's text must be fully static so
	    Svelte renders it inline instead of compiling it into a scoped
	    stylesheet that could never match html/body. The hexes must match
	    themeColor above — test/head-canvas.test.ts fails the build if they
	    drift. -->
	<style>
		html,
		html > body {
			background-color: #4a1fd6;
		}
	</style>
</svelte:head>


<main class="relative flex fill-vp flex-col overflow-hidden bg-field text-white">
	{#if screen === 'join'}
		<button
			type="button"
			data-testid="back-home"
			aria-label={m['nav.back']()}
			onclick={() => void goto('/')}
			class="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 grid size-11 place-items-center rounded-full border-2 border-white/30 bg-white/10 text-white"
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
	{:else if displayedRoom?.phase === 'LOBBY' && view}
		<Lobby
			isHost={view.isHost}
			you={view.you}
			room={displayedRoom}
			onStart={startGame}
			onPractice={startPractice}
			onUpdate={updateSettings}
			onLeave={leaveRoom}
			onKick={kickPlayer}
			onToggleBlocked={toggleBlockedPlayer}
			onReportPlayer={reportPlayer}
			isBlocked={(playerId) => blockedPlayers.has(playerId)}
		/>
	{:else if displayedRoom?.phase === 'INTRO'}
		<section
			data-testid="intro-splash"
			class="pop-in grid fill-vp place-items-center bg-field px-4 text-center"
		>
			<div class="flex flex-col items-center pb-safe">
				<div class="pixel-loader" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<h1 tabindex="-1" class="mt-8 font-display text-6xl font-bold tracking-tight text-white">
					{m['intro.starting']()}
				</h1>
				<span
					class="mt-6 rounded-full bg-surface-2 px-5 pt-1.5 pb-1 text-2xl font-bold tracking-[0.14em] text-white tabular-nums"
				>
					{data.code}
				</span>
			</div>
		</section>
	{:else if displayedRoom?.phase === 'ANSWERING'}
		<Answering
			room={displayedRoom}
			{offset}
			onSubmit={submitEntry}
			onHandIn={handIn}
			onLeave={leaveRoom}
		/>
	{:else if displayedRoom?.phase === 'GUESSING'}
		<Guessing
			room={displayedRoom}
			{offset}
			onGuess={submitGuess}
			onLeave={leaveRoom}
			answerHidden={hiddenAnswers.has(displayedRoom.answer.id)}
			onToggleHidden={() => toggleHiddenAnswer(displayedRoom.answer.id)}
			onReport={() => reportAnswer(displayedRoom.answer.id)}
		/>
	{:else if displayedRoom?.phase === 'REVEAL' && view}
		<Reveal
			room={displayedRoom}
			you={view.you}
			{offset}
			onLeave={leaveRoom}
			answerHidden={hiddenAnswers.has(displayedRoom.answer.id) || blockedPlayers.has(displayedRoom.authorId)}
			answerHiddenByPlayer={blockedPlayers.has(displayedRoom.authorId)}
			onToggleHidden={() => toggleHiddenAnswer(displayedRoom.answer.id)}
			onReport={() => reportAnswer(displayedRoom.answer.id)}
		/>
	{:else if displayedRoom?.phase === 'STANDINGS' && view}
		<Standings room={displayedRoom} you={view.you} {offset} onLeave={leaveRoom} />
	{:else if displayedRoom?.phase === 'FINALE' && view}
		<!-- The only in-room screen with NO leave control: its single action
		     puts the room back in the lobby with the same players, and leaving
		     for good is done from there. -->
		<Finale room={displayedRoom} you={view.you} onBackToLobby={backToLobby} />
	{/if}

	{#if offlineLong && screen !== 'INTRO'}
		<div
			data-testid="offline-overlay"
			class="fixed inset-0 z-50 grid place-items-center bg-field/95"
			role="status"
		>
			<div class="flex flex-col items-center gap-4">
				<div class="pixel-loader mx-auto" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<p class="font-display text-xl font-bold text-white">{m['offline.title']()}</p>
				<p class="text-[11px] font-extrabold tracking-[0.16em] text-white/70 uppercase">{m['offline.retry']()}</p>
			</div>
		</div>
	{/if}

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
		background: var(--color-action);
		animation: pixel-bounce 900ms ease-in-out infinite;
	}

	.pixel-loader span:nth-child(2) {
		background: var(--color-accent-wrong);
		animation-delay: 120ms;
	}

	.pixel-loader span:nth-child(3) {
		background: var(--color-accent-right);
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
