/**
 * Languages the app is authored in. Lived in `content/scenarios.ts`
 * until T2 deleted that file with the rest of the Alibi content; it sits
 * next to `PackId` now because both describe what a prompt is written in.
 */
export type Lang = "en" | "da";

/** Prompt packs a host can switch on. `spicy` is opt-in and off by default. */
export type PackId = "everyday" | "opinions" | "absurd" | "spicy";

/** Every known pack id, so settings can filter a client patch to ids that
    actually have prompts behind them. */
export const PACK_IDS: readonly PackId[] = ["everyday", "opinions", "absurd", "spicy"];

export interface Prompt {
  id: string;
  pack: PackId;
  en: string;
  da: string;
}

/**
 * Prompts everyone in the room answers at once, anonymously, in one line.
 * The room then guesses who wrote what, so a prompt earns its place only if
 * the answers differ in *voice* — a habit, an opinion, a way of phrasing
 * things. Anyone must be able to answer in seconds with no research.
 *
 * Both languages are authored natively rather than translated: where the
 * English leans on something that doesn't land in Danish, the Danish says
 * something else that does.
 *
 * **Danish convention, and it is not optional for new prompts:**
 *
 *  - **Grammatisk komma (startkomma), consistently** — a comma before every
 *    subordinate clause: "Det sidste, du søgte efter", "En regel, der burde
 *    afskaffes". This file was inconsistent about it, which is the single
 *    clearest tell that a Danish text was not written by a Dane; all 80 were
 *    normalised in one pass and a new prompt must match.
 *  - **Compounds are one word** — "realityprogram", never "reality-program".
 *  - **Say it the way a Dane says it**, not the way the English is built:
 *    "lader som om de kan lide", not "foregiver at nyde"; "krumme tæer", not
 *    a literal rendering of "cringe". A calque that parses is still wrong —
 *    "skurkeoprindelse" was one, and it read as machine output.
 *  - Where an English idiom has no Danish pendant, write Danish that lands
 *    the same joke rather than a faithful translation that dies.
 */
