# AHA iOS / App Store handoff

Last updated: 2026-09-02 (Europe/Copenhagen)

This document is the source of truth for taking AHA from its existing web game to
an App Store release. It is intentionally self-contained so a new Codex session can
continue with minimal user involvement.

## 1. Mission and execution contract

Ship AHA as a polished, compliant universal iPhone/iPad app while preserving the
live web game and Cloudflare backend. Native and web players must share rooms and
play together.

The next session should keep working until it reaches a real blocker that only the
user can resolve. It should not stop merely to ask about small implementation
choices. Make conservative, reversible defaults, document them, and continue.

Expected 1.0 scope:

- Universal iPhone and iPad app.
- Danish as the primary App Store localization; English supported in-app and ready
  for a later/localized store listing.
- Same multiplayer rooms, game rules, prompt packs, and visual identity as web.
- Free launch without purchases. RevenueCat/IAP is a possible later update, not a
  release dependency unless the user explicitly changes scope.
- Denmark-first release, flexible date, organic-first launch. Do not invent a fixed
  launch date or paid budget before the release candidate is stable.

## 2. Repository isolation — non-negotiable

There are two worktrees:

| Purpose | Path | Branch |
| --- | --- | --- |
| Existing live web project | `/Users/nicklasandreasen/aha` | `main` |
| iOS/App Store project | `/Users/nicklasandreasen/aha-ios` | `ios-app` |

The iOS worktree was created from clean `main` at commit `65b781f` on 2026-09-01.
The original worktree was clean and matched `origin/main` at that point.

Every session must begin with:

```sh
pwd
git branch --show-current
git status --short --branch
```

Expected path: `/Users/nicklasandreasen/aha-ios`.
Expected branch: `ios-app`.

Never switch the original `/Users/nicklasandreasen/aha` worktree away from `main`.
Never merge or push `ios-app` into `main` without explicit user approval. A push to
`main` runs CI and then automatically deploys both production Workers. Do not push
or deploy `main` as an incidental part of iOS work.

It is fine to commit iOS work locally on `ios-app`. Push only `ios-app` when remote
CI/Codemagic needs it, and confirm the push target before doing so.

## 3. Current product

AHA is a synchronous party game for 3–16 players:

1. A host creates a room and chooses question/round settings.
2. Everyone answers the same set of prompts anonymously, up front and at their own
   pace within a shared timer.
3. Each guessing round shows one question and one anonymous answer.
4. Players guess who wrote the answer.
5. The author is revealed, standings appear periodically, and the game ends with a
   finale that returns the same room to the lobby.

The selection logic deliberately spreads rounds across players and avoids repeating
the same question twice in a row. The app is not a clone of Vildsvar: carry over the
release process, not Vildsvar's game concepts or store copy.

Current content:

- 80 prompts total.
- Packs: Everyday (25), Opinions (20), Absurd (20), Spicy/`Tilståelser` (15).
- The current `Tilståelser` prompts are mild personal confessions such as white
  lies, embarrassing memories, excuses, guilty songs, and petty revenge. They do
  not currently contain explicit sexual or alcohol content.
- Danish and English localizations exist. Danish copy should always be reviewed as
  native Danish before release.

Current visual system:

- Purple field `#4A1FD6`, white reading surfaces, yellow action `#FFE14D`.
- Fredoka for expressive content; Figtree for controls and explanatory copy.
- Existing `.sticker` and `.field-label` primitives.
- Existing screens already account for 390×844 and keyboard-height 390×420 web
  viewports. Preserve this behavior while adding native safe areas.

## 4. Current technical architecture

pnpm monorepo, Node 22+, pnpm 10:

- `apps/web`: SvelteKit 2, Svelte 5, Cloudflare adapter, Paraglide i18n.
- `apps/rooms`: Cloudflare Worker REST/WebSocket API backed by a Durable Object.
- `packages/shared`: protocol, prompt content, room codes, state machine.

Production:

- Game: <https://aha.adrez.dev>
- Web Worker: <https://aha-web.nicklas-andreasen2000.workers.dev>
- Rooms health: <https://aha-rooms.nicklas-andreasen2000.workers.dev/health>

