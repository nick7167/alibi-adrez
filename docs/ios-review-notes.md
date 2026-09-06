# Hvem mon? App Review notes

Updated 2026-09-06. The owner requested removal of practice bots and approved
submission after testing. Use these notes with the new bot-free binary only.

## Review access

Hvem mon? is a private multiplayer party game for 3 to 16 players. There is no
account registration, login, purchase, advertisement or practice/bot mode.
One reviewer can control three independent sessions manually:

1. Launch the iOS app. Select EN on the home screen for English, if needed.
2. Tap Create room, enter a nickname and choose an avatar, then tap Enter.
3. Open https://aha.adrez.dev in two independent browser sessions, for example
   Safari and Chrome, or a normal window and a private window. Two ordinary tabs
   in the same profile share a saved identity and should not be used.
4. In each browser, choose Join room, enter the four-character code shown in the
   iOS lobby, and join with a different nickname.
5. On the iOS host, set Questions to 1 and Rounds to 3. Under timing settings,
   set Guess time to 60 seconds to allow time to switch between sessions.
6. Tap Start. In each session, type a different answer and tap I'm done.
7. In each guessing round, the author waits while the other two sessions select
   who they think wrote the displayed answer. If time expires, the round still
   advances. All sessions show the author reveal and scoring.
8. After the final round, tap Back to lobby to play again. Use the X to leave.

These are ordinary, publicly available multiplayer sessions. All players use the
same live backend and rules. There are no hidden reviewer credentials, special
room codes, automated opponents or review-only features.

## User-generated content and safety

Names and short written answers are shared only within an invited private room.
There is no public feed, random matchmaking or public chat. Authorship is hidden
during guessing and revealed afterwards inside the same room.

The server filters a deterministic set of objectionable Danish and English terms.
Participant menus allow local hiding, reporting and, for the host, removal from
the room. Answer menus allow hiding and reporting. Removal revokes the current
room session and closes its sockets; this is not an account-level ban.

Reports open an editable email draft addressed to support@adrez.dev. The player
chooses whether to send it using their configured mail app. Support and privacy
pages identify Nicklas Andreasen, known as Adrez, as the individual operator.
No unverified support response-time guarantee is claimed.

Community rules: https://adrez.dev/aha/en/community-rules
Support: https://adrez.dev/aha/en/support
Privacy: https://adrez.dev/aha/en/privacy

## Privacy and recovery

The service stores pseudonymous player identities, game content and hashed
reconnect credentials needed to operate the room. Room data is deleted ten minutes
after the last connection closes, unless a player reconnects first. Returning to
the lobby clears the previous game's answers and scores. Provider infrastructure
and support correspondence have separate retention described in the policy.

The app stores room logins locally for reconnecting. Support includes a confirmed
Delete saved room logins action. No advertising, analytics or tracking SDK is used.
Final App Privacy answers must match the audited data map before submission.
