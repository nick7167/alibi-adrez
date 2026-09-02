<script lang="ts">
	import SafetyInfoPage from '$lib/components/SafetyInfoPage.svelte';
	import { currentLocale } from '$lib/i18n';

	const content = $derived(currentLocale() === 'da'
		? {
			title: 'Fællesskabsregler',
			tag: 'Spil ordentligt',
			sections: [
				{
					heading: 'Et trygt privat rum',
					body: 'AHA er et selskabsspil for inviterede deltagere. Du er ansvarlig for det navn og de svar, du skriver.'
				},
				{
					heading: 'Det er ikke tilladt',
					bullets: [
						'Chikane, mobning, hadefuldt eller diskriminerende indhold.',
						'Trusler, opfordring til selvskade eller seksualiseret udnyttelse.',
						'Deling af private oplysninger om andre uden deres tilladelse.',
						'Spam, ulovligt indhold eller forsøg på at omgå sikkerhedsfilteret.'
					]
				},
				{
					heading: 'Hvis noget går galt',
					body: 'Skjul svaret eller spilleren på din enhed, og brug Rapportér for at sende sagen til support. Værten kan fjerne en deltager fra det aktuelle rum. Forlad straks rummet ved trusler eller utryghed.'
				}
			]
		}
		: {
			title: 'Community rules',
			tag: 'Play with care',
			sections: [
				{
					heading: 'A safe private room',
					body: 'AHA is a party game for invited participants. You are responsible for the name and answers you enter.'
				},
				{
					heading: 'Not allowed',
					bullets: [
						'Harassment, bullying, hateful, or discriminatory content.',
						'Threats, encouragement of self-harm, or sexual exploitation.',
						'Sharing another person’s private information without permission.',
						'Spam, illegal content, or attempts to evade the safety filter.'
					]
				},
				{
					heading: 'If something goes wrong',
					body: 'Hide the answer or player on your device, then use Report to contact support. The host can remove a participant from the current room. Leave immediately if you feel threatened or unsafe.'
				}
			]
		});
</script>

<SafetyInfoPage title={content.title} tag={content.tag} sections={content.sections} />
