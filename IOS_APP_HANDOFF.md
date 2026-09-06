# AHA iOS / App Store handoff

Last updated: 2026-09-06 (Europe/Copenhagen)

### Physical iPhone feedback: join navigation overlap — 2026-09-06

The owner tested build 1 and reported the name/avatar card almost covering the
top-left Back control after Create room. Other initial impressions were positive;
this does not establish that full mixed-device gameplay passed.

Moved the Back control into JoinForm's own non-shrinking navigation row, above
the scrolling form, with safe-area top padding and a 16px gap. The footer remains
pinned and the avatar area scrolls independently. No game rules or strings changed.
Frontend-design skill was used for a narrowly scoped layout fix, preserving the
approved purple visual identity. Eight browser regressions passed (DA/EN at
390x844, 390x420, 320x420 and 1032x1376), checking navigation clearance, 44px
target, tap interception, input/submit visibility and navigation after scrolling.
These emulate 59px safe-area padding and keyboard-height viewports, not a real
iOS software keyboard. DA/EN phone screenshots were visually inspected.
All 269 unit/integration tests and typechecking (zero errors/warnings) passed;
mobile build and Capacitor sync passed. A new signed build is still required to
deliver this fix to the owner's TestFlight installation. Do not claim build 1 fixed.

### First TestFlight build and Danish copy live in ASC — 2026-09-06

This entry supersedes the older missing-record and unsigned-build notes below.
The user replied "Done" after the record/name-check request. Treat this as owner
confirmation, not an independent legal opinion. Verified ASC app `6809198474`,
bundle `dev.adrez.aha`, primary locale `da`, version 1.0. Danish and en-GB metadata,
all 24 approved purple screenshots, Games/Trivia and Entertainment categories,
copyright and MANUAL release are saved. Screenshot processing is COMPLETE for all
24; public asset IDs and checksums are in `docs/ios-store-upload-state.json`.

Hosted Xcode run `34044530327` succeeded; both simulator captures were inspected.
Codemagic build `6a9d910727f4f755191f7ed2` succeeded including signed IPA and
publication, using `ios-app` release source `ad981128`. Apple build
`60395c78-28e1-456f-8f8d-7c324b316024`, build number 1, is VALID and
READY_FOR_BETA_TESTING, with non-exempt encryption false. It is attached to draft
version `01a7f353-c065-4b6b-96a8-206087b23846` and available to the internal group
`Hvem mon Internal` (`d2540cb5-1197-4300-b299-82985b267a12`). The owner is now
the group's sole tester with EMAIL invitation state INVITED. Reusing either old
app's tester resource failed with 409; creating an app-specific tester using the
verified owner's email succeeded. No other tester or Vildsvar resource changed.

User explicitly requests natural, professional Danish throughout, without
unnecessary double dashes or translated marketing phrasing. Metadata optimization
skill used to retain approved title/subtitle/keywords while rewriting description
and promotional text. Copy was saved and read back from ASC; all field limits pass.
Danish beta description and DA/en-GB What to Test notes are also saved. Keep this
tone in all future public writing. Approved artwork remains unchanged.

Age-rating questionnaire saved from the content audit; exact answers and Apple's
returned regional ratings are in `docs/ios-age-rating-saved.json`. The appInfo API
currently returns TWELVE_PLUS globally, FOURTEEN in Brazil, TWELVE in Korea; do not
substitute a guessed 13+ value. Final privacy declarations, review contact/notes,
pricing/availability and physical iPhone gameplay still need completion before
public review. Ask the owner to accept the TestFlight invitation and complete a
mixed iOS/web game, keyboard and resume checks. No public or external beta review
submission occurred, and no production deployment or AHA main change occurred.

### Final purple selection and release preparation — 2026-09-06

