# AHA iOS App Review notes (draft)

Status: code-side draft for the `ios-app` branch as of 2026-09-02. Do not paste
this into App Store Connect until the production backend, public URLs, support
mailbox, signed build, and final public app name have been verified.

## Review access

AHA does not require an account, login, purchase, location, or special hardware.
The normal multiplayer game uses a four-character private room code and requires
at least three people. A public, production-safe solo path is included so a single
reviewer can evaluate the complete app without additional devices:

1. Launch the app and tap **Create room**.
2. Choose any nickname and avatar, then enter the lobby.
3. Tap **Practice with 2 bots**. In Danish the action is **Øv med 2 bots**.
4. Answer the three displayed prompts and tap the hand-in action.
5. When an answer written by a bot appears, choose who you think wrote it. Bot
   guesses are automatic. The game continues through reveal, an intermediate
   standings screen, and final standings.
6. Tap **Back to lobby** after the finale. The two generated participants are
   labeled **Bot** and can be used to inspect the participant safety controls.
7. Tap the X in the lobby to leave the room and return home.

This is not a prerecorded or mock demo. It uses the shipped WebSocket protocol,
Durable Object room state, normal timers, scoring, reconnect handling, and the
same UI as a multiplayer game. Reloading or backgrounding during the answering
phase reconnects the same room identity and restores answers already sent to the
server. If a real person joins a finished practice lobby, the generated bot seats
are removed before the ordinary multiplayer lobby continues.

## User-generated content and safety

The only user-generated content is a player's chosen nickname and short answers
shared inside a private room. The server rejects a deterministic set of clearly
objectionable Danish and English terms before a nickname or answer enters room
state.

- On a participant row, tap the ellipsis to hide/show that participant locally,
  prepare a report email, or—when reviewing as host—remove them from the room.
- On an answer card during guessing or reveal, tap the ellipsis to hide/show the
  answer locally or prepare a report email.
- Reports open a localized, prefilled email addressed to `support@adrez.dev`. The
  user reviews and sends it from their mail app; opening the action does not send
  data silently.
- Host removal revokes the participant's current room session and closes active
  sockets. Because rooms are private and pseudonymous, this is a room-session
  removal rather than an account-level platform ban.
- Community rules and support are linked from the app's landing screen in both
  English and Danish.

Before submission, replace this paragraph with verified operational facts for the
support mailbox, response target, report retention/deletion, and final canonical
support/community URLs. Do not claim those operational controls are live from the
code alone.

## Room privacy and lifetime

Players are pseudonymous and no account profile is created. Answers are anonymous
to other players during guessing and attributed to their author only during the
reveal inside that room. The room backend stores the live nickname, answers,
guesses, scores, room/session identifiers, and reconnect-token hashes needed to run
the game. When the last socket disconnects, the room is scheduled for deletion
after ten minutes; reconnecting before then cancels that idle deletion timer.

The app contains no advertising SDK and no cross-app tracking. Final App Store
privacy answers must be reconciled against `docs/ios-privacy-data-map.md`, the
signed archive's aggregated privacy report, the deployed Cloudflare configuration,
and the published privacy policy before submission.

## Mixed web and native play

The iOS app and web app use the same room protocol and backend. A web player and an
iOS player can join the same code and complete the same game. Production review
notes should include the verified public web URL only after the native-origin
allowlist and both cross-platform directions have been tested against production.
