<svelte:head>
	<title>ALIBI 🎭</title>
	<meta name="theme-color" content="#FFC93C" />
</svelte:head>

<main class="relative min-h-dvh overflow-hidden bg-sunshine text-ink">
	<!-- pixel-confetti layer (decorative) -->
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<span class="absolute top-[8%] left-[6%] h-3 w-3 rotate-12 bg-cobalt opacity-15"></span>
		<span class="absolute top-[16%] right-[10%] h-2.5 w-2.5 rotate-45 bg-coral opacity-20"></span>
		<span class="absolute top-[30%] left-[12%] h-2 w-2 -rotate-6 bg-grape opacity-15"></span>
		<span class="absolute top-[38%] right-[5%] h-3.5 w-3.5 rotate-45 bg-mint opacity-15"></span>
		<span class="absolute bottom-[24%] left-[7%] h-3.5 w-3.5 rotate-3 bg-cobalt opacity-10"></span>
		<span class="absolute right-[14%] bottom-[32%] h-2.5 w-2.5 -rotate-12 bg-coral opacity-20"></span>
		<span class="absolute top-[6%] right-[32%] h-2 w-2 rotate-45 bg-paper opacity-20"></span>
		<span class="absolute bottom-[12%] left-[28%] h-2.5 w-2.5 rotate-45 bg-grape opacity-15"></span>
		<span class="absolute right-[6%] bottom-[8%] h-3 w-3 -rotate-45 bg-mint opacity-20"></span>
		<span class="absolute bottom-[42%] left-[4%] h-2 w-2 rotate-45 bg-coral opacity-15"></span>
	</div>

	<div
		class="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-16 pb-8"
	>
		<header>
			<h1
				class="reveal text-center text-7xl font-extrabold tracking-tight text-ink"
				style="animation-delay: 0ms"
			>
				ALIBI <span class="align-middle">🎭</span>
			</h1>
			<p
				class="reveal mt-4 text-center text-lg font-semibold"
				style="animation-delay: 100ms"
			>
				A party game of tall tales and busted alibis.
			</p>
		</header>

		<div class="mt-auto flex flex-col gap-4">
			<button
				type="button"
				aria-disabled="true"
				class="reveal flex min-h-14 w-full items-center justify-center rounded-full bg-cobalt px-8 text-lg font-bold text-white shadow-[0_5px_0_rgba(20,20,51,0.25)] transition-shadow active:translate-y-0.5 active:shadow-[0_2px_0_rgba(20,20,51,0.25)]"
				style="animation-delay: 200ms"
			>
				Create room
			</button>
			<button
				type="button"
				aria-disabled="true"
				class="reveal flex min-h-14 w-full items-center justify-center rounded-full border-4 border-cobalt bg-transparent px-8 text-lg font-bold text-cobalt shadow-[0_5px_0_rgba(20,20,51,0.15)] transition-shadow active:translate-y-0.5 active:shadow-[0_2px_0_rgba(20,20,51,0.15)]"
				style="animation-delay: 300ms"
			>
				Join
			</button>
		</div>

		<footer
			class="reveal mt-10 text-center text-sm font-bold tracking-widest opacity-60"
			style="animation-delay: 400ms"
		>
			EN | DA
		</footer>
	</div>
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

	@media (prefers-reduced-motion: reduce) {
		.reveal {
			animation: none;
		}
	}
</style>
