# AHA iOS privacy data map

Status: working release-gate document, based on the code on `ios-app` as of
2026-09-02. It is not yet a final App Store Connect declaration or privacy
policy.

Apple treats data as collected when it is transmitted off-device and retained
beyond what is needed to service the request in real time. Apple's current
definitions and disclosure rules are the source of truth:

- [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/)
- [App privacy reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy)

## Current data flow

The bundled Capacitor app opens HTTPS and WSS connections directly to the AHA
Rooms Worker. The Worker and its Durable Object are the only application
backend. There is no AHA account, contact upload, advertising SDK, analytics
SDK, crash-reporting SDK, payment SDK, or third-party social login.

One Durable Object stores one private room. Players enter a display name, choose
an emoji, and receive a random player ID plus a reconnect token. The server
stores only the reconnect token's hash. During a game it also stores the room
settings, language, question IDs, free-text answers, guesses, scores, ranks,
phase state, and timestamps needed to run that room.

The raw reconnect token, player ID, display name, and emoji are kept in the
WebView's local storage under a room-specific key. The locale is also kept in
local storage in the native build. These values remain on the device and are
not an additional App Store “collection” event, although the identity and
locale are sent to the room service when joining or reconnecting.

## Proposed App Store data-type mapping

This mapping deliberately treats the random player ID as linkable identity:
the room's other data is associated with it while the room exists, even though
AHA cannot connect it to an account or a person outside that room.

| Apple data type | AHA fields and reason | Linked to user | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Name | Player-entered display name; the UI permits a real first name | Yes, to the room player ID | No | App Functionality |
| User ID | Random player UUID and hashed reconnect credential | Yes | No | App Functionality |
| Gameplay Content | Room membership/code, settings, question IDs, answers, guesses, scores, ranks, and game progress | Yes, where player-specific | No | App Functionality |
| Other Data Types | Selected emoji/avatar, language preference, and the SHA-256 client-network key used by the edge rate limiter; keep this conservative unless App Store Connect guidance places a field elsewhere | Yes | No | App Functionality (security) |

The free-text answers are game UGC, so `Gameplay Content` is the better primary
classification than treating them only as generic free text. Any future
free-form report or support message is separate and would add `Customer Support`
and/or `Other User Content`; those flows do not exist yet and must not be
declared as current behavior.

Current code supports **no tracking**: data is not combined with third-party
data for advertising or measurement and is not shared with a data broker.

## Storage, visibility, and deletion

| Location | Stored data | Current lifetime and deletion |
| --- | --- | --- |
| Durable Object | Full room state, including pseudonymous identities and gameplay | Deleted ten minutes after all room WebSockets have disconnected. A reconnect cancels the pending deletion. |
| Durable Object | Answers, guesses, scores, ranks, and question state | Cleared when players return to the lobby; otherwise retained until the room object is deleted. |
| Durable Object | A player who explicitly leaves | Their player record, session hash, score, staging count, and authored answers are removed as part of the leave event. |
| iOS WebView local storage | Per-room player ID, raw reconnect token, display name, and emoji | Cleared on an explicit leave or an `UNKNOWN_PLAYER` response. It can otherwise survive app restarts, including after the server room expires. |
| iOS WebView local storage | Locale | Persists until changed or app storage is cleared. |
| Cloudflare Rate Limiting binding | SHA-256 hash of `CF-Connecting-IP` for room creation/access counters | Configured in 60-second windows. Verify whether Cloudflare retains any associated counter or request data beyond the active window. |

Names and emojis are visible to the other players in the same room. Answers are
shown according to the game rules; their authorship is hidden during guessing
and revealed for the active answer. Guesses and scoring are revealed by the
game. No room content is intentionally published outside the room.

All app-to-service traffic uses HTTPS/WSS. The backend stores a SHA-256 hash of
the reconnect token, not its raw value. The raw token remains on-device and is
sent only when reconnecting.

## Processors and unresolved infrastructure facts

Cloudflare processes the application traffic and hosts the Worker/Durable
Object. The application code does not log room content, player IDs, tokens,
answers, raw IP addresses, or diagnostics and does not install analytics or
crash reporting. The rate guard hashes Cloudflare's client-IP header in memory
and gives only the hash to edge-local 60-second counters. This code review
cannot establish what Cloudflare account-level request logs, rate-limit backing
systems, security products, or observability settings retain.

Before final declarations and policy wording, verify in the production
Cloudflare account:

- which Worker logs, traces, analytics, security-event logs, and request fields
  are enabled;
- whether source IP, user agent, approximate location, or diagnostics are
  retained and for how long;
- the applicable data location, subprocessors, and DPA terms;
- that no payload logging or long-lived debug tail is enabled for the Rooms
  Worker.

If retained infrastructure data meets Apple's definition of collection, add
the appropriate location, identifier, usage, or diagnostics types. Do not infer
“Data Not Collected” merely because application code has no logging calls.

## Native privacy manifests

Capacitor iOS 8.5.1 and CapacitorCordova 8.5.1 currently ship dependency
privacy manifests declaring no tracking, collected data types, tracking
domains, or required-reason API use. AHA currently has no native plugin beyond
the Capacitor shell. AHA's app-owned `PrivacyInfo.xcprivacy` declares the four
proposed types above, no tracking, and no required-reason API use. Hosted Xcode
must compile it into the app, and the final signed archive's aggregated privacy
report must still be reviewed; this is not copied from Vildsvar.

Re-audit this section whenever adding analytics, crash reporting, haptics,
sharing, network monitoring, report/support uploads, notifications, or another
native SDK.

## Release gates

- Confirm the Cloudflare facts above against the production account and current
  contracts/settings.
- Implement the required UGC filtering, reporting, blocking, host controls, and
  operational support path; extend this map before those features ship.
- Decide a user-facing way to clear stale local room identities, or document why
  explicit leave plus OS app-data controls are sufficient.
- Archive-validate AHA's own privacy manifest and review Xcode's aggregated
  privacy report.
- Reconcile the final App Store Connect answers, privacy policy, review notes,
  support workflow, and actual binary immediately before submission.
