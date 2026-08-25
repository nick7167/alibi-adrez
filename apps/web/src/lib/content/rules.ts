import type { Locale } from '$lib/i18n';

/** One block of rulebook prose. Kept structured (not flat translation keys)
 *  because this is long-form content — sections, steps, a scoring table —
 *  not short UI strings. */
export type RuleBlock =
	| { type: 'paragraph'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'steps'; items: { title: string; meta?: string; body: string }[] }
	| { type: 'table'; headers: string[]; rows: string[][] }
	| { type: 'stamp'; label: string; text: string };

export interface RuleSection {
	id: string;
	heading: string;
	blocks: RuleBlock[];
}

const en: RuleSection[] = [
	{
		id: 'concept',
		heading: 'The concept',
		blocks: [
			{
				type: 'paragraph',
				text: "Alibi is a party game of tall tales. Each round, two players become the suspects — secretly sharing the exact same made-up alibi. Everyone else plays detective, trying to catch them contradicting each other. The app runs the show: it keeps the secrets, runs the clock, and keeps score. Everyone plays on their own phone, whether you're all crammed onto one couch or scattered across a call."
			}
		]
	},
	{
		id: 'setup',
		heading: 'Setup',
		blocks: [
			{
				type: 'list',
				items: [
					'3 to 16 players.',
					'One person creates a room and shares the 4-letter code.',
					'Everyone else joins with a nickname and an avatar.',
					'The host can change the settings, then starts the game.'
				]
			}
		]
	},
	{
		id: 'round',
		heading: 'A round, phase by phase',
		blocks: [
			{
				type: 'steps',
				items: [
					{
						title: 'Intro',
						meta: '5 sec',
						body: 'The round number goes up, and the two suspects for this round are revealed to everyone.'
					},
					{
						title: 'Planning',
						meta: '45 sec default · 15–120 host-set',
						body: "The two suspects secretly receive the exact same scenario — a short story plus four specific details — and get a private chat, visible only to the two of them, to agree their story. Detectives just see a waiting screen and who the suspects are; they never see the scenario."
					},
					{
						title: 'Interrogation',
						meta: '6 questions default · 3–10 host-set',
						body: "Detectives type questions, up to 5 each per round. If nobody has asked anything when a question is needed, the app asks about one of the scenario's own details. Each question goes to both suspects, one at a time, under a timer (30 sec default, 10–90 host-set). Neither suspect sees the other's answer, and running out of time counts as no answer."
					},
					{
						title: 'Deliberation',
						meta: 'up to 60 sec',
						body: "Both suspects' answers appear side by side for everyone. Detectives vote Consistent or Busted. It ends the moment every detective has voted, or when the clock runs out."
					},
					{
						title: 'Reveal',
						meta: '10 sec',
						body: 'The verdict lands, the scenario is made public, and the points go up on the board.'
					}
				]
			}
		]
	},
	{
		id: 'scoring',
		heading: 'Scoring',
		blocks: [
			{
				type: 'table',
				headers: ['Role', 'Points'],
				rows: [
					['Suspects', '+2 each if the verdict is Consistent'],
					['Suspects, bonus', '+1 each more if the detectives were unanimous'],
					['Detectives', '+2 each for voting with the majority'],
					['Detectives, no vote', "0 — a detective who doesn't vote scores nothing"]
				]
			},
			{
				type: 'stamp',
				label: 'Rule',
				text: 'A tied vote counts as Consistent — the suspects get the benefit of the doubt.'
			}
		]
	},
	{
		id: 'rounds',
		heading: 'Rounds & the finale',
		blocks: [
			{
				type: 'paragraph',
				text: 'Games run 3 rounds by default (the host can set 1–10). Nobody plays suspect twice until everyone at the table has had a turn.'
			},
			{
				type: 'list',
				items: [
					'A podium for the top scores.',
					'Superlative awards: most convincing liar, sharpest detective, and most curious.'
				]
			}
		]
	},
	{
		id: 'goodToKnow',
		heading: 'Good to know',
		blocks: [
			{
				type: 'list',
				items: [
					'Each player reads the game in their own language — English or Danish — including the scenario.',
					'If someone leaves and fewer than 3 players remain, the game ends and the scores stand.',
					'If a suspect leaves mid-round, that round is abandoned with no points.'
				]
			}
		]
	}
];