The user rejected both alternate concepts, requested their removal, then selected
the original purple campaign for release and asked to proceed with TestFlight and
App Store preparation. The rejected concepts and their tooling were moved out of
the workspace to `/private/tmp/hvemmon-rejected-concepts.RcJ9pS/` (recoverable until
temporary storage is cleared). The replacement image-generation request was
interrupted and abandoned. Do not resume alternate artwork generation.

The approved screenshots remain unchanged in `docs/app-store/final/`, with their
exact archive at `docs/app-store/concepts/01-purple-original/`. The native icon,
splash and iOS-branch favicon now use the purple/yellow question-mark identity;
`scripts/render-native-assets.mjs` regenerates opaque, size-checked PNGs. Technical
asset filenames remain unchanged intentionally. Reduced-motion lobby confetti now
has zero opacity, with a passing browser regression, rather than freezing over
the code. Codemagic's workflow display name is now Hvem mon? TestFlight.

Apple API inventory on 2026-09-06 still returns zero app records for `dev.adrez.aha`.
Official Apple documentation explicitly requires creating the initial record on
the App Store Connect website, not through its API. No authenticated interactive
browser tool is available here. This and the unresolved interactive trademark
checks are real user/external gates, not incomplete signing setup. Do not start
an upload workflow that cannot succeed without the record. No TestFlight upload
or App Store review submission has occurred.

Local verification: all 269 tests passed (135 shared / 95 web / 39 Rooms), mobile
build and Capacitor sync passed, and three targeted browser scenarios passed.
An initial parallel typecheck saw Paraglide-generated files being rewritten by
the browser dev server; a standalone rerun finished with zero errors/warnings.
Approved artwork hashes were rechecked without modifying any screenshot.
Release preparation commit `ad9811282ea84c5c941ebc50bd0b230ac7ce78a4` was pushed
only to `ios-app`. Hosted Xcode validation run `34044530327` is in progress:
`https://github.com/nick7167/alibi-adrez/actions/runs/34044530327`.
Check its conclusion and native artifacts on continuation; do not mistake it for
a signed Codemagic build or TestFlight upload. No production deployment occurred.

### Approved screenshot archive and alternatives — historical 2026-09-06

The user approved the revised purple campaign and requested two completely
different six-screen concepts while preserving it. The approved 24 images remain
unchanged in `docs/app-store/final/`; an exact copy plus SHA-256 manifest is stored
in `docs/app-store/concepts/01-purple-original/`. Two separate DA/EN iPhone/iPad
alternatives (48 additional PNGs) are in `02-social-dossier/` and
`03-game-night-live/`: cream/red printed editorial evidence boards versus
mint/black/hot-pink kinetic event posters. Each has six feature screens and both
language overview images. Reproduction and provenance are in the concepts README.
These are alternatives, not a replacement decision or an Apple upload. No app
code or production resource changed. Do not overwrite the approved set when
iterating alternatives.

### ASO and promotional artwork — 2026-09-06

Completed 24 promotional RGB PNGs: six per language (DA/EN) and device (iPhone
1320×2868, iPad 2064×2752), in `docs/app-store/final/`. Both language overview
images were visually inspected. The original poster design uses this app's
purple/yellow identity, not Vildsvar artwork. Both device families now enlarge
and rearrange actual UI crops. These are browser-based
captures of the shared app, not signed-native device evidence. Compare with the
signed candidate before uploading. README, editable HTML, source captures and
scenario provenance are retained in `docs/app-store/`.

The opt-in `playwright.store.config.ts` capture suite passed both real five-player
games and all 24 renders, including answer/author/score assertions and headline
clearance. PNG dimensions and absence of alpha passed; web typecheck reports zero
errors/warnings. Normal E2E discovery still contains exactly the existing 15 tests.
No application behavior changed in this artwork pass.

