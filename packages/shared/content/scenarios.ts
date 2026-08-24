export type Lang = "en" | "da";

export interface ScenarioText {
  story: string;
  details: readonly [string, string, string, string];
}

export interface Scenario {
  id: string;
  en: ScenarioText;
  da: ScenarioText;
}

/**
 * Curated party-safe alibi scenarios. Each entry is authored natively in
 * English and Danish (not machine-translated) so both read naturally. The
 * `story` sets the shared alibi; `details` are four specific, checkable
 * particulars the two suspects must keep straight under separate
 * questioning.
 */
export const SCENARIOS: readonly Scenario[] = [
  {
    id: "car-wash-mariachi",
    en: {
      story:
        "You two say you were stuck at the 24-hour car wash at 3 a.m. because a mariachi band, on the run from someone else's wedding, had taken shelter inside the wash tunnel.",
      details: [
        "A trumpet player named Gustavo who wouldn't stop practicing scales",
        "Foam that came out neon pink instead of white",
        "The same eurodance song looping on the radio the whole time",
        "A vending machine that only sold pickled quail eggs",
      ],
    },
    da: {
      story:
        "I siger, at I sad fast på den døgnåbne bilvask klokken tre om natten, fordi et mariachiband, der var stukket af fra et fremmed bryllup, havde søgt ly inde i vasketunnelen.",
      details: [
        "En trompetist ved navn Gustavo, der ikke kunne holde op med at øve skalaer",
        "Skum der kom ud neonpink i stedet for hvidt",
        "Den samme eurodance-sang der kørte i loop på radioen hele tiden",
        "En automat der kun solgte syltede vagtelæg",
      ],
    },
  },
  {
    id: "alpaca-farm-wedding",
    en: {
      story:
        "You claim you spent the afternoon herding a runaway alpaca back into its pen at a farm that was supposed to be hosting somebody's wedding photos that day.",
      details: [
        "An alpaca named Brenda who kept spitting at the photographer",
        "A wedding arch made entirely of sunflowers",
        "A farmhand missing one wellington boot",
        "The smell of wet wool and freshly cut grass",
      ],
    },
    da: {
      story:
        "I hævder, at I brugte eftermiddagen på at drive en undsluppet alpaka tilbage i sin fold, på en gård hvor der egentlig skulle tages bryllupsbilleder samme dag.",
      details: [
        "En alpaka ved navn Brenda, der blev ved med at spytte efter fotografen",
        "En bryllupsbue lavet udelukkende af solsikker",
        "En landarbejder der manglede den ene gummistøvle",
        "Lugten af vådt uld og nyslået græs",
      ],
    },
  },
  {
    id: "escape-room-marathon",
    en: {
      story:
        "You say you were locked in the pirate-themed escape room for two extra hours because the actor playing the ghost captain got stuck in a secret passage.",
      details: [
        "A ghost captain named Barry who kept apologizing between groans",
        "A treasure chest that only opened with a hairpin",
        "A parrot puppet with one glass eye",
        "The countdown clock frozen at 13 minutes for the whole ordeal",
      ],
    },
    da: {
      story:
        "I siger, at I sad fastlåst i den piratthemede escape room to timer for længe, fordi skuespilleren, der spillede spøgelseskaptajnen, sad fast i en hemmelig gang.",
      details: [
        "En spøgelseskaptajn ved navn Barry, der blev ved med at undskylde mellem sine stønnen",
        "En skattekiste der kun kunne åbnes med en hårnål",
        "En papegøjedukke med ét glasøje",
        "Nedtællingsuret der stod fast på 13 minutter hele tiden",
      ],
    },
  },
  {
    id: "midnight-bowling",
    en: {
      story:
        "You claim you were competing in a midnight bowling league final when the scoreboard caught fire and the game had to finish by candlelight.",
      details: [
        "A bowling ball painted like a disco globe",
        "A referee wearing a Hawaiian shirt covered in tacos",
        "The smell of scorched electronics and popcorn butter",
        "A final score of exactly 142",
      ],
    },
    da: {
      story:
        "I hævder, at I var med i finalen i en bowlingliga ved midnat, da resultattavlen gik i brand, og kampen måtte færdigspilles ved stearinlys.",
      details: [
        "En bowlingkugle malet som en diskokugle",
        "En dommer i en hawaiiskjorte med tacoer på",
        "Lugten af svedet elektronik og popcornsmør",
        "En slutscore på præcis 142",
      ],
    },
  },
  {
    id: "laundromat-seance",
    en: {
      story:
        "You say a stranger convinced you both to join a séance in the back of the laundromat to contact the ghost of a sock that had been missing for years.",
      details: [
        "A medium named Ingrid with seventeen bangle bracelets",
        "A dryer that kept chiming during the silent parts",
        "A single glow-in-the-dark sock placed on the table",
        "The smell of fabric softener and burnt sage",
      ],
    },
    da: {
      story:
        "I siger, at en fremmed overtalte jer begge til at deltage i en åndemaning bagerst i vaskeriet for at kontakte spøgelset af en sok, der havde været væk i årevis.",
      details: [
        "Et medium ved navn Ingrid med sytten armbånd",
        "En tørretumbler der blev ved med at bimle midt i de stille øjeblikke",
        "En enkelt selvlysende sok, der lå på bordet",
        "Lugten af skyllemiddel og brændt salvie",
      ],
    },
  },
  {
    id: "petting-zoo-escape",
    en: {
      story:
        "You claim a goat unlatched its own pen at the petting zoo and led a small parade of animals through the gift shop while you two tried to herd them back.",
      details: [
        "A goat named Kevin with a taste for straw hats",
        "A gift shop shelf of snow globes, all knocked over",
        "A peacock that refused to move for twenty minutes",
        "The smell of hay mixed with cotton candy",
      ],
    },
    da: {
      story:
        "I hævder, at en ged selv lirkede sin låge op i minizoologisk have og førte en lille parade af dyr gennem gavebutikken, mens I to forsøgte at drive dem tilbage.",
      details: [
        "En ged ved navn Kevin med en forkærlighed for stråhatte",
        "En hylde med snekugler i gavebutikken, alle væltet",
        "En påfugl der nægtede at flytte sig i tyve minutter",
        "Lugten af hø blandet med candyfloss",
      ],
    },
  },
  {
    id: "karaoke-parrot",
    en: {
      story:
        "You say you spent the evening at a karaoke bar where the owner's parrot kept stealing the microphone between songs and refused to give it back.",
      details: [
        "A parrot named Doris who only knew one chorus",
        "A karaoke machine stuck on Song 27 the whole night",
        "A disco ball missing half its mirror tiles",
        "The smell of nachos and fog machine juice",
      ],
    },
    da: {
      story:
        "I siger, at I tilbragte aftenen på en karaokebar, hvor ejerens papegøje blev ved med at stjæle mikrofonen mellem sangene og nægtede at give den tilbage.",
      details: [
        "En papegøje ved navn Doris, der kun kunne ét omkvæd",
        "En karaokemaskine der sad fast på sang nummer 27 hele aftenen",
        "En diskokugle der manglede halvdelen af spejlbrikkerne",
        "Lugten af nachos og røgmaskinevæske",
      ],
    },
  },
  {
    id: "ice-sculpture-contest",
    en: {
      story:
        "You claim you were roped into judging a backyard ice-sculpture contest where every entry melted into the same shapeless blob before the scores were final.",
      details: [
        "A judge's clipboard with the categories smudged by melted ice",
        "A sculpture of a swan that slowly became a sea lion",
        "A generator that kept tripping the lights",
        "The cold, wet smell of a walk-in freezer left open",
      ],
    },
    da: {
      story:
        "I hævder, at I blev hevet ind som dommere i en baghave-iskonkurrence, hvor samtlige bidrag smeltede til den samme formløse klump, inden pointene var endelige.",
      details: [
        "En dommerklemme med kategorier der var visket ud af smeltet is",
        "En skulptur af en svane, der langsomt blev til en søløve",
        "Et generatoranlæg der blev ved med at slå lyset ud",
        "Den kolde, våde lugt af en frostrumsdør der stod åben",
      ],
    },
  },
  {
    id: "garage-sale-spaceship",
    en: {
      story:
        "You say you spent hours at a garage sale haggling over a life-size cardboard spaceship prop that neither of you actually wanted but couldn't stop bidding on.",
      details: [
        "A seller named Roger who wouldn't go below forty kroner",
        "A cardboard spaceship missing one wing",
        "A folding table covered in mismatched board game pieces",
        "The smell of a neighbor's grill drifting over the fence",
      ],
    },
    da: {
      story:
        "I siger, at I brugte timer på et garagesalg med at prutte om en skulderhøj papkulisse af et rumskib, som ingen af jer egentlig ville have, men som I ikke kunne stoppe med at byde på.",
      details: [
        "En sælger ved navn Roger, der ikke ville gå under fyrre kroner",
        "Et rumskib af pap, der manglede den ene vinge",
        "Et klapbord fyldt med brikker fra forskellige brætspil, der ikke hørte sammen",
        "Lugten af naboens grill, der drev ind over hegnet",
      ],
    },
  },
  {
    id: "roller-disco-blackout",
    en: {
      story:
        "You claim you were skating at the roller disco when the power cut out and the whole rink had to finish the last song by phone flashlight.",
      details: [
        "A DJ named Tanja who kept the music going by clapping the beat",
        "A pair of skates with one wheel that squeaked",
        "A glitter cannon that misfired early",
        "The smell of rink wax and spilled slushies",
      ],
    },
    da: {
      story:
        "I hævder, at I skøjtede på rulleskøjtedisko, da strømmen gik, og hele hallen måtte fuldføre den sidste sang med lys fra mobiltelefoner.",
      details: [
        "En dj ved navn Tanja, der holdt musikken i gang ved at klappe takten",
        "Et par rulleskøjter, hvor det ene hjul knirkede",
        "En glimmerkanon der gik af for tidligt",
        "Lugten af skøjtevoks og spildt slush-ice",
      ],
    },
  },
  {
    id: "taxidermy-museum-nightshift",
    en: {
      story:
        "You say you were locked in overnight at the natural history museum's taxidermy wing because a fire drill sealed the doors while you were admiring the walrus.",
      details: [
        "A stuffed walrus that, according to the plaque, was named Big Ole",
        "A security guard who fell asleep humming show tunes",
        "A fire alarm that chirped every four minutes instead of stopping",
        "The dusty smell of old velvet rope stands",
      ],
    },
    da: {
      story:
        "I siger, at I blev låst inde natten over i naturhistorisk museums udstoppede dyr-afdeling, fordi en brandøvelse forseglede dørene, mens I stod og beundrede hvalrossen.",
      details: [
        "En udstoppet hvalros, der ifølge skiltet hed Store Ole",
        "En vagt der faldt i søvn mens han nynnede musicalmelodier",
        "En brandalarm der bippede hvert fjerde minut i stedet for at stoppe",
        "Den støvede lugt af gamle fløjlssnore",
      ],
    },
  },
  {
    id: "hot-air-balloon-launch",
    en: {
      story:
        "You claim you volunteered to hold down a hot air balloon's ropes at dawn and ended up drifting three fields over before the pilot noticed you were still attached.",
      details: [
        "A pilot named Henrik who narrated everything like a nature documentary",
        "A balloon patterned like a giant strawberry",
        "A basket that smelled like propane and fresh coffee",
        "A cow that watched the whole thing without blinking",
      ],
    },
    da: {
      story:
        "I hævder, at I meldte jer frivilligt til at holde i rebene på en varmluftballon ved daggry og endte med at drive tre marker videre, inden piloten opdagede, at I stadig hang fast.",
      details: [
        "En pilot ved navn Henrik, der fortalte alting som i et naturprogram",
        "En ballon mønstret som et kæmpe jordbær",
        "En kurv der lugtede af gas og friskbrygget kaffe",
        "En ko der iagttog det hele uden at blinke",
      ],
    },
  },
  {
    id: "cheese-festival-judging",
    en: {
      story:
        "You say you got pulled in as emergency judges at a cheese festival after the real judges were disqualified for arguing too loudly about mould.",
      details: [
        "A wheel of cheese labeled only 'Aggressive'",
        "A judge's badge made of laminated cheese wrapper",
        "A goat mascot that kept trying to eat the exhibits",
        "The overwhelming smell of gorgonzola in a small tent",
      ],
    },
    da: {
      story:
        "I siger, at I blev hevet ind som nøddommere ved en ostefestival, efter de rigtige dommere blev diskvalificeret for at skændes for højlydt om skimmel.",
      details: [
        "Et osthjul der kun var mærket 'Aggressiv'",
        "Et dommerskilt lavet af lamineret ostepapir",
        "En gedemaskot der blev ved med at prøve at spise udstillingerne",
        "Den overvældende lugt af gorgonzola i et lille telt",
      ],
    },
  },
  {
    id: "treasure-hunt-woods",
    en: {
      story:
        "You claim you followed a hand-drawn treasure map left on a park bench and spent the afternoon digging in the woods with a garden trowel.",
      details: [
        "A map with a coffee stain shaped like an X",
        "A rusty tin box buried under exactly three rocks",
        "A dog walker who offered unsolicited digging advice",
        "The smell of wet soil and pine needles",
      ],
    },
    da: {
      story:
        "I hævder, at I fulgte et håndtegnet skattekort, der lå på en parkbænk, og brugte eftermiddagen på at grave i skoven med en lille håndspade.",
      details: [
        "Et kort med en kaffeplet formet som et X",
        "En rusten dåse begravet under præcis tre sten",
        "En hundeluftet der kom med uopfordrede graveråd",
        "Lugten af våd jord og fyrrenåle",
      ],
    },
  },
  {
    id: "board-game-tournament",
    en: {
      story:
        "You say you were mid-final in a neighborhood board game tournament when the last die rolled under the radiator and the whole match stalled for an hour.",
      details: [
        "A trophy shaped like a tiny plastic top hat",
        "A die that everyone swore was cursed",
        "A snack table with only pretzels left",
        "A neighbor named Ib who narrated every move out loud",
      ],
    },
    da: {
      story:
        "I siger, at I var midt i finalen ved en brætspilsturnering i kvarteret, da den sidste terning trillede ind under radiatoren, og hele kampen gik i stå i en time.",
      details: [
        "En pokal formet som en lille plastikcylinderhat",
        "En terning som alle svor var forbandet",
        "Et snackbord hvor der kun var kringler tilbage",
        "En nabo ved navn Ib der kommenterede hvert eneste træk højt",
      ],
    },
  },
  {
    id: "haunted-house-shift",
    en: {
      story:
        "You claim you filled in as last-minute actors at a haunted house when two of the real ghosts called in sick, and neither of you knew the script.",
      details: [
        "A fog machine that only worked in short, angry bursts",
        "A costume chain that kept falling off at the ankle",
        "A visitor who screamed at the coat rack by mistake",
        "The smell of latex masks and cheap dry ice",
      ],
    },
    da: {
      story:
        "I hævder, at I sprang til som sidste-øjebliks-skuespillere i et gyserhus, da to af de rigtige spøgelser meldte sig syge, og ingen af jer kendte manuskriptet.",
      details: [
        "En røgmaskine der kun virkede i korte, sure stød",
        "En kostumekæde der blev ved med at falde af ved anklen",
        "En gæst der skreg ad frakkestativet ved en fejl",
        "Lugten af latexmasker og billig tøris",
      ],
    },
  },
  {
    id: "food-truck-festival",
    en: {
      story:
        "You say you got stuck in line at a food truck festival for two hours behind a man ordering fourteen different kinds of dumplings, one at a time.",
      details: [
        "A food truck named 'Dumpling Duel'",
        "A napkin dispenser that only released one at a time",
        "A busker playing accordion covers of pop songs",
        "The smell of frying oil and orange soda",
      ],
    },
    da: {
      story:
        "I siger, at I stod fast i kø ved en food truck-festival i to timer bag en mand, der bestilte fjorten forskellige slags dumplings, én ad gangen.",
      details: [
        "En food truck ved navn 'Dumpling-duellen'",
        "En servietholder der kun ville give én serviet ad gangen",
        "En gademusikant der spillede poplåle på harmonika",
        "Lugten af friturefedt og orange sodavand",
      ],
    },
  },
  {
    id: "silent-disco-mixup",
    en: {
      story:
        "You claim your headphones got swapped at a silent disco, so you spent the whole night dancing to a true crime podcast instead of the music.",
      details: [
        "A pair of headphones with a sticker of a smiling shark",
        "A dance floor lit only in three colors: red, green, purple",
        "A podcast host with a suspiciously calm voice",
        "A stranger who kept giving you a thumbs up for no reason",
      ],
    },
    da: {
      story:
        "I hævder, at jeres høretelefoner blev byttet om til en silent disco, så I dansede hele natten til en true crime-podcast i stedet for musikken.",
      details: [
        "Et par høretelefoner med et klistermærke af en smilende haj",
        "Et dansegulv der kun var oplyst i tre farver: rødt, grønt, lilla",
        "En podcastvært med en mistænkeligt rolig stemme",
        "En fremmed der blev ved med at give tommelfinger op uden grund",
      ],
    },
  },
  {
    id: "pottery-class-disaster",
    en: {
      story:
        "You say a beginner's pottery class went wrong when the wheel jammed and flung wet clay across the room, and you two spent the rest of the class helping clean it up.",
      details: [
        "A ceramics teacher named Bodil with clay in her eyebrows",
        "A lump of clay that landed directly in someone's tea",
        "A radio playing smooth jazz on a loop",
        "The smell of wet clay and kiln heat",
      ],
    },
    da: {
      story:
        "I siger, at et pottemagerkursus for begyndere gik galt, da drejeskiven kørte fast og slyngede vådt ler ud over hele lokalet, og I to brugte resten af timen på at hjælpe med oprydningen.",
      details: [
        "En keramiklærer ved navn Bodil med ler i øjenbrynene",
        "En klat ler der landede direkte i en kop te",
        "En radio der spillede blid jazz i loop",
        "Lugten af vådt ler og ovnvarme",
      ],
    },
  },
  {
    id: "trivia-night-team",
    en: {
      story:
        "You claim you were drafted onto a pub quiz team at the last minute and somehow won the tie-breaker round on a question about deep-sea fish.",
      details: [
        "A quizmaster named Flemming with a squeaky microphone",
        "A team name scribbled down as 'The Melting Ice Cubes'",
        "A tie-breaker prize of a single inflatable flamingo",
        "The smell of spilled beer soaked into the carpet",
      ],
    },
    da: {
      story:
        "I hævder, at I i sidste øjeblik blev hevet ind på et pubquiz-hold og på en eller anden måde vandt omkampen på et spørgsmål om dybhavsfisk.",
      details: [
        "En quizmaster ved navn Flemming med en knirkende mikrofon",
        "Et holdnavn kruset ned som 'De Smeltende Isterninger'",
        "En omkamp-præmie i form af en enkelt oppustelig flamingo",
        "Lugten af spildt øl i tæppet",
      ],
    },
  },
] as const;

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

export function resolveScenario(id: string, lang: Lang): ScenarioText | undefined {
  const scenario = scenarioById(id);
  return scenario ? scenario[lang] : undefined;
}