Important implementation facts:

- `PROTOCOL_VERSION = 1`; persisted room schema is version 2.
- Player session secrets are hashed before server persistence. The plaintext room
  session token is currently stored client-side in `localStorage` for reconnects.
- Rooms self-delete after ten minutes without connected sockets.
- The web client uses relative `/api` requests and derives WebSocket URLs from the
  page host. In production those requests pass through a SvelteKit endpoint and a
  Cloudflare service binding to `aha-rooms`.
- The separate mobile build uses explicit HTTPS and WSS origins for the Rooms
  Worker. The web build retains its relative `/api` service-binding path.
- `scripts/bots.mjs` is a development CLI only. App Review cannot use it.
- Capacitor configuration, a universal native iOS project, an unsigned hosted-Xcode
  workflow, and an AHA-specific privacy manifest now exist on `ios-app`. There is
  still no Codemagic workflow, App Store record, or AHA-specific signing setup.

## 5. Baseline verification

Run on 2026-09-01 from the clean baseline:

- `pnpm typecheck`: passed, 0 Svelte errors and 0 warnings.
- `pnpm test`: passed, 210 tests total.
  - shared: 124
  - web: 58
  - rooms: 28
- `pnpm build`: passed with the Cloudflare adapter.

The Playwright suite was not rerun during handoff creation. It is excluded from CI
and should be run before structural mobile changes and again before release:

```sh
pnpm --filter web exec playwright test
```

The Playwright servers can be isolated from another worktree by setting
`AHA_E2E_WEB_PORT` and `AHA_E2E_ROOMS_PORT`; the Vite API/WebSocket proxy follows
the selected Rooms port. Use that when another project already owns 5173/8787.

Reverified later on 2026-09-01 from `ios-app` after the initial mobile transport
work:

- `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings.
- `pnpm test`: passed, 218 tests total (shared 124, web 62, rooms 32).
- `pnpm build`: passed using the unchanged Cloudflare adapter path.
- `pnpm build:mobile`: passed and wrote the separate Capacitor SPA to
  `apps/web/build-mobile`.
- Playwright: 6/6 passed twice (baseline before changes and regression after the
  origin policy), including the full game, short viewport, cadence, and leaver
  flows.

Reverified on 2026-09-02 after the iPad/privacy, rate-guard, and local UGC-safety work:

- `pnpm typecheck`: passed across the workspace.
- `pnpm test`: passed, 239 tests total (shared 130, web 73, rooms 36).
- Playwright: all 10 current specs passed (7 full regression specs plus 3 focused
  safety specs), including the 1032 x 1376 iPad composition assertion, full
  browser game flow, server name rejection, persistent local blocking, host
  removal, anonymous-answer hide/restore/report controls, and reachable
  community/support pages.
- `pnpm audit --prod`: no known vulnerabilities.

Reverified again after the solo reviewer path:

- `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings.
- `pnpm test`: passed, 245 tests total (shared 135, web 73, rooms 37).
- Playwright: all 11 specs passed under four parallel browser workers on isolated
  local servers, including the complete solo reviewer journey and the existing
  multiplayer, safety, short-viewport, iPad, cadence, and leaver regressions.
- Cloudflare web build, static mobile build, Capacitor iOS sync, privacy-manifest
  lint, and `pnpm audit --prod` all passed.

The generated Capacitor project is under `apps/mobile/ios`. Its project settings
target iPhone+iPad (`TARGETED_DEVICE_FAMILY = "1,2"`) with iOS 15.0 as the
minimum. GitHub-hosted Xcode 26.6 has compiled both generic iOS and simulator
targets and launched the app on current iPhone and iPad simulators. A blank-screen
regression discovered in the first screenshots was traced to Paraglide's cookie
locale strategy on Capacitor's custom scheme; the mobile build now uses
`localStorage`, while the web build still uses its cookie strategy.

## 6. Proven approach from Vildsvar

The completed Vildsvar worktree is `/Users/nicklasandreasen/chameleon-ios`. Its
`IOS_APP_HANDOFF.md`, Capacitor setup, Codemagic workflow, hosted simulator checks,
safe-area work, screenshot tooling, privacy manifest, and metadata pipeline are the
reference implementation.

