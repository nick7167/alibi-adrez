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

/* Every number below is taken from the code, not from memory — a rulebook that
   contradicts the engine is worse than no rulebook at all:

     MIN_PLAYERS 3 / MAX_PLAYERS 16 / MAX_ENTRY_LENGTH 140  packages/shared/src/protocol.ts
     DEFAULT_SETTINGS rounds 4, writeSec 60, guessSec 25     packages/shared/src/protocol.ts
     bounds 1–10 / 20–120 / 10–60                            packages/shared/src/state.ts (nextSettings)
     INTRO 3s, REVEAL 7s, ROUND_END 8s, MAX_STAGED 4         packages/shared/src/round.ts
     +2 correct guess, +1 per fooled guesser                 packages/shared/src/round.ts
     packs, spicy opt-in                                     packages/shared/content/prompts.ts

   If any of those change, this file changes in the same commit. */

const en: RuleSection[] = [
	{
		id: 'concept',
		heading: 'The concept',
		blocks: [
			{
				type: 'paragraph',
				text: "Everyone in the room answers the same question at the same time, anonymously, in one line. The app then puts a few of the answers up one at a time, and everyone else guesses who wrote it. Then the name lands — and the noise the room makes at that moment is what the game is named after. Everyone plays on their own phone, whether you're crammed onto one sofa or spread across a call."
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
					'One person creates a room and reads out the 4-letter code.',
					'Everyone else joins with a nickname and an avatar.',
					'The host sets the length and the question packs, then starts.'
				]
			},
			{
				type: 'paragraph',
				text: 'A 3-second splash opens the game, and then the first question is on everyone at once.'
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
						title: 'Write',
						meta: '60 sec default · 20–120 host-set',
						body: 'Everyone gets the same question and writes one answer, up to 140 characters. Nobody sees anyone else’s. You can keep changing yours until the clock runs out, and the round moves on the moment everyone has handed something in.'
					},
					{
						title: 'Guess',
						meta: '25 sec default · 10–60 host-set',
						body: 'One answer goes up on its own, with the question still above it. Everyone except the author taps the player they think wrote it — one tap, no takebacks. The author gets no buttons at all; they just sit there being hunted.'
					},
					{
						title: 'Reveal',
						meta: '7 sec',
						body: 'The author’s name lands, along with who guessed whom and what everyone earned. Then the next answer goes up. Up to 4 answers are put to the room per round.'
					},
					{
						title: 'Round over',
						meta: '8 sec',
						body: 'Every answer of the round appears with its author — including the ones that were never put to the room — plus the scoreboard so far. Then the next question, or the finale.'
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
				headers: ['What happened', 'Points'],
				rows: [
					['You named the author correctly', '+2'],
					['Someone named the wrong player on your answer', '+1 to you, per wrong guess'],
					['You ran out of time and never guessed', '0 — and the author gets nothing either']
				]
			},
			{
				type: 'stamp',
				label: 'Note',
				text: 'Points land at every reveal, so the scoreboard moves all game rather than all at once at the end.'
			}
		]
	},
	{
		id: 'packs',
		heading: 'The question packs',
		blocks: [
			{
				type: 'list',
				items: [
					'Everyday — small true things from your day.',
					'Opinions — hot takes you’d actually defend.',
					'Absurd — made-up nonsense with no right answer.',
					'Confessions — personal admissions: white lies, cringe, petty revenge.'
				]
			},
			{
				type: 'stamp',
				label: 'Confessions',
				text: 'The first three are on by default. Confessions is off until the host switches it on, and every player can see in the lobby whether it is on before the game starts.'
			}
		]
	},
	{
		id: 'settings',
		heading: 'What the host can set',
		blocks: [
			{
				type: 'table',
				headers: ['Setting', 'Default', 'Range'],
				rows: [
					['Rounds', '4', '1–10'],
					['Writing time', '60 sec', '20–120 sec'],
					['Guessing time', '25 sec', '10–60 sec'],
					['Question packs', 'Everyday, Opinions, Absurd', 'At least one has to stay on']
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
					'Each player reads the game in their own language — English or Danish — questions included.',
					'No question comes up twice in the same game.',
					'Only 4 answers per round go to the room, so in a big group not everyone is put up every round. The app spreads it out: whoever has been put up least goes next.',
					'Anyone can be guessed, including players who wrote nothing that round. Who you can pick never narrows the field.',
					'Two people writing exactly the same thing is not a bug and is never merged. It is usually the best moment of the round.',
					'If someone leaves, their answer leaves with them. Below 3 players the game ends and the scores stand as they are.'
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
				text: 'Alle i rummet svarer på det samme spørgsmål på samme tid, anonymt og på én linje. Appen tager derefter et par af svarene frem ét ad gangen, og alle andre gætter, hvem der har skrevet det. Så falder navnet — og lyden, rummet laver i det sekund, er den, spillet er opkaldt efter. Alle spiller på deres egen telefon, uanset om I sidder proppet sammen i én sofa eller er spredt ud over et opkald.'
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
					'Én opretter et rum og læser den 4-bogstavers kode højt.',
					'Alle andre går ind med et kaldenavn og en avatar.',
					'Værten sætter længden og spørgsmålspakkerne og starter så spillet.'
				]
			},
			{
				type: 'paragraph',
				text: 'Spillet åbner med 3 sekunders optakt, og så rammer det første spørgsmål alle på én gang.'
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
						title: 'Skriv',
						meta: '60 sek. som standard · 20–120 sat af værten',
						body: 'Alle får det samme spørgsmål og skriver ét svar på højst 140 tegn. Ingen kan se de andres. Du må rette i dit, indtil tiden løber ud, og runden går videre i samme øjeblik alle har afleveret.'
					},
					{
						title: 'Gæt',
						meta: '25 sek. som standard · 10–60 sat af værten',
						body: 'Ét svar kommer op alene med spørgsmålet stadig over sig. Alle andre end den, der skrev det, trykker på den spiller, de tror står bag — ét tryk, ingen fortrydelse. Den, der skrev svaret, får slet ingen knapper og må bare sidde og se på.'
					},
					{
						title: 'Afsløring',
						meta: '7 sek.',
						body: 'Navnet på den, der skrev svaret, falder sammen med hvem der gættede på hvem, og hvad alle fik ud af det. Så kommer det næste svar op. Der bliver højst taget 4 svar frem pr. runde.'
					},
					{
						title: 'Runden er slut',
						meta: '8 sek.',
						body: 'Alle rundens svar vises med deres afsender — også dem, der aldrig kom frem — plus stillingen indtil nu. Derefter kommer næste spørgsmål, eller finalen.'
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
				headers: ['Hvad skete der', 'Point'],
				rows: [
					['Du gættede den rigtige afsender', '+2'],
					['En anden gættede forkert på dit svar', '+1 til dig, pr. forkert gæt'],
					['Du nåede ikke at gætte', 'Ingen — og afsenderen får heller ikke noget']
				]
			},
			{
				type: 'stamp',
				label: 'Bemærk',
				text: 'Pointene lægges til ved hver afsløring, så stillingen rykker sig hele vejen igennem i stedet for at komme samlet til sidst.'
			}
		]
	},
	{
		id: 'packs',
		heading: 'Spørgsmålspakkerne',
		blocks: [
			{
				type: 'list',
				items: [
					'Hverdag — små sande ting fra din dag.',
					'Holdninger — skarpe meninger, du gerne forsvarer.',
					'Absurd — opdigtet vrøvl uden rigtige svar.',
					'Tilståelser — personlige tilståelser: hvide løgne, pinlige minder og smålig hævn.'
				]
			},
			{
				type: 'stamp',
				label: 'Tilståelser',
				text: 'De tre første er slået til fra start. Tilståelser er slået fra, indtil værten tænder for den, og alle i rummet kan se i lobbyen, om den er tændt, inden spillet går i gang.'
			}
		]
	},
	{
		id: 'settings',
		heading: 'Det værten kan skrue på',
		blocks: [
			{
				type: 'table',
				headers: ['Indstilling', 'Standard', 'Interval'],
				rows: [
					['Runder', '4', '1–10'],
					['Skrivetid', '60 sek.', '20–120 sek.'],
					['Gættetid', '25 sek.', '10–60 sek.'],
					['Spørgsmålspakker', 'Hverdag, Holdninger, Absurd', 'Mindst én skal være tændt']
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
					'Hver spiller læser spillet på sit eget sprog — dansk eller engelsk — spørgsmålene med.',
					'Det samme spørgsmål kommer ikke to gange i samme spil.',
					'Der kommer højst 4 svar frem pr. runde, så i et stort selskab bliver alle ikke taget frem hver gang. Appen fordeler det: den, der har været fremme færrest gange, er den næste.',
					'Alle kan gættes på — også dem, der ikke fik skrevet noget i runden. Feltet af mulige afsendere bliver aldrig smallere.',
					'To ens svar er ikke en fejl og bliver aldrig slået sammen. Det er som regel rundens bedste øjeblik.',
					'Forlader nogen spillet, ryger deres svar med. Bliver I færre end 3, slutter spillet, og pointene står ved magt.'
				]
			}
		]
	}
];

const content: Record<Locale, RuleSection[]> = { en, da };

export function rulesContent(locale: Locale): RuleSection[] {
	return content[locale];
}