const da: RuleSection[] = [
	{
		id: 'concept',
		heading: 'Konceptet',
		blocks: [
			{
				type: 'paragraph',
				text: 'Alibi er et festspil med skrøner. I hver runde bliver to spillere til de mistænkte — de deler i hemmelighed nøjagtig det samme opdigtede alibi. Alle de andre er detektiver, der prøver at fange dem i at modsige hinanden. Appen er værten: den holder på hemmelighederne, styrer uret og holder styr på pointene. Alle spiller på deres egen telefon, uanset om I sidder proppet sammen på én sofa eller er spredt ud over et opkald.'
			}
		]
	},
	{
		id: 'setup',
		heading: 'Sådan starter I',
		blocks: [
			{
				type: 'list',
				items: [
					'3 til 16 spillere.',
					'Én person opretter et rum og deler den 4-bogstavers kode.',
					'Alle andre deltager med et kaldenavn og en avatar.',
					'Værten kan ændre indstillingerne og starter derefter spillet.'
				]
			}
		]
	},
	{
		id: 'round',
		heading: 'En runde, trin for trin',
		blocks: [
			{
				type: 'steps',
				items: [
					{
						title: 'Intro',
						meta: '5 sek.',
						body: 'Rundenummeret vises, og de to mistænkte i denne runde bliver afsløret for alle.'
					},
					{
						title: 'Planlægning',
						meta: '45 sek. som standard · 15–120 sat af værten',
						body: 'De to mistænkte modtager i hemmelighed nøjagtig det samme scenarie — en kort historie plus fire konkrete detaljer — og får en privat chat, som kun de to kan se, til at blive enige om historien. Detektiverne ser kun en venteskærm og hvem de mistænkte er — de ser aldrig scenariet.'
					},
					{
						title: 'Afhøring',
						meta: '6 spørgsmål som standard · 3–10 sat af værten',
						body: 'Detektiverne skriver spørgsmål, op til 5 hver pr. runde. Hvis ingen har stillet et spørgsmål, når der skal bruges ét, spørger appen om en af scenariets egne detaljer. Hvert spørgsmål besvares af begge mistænkte, én ad gangen, under et nedtællingsur (30 sek. som standard, 10–90 sat af værten). Ingen af de mistænkte ser den andens svar, og løber tiden ud, tæller det som intet svar.'
					},
					{
						title: 'Rådslagning',
						meta: 'op til 60 sek.',
						body: 'Begge mistænktes svar vises side om side for alle. Detektiverne stemmer Konsistent eller Afsløret. Det slutter, så snart alle detektiver har stemt, eller når tiden løber ud.'
					},
					{
						title: 'Afsløring',
						meta: '10 sek.',
						body: 'Dommen falder, scenariet bliver offentligt, og pointene lægges til på tavlen.'
					}
				]
			}
		]
	},
	{
		id: 'scoring',
		heading: 'Point',
		blocks: [
			{
				type: 'table',
				headers: ['Rolle', 'Point'],
				rows: [
					['Mistænkte', '+2 hver, hvis dommen er Konsistent'],
					['Mistænkte, bonus', '+1 hver mere, hvis detektiverne var enstemmige'],
					['Detektiver', '+2 hver for at stemme med flertallet'],
					['Detektiver, ingen stemme', 'Ingen point — en detektiv, der ikke stemmer, får intet']
				]
			},
			{
				type: 'stamp',
				label: 'Regel',
				text: 'En uafgjort stemme tæller som Konsistent — de mistænkte får tvivlens fordel.'
			}
		]
	},
	{
		id: 'rounds',
		heading: 'Runder & finalen',
		blocks: [
			{
				type: 'paragraph',
				text: 'Som standard spilles der 3 runder (værten kan sætte 1–10). Ingen er mistænkt to gange, før alle ved bordet har haft en tur.'
			},
			{
				type: 'list',
				items: [
					'Et podie for de højeste point.',
					'Særlige priser: mest overbevisende løgner, skarpeste detektiv og mest nysgerrig.'
				]
			}
		]
	},
	{
		id: 'goodToKnow',
		heading: 'Godt at vide',
		blocks: [
			{
				type: 'list',
				items: [
					'Hver spiller læser spillet på sit eget sprog — engelsk eller dansk — inklusive scenariet.',
					'Hvis nogen forlader spillet, og der er færre end 3 spillere tilbage, slutter spillet, og pointene står ved magt.',
					'Hvis en mistænkt forlader midt i en runde, kasseres runden uden point.'
				]
			}
		]
	}
];

const content: Record<Locale, RuleSection[]> = { en, da };

export function rulesContent(locale: Locale): RuleSection[] {
	return content[locale];
}
