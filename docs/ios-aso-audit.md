# Hvem mon? — pre-launch ASO audit

2026-09-06 · iOS · Denmark first, English secondary.
Skills used: aso-audit → keyword-research → metadata-optimization; screenshot-
optimization supplies the separate artwork work. This is an audit of prepared
assets, not a live listing. There is no Apple app record or performance history.

## Decision

Keep `Hvem mon? Gæt dine venner` and `Selskabsspil med anonyme svar`.
The approved brand plus author-guessing action is more informative than replacing
the action with generic party terms. Put additional category-adjacent vocabulary
in the keyword field. The canonical, upload-ready text draft remains
`ios-store-metadata.json`; it is not uploaded or legally cleared.

## Evidence and limits

Apple's public Search API was queried on this date with country `dk`, entity
`software`, limit `8`. These are a small relevance sample, NOT measured on-device
rankings, demand estimates, or the total number of competing apps.

| Query | Returned sample | Interpretation |
| --- | --- | --- |
| Hvem mon | 0 | No results in this search, not a name reservation |
| festspil | 8; includes PartyPal, Hvem Her, Most Likely | Relevant party-game intent |
| selskabsspil | 8; includes Charades Headbands, 5 Second Battle | Relevant but broad game intent |
| partyspil | 8; includes PartyPal and Blur | Useful additional Danish compound |
| spilleaften | 8; includes Whist Tracker and Alias | Relevant occasion, mixed intent |
| gæt venner | 6; includes music, drawing and charades games | Broad guessing intent; explain author guessing clearly |

Reproduce: `https://itunes.apple.com/search?term=festspil&country=dk&entity=software&limit=8`
(replace the query term). Public results can return English metadata in the Danish
storefront; do not interpret that as absence of Danish app localization.

No Appeeky/keyword-volume integration or Search Ads popularity data is available.
Autocomplete, live rank tracking, volume, difficulty and the skill's calculated
opportunity score are therefore **unavailable**, not zero. No claim of an
uncontested keyword or estimated monthly searches is justified.

## Prioritized keyword strategy

Manual relevance is qualitative, based on the shipped game, not traffic.

| Bucket | Candidate terms | Relevance / action |
| --- | --- | --- |
| Primary | gæt, venner, selskabsspil | High; keep title/subtitle placement |
| Secondary | festspil, partyspil, spørgsmål, spilleaften, multiplayer | High; keyword field |
| Supporting | gruppe, familie, hyggespil, afsløring | Relevant audience/occasion/reveal terms; keyword field |
| Long-tail hypotheses | selskabsspil med venner; gæt hvem der skrev; anonyme svar; festspil til spilleaften; spørgsmål til venner; spil med vennegruppen; selskabsspil på telefonen; spil til familiefesten; multiplayer med venner; gæt hinandens svar | Research/measurement backlog, not a promise Apple combines every phrase |
| Broad later hypotheses | quiz, party games, social games | Mixed intent; do not displace the core loop |
| Reject | drukspil, sandhed eller konsekvens, offline, competitor brands | Unsupported mechanics, inaccurate promise or protected names |

Removed `sjov`, `sammen` and `quiz` from Danish keywords to make room for
`partyspil` and `afsløring`. Removed vague English `room` and `fun`, adding
`icebreaker` and `social`. Quiz implies knowledge questions rather than identifying
an author; this is a product-fit judgment, not a measured ranking improvement.

### Coverage

| Term | Title | Subtitle | Keywords |
| --- | --- | --- | --- |
| Hvem mon | yes | — | — |
| gæt / venner | yes | — | — |
| selskabsspil / anonyme / svar | — | yes | — |
| festspil / partyspil | — | — | yes |
| spørgsmål / spilleaften / multiplayer | — | — | yes |
| gruppe / familie / hyggespil / afsløring | — | — | yes |

