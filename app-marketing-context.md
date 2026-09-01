# AHA app marketing context

Last updated: 2026-09-01 (Europe/Copenhagen)

This document is the shared marketing context for ASO and launch work. Public
identity is intentionally provisional until the name/IP gate is approved.

## App Overview

- **Working app name:** AHA
- **Recommended public candidate:** `Svarspor: Gæt dine venner`
- **Apple app ID:** Not created
- **Bundle ID:** `dev.adrez.aha` (provisional local configuration only)
- **Recommended primary category:** Games — Trivia
- **Recommended secondary category:** Entertainment
- **Platform:** Universal iPhone/iPad, interoperable web version
- **Price model:** Free for 1.0; no ads or purchases
- **Launch date:** Not yet launched; flexible after the release candidate is stable
- **Current version:** 0.1.0 pre-release

## Value Proposition

- **Problem:** Familiar party games often make one person perform while others
  wait, or rely on generic dares that do not become more fun with close friends.
- **Target audience:** Danish friend groups, families, classmates, colleagues,
  and game-night groups of 3–16 people who are together or can each open a phone
  or browser.
- **Unique differentiator:** Everyone answers first, answers are anonymous during
  guessing, and the fun comes from recognizing the people in the room. The same
  private room works across iPhone, iPad, and web without accounts.
- **Elevator pitch:** Svar anonymt i runden, gæt hvem af dine venner der skrev
  svaret, og se hvor godt I egentlig kender hinanden.

## Competitors

| App | Apple ID | Strengths | Weaknesses / AHA opportunity |
| --- | --- | --- | --- |
| Double Blind: The Game | 6754299900 | Closest anonymous-answer concept; room codes; iPhone and iPad | English only in Denmark; 18+ positioning; no author-guessing score loop |
| Exposed — Who's Most Likely To | 1553777064 | Strong social proof; multiplayer PIN; clear friend-reveal hook | iPhone only; English; 16+; subscription-heavy; tracking disclosure |
| PartyPal: Festspil — Partyspil | 1284471058 | Danish; broad party-game library; strong ratings footprint | 18+ drinking-game position; broad rather than focused; IAP |
| Party Up danske fest spil | 1620838428 | Danish localization; iPhone/iPad; 600 Danish-store ratings | 16+ and challenge/secret positioning; subscription; less distinctive core loop |
| Buddies: Festspil Quiz | 1615045598 | Multiplayer PIN; “what friends think” positioning | iPhone only; broad dares/challenges; tracking disclosure |

## Current ASO State

- **App Store record:** None
- **Title/subtitle/keyword field:** Not locked
- **Ratings/rankings:** None; pre-launch
- **Provisional title:** `Svarspor: Gæt dine venner` (25/30 characters)
- **Provisional subtitle:** `Festspil med venner` (19/30 characters)
- **Core Danish search themes to validate later:** festspil, selskabsspil,
  venner, gæt hvem, spørgsmål, spilleaften

## Goals

1. **Release quality:** Complete App Review, moderation, privacy, accessibility,
   and interoperability gates before submission.
2. **Activation:** Establish baselines for product-page conversion, first room
   join/create, and first completed game after launch; do not invent targets
   before data exists.
3. **Reliability and repeat use:** Measure crash-free sessions, successful joins,
   completed games, reconnect success, and another session within 7/30 days.

## Resources

- **Budget:** No fixed paid budget; organic-first launch
- **Team:** Indie/solo owner with Codex implementation support
- **Infrastructure:** Existing Svelte/Cloudflare multiplayer product, Apple
  Developer membership, GitHub Actions, Codemagic, hosted Xcode
- **Analytics:** None added for the checklist alone; use privacy-minimizing events
  only if a concrete decision requires them
- **Constraints:** Current Mac cannot run the required full Xcode; no production
  deployment without explicit approval; final public name is a user decision

## Markets

- **Primary:** Denmark
- **Secondary:** English-speaking markets after the Danish listing and product
  prove stable
- **Languages:** Danish primary; English supported in-app

## Positioning Guardrails

- Say “anonymt i runden,” not globally anonymous: authors are revealed later to
  the private room.
- Lead with the author-guessing loop, not a generic collection of party prompts.
- Treat cross-platform rooms, no accounts, and free 1.0 as proof points.
- Do not position it as a drinking/adult game unless shipped content changes.
- Keep the public title distinct from AhaGuess and Aha World.

## Recommended Next Skills

- `keyword-research` after the public name direction is approved
- `metadata-optimization` after keyword evidence exists
- `screenshot-optimization` and `app-icon-optimization` after the identity is locked
- `app-launch` once a stable release candidate and review path exist
