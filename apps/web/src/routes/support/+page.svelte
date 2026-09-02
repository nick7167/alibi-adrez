<script lang="ts">
	import SafetyInfoPage from '$lib/components/SafetyInfoPage.svelte';
	import { currentLocale } from '$lib/i18n';

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

<SafetyInfoPage title={content.title} tag={content.tag} sections={content.sections} showContact />