Reuse lessons and patterns, but audit every copied line. In particular:

- Use a separate mobile SPA build while leaving the Cloudflare web build intact.
- Use Capacitor 8 with a universal iPhone/iPad target and minimum iOS/iPadOS 15,
  unless a dependency forces a documented change.
- Account for status bar, Dynamic Island/notch, and home-indicator safe areas on
  every screen, including keyboard states.
- Use current native App, Network, Haptics, and Share integrations only where they
  improve AHA; keep browser fallbacks for the web version.
- Add `PrivacyInfo.xcprivacy` based on AHA's actual APIs/data, not Vildsvar's answers.
- Use hosted Xcode because the user's older Mac cannot install the required full
  Xcode. Use Codemagic for signed archives and App Store Connect publication.
- Current Apple upload requirement: Xcode 26+ with the iOS 26 SDK.
- Generate polished device-specific iPhone and iPad screenshots. Do not simply place
  a phone-sized game panel in the middle of a large iPad canvas.

Do not copy these Vildsvar-specific values:

- Bundle identifier, Apple app ID, SKU, App Store record, provisioning profiles.
- Public title/subtitle/keywords, age rating, privacy answers, screenshots.
- Game content, review notes, or any wording that describes Vildsvar's hidden-role
  mechanics.

## 7. Preliminary identity and IP finding

`AHA` is a crowded and weakly distinctive public name. A preliminary check found
multiple current App Store apps using “Aha”, including “Aha World” and a party game
called “AhaGuess”. Historical trademarks also exist for AHA across software and
games. This is not a legal conclusion, but it is enough to make name clearance a
release gate.

Do not create the final App Store record or lock the public identity until the next
session has:

1. Searched the Danish trademark register, EUIPO/TMview, WIPO, the Danish App Store,
   major web/social domains, and relevant game databases.
2. Compared similar names in software/game classes and party-game use, not just exact
   word matches.
3. Presented one clear recommendation and two backups to the user.
4. Received the user's approval of the final public name. This is a meaningful user
   decision and is allowed to block the identity-dependent work only.

The in-game brand can potentially remain “AHA” while the App Store product title is
made more distinctive. A provisional Danish candidate—not yet approved—is:

- Name: `Aha: Hvem skrev svaret?`
- Subtitle direction: `Festspil med venner`

Verify Apple's current character limits and availability before recommending it.
Do not describe a preliminary search as trademark clearance or legal advice.

Provisional bundle identifier for availability checks only: `dev.adrez.aha`.
Register it only after confirming it is unused and the final identity will not make
a different identifier preferable.

## 8. Release-critical gaps discovered in AHA

### Mobile transport

Create a mobile build mode that produces static assets for Capacitor while retaining
the Cloudflare adapter for web. Centralize transport selection:

- Web production: relative `/api` through the existing service binding.
- Native production: explicit HTTPS/WSS endpoint for `aha-rooms`.
- Local/test: explicit configurable origins, never hard-coded ad hoc per component.

The backend must explicitly support the Capacitor origin(s). Do not weaken CORS to
`*` for authenticated/session-bearing endpoints without a documented security
analysis. Keep web/iOS protocol compatibility covered by tests so web and native
users can share rooms.

### UGC moderation — App Review Guideline 1.2

Player names and free-text answers are user-generated content. Current code does not
provide the full App Store moderation set. Before submission, implement and verify:

- Server-side filtering of clearly objectionable material before it is posted,
  covering both Danish and English without relying only on client validation.
- A visible way to report an offensive answer/player.
- A timely operational path for those reports to reach support.
- A way to block/hide an abusive participant for the affected user and a host
  kick/room-ban mechanism appropriate to private ephemeral rooms.
- Published community rules and reachable contact/support information.
- Review notes that explain the private-room model, data lifetime, and exactly how
  filtering, reporting, and blocking work.

Do not claim compliance until these flows are executable and tested end to end.

### App Review testability