User feedback rejected the first draft's changing backgrounds, passive answer
card and frozen confetti over room codes. The revised campaign uses a consistent
deep-purple/bright-purple/yellow palette, stronger cross-platform room copy and
larger gameplay close-ups. Writing captures show actual partial typing and the
real caret. Normal-motion capture waits for confetti opacity zero, rather than
freezing it with reduced motion. Room-code crops exclude the unrelated leave
button at the edge. The original mixed-colour draft must not be uploaded.
The underlying app's reduced-motion confetti behavior remains an accessibility
follow-up; only capture behavior was changed in this screenshot request.

ASO skills produced `docs/ios-aso-audit.md`; DA/EN keywords were refined and field
limits checked including UTF-8 bytes. Public search samples are documented without
invented volume/rank figures. Metadata and artwork remain local, not uploaded.
The Danish registry form loaded normally and showed two CAPTCHA frames; no
challenge was bypassed. TMview produced no usable page and WIPO's restriction
remains. Name clearance, the legacy native icon/splash replacement, final store
record, signed build and physical iPhone testing remain release gates.

### App-specific provisioning profile — 2026-09-06

The user confirmed Codemagic displays one iOS certificate named `Vildsvar
Distribution` and one profile reference `vildsvar-app-store-profile`. Read-only
Apple inspection found the active `Vildsvar App Store` profile and its single
valid Distribution certificate, expiring 2027-09-01. Reusing this account-level
certificate is intentional; the old profile was not copied or changed.

Created a NEW `IOS_APP_STORE` profile named `Hvem mon App Store`, Apple resource
`K7CQ8GLCL6`, state `ACTIVE`, for `dev.adrez.aha` using that certificate. Verified
the new profile's bundle and certificate relationships separately. Apple initially
returned HTTP 500; a read confirmed no profile existed before one retry succeeded.
No certificate or existing profile was modified/revoked; no build was started.

The user's screenshot confirms `hvemmon-app-store-profile` for `dev.adrez.aha`
is imported in Codemagic with the green matching-certificate indicator and expiry
2027-09-01. Do not ask the user to repeat this step. Signed build validation is
still pending. Keep the Vildsvar entries unchanged.
This supersedes older zero-profile notes below. If Associated Domains is enabled
later for universal links, regenerate/refetch this app's profile before signing.

### Apple/Codemagic setup — 2026-09-06

The user approved the prepared root-site push and explicitly requested beginning
App Store setup, then said to continue. Root commit `ef41c37` (including its
`d9ec7b9` ancestor) is now pushed to `nick7167/adrez-personal:main`. No AHA
`main` changes or pushes were made.

Secure account inventory succeeded without printing credential values. Apple
registered the unused `dev.adrez.aha` bundle ID with description `Hvem mon`
(resource ID `Y7S62QDT83`). Keeping the existing technical identifier is deliberate;
the public name does not require a reverse-domain identifier change. This is an
App ID registration, NOT an App Store app record or name-clearance finding.

Created a separate Codemagic application in the existing account team:
`https://codemagic.io/app/6a9ca41794d126108b294467`. The service derives its display
name `alibi-adrez` from the existing GitHub repository; this is the correct AHA/iOS
repository, not a retired Worker deployment. Verified repository URL, file-based
configuration, and an empty build schedule. Always select `ios-app` and workflow
`aha-testflight`; do not run another branch. No signed build was started.

Apple reports zero profiles for this bundle ID and two existing Apple Distribution
certificates, expiring September 2027. None was altered or revoked. The documented
Codemagic REST schema does not expose code-signing identity management. Its settings
UI is needed to confirm the certificate with a held private key and fetch/upload a
new App Store profile for this bundle. Do not assume an Apple certificate listing
proves that its private key exists in Codemagic. Do not copy Vildsvar's profile.

Hosted Xcode run `33997799689` is fully successful. Downloaded and inspected both
iPhone/iPad screenshots: approved name, complete controls, locale switcher and
community/support/privacy links render with safe-area clearance. Focused logs
contain no crash/fatal/uncaught/exception/terminated matches. This is unsigned
simulator evidence, not a signed upload or physical iPhone test.

