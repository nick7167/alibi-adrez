<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { MAX_TEXT_LENGTH, type InterrogationView, type Player } from '@aha/shared';
	import Countdown from '$lib/components/Countdown.svelte';

	let {
		room,
		you,
		offset,
		onSubmitQuestion,
		onSubmitAnswer
	}: {
		room: InterrogationView;
		you: string;
		offset: number;
		onSubmitQuestion: (text: string) => void;
		onSubmitAnswer: (text: string) => void;
	} = $props();

	function playerFor(id: string): Player | undefined {
		return room.players.find((p) => p.id === id);
	}

	const clockedPlayer = $derived(room.onTheClock ? (playerFor(room.onTheClock) ?? null) : null);

	// -- suspect: answer box --
	let answerDraft = $state('');
	const canAnswer = $derived(
		answerDraft.trim().length > 0 && answerDraft.trim().length <= MAX_TEXT_LENGTH
	);

	function submitAnswerForm(e: SubmitEvent) {
		e.preventDefault();
		const text = answerDraft.trim();
		if (!text || text.length > MAX_TEXT_LENGTH) return;
		onSubmitAnswer(text);
		answerDraft = '';
	}

	// -- detective: question box --
	let questionDraft = $state('');
	const questionsLeft = $derived(room.myQuestionsLeft ?? 0);
	const canAsk = $derived(
		questionsLeft > 0 &&
			questionDraft.trim().length > 0 &&
			questionDraft.trim().length <= MAX_TEXT_LENGTH
	);

	function submitQuestionForm(e: SubmitEvent) {
		e.preventDefault();
		const text = questionDraft.trim();
		if (!text || text.length > MAX_TEXT_LENGTH || questionsLeft <= 0) return;
		onSubmitQuestion(text);
		questionDraft = '';
	}

	// Auto-scroll to the newest item as the transcript/question grows.
	let logEl = $state<HTMLElement | null>(null);
	$effect(() => {
		void room.transcript.length;
		void room.question;
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
	<div class="mt-3 flex shrink-0 items-center justify-center px-5">
		<span class="stamp" data-testid="progress-stamp">
			{m['interrogation.progress']({
				index: Math.min(room.questionIndex + 1, room.questionTotal),
				total: room.questionTotal
			})}
		</span>
	</div>
{/snippet}

{#snippet questionCard(label: string)}
	<section
		data-testid="question-card"
		class="ruled rounded-card border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
	>
		<h2 class="field-label">{label}</h2>
		<p class="mt-2 text-2xl leading-snug font-extrabold">{room.question}</p>
	</section>
{/snippet}

{#if room.role === 'suspect'}
	<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-night text-paper">
		{@render header()}

		<div class="relative mt-3 min-h-0 flex-1">
			<div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-5 pb-3" bind:this={logEl}>
				{#if room.question !== null}
					{@render questionCard(room.awaitingMyAnswer ? m['interrogation.yourTurn']() : clockedPlayer ? m['interrogation.waitingFor']({ name: clockedPlayer.name }) : m['interrogation.pending']())}
				{:else}
					<p class="text-center text-sm font-bold text-paper/70">{m['interrogation.pending']()}</p>
				{/if}

				{#if !room.awaitingMyAnswer}
					<div class="mt-4 flex flex-col items-center gap-3 text-center" data-testid="waiting-turn">
						<div class="pixel-loader" aria-hidden="true">
							<span></span><span></span><span></span>
						</div>
						<p class="font-semibold text-paper/75">{m['interrogation.waitingBody']()}</p>
					</div>
				{/if}

				{#if room.scenario}
					<details class="reference mt-5 shrink-0" data-testid="scenario-reference">
						<summary class="field-label-invert flex cursor-pointer items-center gap-2 select-none">
							<svg
								class="chevron shrink-0"
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="m9 5 7 7-7 7" />
							</svg>
							{m['interrogation.scenarioReference']()}
						</summary>
						<section
							class="ruled rounded-card mt-2 border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
						>
							<h3 class="field-label">{m['planning.scenario.title']()}</h3>
							<p class="mt-2 text-base leading-snug font-bold">{room.scenario.story}</p>

							<h3 class="field-label mt-4">{m['planning.details.title']()}</h3>
							<ol class="mt-2 flex flex-col gap-2">
								{#each room.scenario.details as detail, i (i)}
									<li class="flex items-start gap-2 text-[14px] leading-snug">
										<span
											class="font-mono text-xs font-bold text-coral tabular-nums"
											aria-hidden="true"
										>
											{String(i + 1).padStart(2, '0')}
										</span>
										<span>{detail}</span>
									</li>
								{/each}
							</ol>
						</section>
					</details>
				{/if}

				{#if !room.awaitingMyAnswer}
					<div class="pb-safe"></div>
				{/if}
			</div>
		</div>

		{#if room.awaitingMyAnswer}
			<form
				onsubmit={submitAnswerForm}
				class="flex shrink-0 items-center gap-2 px-5 pt-2 pb-safe"
				data-testid="answer-form"
			>
				<label for="interrogation-answer-input" class="sr-only"
					>{m['interrogation.answerPlaceholder']()}</label
				>
				<input
					id="interrogation-answer-input"
					type="text"
					bind:value={answerDraft}
					maxlength={MAX_TEXT_LENGTH}
					placeholder={m['interrogation.answerPlaceholder']()}
					autocomplete="off"
					class="min-h-11 flex-1 rounded-full border-[3px] border-ink/20 bg-white/90 px-4 text-[15px] font-semibold text-ink placeholder:text-ink/40 focus:border-ink/60 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!canAnswer}
					data-testid="answer-send"
					aria-label={m['interrogation.send']()}
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
		{/if}
	</div>
{:else}
	<div class="relative mx-auto flex fill-vp w-full max-w-md flex-col bg-night text-paper">
		{@render header()}

		<div class="relative mt-3 min-h-0 flex-1">
			<div class="h-full overflow-x-hidden overflow-y-auto px-5 pb-3" bind:this={logEl}>
				<ul class="mt-1 flex flex-col gap-3 pb-1" role="log" aria-live="polite" data-testid="transcript">
					{#each room.transcript as entry, i (i)}
						<li
							class="rounded-card border-[3px] border-ink bg-manila p-4 text-ink shadow-[0_5px_0_rgba(23,21,49,0.25)]"
						>
							<span class="font-mono text-xs font-bold text-coral tabular-nums" aria-hidden="true"
								>{String(i + 1).padStart(2, '0')}</span
							>
							<p class="mt-1 text-lg leading-snug font-bold">{entry.question}</p>
							<div class="mt-3 grid gap-2">
								{#each entry.answers as a (a.playerId)}
									{@const p = playerFor(a.playerId)}
									<div class="rounded-[14px] bg-paper/60 p-2.5">
										<span class="field-label">{p ? p.name : a.playerId}</span>
										{#if a.text === ''}
											<p class="mt-0.5 text-sm font-bold text-ink/50 italic">
												{m['interrogation.noAnswer']()}
											</p>
										{:else}
											<p class="mt-0.5 text-[15px] leading-snug font-semibold">{a.text}</p>
										{/if}
									</div>
								{/each}
							</div>
						</li>
					{:else}
						<li class="text-center text-sm font-bold text-paper/70" data-testid="transcript-empty">
							{m['interrogation.transcriptEmpty']()}
						</li>
					{/each}

					{#if room.question !== null}
						<li
							class="rounded-card border-[3px] border-dashed border-paper/40 bg-transparent p-4 text-paper"
							data-testid="pending-question"
						>
							<span class="field-label-invert">{m['interrogation.onRecord']()}</span>
							<p class="mt-1 text-lg leading-snug font-bold">{room.question}</p>
							{#if clockedPlayer}
								<p class="mt-2 text-sm font-semibold text-sunshine">
									{m['interrogation.waitingFor']({ name: clockedPlayer.name })}
								</p>
							{/if}
						</li>
					{/if}
				</ul>
			</div>
		</div>

		<div class="flex shrink-0 items-center justify-between px-5 pt-1">
			<span class="field-label-invert">{m['interrogation.questionPlaceholder']()}</span>
			<span class="stamp" data-testid="questions-left">
				{questionsLeft > 0
					? m['interrogation.questionsLeft']({ count: questionsLeft })
					: m['interrogation.questionsDone']()}
			</span>
		</div>
		<form
			onsubmit={submitQuestionForm}
			class="flex shrink-0 items-center gap-2 px-5 pt-2 pb-safe"
			data-testid="question-form"
		>
			<label for="interrogation-question-input" class="sr-only"
				>{m['interrogation.questionPlaceholder']()}</label
			>
			<input
				id="interrogation-question-input"
				type="text"
				bind:value={questionDraft}
				maxlength={MAX_TEXT_LENGTH}
				disabled={questionsLeft <= 0}
				placeholder={m['interrogation.questionPlaceholder']()}
				autocomplete="off"
				class="min-h-11 flex-1 rounded-full border-[3px] border-ink/20 bg-white/90 px-4 text-[15px] font-semibold text-ink placeholder:text-ink/40 focus:border-ink/60 focus:outline-none disabled:opacity-40"
			/>
			<button
				type="submit"
				disabled={!canAsk}
				data-testid="question-send"
				aria-label={m['interrogation.send']()}
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
{/if}

<style>
	/* Drawn chevron instead of the browser's native disclosure triangle —
	   every other icon in the app is a drawn SVG. */
	.reference > summary {
		list-style: none;
	}

	.reference > summary::-webkit-details-marker {
		display: none;
	}

	.reference .chevron {
		transition: rotate 150ms ease;
	}

	.reference[open] .chevron {
		rotate: 90deg;
	}

	@media (prefers-reduced-motion: reduce) {
		.reference .chevron {
			transition: none;
		}
	}

	/* Same evidence typography as app.css's field-label, recolored for this
	   screen's dark night field — the shared primitive is tuned for
	   paper/manila and would go near-invisible here. Scoped to this
	   component so the light-background labels inside the manila cards
	   keep using the real field-label class. */
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