The real game requires at least three people; the existing bot CLI is unavailable to
reviewers. Add a user-visible “practice/demo game” or another production-safe review
path that lets one reviewer complete the entire loop with coherent bots. It should:

- Use believable Danish names and logically consistent prompt/answer pairs.
- Exercise answering, guessing, reveal, standings, finale, reconnect/leave behavior,
  and moderation controls.
- Be explained precisely in App Review notes.
- Not be a hidden backdoor or rely on developer tools.

### Backend/security readiness

Audit and address at least:

- Request and room-operation rate limiting.
- Room-code enumeration/brute-force resistance.
- Origin/CORS validation for web and native clients.
- Input normalization and server-side length/content validation.
- Reconnect token lifecycle and secure local storage implications.
- Abuse/report handling and minimal, privacy-conscious operational logging.
- Dependency audit and production error handling.
- EU data location/jurisdiction requirements for Durable Objects if promised in the
  privacy policy. Do not promise EU-only storage until configuration proves it.

### Privacy

Perform a field-by-field data inventory. Do not copy the eight Vildsvar data types
from App Store Connect. AHA currently appears to process at least nicknames, room
answers, guesses/game state, room/session identifiers, and support/report content if
the moderation flow is added. Determine for every field:

- whether Apple considers it “collected”;
- whether it is linked to identity;
- purpose(s);
- retention and deletion behavior;
- whether it leaves the device;
- whether Cloudflare or another processor receives it.

No tracking or advertising SDK is currently present. Do not declare tracking unless
the implementation changes. Create a privacy policy that matches actual behavior and
Apple privacy answers exactly.

### Age rating

Answer Apple's current questionnaire from actual shipped content and capabilities.
Do not automatically copy Vildsvar's 16+ decision: AHA's present prompt content is
substantially milder, while free-text UGC and communication capabilities still need
accurate disclosure. Apple—not a manually chosen marketing preference—calculates the
rating from the questionnaire. Do not add an 18+ click-through as a “workaround”.

## 9. Implementation sequence

Work through these phases in order, while parallelizing independent checks when safe.
Update this document as each phase completes.

### Phase A — safety, inventory, and identity

- [x] Create isolated `ios-app` branch and `/Users/nicklasandreasen/aha-ios` worktree.
- [x] Confirm clean baseline typecheck, unit tests, and web build.
- [x] Run baseline Playwright tests.
- [ ] Complete name/IP and App Store name availability research.
- [ ] Obtain user approval for the final public name only when needed.
- [ ] Confirm bundle ID, SKU naming convention, primary category, and secondary
  category based on competitor/category research.
- [x] Create an AHA-specific app marketing context using the installed ASO skills.

Research artifacts now exist in `app-marketing-context.md` and
`docs/ios-name-category-research.md`. Current recommendation: do not lead the
public title with AHA because AhaGuess is now an active party guessing game and
Aha World is a large, protected adjacent brand. `Svarspor: Gæt dine venner` is
the provisional recommendation, with two documented backups. Exact/fuzzy
interactive PVSonline/TMview/WIPO searches remain before approval because the
official services require interactive use and must not be scraped or have CAPTCHA
bypassed. Provisional category direction is Games — Trivia, secondary
Entertainment.

### Phase B — mobile foundation

- [x] Add conditional/static mobile SPA build without changing Cloudflare web output.
- [x] Centralize native/web API and WebSocket URL resolution.
- [x] Add Capacitor 8 and generate the iOS project.
- [x] Configure universal iPhone/iPad support and iOS 15 minimum.
- [ ] Add native safe-area/status-bar handling to every route and keyboard state.
- [ ] Add only justified Capacitor plugins, browser fallbacks, and permissions.
- [ ] Add a real iOS app icon, polished launch screen, and final display name.
- [x] Add an AHA-specific app privacy manifest based on audited current behavior.
- [ ] Add universal links for `aha.adrez.dev/room/<code>` so app and web users share
  the same invite URL, with web fallback when the app is not installed.

### Phase C — backend and review compliance

- [ ] Allow intentional native HTTPS/WSS transport without broadening trust globally.
- [ ] Add rate limits and brute-force protections.
- [ ] Implement UGC filtering, reporting, blocking/hiding, host removal/room banning,
  and support escalation.