`docs/ios-app-store-next-steps.md` records the remaining interactive name check,
App Store record fields, signing setup and beta-first release sequence. No final
App Store record, profile, TestFlight build or review submission exists yet.

### Current decision and publication — 2026-09-06

The user selected **Hvem mon?**, authorized publication of the needed changes,
and confirmed Gmail as the support provider. Cloudflare's exact support-address
routing rule was verified as forwarding to gmail.com, without exposing the
destination address. Do not ask again for a name decision, mailbox receipt, or
mail provider. Prior unresolved-name/provider notes below are historical.

The approved public name is applied to Danish/English app titles, native display
name, web manifest, sharing and report text, support/community copy and root-site
catalog. Technical identifiers (`dev.adrez.aha`, worker names, room URLs,
localStorage keys) intentionally remain unchanged. The old A-shaped icon/splash
and favicon still need a deliberate final identity artwork pass; do not claim
the complete visual rebrand or native release assets are finalized.

The root-site bilingual policy source is
`/Users/nicklasandreasen/adrez.dev/src/data/aha-privacy.ts`. It names the controller,
Cloudflare Email Routing and Gmail, states purpose-based support retention,
distinguishes provider infrastructure from ten-minute active room deletion,
describes purpose-specific legal bases and rights, and discloses the root site's
existing external Google Fonts request. It promises neither EU-only processing
nor an unverified fixed provider-log lifetime. Owner duties and the assessment
are in `docs/ios-support-operations.md`; there is no automatic inbox cleanup.

Latest root-site source is now `ef41c375b3d137475a769049b23bb2037f8ccc91`, adding
discoverable root-footer links and underlines on provider references. All 30
tests and the build passed again; targeted browser checks passed. It is deployed
at `https://b35b8c71.adrez-personal.pages.dev` and on `adrez.dev`. The source commit
was presented with its verification status and subsequently pushed after the
user's explicit approval (see latest setup entry). Deployment itself is complete.

Root commit `d9ec7b9c28f94a3afdcbd4154912d58d05130b7d` passed all 30 tests,
static build and six-route phone/tablet checks and was directly deployed as
`https://62be52cf.adrez-personal.pages.dev`. Screenshots of the privacy page and
settled root catalog were inspected. The earlier prepared commit `891aee7` was
pushed to the root site's GitHub after the user's follow-up approval. The new
`d9ec7b9` commit was presented with verification status; the root repository's
post-commit push approval was subsequently received and the commit pushed. Do not overwrite the direct
deployment from an older checkout. Its existing untracked AGENTS.md remains untouched.

Native Info.plist/privacy manifest lint, workspace typecheck, all 269 tests
(shared 135 / web 95 / Rooms 39), web/mobile builds and Capacitor sync passed.
The new identity/privacy-link browser test and the existing viewport checks passed
after restoring tablet-scale title sizing. Concurrent local Wrangler instances
exposed shared SQLite test-state contention; Playwright now uses a per-port
`--persist-to .wrangler/e2e-<port>` directory. The full rerun passed all 15 browser
scenarios, including the author-leaving regression, without database errors.

The renamed web client was built again, dry-run checked, then deployed directly
from `ios-app` to `aha-web` as version `d9bfbb40-d8a7-4899-8559-79d48d79c21b`.
Previous version recorded for rollback: `34fce12b-d52c-4b8d-ac5c-fba1973bc622`.
No AHA `main` branch was modified or pushed. A future deployment of its older
source would revert these UI changes; coordinate a separately authorized source
integration rather than silently merging. The live web title, phone/tablet views,
six root-site URLs, locale/canonical values and decoded email links were checked.
The mixed native-origin/live-web-proxy production full-game smoke passed again.
Hosted Xcode run `33997799689` for `e95ef22` passed device/simulator compilation
and both simulator launches; screenshots were downloaded and inspected.