Apple's overview says 100 characters, but its field reference says 100 bytes.
Use the stricter UTF-8 byte ceiling too: Danish draft uses 90 bytes; English 83.
Do not fill spare capacity with unrelated filler. Do not assume Danish inflection
and compound indexing works identically to English plurals.
[Apple field reference](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information),
[Apple search guidance](https://developer.apple.com/app-store/search/).

## Copy alternatives (not a new name-approval request)

| Pair | Title | Subtitle | Rationale |
| --- | --- | --- | --- |
| Recommended DA | Hvem mon? Gæt dine venner | Selskabsspil med anonyme svar | Mechanic plus category |
| Alternative A DA | Hvem mon? Festspil med venner | Svar først. Gæt bagefter. | Party-led; repeats a word across fields, so not selected |
| Alternative B DA | Hvem mon? Hvem skrev svaret? | Festspil med skjulte afsendere | Explicit author hook, but repeated “hvem” wastes title space |
| Recommended EN | Hvem mon? Guess your friends | Party game with secret answers | Keeps brand, explains social guessing |
| Alternative A EN | Hvem mon? Who wrote that? | Party game with secret answers | Clear author question |
| Alternative B EN | Hvem mon? Party with friends | Guess who wrote each answer | Party-led; no claim of demand superiority |

The full canonical descriptions explain author reveal, private rooms, 3–16 players,
cross-platform play, no accounts, four prompt themes and moderation. The release
candidate has no practice or bot mode.
No invented awards, reviews or download counts are added. No keyword stuffing in
the description: its job is explaining the experience and persuading the reader.

Promotional alternatives for later testing:

- DA A: `Hvem overrasker jer mest? Svar på de samme spørgsmål, og gæt, hvem der skrev hvad. Spil sammen på telefon, tablet og i browseren.`
- DA B: `Saml vennegruppen i et privat rum. Alle svarer først — så begynder gætteriet. Ingen konto nødvendig.`
- EN A: `Same questions. Unexpected answers. Guess which friend wrote each one, then enjoy the reveal together.`
- EN B: `Get your friends into one private room. Everyone answers first, then the guessing begins. No account needed.`

The recommended promotional text stays in the JSON. Alternative copy is a
qualitative experiment backlog, not a proven conversion winner. No What's New
history, paid campaigns, preview video or paid tests are invented for version 1.

## Creative and competitive assessment

Apple lookup on this date (Denmark storefront):

| App | Rating/count snapshot | Positioning in its own description | Hvem mon? distinction |
| --- | --- | --- | --- |
| [Double Blind](https://apps.apple.com/dk/app/id6754299900) | 0 ratings; no quality score inferred | Anonymous player-written questions/answers; premium hosting | Preset questions, guess-and-reveal scoring, browser participation |
| [Exposed](https://apps.apple.com/dk/app/id1553777064) | 4.32 / 13,999 | Truths, dares, challenges and friend-group PIN | Focused answer-author guessing, no dares |
| [PartyPal](https://apps.apple.com/dk/app/id1284471058) | 4.88 / 2,655 | Collection of party games | One coherent simultaneous-answer game |

Current competitor screenshot layouts/videos were not visually audited in this
pass; metadata descriptions do not prove creative quality. No competitor names
or statistics enter our listing or artwork.

## Readiness score, not predicted store performance

Editorial assessment at the start of this pass:

| Factor | Score / 10 | Weight | Reason |
| --- | --- | --- | --- |
| Title | 8 | 20 | Clear action and brand; demand unmeasured |
| Subtitle | 8 | 15 | Category and answer hook |
| Keywords | 6 | 15 | Relevant but broad filler; corrected in this pass |
| Description | 8 | 5 | Concrete truthful loop; no fake social proof |
| Screenshots | 0 | 15 | No completed Hvem mon? promotional set at audit start |
| Icon | 2 | 5 | Old A-shaped artwork remains |
| Conversion copy | 7 | 5 | Promotional copy prepared, untested |
| Video | N/A | — | Optional, not produced |
| Ratings/reviews | N/A | — | Pre-launch |
| Keyword rankings | N/A | — | No live record or rank data |

Normalized baseline: **57/100** = 455 weighted points / 80 applicable weight.
The skill's original weights sum to 110, so applicable weights are normalized,
not treated as a literal 100. No post-artwork score is assigned before inspection.

### Priorities

Now: improve keyword precision; validate UTF-8 limits; record signing confirmation.
This release: produce actual-game promotional screenshots separately for iPhone
and iPad; finish approved-brand icon/splash; resolve name and App Store access
gates. After launch: establish real conversion/rank baselines, review feedback,
and revisit terms after enough observations. No promised uplift percentages.

### Artwork completion

The same day's follow-up produced and visually inspected 24 original promotional
images: six each for DA/EN and iPhone/iPad. See `app-store/README.md` for provenance,
dimensions and reproduction. Real five-player game assertions and layout checks
passed for both languages. The baseline above describes the start of the audit,
not the completed artwork. No conversion improvement is claimed without live
measurement. Signed-candidate comparison and upload remain pending.