- [x] Add the solo practice/reviewer path.
- [ ] Add unit/integration/e2e tests for native origin, cross-platform room play,
  abuse controls, reconnects, and the full reviewer journey.
- [ ] Draft privacy, support, and community-rules pages under canonical URLs such as
  `https://adrez.dev/aha/privacy`, `/support`, and `/community-rules`.
- [ ] Do not deploy those pages or any Worker without explicit user approval.

The native-origin implementation is present locally but is intentionally not
marked complete until deployed and tested against the production Worker. The
Rooms Worker now has an exact comma-separated origin allowlist
(`https://aha.adrez.dev,capacitor://localhost`), rejects untrusted REST and
WebSocket browser origins, and gives local `wrangler dev` its own localhost
override. There is no wildcard CORS. Unit/integration and full Playwright
regressions pass. Deployment remains explicitly gated.

Rate-limit protection is also implemented on `ios-app` but intentionally not
marked complete before deployment: edge bindings allow 12 room creations/minute
and 120 room lookup/WebSocket attempts/minute per SHA-256-hashed Cloudflare client
IP, while each accepted socket is limited to 50 messages/10 seconds so one client
cannot monopolize the Durable Object queue. Wrangler 4.125 dry-run recognizes both
bindings and the Rooms suite covers hashing, local bypass, and flood closure. The
edge counters are intentionally permissive/location-local and are a safety layer,
not billing or exact accounting.

The code-side UGC safety set is now implemented on `ios-app`: deterministic
Danish/English server filtering runs before player names or answers enter room
state; every participant can locally mask another player and hide/report the
current answer; player and answer reports open a localized, prefilled email to
`support@adrez.dev`; and the host can remove another player, revoke that room
session, and close its sockets. Community-rules and support pages are reachable
from the landing page in both languages. The guessing snapshot remains anonymous:
answer reporting before reveal includes no author, and local player masking does
not alter candidate IDs or scoring. This is an ephemeral session removal, not an
account-level ban: a removed person with the private invitation can still create a
new pseudonymous identity. Do not claim the release gate complete until mailbox
ownership/access, response expectations, retention/deletion, final public URLs,
and deployed end-to-end behavior have been verified.

The current code-derived privacy inventory and open infrastructure checks are in
`docs/ios-privacy-data-map.md`. The app target now bundles
`PrivacyInfo.xcprivacy`; the final signed archive's aggregated privacy report and
Cloudflare account-level retention still require verification.

The solo App Review path is implemented on the real room protocol and Durable
Object rather than as mocked screens. A lone host sees a public practice action;
it adds two clearly labeled, localized bot players with fixed coherent answers and
then uses the normal INTRO, ANSWERING, GUESSING, REVEAL, STANDINGS, FINALE, scoring,
reconnect, safety, and leave flows. Bot votes use the same round transition as human
votes. A real guest joining the finished lobby removes all bot scaffolding before
normal name/capacity checks, preserving ordinary web/iOS room interoperability.
Shared-state, Durable Object socket, and real-browser tests cover the path. Draft
reviewer instructions live in `docs/ios-review-notes.md`.

### Phase D — hosted native CI and signing

- [x] Add a GitHub Actions hosted-macOS job for unsigned native compile checks and
  iPhone/iPad simulator smoke tests using current Xcode 26.
- [ ] Create an AHA-specific `codemagic.yaml` based on the proven Vildsvar pattern.
- [ ] Reuse the user's existing Apple Developer membership and App Store Connect API
  credentials securely; never commit or print secrets.
- [ ] Register the unique App ID/bundle ID, distribution certificate, and App Store
  provisioning profile for AHA.
- [ ] Add AHA as a separate Codemagic app/workflow. Do not reuse Vildsvar's App Store
  record or provisioning profile.
- [ ] Build, upload, and process the first TestFlight build.