`docs/ios-store-metadata.json` contains Danish and English listing drafts. All
title/subtitle/keyword/promotional-text/description limits were checked mechanically,
and keyword fields do not duplicate title/subtitle words. No fabricated social
proof or measured keyword-volume claims are included; nothing was uploaded to ASC.

The Danish PVSonline trademark search form was re-opened on 2026-09-06 and
explicitly presents reCAPTCHA. It was not solved or bypassed. TMview rendered no
usable page in the available browser, and WIPO's earlier automation restriction
still applies. A human/compliant interactive trademark check remains necessary.

Interactive trademark checks and final App Store name availability remain separate
release gates. The technical bundle ID and Codemagic project now exist, but no
store record, provisioning profile or TestFlight upload has been created for this
app. Broad publication approval does not establish trademark clearance
or replace a physical iPhone test.

### Current authorization and production update — 2026-09-05

The user confirms Apple account/verifications are complete (another app is already
live) and that they can receive messages at `support@adrez.dev`. Do not ask them
to repeat enrollment or mailbox-access verification. AHA-specific App Store,
bundle/signing and Codemagic records are still required after final-name approval.

The user explicitly authorized updating/deploying the AHA Rooms backend and
publishing AHA privacy/support pages on their root website, `adrez.dev`. This
supersedes older deployment gates below for these exact targets. It does not
authorize merging/pushing AHA's `main`, touching retired Workers, or selecting a
final name without the requested brainstorming/approval.

Rooms was deployed from `ios-app` as version
`20ee6760-960a-407d-a518-1e16146173f1`. Previous production version, recorded for
rollback: `89391e5b-2d99-4efc-85c0-b4175934bd7c`. The 39 Rooms tests and Wrangler
dry run passed before deployment. A live test then verified health, exact native
CORS, rejection of an untrusted origin, room lookup through the existing live web
proxy, and three disposable players using both the live web WebSocket proxy and
the native-origin direct endpoint. They completed INTRO → ANSWERING → GUESSING →
REVEAL → FINALE and returned to LOBBY without protocol errors. Test clients sent
Leave before closing. This is server/protocol evidence, not a signed iPhone test.
The live AHA web Worker was not redeployed; its existing UI is preserved.

Root website found at `/Users/nicklasandreasen/adrez.dev`, Astro/Cloudflare Pages
project `adrez-personal`. Its existing untracked `AGENTS.md` is user-owned and was
not staged. AHA support/community pages now have Danish and English source routes:
`/aha/support`, `/aha/community-rules`, `/aha/en/support`,
`/aha/en/community-rules`. Root source commit: `891aee7d0601adc594e02e7b9951e07aa54ecdf1`.
All 30 root tests and the static build passed. Browser checks at 390px and 1024px
verified all four routes, document language, canonical URLs, contact links, one
main heading and no horizontal overflow; phone screenshot inspected manually.
Root GitHub push remains gated by that repository's explicit post-commit approval
instruction; direct Pages deployment is authorized separately.
The static Pages deployment completed successfully at
`https://7cab9dc3.adrez-personal.pages.dev`, targeting production branch `main`
of the root-site Pages project only. It does not involve AHA's `main` branch.

Privacy is not published yet. The user has been asked which mailbox provider
receives support email and whether daily report checks, a 48-hour reply target,
and deletion within 90 days after resolution are feasible. Do not invent their
answer or publish the draft's placeholders. Account inspection before deployment
found Rooms Logpush disabled, no tail consumers and no explicit observability
setting; this does not prove all Cloudflare infrastructure records have no
retention. Public policies must still resolve infrastructure and support facts.

Final naming remains open. The current ASO brainstorm compares Svarspor,
Hvem mon?, and Bag svaret. No final App Store record or name-dependent assets
were created in this deployment step.

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
  also a manual-only Codemagic workflow, but still no App Store record or
  AHA-specific signing setup.

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

Reverified again after the solo reviewer path, code-side accessibility pass, and
universal-link listener preparation:

