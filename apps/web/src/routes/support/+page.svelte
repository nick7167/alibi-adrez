<script lang="ts">
	import SafetyInfoPage from '$lib/components/SafetyInfoPage.svelte';
	import { currentLocale } from '$lib/i18n';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { clearSavedIdentities } from '$lib/stores/session.svelte';

	let confirmCleanup = $state(false);
	let cleanupResult = $state<boolean | null>(null);
	const cleanup = $derived(currentLocale() === 'da' ? {
		title: 'Gemte rumlogin',
		body: 'Denne enhed gemmer dit spillernavn, din emoji og dit login til de rum, du har deltaget i. Du kan slette dem her. Dit sprogvalg og skjulte spillere og svar bevares.',
		button: 'Slet gemte rumlogin',
		confirmTitle: 'Slet dine gemte rumlogin?',
		confirmBody: 'Du mister adgangen til at vende tilbage som samme spiller, også som vært. Forlad aktive spil og luk andre faner med AHA først. Dette sletter kun login på denne enhed, ikke spilindhold i rummene eller sendte supportmails.',
		success: 'Dine gemte rumlogin er slettet fra denne enhed.',
		failure: 'Ikke alle gemte rumlogin kunne slettes. Prøv igen, eller slet appens eller webstedets data i enhedens indstillinger.'
	} : {
		title: 'Saved room logins',
		body: 'This device saves your player name, emoji, and login for rooms you have joined. You can delete them here. Your language and hidden players and answers are kept.',
		button: 'Delete saved room logins',
		confirmTitle: 'Delete your saved room logins?',
		confirmBody: 'You will lose access to rejoin as the same player, including as host. Leave active games and close other AHA tabs first. This only deletes logins on this device, not gameplay content in rooms or support emails you sent.',
		success: 'Your saved room logins have been deleted from this device.',
		failure: 'Some saved room logins could not be deleted. Try again, or clear the app or website data in your device settings.'
	});

	function deleteLogins() {
		cleanupResult = clearSavedIdentities();
		confirmCleanup = false;
	}

	const content = $derived(currentLocale() === 'da'
		? {
			title: 'Support og rapporter',
			tag: 'Vi hjælper',
			sections: [
				{
					heading: 'Rapportér fra et rum',
					body: 'Åbn menuen ••• ved et svar eller en spiller og vælg Rapportér. Din mailapp åbner med rumkode og de relevante tekniske ID’er udfyldt. Du bestemmer selv, om mailen sendes.'
				},
				{
					heading: 'Skjul eller fjern',
					body: 'Alle kan skjule et svar eller en spiller lokalt på deres egen enhed. Værten kan fjerne en spiller og ugyldiggøre spillerens aktuelle rumsession.'
				},
				{
					heading: 'Send kun det nødvendige',
					body: 'Beskriv kort hvad der skete, men send ikke flere personoplysninger end nødvendigt. Rapporter gennemgås så hurtigt som muligt.'
				}
			]
		}
		: {
			title: 'Support and reports',
			tag: 'We can help',
			sections: [
				{
					heading: 'Report from a room',
					body: 'Open the ••• menu beside an answer or player and choose Report. Your mail app opens with the room code and relevant technical IDs filled in. You decide whether to send it.'
				},
				{
					heading: 'Hide or remove',
					body: 'Anyone can hide an answer or player locally on their own device. The host can remove a player and revoke that player’s current room session.'
				},
				{
					heading: 'Send only what is needed',
					body: 'Briefly describe what happened, but do not include more personal information than necessary. Reports are reviewed as quickly as possible.'
				}
			]
		});
</script>

<SafetyInfoPage title={content.title} tag={content.tag} sections={content.sections} showContact>
	<section class="rounded-card bg-surface p-5 text-ink shadow-[0_5px_0_rgba(22,11,61,0.4)]">
		<h2 class="font-display text-xl font-semibold">{cleanup.title}</h2>
		<p class="mt-3 text-[15px] leading-relaxed font-medium text-ink/85">{cleanup.body}</p>
		<button
			type="button"
			data-testid="delete-room-logins"
			onclick={() => { cleanupResult = null; confirmCleanup = true; }}
			class="mt-4 flex min-h-12 w-full items-center justify-center rounded-full border-2 border-ink/25 px-4 font-bold"
		>{cleanup.button}</button>
		<p role="status" class="mt-3 text-[15px] leading-relaxed font-medium">
			{cleanupResult === null ? '' : cleanupResult ? cleanup.success : cleanup.failure}
		</p>
	</section>
</SafetyInfoPage>

<ConfirmDialog
	open={confirmCleanup}
	title={cleanup.confirmTitle}
	body={cleanup.confirmBody}
	confirmLabel={cleanup.button}
	destructive
	onConfirm={deleteLogins}
	onCancel={() => { confirmCleanup = false; }}
	testid="delete-logins-confirm"
/>
