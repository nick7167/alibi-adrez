<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { MAX_TEXT_LENGTH, type PlanningView } from '@alibi/shared';
	import Countdown from '$lib/components/Countdown.svelte';

	let {
		room,
		you,
		offset,
		onSendChat
	}: {
		room: PlanningView;
		you: string;
		offset: number;
		onSendChat: (text: string) => void;
	} = $props();

	const suspects = $derived(room.players.filter((p) => room.suspectIds.includes(p.id)));
	const partner = $derived(suspects.find((p) => p.id !== you) ?? null);

	let draft = $state('');
	const canSend = $derived(draft.trim().length > 0 && draft.trim().length <= MAX_TEXT_LENGTH);

	function submitChat(e: SubmitEvent) {
		e.preventDefault();
		const text = draft.trim();
		if (!text || text.length > MAX_TEXT_LENGTH) return;
		onSendChat(text);
		draft = '';
	}

	// Auto-scroll the chat log to the newest line as messages arrive.
	let logEl = $state<HTMLElement | null>(null);
	$effect(() => {
		void room.chat?.length;
		if (logEl) logEl.scrollTop = logEl.scrollHeight;
	});
</script>

{#snippet header()}
	<div class="flex shrink-0 items-center justify-between px-5 pt-safe">
		<span class="field-label-invert">
			{m['game.round']({ round: room.round, roundCount: room.roundCount })}
		</span>
		<div class="flex flex-col items-end">
			<span class="field-label-invert">{m['game.timeLeft']()}</span>
			<Countdown deadline={room.deadline} {offset} class="text-sunshine" />
		</div>
	</div>
{/snippet}

{#if room.role === 'suspect'}
	<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-grape text-paper">
		{@render header()}

		<div class="mt-3 flex shrink-0 items-center justify-center gap-2 px-5">
			<span class="stamp">{m['planning.secretStamp']()}</span>
			{#if partner}
				<p class="text-center text-sm font-bold text-paper/80" data-testid="shared-with">
					{m['planning.sharedWith']({ name: partner.name })}
				</p>
			{/if}
		</div>

		<div class="relative mt-3 min-h-0 flex-1">
			<div class="h-full overflow-x-hidden overflow-y-auto px-5 pb-3" bind:this={logEl}>
				<section
					data-testid="scenario-card"
					class="ruled rounded-card border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
				>
					<h2 class="field-label">{m['planning.scenario.title']()}</h2>
					<p class="mt-2 text-lg leading-snug font-bold">{room.scenario?.story}</p>

					<h3 class="field-label mt-4">{m['planning.details.title']()}</h3>
					<ol class="mt-2 flex flex-col gap-2">
						{#each room.scenario?.details ?? [] as detail, i (i)}
							<li class="flex items-start gap-2 text-[15px] leading-snug">
								<span class="font-mono text-xs font-bold text-coral tabular-nums" aria-hidden="true">
									{String(i + 1).padStart(2, '0')}
								</span>
								<span>{detail}</span>
							</li>
						{/each}
					</ol>
				</section>

				<h3 class="field-label-invert mt-5">{m['planning.chat.title']()}</h3>
				<ul class="mt-2 flex flex-col gap-1.5 pb-1" role="log" aria-live="polite" data-testid="chat-log">
					{#each room.chat ?? [] as line, i (i)}
						{@const mine = line.playerId === you}
						<li class="flex {mine ? 'justify-end' : 'justify-start'}">
							<span
								class="max-w-[80%] rounded-[16px] px-3.5 py-2 text-[15px] font-semibold break-words {mine
									? 'bg-coral text-white'
									: 'bg-paper text-ink'}"
							>
								{line.text}
							</span>
						</li>
					{:else}
						<li class="text-center text-sm font-bold text-paper/70">{m['planning.chat.empty']()}</li>
					{/each}
				</ul>
			</div>
		</div>

		<form
			onsubmit={submitChat}
			class="flex shrink-0 items-center gap-2 px-5 pt-2 pb-safe"
			data-testid="chat-form"
		>
			<label for="planning-chat-input" class="sr-only">{m['planning.chat.placeholder']()}</label>
			<input
				id="planning-chat-input"
				type="text"
				bind:value={draft}
				maxlength={MAX_TEXT_LENGTH}
				placeholder={m['planning.chat.placeholder']()}
				autocomplete="off"
				class="min-h-11 flex-1 rounded-full border-[3px] border-ink/20 bg-white/90 px-4 text-[15px] font-semibold text-ink placeholder:text-ink/40 focus:border-ink/60 focus:outline-none"
			/>
			<button
				type="submit"
				disabled={!canSend}
				data-testid="chat-send"
				aria-label={m['planning.chat.send']()}
				class="sticker grid size-11 shrink-0 place-items-center rounded-full bg-coral text-white disabled:opacity-40"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.6"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M4 12 20 4l-6 16-3-7-7-1Z" />
				</svg>
			</button>
		</form>
	</div>
{:else}
	<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-grape text-paper">
		{@render header()}

		<div class="relative min-h-0 flex-1">
			<div class="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 text-center">
				<div class="pixel-loader" aria-hidden="true">
					<span></span><span></span><span></span>
				</div>
				<div>
					<h2 class="text-2xl font-extrabold text-paper" data-testid="detective-waiting-title">
						{m['planning.detective.waiting.title']()}
					</h2>
					<p class="mt-2 font-semibold text-paper/75">{m['planning.detective.waiting.body']()}</p>
				</div>

				<div class="w-full">
					<h3 class="field-label-invert">{m['planning.detective.suspects']()}</h3>
					<ul class="mt-3 flex flex-col gap-2" data-testid="suspect-list">
						{#each suspects as suspect (suspect.id)}
							<li
								class="flex min-h-[52px] items-center gap-3 rounded-[14px] bg-paper/10 px-4 py-2 text-left"
							>
								<span class="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-xl">
									{suspect.emoji}
								</span>
								<span class="font-bold text-paper">{suspect.name}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Same evidence typography as app.css's `.field-label`, recolored for
	   this screen's dark grape field — the shared primitive is tuned for
	   paper/manila and would go near-invisible here. Scoped to this
	   component so the light-background labels inside the manila scenario
	   card keep using the real `.field-label`. */
	.field-label-invert {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--color-paper) 70%, transparent);
	}

	.pixel-loader {
		display: flex;
		gap: 10px;
	}

	.pixel-loader span {
		width: 12px;
		height: 12px;
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
			transform: translateY(-10px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pixel-loader span {
			animation: none;
		}
	}
</style>