- `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings.
- `pnpm test`: passed, 259 tests total (shared 135, web 87, rooms 37).
- Playwright: all 11 specs passed under four parallel browser workers on isolated
  local servers, including the complete solo reviewer journey and the existing
  multiplayer, safety, short-viewport, iPad, cadence, and leaver regressions. The
  reviewer journey runs with Reduce Motion enabled and asserts focus at every game
  phase transition.
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

`docs/ios-age-rating.md` now maps every current questionnaire category to shipped
code evidence. The conservative draft answers Yes for room-scoped UGC and messaging,
Infrequent for profanity/crude humor and the single bar reference, and Frequent for
the score-and-ranking contest present in every game. Apple's current tables therefore
suggest a global 13+ result, but the checklist remains open until App Store Connect
calculates the final global and regional ratings from the final binary/content.

## 9. Implementation sequence

Work through these phases in order, while parallelizing independent checks when safe.
Update this document as each phase completes.

### Phase A — safety, inventory, and identity

- [x] Create isolated `ios-app` branch and `/Users/nicklasandreasen/aha-ios` worktree.
- [x] Confirm clean baseline typecheck, unit tests, and web build.
- [x] Run baseline Playwright tests.
- [ ] Complete name/IP and App Store name availability research.
- [x] Obtain user approval for the final public name only when needed.
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
- [x] Add native safe-area/status-bar handling to every route and keyboard state.
- [x] Add only justified Capacitor plugins, browser fallbacks, and permissions.
- [ ] Add a real iOS app icon, polished launch screen, and final display name.
- [x] Add an AHA-specific app privacy manifest based on audited current behavior.
- [ ] Add universal links for `aha.adrez.dev/room/<code>` so app and web users share
  the same invite URL, with web fallback when the app is not installed.

The code-side safe-area and accessibility evidence, plus the deliberately open
physical-device checks, are recorded in `docs/ios-accessibility-audit.md`. Phase B's
safe-area implementation is complete; the physical iPhone, VoiceOver, Dynamic Type,
and Accessibility Inspector checks remain separate Phase E release gates.

Universal-link routing is prepared with the official Capacitor App plugin for both
cold and warm launches, a strict `aha.adrez.dev/room/<code>` parser, and rejection
tests. `docs/ios-universal-links.md` records the remaining identity-gated App ID,
entitlement, provisioning, AASA publication, production approval, and physical
device validation. The universal-links checkbox remains open until those steps are
complete.

The default Capacitor app icon and splash artwork have been replaced by
AHA-specific, opaque RGB assets with reproducible SVG sources. Their dimensions,
crop strategy, and remaining physical-device checks are recorded in
`docs/ios-native-assets.md`. This checklist item stays open only because the final
public display name is still gated and the new assets still need physical native
inspection.

### Phase C — backend and review compliance

- [x] Allow intentional native HTTPS/WSS transport without broadening trust globally.
- [x] Add rate limits and brute-force protections.
- [ ] Implement UGC filtering, reporting, blocking/hiding, host removal/room banning,
  and support escalation.
- [x] Add the solo practice/reviewer path.
- [ ] Add unit/integration/e2e tests for native origin, cross-platform room play,
  abuse controls, reconnects, and the full reviewer journey.
- [ ] Draft privacy, support, and community-rules pages under canonical URLs such as
  `https://adrez.dev/aha/privacy`, `/support`, and `/community-rules`.
- [ ] Do not deploy those pages or any Worker without explicit user approval.

Historical pre-deployment notes (deployment and live protocol checks completed
2026-09-05 as recorded at the top; signed-device checks remain):

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

The public WebSocket route now also checks Durable Object metadata before upgrading:
an unknown but format-valid code returns 404 and cannot let a first socket silently
create state outside the rate-limited room-creation endpoint. The web/native client
preflights room availability, presents a localized and focus-managed missing-room
state, waits for the socket to open before accepting a nickname, and uses the
existing reconnect overlay for genuine transport outages. Unit/integration tests
cover response validation and the non-materializing 404; the complete 12-scenario
Playwright suite covers both the missing-link state and ordinary multi-client play.

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

