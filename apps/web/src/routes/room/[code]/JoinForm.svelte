<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { AVATARS } from '@alibi/shared';

	let {
		pending = false,
		errorNonce = 0,
		onJoin
	}: { pending?: boolean; errorNonce?: number; onJoin: (name: string, emoji: string) => void } =
		$props();

	let name = $state('');
	let emoji = $state<string>(AVATARS[0] ?? '');
	let nameEl = $state<HTMLInputElement | null>(null);

	const canJoin = $derived(name.trim().length > 0 && !pending);

	// Focus the nickname input on mount and after an error sends us back here.
	$effect(() => {
		void errorNonce;
		nameEl?.focus();
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!canJoin) return;
		onJoin(name.trim().slice(0, 20), emoji);
	}

	const AVATAR_FILLS = [
		'bg-sunshine text-ink',
		'bg-mint text-ink',
		'bg-coral text-white',
		'bg-grape text-white'
	];
</script>

<!-- Root fills the viewport as a flex column; the middle section is the
     screen's single scrollable region, so focus-scrolling can lift the
     nickname field above the on-screen keyboard. -->
<div class="fill-vp relative flex flex-col bg-cobalt">
	<!-- pixel-confetti layer (decorative) -->
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<span class="absolute top-[10%] left-[8%] h-3 w-3 rotate-12 bg-sunshine opacity-20"></span>
		<span class="absolute top-[18%] right-[9%] h-2.5 w-2.5 rotate-45 bg-paper opacity-20"></span>
		<span class="absolute bottom-[14%] left-[10%] h-3.5 w-3.5 -rotate-6 bg-mint opacity-15"></span>
		<span class="absolute right-[7%] bottom-[22%] h-2.5 w-2.5 rotate-45 bg-coral opacity-20"></span>
		<span class="absolute top-[46%] left-[4%] h-2 w-2 rotate-45 bg-sunshine opacity-15"></span>
	</div>

	<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-safe">
		<section
			class="pop-in relative z-10 mx-auto mt-4 w-full max-w-md rounded-card bg-paper p-6 shadow-[0_8px_0_rgba(23,21,49,0.35)] sm:p-8"
		>
		<h1 class="text-center text-4xl font-extrabold tracking-tight text-ink">
			{m['join.title']()}
		</h1>

		<form class="mt-6" id="join-fields" onsubmit={submit}>
			<label for="nickname" class="block text-sm font-bold tracking-wide text-ink">
				{m['join.nickname']()}
			</label>
			<input
				bind:this={nameEl}
				bind:value={name}
				id="nickname"
				data-testid="nickname"
				type="text"
				maxlength={20}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				placeholder={m['join.title']()}
				class="mt-2 h-14 w-full rounded-full border-4 border-ink bg-white px-5 text-lg font-bold text-ink caret-ink placeholder:text-ink/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-cobalt"
			/>

			<p class="mt-5 block text-sm font-bold tracking-wide text-ink">{m['join.pickAvatar']()}</p>
			<div role="radiogroup" aria-label={m['join.pickAvatar']()} class="mt-3 grid grid-cols-4 gap-2.5">
				{#each AVATARS as avatar, i (avatar)}
					<button
						type="button"
						role="radio"
						aria-checked={emoji === avatar}
						aria-label={avatar}
						data-testid={`avatar-${i}`}
						onclick={() => (emoji = avatar)}
						class={`grid h-14 w-full place-items-center rounded-full text-2xl transition-transform duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-cobalt ${
							AVATAR_FILLS[i % AVATAR_FILLS.length]
						} ${emoji === avatar ? 'rotate-6 ring-4 ring-ink' : 'hover:scale-105'}`}
					>
						{avatar}
					</button>
				{/each}
			</div>
		</form>
	</section>
	</div>

	<div class="shrink-0 px-4 pt-4 pb-safe">
		<button
			type="submit"
			form="join-fields"
			data-testid="join-submit"
			disabled={!canJoin}
			class="sticker flex min-h-14 w-full items-center justify-center rounded-full bg-sunshine px-8 text-lg font-bold text-ink disabled:opacity-40"
		>
			{m['join.enter']()}
		</button>
	</div>
</div>

<style>
	.pop-in {
		animation: pop-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.sticker {
		box-shadow: 0 5px 0 rgba(23, 21, 49, 0.25);
		transition: box-shadow 100ms ease, transform 100ms ease;
	}

	.sticker:not(:disabled):active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 rgba(23, 21, 49, 0.25);
	}

	@media (prefers-reduced-motion: reduce) {
		.pop-in {
			animation: none;
		}
		.sticker {
			transition: none;
		}
	}
</style>