export const PROMPTS: readonly Prompt[] = [
  // ---------------------------------------------------------------- everyday
  {
    id: "last-search",
    pack: "everyday",
    en: "The last thing you searched for online.",
    da: "Det sidste, du søgte efter på Google.",
  },
  {
    id: "pocket-contents",
    pack: "everyday",
    en: "One thing in your pocket or bag right now.",
    da: "En ting, du har i lommen eller tasken lige nu.",
  },
  {
    id: "last-photo",
    pack: "everyday",
    en: "What's in the most recent photo on your phone?",
    da: "Hvad er der på det seneste billede i din kamerarulle?",
  },
  {
    id: "breakfast-today",
    pack: "everyday",
    en: "What you actually had for breakfast today.",
    da: "Hvad du fik til morgenmad i dag – helt ærligt.",
  },
  {
    id: "oldest-open-tab",
    pack: "everyday",
    en: "The oldest tab still open on your phone.",
    da: "Den ældste fane, du stadig har åben på telefonen.",
  },
  {
    id: "notes-app-last-line",
    pack: "everyday",
    en: "The last thing you typed into your notes app.",
    da: "Det sidste, du skrev i din noteapp.",
  },
  {
    id: "phone-greeting",
    pack: "everyday",
    en: "Exactly what you say when you answer the phone.",
    da: "Præcis hvad du siger, når du tager telefonen.",
  },
  {
    id: "last-message-sent",
    pack: "everyday",
    en: "The last message you sent, word for word.",
    da: "Den sidste besked, du sendte, ord for ord.",
  },
  {
    id: "saddest-thing-in-fridge",
    pack: "everyday",
    en: "The saddest thing in your fridge right now.",
    da: "Det tristeste, der står i dit køleskab lige nu.",
  },
  {
    id: "chore-put-off",
    pack: "everyday",
    en: "The chore you've put off the longest.",
    da: "Det husarbejde, du har udskudt allerlængst.",
  },
  {
    id: "lazy-dinner",
    pack: "everyday",
    en: "What you make for dinner when you can't be bothered.",
    da: "Hvad du laver til aftensmad, når du ikke gider.",
  },
  {
    id: "song-on-repeat",
    pack: "everyday",
    en: "A song you've played far too much lately.",
    da: "En sang, du har hørt alt for meget på det seneste.",
  },
  {
    id: "phone-wallpaper",
    pack: "everyday",
    en: "What's your phone wallpaper?",
    da: "Hvad har du som baggrund på telefonen?",
  },
  {
    id: "last-purchase",
    pack: "everyday",
    en: "The last thing you spent money on.",
    da: "Det sidste, du brugte penge på.",
  },
  {
    id: "useless-skill",
    pack: "everyday",
    en: "A completely useless thing you're good at.",
    da: "En fuldstændig ubrugelig ting, du er god til.",
  },
  {
    id: "daily-ritual",
    pack: "everyday",
    en: "A small thing you do every single day.",
    da: "En lille ting, du gør hver eneste dag.",
  },
  {
    id: "not-your-name",
    pack: "everyday",
    en: "Something you get called that isn't your name.",
    da: "Noget, du bliver kaldt, som ikke er dit navn.",
  },
  {
    id: "last-thing-watched",
    pack: "everyday",
    en: "The last thing you watched on a screen.",
    da: "Det sidste, du så på en skærm.",
  },
  {
    id: "usual-cafe-order",
    pack: "everyday",
    en: "Your usual order at a café.",
    da: "Din faste bestilling på café.",
  },
  {
    id: "bedside-table",
    pack: "everyday",
    en: "What's on your bedside table right now?",
    da: "Hvad ligger der på dit natbord lige nu?",
  },
  {
    id: "highest-screen-time",
    pack: "everyday",
    en: "The app with your highest screen time.",
    da: "Den app, du har mest skærmtid på.",
  },
  {
    id: "home-alone-mutter",
    pack: "everyday",
    en: "Something you say out loud when nobody is home.",
    da: "Noget, du siger højt, når der ikke er nogen hjemme.",
  },
  {
    id: "word-you-overuse",
    pack: "everyday",
    en: "A word you say far too often.",
    da: "Et ord, du siger alt for tit.",
  },
  {
    id: "broken-at-home",
    pack: "everyday",
    en: "Something at home that's been broken for far too long.",
    da: "Noget derhjemme, der har været i stykker alt for længe.",
  },
  {
    id: "most-worn-clothing",
    pack: "everyday",
    en: "The item of clothing you wear far too often.",
    da: "Det stykke tøj, du har på alt for tit.",
  },

  // ---------------------------------------------------------------- opinions
  {
    id: "overrated-food",
    pack: "opinions",
    en: "The most overrated food.",
    da: "Den mest overvurderede mad.",
  },
  {
    id: "film-everyone-loves",
    pack: "opinions",
    en: "A film everyone loves that you think is bad.",
    da: "En film, alle elsker, men som du synes er dårlig.",
  },
  {
    id: "worst-common-advice",
    pack: "opinions",
    en: "The worst advice people hand out as if it were wisdom.",
    da: "Det værste råd, folk deler ud, som om det var ren visdom.",
  },
  {
    id: "pointless-invention",
    pack: "opinions",
    en: "The most pointless invention of recent years.",
    da: "Den mest overflødige opfindelse i nyere tid.",
  },
  {
    id: "overrated-destination",
    pack: "opinions",
    en: "A travel destination that isn't worth the trip.",
    da: "Et rejsemål, der ikke er turen værd.",
  },
  {
    id: "only-right-crisps",
    pack: "opinions",
    en: "The only correct crisp flavour. Everything else is wrong.",
    da: "Den eneste rigtige chipssmag – resten er forkert.",
  },
  {
    id: "genre-should-stop",
    pack: "opinions",
    en: "A genre of music that could stop now.",
    da: "En musikgenre, der godt måtte stoppe nu.",
  },
  {
    id: "christmas-tradition-to-abolish",
    pack: "opinions",
    en: "The Christmas tradition that should be abolished.",
    da: "Den juletradition, der burde afskaffes.",
  },
  {
    id: "adults-pretend-to-enjoy",
    pack: "opinions",
    en: "Something adults pretend to enjoy.",
    da: "Noget, voksne bare lader som om de kan lide.",
  },
  {
    id: "worst-weekday",
    pack: "opinions",
    en: "The worst day of the week, and it isn't Monday.",
    da: "Den værste ugedag – og det er ikke mandag.",
  },
  {
    id: "menu-red-flag",
    pack: "opinions",
    en: "The clearest red flag on a restaurant menu.",
    da: "Det tydeligste faresignal på et spisekort.",
  },
  {
    id: "tiny-thing-ruins-day",
    pack: "opinions",
    en: "A tiny thing that can ruin your whole day.",
    da: "En lillebitte ting, der kan ødelægge hele din dag.",
  },
  {
    id: "hill-to-die-on",
    pack: "opinions",
    en: "An opinion you will never back down from.",
    da: "En holdning, du aldrig giver dig på.",
  },
  {
    id: "worst-part-of-flying",
    pack: "opinions",
    en: "The worst part of flying.",
    da: "Det værste ved at flyve.",
  },
  {
    id: "one-new-law",
    pack: "opinions",
    en: "One rule you'd make law tomorrow.",
    da: "Én regel, du ville gøre til lov i morgen.",
  },
  {
    id: "never-worth-the-money",
    pack: "opinions",
    en: "Something that is never worth the money.",
    da: "Noget, der aldrig er pengene værd.",
  },
  {
    id: "right-thing-with-fries",
    pack: "opinions",
    en: "The only acceptable thing to dip chips in.",
    da: "Det eneste rigtige at dyppe pommes frites i.",
  },
  {
    id: "phrase-banned-from-email",
    pack: "opinions",
    en: "A phrase that should be banned from emails.",
    da: "En vending, der burde forbydes i mails.",
  },
  {
    id: "worst-kind-of-gift",
    pack: "opinions",
    en: "The worst kind of gift to receive.",
    da: "Den værste slags gave at få.",
  },
  {
    id: "trend-you-hope-dies",
    pack: "opinions",
    en: "A trend you hope dies this year.",
    da: "En trend, du håber dør ud i år.",
  },

  // ------------------------------------------------------------------ absurd
  {
    id: "terrible-ride",
    pack: "absurd",
    en: "Name a theme park ride nobody would dare try.",
    da: "Find på en forlystelse, ingen tør prøve.",
  },
  {
    id: "villain-origin",
    pack: "absurd",
    en: "Your villain origin story in five words.",
    da: "Historien om, hvordan du blev skurken – på fem ord.",
  },
  {
    id: "worst-superpower",
    pack: "absurd",
    en: "A superpower that would ruin your life.",
    da: "En superkraft, der ville ødelægge dit liv.",
  },
  {
    id: "invent-a-holiday",
    pack: "absurd",
    en: "Invent a public holiday. What are we celebrating?",
    da: "Opfind en helligdag. Hvad fejrer vi?",
  },
  {
    id: "bank-slogan",
    pack: "absurd",
    en: "Write a terrible slogan for a bank.",
    da: "Skriv et elendigt slogan for en bank.",
  },
  {
    id: "boat-name",
    pack: "absurd",
    en: "A terrible name for a boat.",
    da: "Et forfærdeligt navn til en båd.",
  },
  {
    id: "reality-show-you-would-win",
    pack: "absurd",
    en: "A reality show you would actually win.",
    da: "Et realityprogram, du rent faktisk ville vinde.",
  },
  {
    id: "unwanted-ice-cream-flavour",
    pack: "absurd",
    en: "Invent an ice cream flavour nobody asked for.",
    da: "Opfind en issmag, ingen har bedt om.",
  },
  {
    id: "worst-cockpit-announcement",
    pack: "absurd",
    en: "The worst thing to hear from the cockpit mid-flight.",
    da: "Det værste at høre fra cockpittet midt i flyveturen.",
  },
  {
    id: "autobiography-title",
    pack: "absurd",
    en: "The title of your autobiography.",
    da: "Titlen på din selvbiografi.",
  },
  {
    id: "gravestone-text",
    pack: "absurd",
    en: "What ends up written on your gravestone.",
    da: "Hvad der ender med at stå på din gravsten.",
  },
  {
    id: "new-olympic-event",
    pack: "absurd",
    en: "A new Olympic event that should not exist.",
    da: "En ny olympisk disciplin, der ikke burde findes.",
  },
  {
    id: "terrible-advice-for-a-child",
    pack: "absurd",
    en: "Terrible advice to give a child.",
    da: "Et elendigt råd at give et barn.",
  },
  {
    id: "band-name",
    pack: "absurd",
    en: "The name of your band.",
    da: "Navnet på dit band.",
  },
  {
    id: "wifi-name",
    pack: "absurd",
    en: "What you'd name your wifi network.",
    da: "Hvad du ville kalde dit wifi.",
  },
  {
    id: "museum-nobody-visits",
    pack: "absurd",
    en: "A museum nobody would ever visit.",
    da: "Et museum, ingen nogensinde ville besøge.",
  },
  {
    id: "worst-raffle-prize",
    pack: "absurd",
    en: "The worst possible prize in a raffle.",
    da: "Den værste præmie i et amerikansk lotteri.",
  },
  {
    id: "invent-a-swear-word",
    pack: "absurd",
    en: "Invent a new swear word.",
    da: "Opfind et nyt bandeord.",
  },
  {
    id: "illegal-sandwich",
    pack: "absurd",
    en: "A sandwich that should be illegal.",
    da: "En sandwich, der burde være forbudt.",
  },
  {
    id: "your-bar-name",
    pack: "absurd",
    en: "The name of the bar you'd open.",
    da: "Navnet på den bar, du ville åbne.",
  },

  // ------------------------------------------------------------------- spicy
  {
    id: "pettiest-grudge",
    pack: "spicy",
    en: "The pettiest reason you've stopped talking to someone.",
    da: "Den mest smålige grund til, at du droppede en ven.",
  },
  {
    id: "last-white-lie",
    pack: "spicy",
    en: "The last white lie you told.",
    da: "Den seneste hvide løgn, du fortalte.",
  },
  {
    id: "secretly-googled",
    pack: "spicy",
    en: "Something you've googled secretly mid-conversation.",
    da: "Noget, du i smug har googlet midt i en samtale.",
  },
  {
    id: "gift-you-pretended-to-like",
    pack: "spicy",
    en: "A gift you pretended to love.",
    da: "En gave, du lod som om du var vild med.",
  },
  {
    id: "cringe-memory",
    pack: "spicy",
    en: "A memory that still makes you cringe.",
    da: "Et minde, der stadig får dig til at krumme tæer.",
  },
  {
    id: "cancelling-excuse",
    pack: "spicy",
    en: "Your go-to excuse for cancelling plans.",
    da: "Din standardundskyldning, når du vil aflyse.",
  },
  {
    id: "secret-favourite-song",
    pack: "spicy",
    en: "A song you love but would never admit to.",
    da: "En sang, du elsker, men aldrig ville indrømme.",
  },
  {
    id: "worst-first-impression",
    pack: "spicy",
    en: "The worst first impression you've ever made.",
    da: "Det værste førstehåndsindtryk, du har givet.",
  },
  {
    id: "deep-scroll",
    pack: "spicy",
    en: "How far back you've scrolled on someone's profile.",
    da: "Hvor langt tilbage du har scrollet på en andens profil.",
  },
  {
    id: "work-confession",
    pack: "spicy",
    en: "Something from work you'd never tell your boss.",
    da: "Noget fra arbejdet, du aldrig ville fortælle din chef.",
  },
  {
    id: "pettiest-revenge",
    pack: "spicy",
    en: "The pettiest revenge you've ever taken.",
    da: "Den mest smålige hævn, du har taget.",
  },
  {
    id: "took-home-not-yours",
    pack: "spicy",
    en: "The last thing you took home that wasn't yours.",
    da: "Det sidste, du tog med hjem, som ikke var dit.",
  },
  {
    id: "told-a-stranger",
    pack: "spicy",
    en: "Something you've told a stranger that you shouldn't have.",
    da: "Noget, du har fortalt en fremmed, som du ikke burde.",
  },
  {
    id: "rule-you-break",
    pack: "spicy",
    en: "A rule you break constantly with a clear conscience.",
    da: "En regel, du bryder hele tiden med god samvittighed.",
  },
  {
    id: "quietly-jealous",
    pack: "spicy",
    en: "Something you're quietly jealous of.",
    da: "Noget, du i det stille er misundelig på.",
  },
] as const;

export function promptById(id: string): Prompt | undefined {
  return PROMPTS.find((prompt) => prompt.id === id);
}

export function resolvePrompt(id: string, lang: Lang): string | undefined {
  const prompt = promptById(id);
  return prompt ? prompt[lang] : undefined;
}

export function promptsForPacks(packs: readonly PackId[]): readonly Prompt[] {
  const enabled = new Set(packs);
  return PROMPTS.filter((prompt) => enabled.has(prompt.pack));
}
