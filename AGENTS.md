# AHA iOS workspace instructions

Before doing any work in this workspace, read `IOS_APP_HANDOFF.md` in full.
If `IOS_APP_PRIVATE.local` exists, read it too, treat every value in it as private,
and never quote, commit, log, or upload its contents.

## Branch and deployment safety

- This worktree is exclusively for the iOS/App Store project and must remain on
  the `ios-app` branch.
- At the start of every session, verify both `pwd` and
  `git branch --show-current`. Stop if the branch is not `ios-app`.
- The original live web worktree is `/Users/nicklasandreasen/aha` and must remain
  on `main`. Do not make iOS changes there.
- Do not modify, merge into, push, force-push, rebase, or deploy `main` unless the
  user explicitly requests that exact action.
- A push to AHA's `main` automatically deploys both the `aha-web` and `aha-rooms`
  Cloudflare Workers. Treat any operation involving `main` as production work.
- Do not deploy the web app, Rooms backend, root `adrez.dev` site, DNS, or any
  Cloudflare resource unless the user explicitly requests that deployment.
- Do not touch the retired `alibi-*` Workers or the archived Alibi branches/tags.
- Do not perform destructive Git operations.

## Product and release requirements

- Preserve the existing Svelte UI, game rules, Danish/English localization, and
  Cloudflare Durable Objects architecture unless the user approves a change.
- The native app must remain interoperable with the web app: iOS and web players
  must be able to join the same room and complete the same game together.
- Treat App Store review, privacy, UGC moderation, security, accessibility,
  age-rating accuracy, and intellectual-property/name clearance as release gates.
- Do not blindly copy Vildsvar identifiers, App Store records, metadata, privacy
  answers, screenshots, certificates, or content decisions. Reuse the proven
  process and implementation patterns only after adapting them to AHA.
- The user's Mac cannot run a current full Xcode. Use hosted Xcode for native
  validation and Codemagic for signed App Store builds, as described in the handoff.
- Never commit API keys, `.p8` files, tokens, issuer IDs, phone numbers, or private
  handoff data.

## Working style

- Continue autonomously through safe, in-scope work. Do not stop for minor choices
  that can be resolved from code, official documentation, or reasonable defaults.
- Ask the user only when a decision or action is genuinely required to continue,
  such as approving the final public name, accepting an Apple agreement, completing
  an account verification challenge, or performing an explicitly gated production
  deployment.
- Verify changes in proportion to risk and keep this handoff current as work lands.
