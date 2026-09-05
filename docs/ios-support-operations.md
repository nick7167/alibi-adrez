# Hvem mon? — support and privacy operations

Updated 2026-09-06. Operator/data controller: Nicklas Andreasen, known as Adrez.
Public contact: support@adrez.dev. The user confirmed mailbox receipt and Gmail.
Read-only Cloudflare configuration verified that the exact support address routes
through Cloudflare Email Routing to a gmail.com destination. No destination
address, inbox messages or credentials were printed, committed or disclosed.

## Published policy and operator obligations

The user authorized publication. The public policy uses purpose-based retention,
not an unimplemented automatic 90-day deletion promise or a guaranteed 48-hour SLA.
The owner must put the policy into practice:

1. Review reports promptly and prioritize threats, exploitation, privacy exposure
   and sustained harassment. Daily checks and a 48-hour response target remain
   recommended operating goals, not verified staffing or advertised guarantees.
2. Request only the room code, approximate time and evidence actually needed.
   Never request reconnect tokens. Do not imply expired room content can be recovered.
3. Record whether a case needs specific follow-up and what evidence is necessary.
4. Delete resolved correspondence and unnecessary attachments when no follow-up
   need remains, including removing them from Trash when appropriate. Do not keep
   closed cases indefinitely for an unspecified possible future need.
5. Keep only relevant material longer for a specific security case, dispute or
   legal obligation, with a reason and review point. Gmail/provider backup deletion
   is not controlled by deleting a message from the active mailbox.
6. Verify the end-to-end in-app report email delivery before App Review. These
   procedures and a published page do not by themselves complete the UGC gate.

No messages were sent or deleted by this implementation. No inbox access or
automated email cleanup has been configured.

## Privacy assessment and limits

The game purpose is delivering the private room requested by the player: minimal
pseudonymous identity, game inputs and state are needed for scoring/reconnection.
The policy uses GDPR 6(1)(b) for that processing. Protection against abuse uses
6(1)(f): service availability and participant safety are the interests; limited
hash-based counters, private rooms, no advertising and short active-room retention
reduce interference. Support uses 6(1)(f), or 6(1)(b) when needed to provide the
game; specific legal obligations use 6(1)(c). No blanket consent is inferred.
This is the implementation assessment, not independent legal clearance; children's
interests, report operations and the final store declarations remain review gates.

Rooms inspection: Logpush disabled, no tail consumers, no explicit observability
object. Published wording describes those settings and the absence of application
payload logging without claiming that all provider infrastructure data vanishes.
Cloudflare and Google provider retention is separate from the ten-minute active-room
rule. No EU-only storage or fixed provider-log retention is promised. The root
site's existing Google Fonts request is disclosed separately from bundled game fonts.

Policy source: `/Users/nicklasandreasen/adrez.dev/src/data/aha-privacy.ts`.
Canonical URLs: `https://adrez.dev/aha/privacy` and `/aha/en/privacy`.

Sources checked on 2026-09-06:

- https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en
- https://www.cloudflare.com/cloudflare-customer-dpa/
- https://www.cloudflare.com/privacypolicy/
- https://policies.google.com/privacy?hl=en
- https://www.datatilsynet.dk/borger/hvad-er-dine-rettigheder