`docs/ios-privacy-policy-draft.md` contains matched Danish/English policy copy,
prepared from the data map and current Apple/European Commission/Datatilsynet
guidance on 2026-09-05. It is an internal publication draft with explicit fields
for controller contact details, purpose-specific legal bases, support retention/provider,
infrastructure retention/transfers, final name, and effective date. Do not publish
it with those fields unresolved. An accessible in-app link and final public URL
are still required; no public privacy route or production policy has been added.

On 2026-09-05 the user approved identifying the operator/data controller publicly
as **Nicklas Andreasen, known as Adrez**, an individual developer. Adrez is the
developer brand, not a registered company. Both policy languages now use this
identity. Do not ask for controller-name approval again. Contact verification,
the other policy facts above, and final app-name approval remain separate gates.

Support now includes a Danish/English action to delete all saved room logins from
the device. It requires confirmation, explains loss of reconnect/host access and
the separate lifetime of server content, and preserves language and local safety
preferences. Partial storage failures display an error. Unit tests cover multiple
and malformed saved entries, preservation of other data, and failed deletion/retry;
browser coverage checks cancellation, focus restoration, deletion, and persistence
after reload. Signed-device validation remains open.

Verified on 2026-09-05: all 95 web unit tests, workspace typechecking (zero
errors/warnings), the four safety browser scenarios, and a separate run of the
cleanup scenario in both Danish and English passed. The Cloudflare web build,
static mobile build, Capacitor sync, and app privacy-manifest lint also passed.

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
- [x] Create an AHA-specific `codemagic.yaml` based on the proven Vildsvar pattern.
- [ ] Reuse the user's existing Apple Developer membership and App Store Connect API
  credentials securely; never commit or print secrets.
- [ ] Register the unique App ID/bundle ID, distribution certificate, and App Store
  provisioning profile for AHA.
- [ ] Add AHA as a separate Codemagic app/workflow. Do not reuse Vildsvar's App Store
  record or provisioning profile.
- [ ] Build, upload, and process the first TestFlight build.

The root `codemagic.yaml` now contains a manual-only `aha-testflight` workflow
adapted to AHA's paths, pnpm 10.14 pin, Xcode 26.6, privacy-manifest validation,
and current provisional `dev.adrez.aha` bundle identifier. It references the
existing account-level App Store Connect integration but contains no credentials.
Do not start it until that bundle identifier is approved and registered, AHA's
own signing files exist, and the repository has been added as a separate AHA
Codemagic application.

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

Run 33637981195 passed the complete pipeline for solo-reviewer commit `fb437d0`.
Both Xcode builds, the privacy-manifest check, iPhone and iPad launches, and evidence
upload succeeded. The retained screenshots were reviewed manually: both device
classes render the full landing UI with correct safe-area clearance, and the iPad
keeps the tablet-scale composition. Focused logs contain only expected simulator,
WebKit privacy-list, text-input, and XPC diagnostics; there is no app crash or
uncaught JavaScript failure.

Run 33639995088 passed the complete Xcode 26.6 pipeline for accessibility commit
`3123851`: both builds, privacy-manifest validation, simulator launches, and
evidence upload succeeded. Its iPhone and iPad captures were inspected manually
and retain the correct full landing layouts and safe-area clearance. The focused
logs contain no crash, fatal exception, or uncaught JavaScript failure.

Run 33675599632 passed the complete Xcode 26.6 pipeline for universal-link routing
commit `4418d29`: Capacitor synced the App plugin, both native targets compiled,
and the iPhone and iPad launch/content assertions passed. The retained captures
were inspected manually and show the complete, correctly scaled landing UI with
safe-area clearance on both device classes. Neither focused log contains a crash,
fatal exception, uncaught JavaScript failure, or unhandled exception.

