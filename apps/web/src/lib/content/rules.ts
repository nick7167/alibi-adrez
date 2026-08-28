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
     DEFAULT_SETTINGS questions 5, rounds 10, answerSec 180,
       guessSec 25, revealSec 7, standingsEvery 3            packages/shared/src/protocol.ts
     SETTINGS_BOUNDS 1–20 / 1–40 / 30–600 / 10–60 / 3–15 / 0–10
                                                             packages/shared/src/protocol.ts
     INTRO 3s, STANDINGS 6s                                  packages/shared/src/round.ts
     +2 correct guess, +1 per fooled guesser                 packages/shared/src/round.ts
     pack sizes 25 / 20 / 20 / 15, spicy opt-in              packages/shared/content/prompts.ts

   If any of those change, this file changes in the same commit. */

const en: RuleSection[] = [
	{
		id: 'concept',
		heading: 'The concept',
		blocks: [
			{
				type: 'paragraph',
				text: "Everyone in the room answers the same set of questions, anonymously, one line each. Then the app puts one answer up at a time — a random question, a random answer to it — and everyone else guesses who wrote it. Then the name lands, and the noise the room makes at that moment is what the game is named after. Everyone plays on their own phone, whether you're crammed onto one sofa or spread across a call."
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
					'The host picks how many questions, how many guessing rounds, and how long each part lasts.'
				]
			},
			{
				type: 'paragraph',
				text: 'A 3-second splash opens the game, and then everyone gets the whole set of questions at once.'
			}
		]
	},
	{
		id: 'round',
		heading: 'How a game runs',
		blocks: [
			{
				type: 'steps',
				items: [
					{
						title: 'Answering',
						meta: '3 minutes by default, one clock for all of it',
						body: 'You get every question in the game at once and work through them at your own pace — flick back and forth, skip a hard one and come back to it. Each answer is one line, up to 140 characters. Nothing you write is signed. Press "I\'m done" when you\'ve had enough; you can leave questions blank, and you can still change your answers afterwards. The moment everyone has pressed it the game moves on, so nobody waits out a clock for the sake of it.'
					},
					{
						title: 'Guessing',
						meta: '25 seconds by default',
						body: 'One question comes up with one anonymous answer to it, and everyone except whoever wrote it picks a name. One tap, and it is final. The same question never comes up twice in a row, and you can be asked about anyone — including people who skipped that question, because the list of names never gets shorter.'
					},
					{
						title: 'Reveal',
						meta: '7 seconds by default',
						body: 'The author is named, everyone sees who guessed what, and the points land straight away.'
					},
					{
						title: 'Standings',
						meta: '6 seconds, every 3 rounds by default',
						body: 'Every so often the game stops to show where everyone stands — and, more to the point, who has moved. The arrows are places gained or lost since the last time you saw it.'
					}
				]
			},
			{
				type: 'paragraph',
				text: 'Guessing, reveal and the occasional standings beat repeat until the rounds run out. Not every answer gets used — with five players and five questions there are twenty-five answers and only ten rounds by default, so some of what you write is never put to the room. That is the game working as intended, not a bug.'
			},
			{
				type: 'paragraph',
				text: 'The app spreads the spotlight rather than picking purely at random: whoever has been put to the room fewest times is the next one drawn. Nobody gets picked three rounds running while somebody else never appears.'
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
					['You name the person who actually wrote it', '+2'],
					['Somebody guesses wrong on your answer', '+1 to you, for each of them'],
					['You guess wrong', '0'],
					['You never guess', '0 — and the author gets nothing from you']
				]
			},
			{
				type: 'paragraph',
				text: 'Points land at every reveal, not at the end, so the standings move all game. Writing something nobody can pin on you is worth as much as guessing well.'
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
					'Everyday — small true things from your day. 25 questions.',
					'Opinions — hot takes you would actually defend. 20 questions.',
					'Absurd — made-up nonsense with no right answer. 20 questions.',
					'Confessions — personal admissions: white lies, cringe, petty revenge. Not for every group. 15 questions, and it is off unless the host turns it on.'
				]
			},
			{
				type: 'paragraph',
				text: 'At least one pack has to stay on. Every question in a game is different, so the packs you pick also cap how many questions you can have — on one small pack that ceiling is 15. Everyone can see which packs are on before the game starts, host or not.'
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
					['Questions', '5', '1–20'],
					['Guessing rounds', '10', '1–40'],
					['Answer time', '180s', '30–600s'],
					['Guess time', '25s', '10–60s'],
					['Reveal time', '7s', '3–15s'],
					['Standings every', '3 rounds', 'off, or 1–10']
				]
			},
			{
				type: 'paragraph',
				text: 'The lobby shows roughly how long the game will run as you change them. The defaults come out at about nine minutes.'
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
					'Nobody ever sees who wrote what before the reveal — not even a hint of it. The app only ever tells the room how many people have finished, never which ones.',
					'Two identical answers are not a bug and are never merged. It is usually the best moment of the game.',
					'A locked phone is not the same as leaving: you still get put to the room, you still score, and you can still be guessed. The room just stops waiting for you.',
					'If someone leaves, their answers go with them and the round count drops to match. Below 3 players the game ends and the scores stand.',
					'You can change any of your answers right up until the answering time runs out — even after you have pressed "I\'m done".',
					'When the game ends, "Back to lobby" puts the whole room back where it started — same players, same code, same settings — so you can go again without anyone re-joining. Anyone can press it.'
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
				text: 'Alle i rummet svarer på de samme spørgsmål, anonymt, én linje til hvert. Derefter viser appen ét svar ad gangen — et tilfældigt spørgsmål og et tilfældigt svar på det — og alle andre gætter, hvem der har skrevet det. Så falder navnet, og lyden rummet laver i det øjeblik er den, spillet er opkaldt efter. Alle spiller på hver sin telefon, uanset om I sidder i samme sofa eller sidder spredt på et opkald.'
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
					'Én opretter et rum og læser den 4-bogstavs kode højt.',
					'Alle andre går ind med et kaldenavn og en avatar.',
					'Værten vælger antal spørgsmål, antal gætterunder, og hvor lang tid hver del tager.'
				]
			},
			{
				type: 'paragraph',
				text: 'Et 3-sekunders opstartsbillede åbner spillet, og så får alle hele spørgsmålssættet på én gang.'
			}
		]
	},
	{
		id: 'round',
		heading: 'Sådan forløber et spil',
		blocks: [
			{
				type: 'steps',
				items: [
					{
						title: 'Svarrunden',
						meta: '3 minutter som standard, én samlet tid',
						body: 'Du får alle spillets spørgsmål på én gang og arbejder dig igennem dem i dit eget tempo — bladr frem og tilbage, spring et svært over og kom tilbage til det. Hvert svar er én linje på op til 140 tegn. Intet af det, du skriver, står dit navn på. Tryk "Jeg er færdig", når du har fået nok; du må godt lade spørgsmål stå tomme, og du kan stadig rette bagefter. I samme øjeblik alle har trykket, går spillet videre, så ingen sidder og venter tiden ud uden grund.'
					},
					{
						title: 'Gætterunden',
						meta: '25 sekunder som standard',
						body: 'Ét spørgsmål kommer frem med ét anonymt svar, og alle undtagen den, der skrev det, vælger et navn. Ét tryk, og så er det bindende. Det samme spørgsmål kommer aldrig to gange i træk, og alle kan blive gættet på — også dem, der sprang spørgsmålet over, for listen af navne bliver aldrig kortere.'
					},
					{
						title: 'Afsløringen',
						meta: '7 sekunder som standard',
						body: 'Afsenderen bliver nævnt, alle ser hvem der gættede hvad, og pointene falder med det samme.'
					},
					{
						title: 'Stillingen',
						meta: '6 sekunder, hver 3. runde som standard',
						body: 'Med jævne mellemrum stopper spillet op og viser, hvordan I står — og især hvem der har rykket sig. Pilene er pladser vundet eller tabt, siden du så det sidst.'
					}
				]
			},
			{
				type: 'paragraph',
				text: 'Gæt, afsløring og en stilling ind imellem gentager sig, indtil runderne er brugt. Ikke alle svar bliver brugt — med fem spillere og fem spørgsmål er der femogtyve svar og som standard kun ti runder, så noget af det, du skriver, kommer aldrig frem. Sådan er spillet tænkt; det er ikke en fejl.'
			},
			{
				type: 'paragraph',
				text: 'Appen fordeler rampelyset i stedet for at trække helt tilfældigt: den, der har været fremme færrest gange, er den næste, der bliver trukket. Ingen bliver taget tre runder i træk, mens en anden aldrig kommer frem.'
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
					['Du peger på den, der rent faktisk skrev det', '+2'],
					['En anden gætter forkert på dit svar', '+1 til dig, for hver af dem'],
					['Du gætter forkert', '0'],
					['Du gætter slet ikke', '0 — og afsenderen får heller ingenting af dig']
				]
			},
			{
				type: 'paragraph',
				text: 'Pointene falder ved hver afsløring, ikke til sidst, så stillingen rykker sig hele spillet. At skrive noget, ingen kan hænge dig op på, er lige så meget værd som at gætte godt.'
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
					'Hverdag — små sande ting fra din dag. 25 spørgsmål.',
					'Holdninger — skarpe meninger, du faktisk vil forsvare. 20 spørgsmål.',
					'Absurd — opdigtet vrøvl uden et rigtigt svar. 20 spørgsmål.',
					'Tilståelser — personlige indrømmelser: hvide løgne, pinligheder, små hævnaktioner. Ikke for ethvert selskab. 15 spørgsmål, og den er slået fra, medmindre værten tænder for den.'
				]
			},
			{
				type: 'paragraph',
				text: 'Mindst én pakke skal være tændt. Alle spørgsmål i et spil er forskellige, så de pakker I vælger sætter også loftet for, hvor mange spørgsmål I kan have — med én lille pakke er loftet 15. Alle kan se, hvilke pakker der er tændt, før spillet går i gang — også dem der ikke er vært.'
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
					['Spørgsmål', '5', '1–20'],
					['Gætterunder', '10', '1–40'],
					['Svartid', '180s', '30–600s'],
					['Gættetid', '25s', '10–60s'],
					['Afsløringstid', '7s', '3–15s'],
					['Stilling hver', '3. runde', 'fra, eller 1–10']
				]
			},
			{
				type: 'paragraph',
				text: 'Lobbyen viser cirka hvor længe spillet kommer til at vare, mens I skruer på det. Standardindstillingerne lander på omkring ni minutter.'
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
					'Ingen ser nogensinde, hvem der har skrevet hvad, før afsløringen — ikke så meget som et vink om det. Appen fortæller kun rummet, hvor mange der er færdige, aldrig hvem.',
					'To ens svar er ikke en fejl og bliver aldrig slået sammen. Det er som regel spillets bedste øjeblik.',
					'En låst telefon er ikke det samme som at forlade spillet: du bliver stadig taget frem, du får stadig point, og der bliver stadig gættet på dig. Rummet holder bare op med at vente på dig.',
					'Forlader nogen spillet, ryger deres svar med, og antallet af runder falder tilsvarende. Bliver I færre end 3, slutter spillet, og pointene står ved magt.',
					'Du kan rette dine svar helt indtil svartiden løber ud — også efter du har trykket "Jeg er færdig".',
					'Når spillet slutter, sender "Tilbage til lobbyen" hele rummet tilbage til start — samme spillere, samme kode, samme indstillinger — så I kan tage en omgang mere uden at nogen skal ind igen. Alle kan trykke på den.'
				]
			}
		]
	}
];

const content: Record<Locale, RuleSection[]> = { en, da };

export function rulesContent(locale: Locale): RuleSection[] {
	return content[locale];
}
