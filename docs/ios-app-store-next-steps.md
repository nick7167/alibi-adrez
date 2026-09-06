# Hvem mon? — App Store setup

Updated 2026-09-06. Flexible, organic-first launch; beta before public review.
No advertising spend, new analytics SDK, outreach or pre-order is needed for this
technical release step. The app-launch skill informs this staged checklist.

## Completed

- Public support, privacy and community pages are deployed on adrez.dev.
- Approved root-site source commit `ef41c37` is pushed.
- Apple API and Codemagic account access are verified.
- Apple bundle ID `dev.adrez.aha` is registered (description `Hvem mon`).
- Apple App Store profile `Hvem mon App Store` is active for `dev.adrez.aha`,
  reusing the valid account-level distribution certificate linked to Vildsvar.
  The Vildsvar profile and certificate were not modified. The user's screenshot
  confirms the Codemagic import and green matching-certificate indicator.
- Separate [Codemagic application](https://codemagic.io/app/6a9ca41794d126108b294467)
  exists, linked to the correct repository, with no scheduled builds.
- Hosted Xcode run `33997799689` passed native compilation and iPhone/iPad launches;
  both screenshots were inspected.

## Interactive checks before the final store record

The owner already approved the name. The remaining task is checking rights, not
choosing a name again. Search `Hvem mon`, `Hvem mon?` and similar party-game/software
names in [PVSonline](https://onlineweb.dkpto.dk/pvsonline/),
[TMview](https://www.tmdn.org/tmview/) and
[WIPO](https://www.wipo.int/en/web/global-brand-database), including classes 9, 28
and 41. Preserve relevant results for assessment. These sites required interactive
access or blocked automation; no CAPTCHA was bypassed. Search results alone are
not a legal guarantee. Relevant conflicts require review before proceeding.

Once this gate is resolved, use App Store Connect → Apps → + → New App:

| Field | Prepared value |
| --- | --- |
| Platform | iOS (the build supports iPhone and iPad) |
| Name | Hvem mon? Gæt dine venner |
| Primary language | Danish |
| Bundle ID | dev.adrez.aha |
| SKU | hvemmon-ios-001 |
| User access | Full Access, unless the owner needs a specific restriction |

SKU is a proposed internal identifier, not an existing record. Apple checks name
availability when creating the record. Do not silently choose another title if it
is unavailable. API access is available, but no authenticated interactive Apple
session is available to this agent. See
[Apple's new-app instructions](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app).

## Signing and first beta

1. Certificate association is confirmed by the user's green Codemagic indicator.
   Do not revoke existing certificates or copy another app's profile.
2. The separate `Hvem mon App Store` profile is imported as
   `hvemmon-app-store-profile`, bundle `dev.adrez.aha`. No further fetch is needed;
   the signed build must still prove the complete signing configuration.
3. Confirm the existing account-level `vildsvar-app-store-connect` integration is
   available to this new Codemagic project. Its name is historical; the bundle,
   profile and App Store record must belong to Hvem mon?.
4. Select branch `ios-app`, workflow `aha-testflight`. Before starting, confirm the
   app record exists, profile matches, final artwork is ready, and source is pushed.
   No automatic App Store review submission is configured.
5. Build and upload; wait for Apple processing. Confirm the processed build's
   bundle ID, version, encryption status and internal TestFlight availability.
6. Owner installs on a physical iPhone and tests a complete mixed iOS/web game,
   reconnect/backgrounding, links, moderation, report email and saved-login removal.
   External beta testing may require Beta App Review.

## Before public review

- Final icon/splash artwork still needs the approved-brand pass.
- Compare the promotional captures in `app-store/` with the signed candidate,
  upload the final images, and enter prepared DA/EN metadata.
- Complete accurate privacy, content-rights, age-rating and review-contact answers.
- Confirm moderation/support operations and physical iPhone results.
- Submit only after all release gates pass. Public release date remains flexible.

Initial success criteria are a processed/installable beta and a completed mixed
native/web game without blockers. Establish real download/conversion/retention
baselines after launch; no fabricated targets or ratings requests tied to rewards.