Run 33677252475 passed the complete pipeline for native-artwork commit `5fc711f`.
Its new dimensions/alpha guard accepted the opaque 1024x1024 icon and 2732x2732
launch asset before both Xcode builds compiled the catalogs. iPhone and iPad
launch/content assertions and evidence upload also passed; the settled captures
retain the complete landing composition and safe-area clearance, and the focused
logs contain no crash, fatal, uncaught, or unhandled exception. The transient launch
image and installed icon still require physical-device inspection as documented in
`docs/ios-native-assets.md`.

### Phase E — device-quality validation

Run 33961826814 passed the complete Xcode 26.6 pipeline for room-recovery and
saved-login cleanup commit `a2ca6f5` on 2026-09-05. Both native targets compiled,
artwork and embedded privacy-manifest checks passed, and iPhone/iPad launch
guards and evidence upload succeeded. Both retained screenshots were inspected:
the complete landing page is visible, the iPad retains its tablet composition,
and controls remain clear of native safe areas. Focused logs contain simulator
WebKit privacy-database/list, text-input, and XPC diagnostics, with no crash,
fatal exception, or uncaught/unhandled JavaScript failure. These are launch
checks, not signed-device gameplay or production-interoperability evidence.

- [ ] Test full flow on a physical iPhone.
- [ ] The user has no iPad; use hosted iPad simulator tests, screenshots, layout
  assertions, and a Codemagic/GitHub-hosted native compile as the iPad evidence.
- [ ] Verify status-bar/notch/home-indicator safety and software-keyboard states.
- [ ] Verify actual web-to-iOS and iOS-to-web room interoperability.
- [ ] Verify offline/network loss/reconnect behavior and human-readable errors.
- [ ] Verify VoiceOver labels, Dynamic Type where feasible, contrast, 44pt targets,
  Reduce Motion, and non-color-only state communication.
- [ ] Confirm no greyed-out or empty-looking primary states in marketing captures.

Code-side network-loss coverage now includes exponential WebSocket reconnect,
re-authentication on every replacement socket, queued-message ordering, permanent
caller shutdown, a delayed localized outage overlay, REST room preflight, and a
focused missing-room UI. The Phase E network checkbox remains open for airplane-mode,
Wi-Fi/cellular transition, background/foreground, room-expiry, and recovery checks
on a signed physical iPhone against the deployed backend.

Room availability preflight now aborts after ten seconds, including a stalled
response-body read, so a hanging mobile request cannot indefinitely prevent socket
recovery or leave the landing-page join action busy. Regression tests cover both
stall stages and timer cleanup. On 2026-09-05, all 266 unit/integration tests passed
(shared 135, web 92, Rooms 39), workspace typechecking passed with zero errors or
warnings, and the static mobile build and Capacitor iOS sync passed. All 12
Playwright scenarios passed on isolated ports 5187/8797, including the complete
reviewer/multiplayer journeys and the author-leaving-mid-round regression.
Local `/usr/bin/git` currently fails
because the Command Line Tools installation lacks `xcrun`; the worktree HEAD was
verified directly as `refs/heads/ios-app`, and the existing Dulwich installation at
`/private/tmp/aha-dulwich` was used for read-only status/diff inspection. Existing
uncommitted iOS changes were preserved.

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
- Capacitor App API: <https://capacitorjs.com/docs/apis/app>
- Capacitor Universal/App Links guide: <https://capacitorjs.com/docs/guides/deep-links>

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
6. Treat the local security, UGC-safety, solo-reviewer, safe-area/accessibility,
   universal-link listener, and Codemagic workflow implementations as code-complete
   but not production-verified. The signed universal-link entitlement and AASA file
   remain identity/deployment-gated. Continue name-independent native polish and
   release documentation without deploying production or creating name-dependent
   store records prematurely.
7. Continue autonomously through all reversible work. Ask the user only when final
   name approval or another genuinely user-only action becomes the critical path.