`.github/workflows/ios-native-build.yml` pins hosted Xcode 26.6, compiles an
unsigned generic-iOS target and a simulator target, launches current iPhone and
iPad simulators, rejects nearly blank screenshots, captures focused WebKit logs,
and uploads the evidence. Run 33574292438 proved that the locale fix rendered the
full landing UI on both device classes; its iPad step intentionally failed because
the first blank-screen heuristic mistook a sparse, phone-sized tablet layout for a
blank screen. That finding produced a separate iPad layout assertion and a real
tablet-scale landing composition. Run 33576190028 then passed the
complete Xcode 26.6 workflow: unsigned device and simulator builds, embedded
privacy-manifest verification, and visible-content launch guards on both iPhone
and iPad. Its retained screenshots were also reviewed manually; the phone layout
remained unchanged and the iPad now uses the intended tablet-scale composition.
The focused simulator logs contained only simulator/WebKit subsystem diagnostics,
with no application crash or uncaught JavaScript error.

Run 33610151258 passed the same complete Xcode 26.6 pipeline for UGC-safety commit
`401a456`: generic device and simulator builds, embedded privacy-manifest check,
iPhone launch, iPad launch, and evidence upload all succeeded. Its retained phone
and tablet screenshots were reviewed manually and show the full AHA landing UI,
including reachable Community rules and Support links, with no blank or clipped
native launch state.

### Phase E — device-quality validation

- [ ] Test full flow on a physical iPhone.
- [ ] The user has no iPad; use hosted iPad simulator tests, screenshots, layout
  assertions, and a Codemagic/GitHub-hosted native compile as the iPad evidence.
- [ ] Verify status-bar/notch/home-indicator safety and software-keyboard states.
- [ ] Verify actual web-to-iOS and iOS-to-web room interoperability.
- [ ] Verify offline/network loss/reconnect behavior and human-readable errors.
- [ ] Verify VoiceOver labels, Dynamic Type where feasible, contrast, 44pt targets,
  Reduce Motion, and non-color-only state communication.
- [ ] Confirm no greyed-out or empty-looking primary states in marketing captures.

### Phase F — ASO, screenshots, and listing

Use the installed ASO router and its relevant skills rather than guessing:

- `competitor-analysis`
- `keyword-research`
- `metadata-optimization`
- `screenshot-optimization`
- `app-icon-optimization`
- `app-launch`

Deliver Danish copy that reads as if written by a native Danish product writer.
Validate all App Store field limits mechanically.

Screenshot principles learned from Vildsvar:

- Produce premium editorial compositions, not raw screenshots.
- Show a coherent real match across the sequence. Every prompt, answer, selected
  guess, reveal, player name, and score must make logical sense together.
- Use believable Danish player names; never filler or joke names repeated everywhere.
- Show active, emotionally clear states with selected choices and usable CTAs.
- The first image must communicate the core hook instantly: anonymous answers and
  guessing which friend wrote them.
- Create separate iPhone and iPad compositions. On iPad, enlarge the gameplay content
  and recompose the artwork; do not just center a tiny phone layout.
- Keep all text and artwork clear of device/status-bar safe areas.
- Ensure every visible in-app string is exact native Danish and every claim is true.
- Generate the required highest-resolution iPhone and iPad sets and validate pixel
  dimensions/no alpha before upload. Apple currently accepts 1–10 screenshots.

### Phase G — App Store Connect and submission

- [ ] Create the new AHA App Store Connect record only after identity approval.
- [ ] Add Danish metadata, URLs, categories, rights declaration, availability, and
  pricing (free for 1.0).
- [ ] Complete the age-rating questionnaire from the shipped build.
- [ ] Complete App Privacy from the audited data map; publish the matching policy.
- [ ] Upload iPhone and iPad screenshot sets.
- [ ] Add review contact details from the private local handoff, not tracked files.
- [ ] Add complete review notes, the solo review route, and moderation instructions.
- [ ] Run the final release checklist against Apple's current guidelines.
- [ ] Submit and monitor processing/review. Respond to Apple with evidence, not
  guesses, if questions arise.

## 10. Store and launch direction

Positioning hypothesis to validate through ASO research:

> The party game where everyone answers first—and then you discover how well you
> really know your friends.

Danish direction:

> Svar anonymt. Gæt dine venner. Find ud af, hvem der egentlig skrev hvad.

Likely differentiators:

- Everyone answers; nobody has to perform alone.
- The funny moment comes from knowing the people in the room.
- One shared room works across iPhone, iPad, and web.
- Fast joining by room code/link, no account required.
- Repeatable prompt packs and a clear standings/finale rhythm.

Do not claim “anonymous” without context in privacy copy: answers are hidden during
guessing but revealed to the private room afterward. Use “anonymt i runden” or an
equivalent precise phrase.

Release success should initially be measured with modest indie-app targets and then
reset from real data:

- Technical: crash-free sessions, successful room joins, completed games, reconnect
  success, report response time.
- Funnel: product-page conversion, first room join/create, first completed game.
- Retention: another game/session within 7 and 30 days.
- Store: ratings/review quality and keyword indexing after enough data exists.

Do not add analytics merely to satisfy a checklist. If analytics is introduced, use
privacy-minimizing event design, update the policy/privacy labels, and obtain consent
where legally required.

## 11. Purchases later, not in 1.0

If the user later approves monetization, the natural model is one-time non-consumable
prompt packs or an all-packs unlock through Apple's In-App Purchase, with RevenueCat
as entitlement infrastructure. Requirements would include restore purchases,
cross-device entitlement behavior, paywall copy/pricing tests, Family Sharing choice,
review screenshots, and updated privacy/support documentation.

Do not gate the multiplayer core or existing free packs during initial conversion to
iOS. First ship a trustworthy free app, observe play behavior, then design paid packs
from evidence.

## 12. Credentials and user facts

The user already has a paid Apple Developer Program membership. Existing local
App Store Connect/Codemagic credentials from the Vildsvar release can be reused at
the account/integration level, but AHA needs its own bundle/App Store/signing assets.

Access inventory verified on 2026-09-01 without exposing secret values:

- The App Store Connect `.p8` private key exists and is readable.
- The issuer ID and Codemagic API token exist in the private source env file.
- The Codemagic token successfully authenticates to the Applications API. AHA has
  not yet been added as a Codemagic application; the API supports adding it once the
  `ios-app` branch and `codemagic.yaml` are ready.
- GitHub CLI is authenticated with repository and workflow access.
- Wrangler/Cloudflare is authenticated globally with Worker deployment access.

Authentication does not authorize production deployment: the branch/deployment
rules in `AGENTS.md` still apply.

Private paths and review-contact values are in `IOS_APP_PRIVATE.local`, which is
ignored by Git. Never copy those values into this tracked handoff, source code,
Codemagic YAML, CI logs, or chat unless strictly required for the user-facing step.

The user's Mac is too old for current full Xcode. Do not make local full-Xcode
installation a blocker; use GitHub-hosted macOS/Xcode for native checks and Codemagic
for signed archive/publish work.

## 13. Official references to re-check at execution time

- App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Upcoming SDK requirements: <https://developer.apple.com/news/upcoming-requirements/>
- Age rating definitions: <https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions>
- Screenshot specifications: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>
- App privacy details: <https://developer.apple.com/app-store/app-privacy-details/>
- Human Interface Guidelines: <https://developer.apple.com/design/human-interface-guidelines/>

These rules change. Re-read official Apple sources immediately before implementing
or submitting anything affected by them.

## 14. Exact next-session start

The new session should:

1. Read `AGENTS.md`, this file, and `IOS_APP_PRIVATE.local` in full.
2. Verify the path/branch/status commands in section 2.
3. Inspect current code rather than assuming it matches Vildsvar.
4. Treat baseline Playwright, static mobile build, URL resolution, Capacitor
   generation, universal/iOS 15 settings, and local origin-policy tests as complete.
5. Continue the remaining name/IP interactive checks when a compliant browser path
   is available, but do not let that block name-independent implementation.
6. Treat the local security, UGC-safety, and solo-reviewer implementations as
   code-complete but not production-verified. Continue safe-area/accessibility,
   universal-link preparation, and the AHA-specific Codemagic workflow without
   deploying production or creating name-dependent store records prematurely.
7. Continue autonomously through all reversible work. Ask the user only when final
   name approval or another genuinely user-only action becomes the critical path.
