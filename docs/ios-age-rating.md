# AHA iOS age-rating evidence

Status: code-side draft for the `ios-app` branch, reviewed 2026-09-02. This is
not a saved App Store Connect questionnaire or a final rating. Apple calculates
global and regional ratings from the answers entered for the shipped build.

Current sources of truth:

- [Apple age-rating values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)
- [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)

## Proposed questionnaire answers

| Questionnaire item | Proposed answer | Shipped-code evidence and rationale |
| --- | --- | --- |
| Parental Controls | No | AHA has no parent/guardian controls or usage restrictions. |
| Age Assurance | No | AHA does not ask for age or use an age-assurance API. |
| Unrestricted Web Access | No | The app is not a browser and cannot navigate arbitrary sites. Its bundled rules/support views and user-initiated report email are purpose-specific. Recheck after final external URLs are wired. |
| User-Generated Content | Yes | Players create display names and free-text answers that are distributed to the other members of a private room. This is conservative even though distribution is room-scoped rather than public. |
| Social Media | No | There is no feed, discovery, following, likes, reposting, or public amplification. |
| Social Media Disabled for Users Under 13 | No | AHA has no social-media capability or declared-age gating. |
| Messaging and Chat | Yes | Short free-text answers communicate with the whole private room as part of the game, despite there being no general-purpose chat UI. |
| Advertising | No | The app has no advertising SDK, placement, or paid promotion. |
| Profanity or Crude Humor | Infrequent | Authored prompts contain no displayed slurs or profanity, and the server blocks a deterministic set of unambiguous Danish/English terms. One authored prompt asks players to invent a swear word, and user answers can still contain unanticipated crude language. |
| Horror/Fear Themes | None | There is no horror presentation or fear storyline. |
| Alcohol, Tobacco, or Drug Use or References | Infrequent | One of 80 authored prompts asks for the name of a bar. There is no depiction, encouragement, or gameplay involving consumption. This intentionally avoids under-declaring the reference. |
| Medical or Treatment Information | None | No diagnosis, treatment, medication, or emergency-care content. |
| Health or Wellness Topics | None | No self-care, diet, exercise, or wellness guidance. |
| Mature or Suggestive Themes | None | The opt-in `spicy` pack is limited to mild personal confessions such as white lies, embarrassment, jealousy, and petty revenge; it contains no sexual or otherwise mature subject matter under Apple's current definition. |
| Sexual Content or Nudity | None | No sexual behavior, nudity, imagery, or dialog. |
| Graphic Sexual Content and Nudity | None | No such content. |
| Cartoon or Fantasy Violence | None | No depicted physical conflict or harm. References to a fictional villain/superpower do not describe violence. |
| Realistic Violence | None | No such content. |
| Prolonged Graphic or Sadistic Realistic Violence | None | No such content. |
| Guns or Other Weapons | None | No gun, weapon, or harmful-object content. |
| Gambling | No | No money, exchangeable currency, betting, lottery, or prize wagering. |
| Simulated Gambling | None | No simulated bets or casino mechanics. |
| Contests | Frequent | Every normal game is a recurring skill-based competition: players guess authors, receive points, and see round/final rankings. Apple's definition explicitly includes skill competitions and trivia-style contests. |
| Loot Boxes | No | No purchases or randomized virtual items. |

## Expected result

Under Apple's 2026 definitions, **Frequent Contests** maps to the global 13+
band. Infrequent profanity/crude humor and the single alcohol reference do not
lower that result and must remain disclosed. Regional values can differ and the
App Store Connect result is authoritative; do not hard-code or market “13+” until
the current questionnaire has been completed against the final binary.

Do not select Made for Kids. Do not apply a higher manual override unless the
final EULA, content, distribution plan, or Apple's calculated result provides a
specific reason. AHA's moderation controls are release requirements, not a basis
for answering that user-authored text cannot exist.

## Submission-time checks

- Re-scan every enabled prompt pack and all App Store marketing copy for added
  mature, violent, substance, gambling, or sexual references.
- Confirm the final support/community links do not create unrestricted browsing.
- Re-evaluate the messaging and UGC answers in the live questionnaire help text;
  preserve the conservative answer if the UI remains ambiguous.
- Save screenshots or an export of the completed answers and calculated global
  and regional ratings as release evidence.
- Reconcile the result with the product page, review notes, privacy policy, and
  any minimum-age term in the final EULA.
