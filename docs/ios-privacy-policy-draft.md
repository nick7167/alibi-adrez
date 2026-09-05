# AHA privacy policy — publication draft

Prepared 2026-09-05 from `docs/ios-privacy-data-map.md` and the `ios-app`
implementation. Internal draft only: this file is not a public policy, and its
existence does not complete the privacy release gate. AHA is the working name.

## Facts required before publication

Replace every bracketed field in both languages with verified public information.
Do not copy private handoff values into this file without authorization to publish
them. Resolve these items before adding the policy route or App Store URL:

- Public controller identity and contact details; assess whether a representative
  or data protection officer needs to be identified.
- Legal basis for each purpose: running the game, abuse prevention, and handling
  support/reports. Document the assessment, including any legitimate interests,
  instead of treating use of the app as blanket consent.
- Cloudflare account logging, retention, processors, locations, and applicable
  international-transfer safeguards. A 60-second rate-limit window is not proof
  that all infrastructure records disappear after 60 seconds.
- Support mailbox provider, verified access, handling process, retention period
  or criteria, and deletion procedure. A sent email is separate from a room.
- Final public name, effective date, and canonical policy URL. Confirm that the
  public backend actually has the behavior described below.

Publication must include an accessible in-app link and the same URL in App Store
Connect. Apple's policy requirements cover data use, sharing, retention, and
deletion. [App Review Guidelines, 5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)

Use the final data map to reconcile App Privacy separately; short-lived room
storage must not automatically be described as “Data Not Collected.”
[Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

The missing legal-basis and rights fields follow the official guidance on lawful
processing and individuals' rights. These sources do not establish AHA's actual
account settings or determine its legal basis.
[European Commission](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en),
[Datatilsynet](https://www.datatilsynet.dk/borger/hvad-er-dine-rettigheder)

## Dansk

### Privatliv i AHA

Gælder fra: [DATO]. Dataansvarlig: [OFFENTLIGT NAVN OG KONTAKTOPLYSNINGER].
Spørgsmål om dine oplysninger: [BEKRÆFTET KONTAKT].

AHA er et spil i private rum. Du behøver ikke oprette en konto. Du vælger et
spillernavn og en emoji og kan skrive svar på spillets spørgsmål. Brug gerne et
kaldenavn, og undgå følsomme oplysninger om dig selv eller andre.

### Oplysninger, vi bruger

For at drive et rum behandler vi dit spillernavn, din emoji, et tilfældigt
spiller-id, dit sprogvalg og de oplysninger, der gør det muligt at vende tilbage
som samme spiller. Vi behandler også rumkode, indstillinger, spørgsmål, svar,
gæt, point og spillets forløb. Forbindelserne til spilserveren er krypterede.

De andre spillere i rummet kan se dit navn og din emoji. Når et svar vises i
gætterunden, er forfatteren skjult; bagefter afslører spillet, hvem der skrev
det. Gæt og resultater vises som en del af spillet. Svarene er derfor ikke
permanent anonyme. Andre deltagere kan selv kopiere eller tage billeder af det,
de ser.

Cloudflare leverer vores spilserver og behandler netværkstrafikken. AHA bruger
en hash af forbindelsens IP-adresse til at begrænse gentagne forespørgsler.
[INDSÆT BEKRÆFTEDE INFRASTRUKTUROPLYSNINGER, FORMÅL OG OPBEVARING].

AHA indeholder ingen reklame-, analyse- eller crashrapporterings-SDK'er. Vi
bruger ikke spiloplysninger til at følge dig på tværs af andre virksomheders
apps eller hjemmesider til reklameformål.

### Support og rapporter

Når du vælger at rapportere en spiller eller et svar, åbner AHA en mailkladde
med relevant rum- og spilindhold. Du kan ændre kladden og bestemmer selv, om
den skal sendes. Hvis du sender den, behandler vi din mailadresse, beskeden og
det indhold, du medsender, for at håndtere henvendelsen. Din mailudbyder og
[SUPPORTMAILENS UDBYDER] behandler også mailen.

### Opbevaring og sletning

Spilserveren er indrettet til at slette rummets aktive data ti minutter efter,
at alle spillere har mistet forbindelsen. Hvis nogen forbinder igen inden da,
fortsætter rummet. Spillets svar, gæt og resultater nulstilles, når spillerne
vender tilbage til lobbyen. Når du bruger Forlad spillet, fjerner spilserveren
din spillerprofil og dine egne svar fra rummet.

Din enhed gemmer rumlogin, så du kan vende tilbage efter at have lukket appen.
På Support kan du vælge Slet gemte rumlogin. Du mister dermed adgangen til at
vende tilbage som samme spiller, også hvis du var vært. Sletningen gælder denne
enhed og sletter ikke rummets data eller sendte mails. Forlad aktive spil og luk
andre faner med AHA først. Sprogvalg samt skjulte spillere og svar bevares lokalt;
de kan fjernes ved at rydde appens eller webstedets data på enheden.

Supportmails opbevares [PERIODE ELLER KONKRETE KRITERIER OG SLETTEPROCEDURE].
Tekniske infrastrukturdata opbevares [BEKRÆFTET PERIODE ELLER KRITERIER].

### Grundlag, modtagere og dine rettigheder

[INDSÆT RETSGRUNDLAG FOR HVERT FORMÅL OG EVENTUELLE LEGITIME INTERESSER].
[INDSÆT BEKRÆFTEDE MODTAGERE, LANDE OG EVENTUELLE OVERFØRSELSGARANTIER SAMT
HVORDAN DER KAN FÅS EN KOPI].

Afhængigt af behandlingen kan du have ret til indsigt, rettelse, sletning,
begrænsning, indsigelse og dataportabilitet. Kontakt os via [BEKRÆFTET KONTAKT].
Hvis en behandling bygger på samtykke, kan du trække det tilbage for fremtiden.
Du kan klage til [Datatilsynet](https://www.datatilsynet.dk/).

Vi kan have brug for rumkode og tidspunkt for at finde oplysninger om en
henvendelse. Send aldrig dit login eller din hemmelige adgang til rummet til
support. Vi kan ikke genskabe rumindhold, som allerede er slettet fra den
aktive spilserver.

## English

### Privacy in AHA

Effective date: [DATE]. Controller: [PUBLIC NAME AND CONTACT DETAILS].
Questions about your information: [VERIFIED CONTACT].

AHA is a game played in private rooms. You do not need an account. You choose
a player name and emoji and can write answers to the game's questions. You
can use a nickname; avoid sensitive information about yourself or others.

### Information we use

To run a room, we process your player name, emoji, random player ID, language,
and credentials that let you return as the same player. We also process the
room code, settings, questions, answers, guesses, scores, and game progress.
Connections to the game server are encrypted.

Other players in the room can see your name and emoji. During guessing, the
author of the displayed answer is hidden; afterwards the game reveals who
wrote it. Guesses and results are displayed as part of the game. Answers are
therefore not permanently anonymous. Other participants can independently copy
or take pictures of what they see.

Cloudflare hosts our game server and processes network traffic. AHA uses a hash
of the connection's IP address to limit repeated requests.
[INSERT VERIFIED INFRASTRUCTURE DATA, PURPOSES, AND RETENTION].

AHA includes no advertising, analytics, or crash-reporting SDKs. We do not use
game information to track you across other companies' apps or websites for
advertising.

### Support and reports

When you choose to report a player or answer, AHA opens an email draft with
relevant room and game content. You can edit the draft and decide whether to
send it. If you send it, we process your email address, message, and included
content to handle your request. Your email provider and [SUPPORT MAIL PROVIDER]
also process the email.

### Retention and deletion

The game server is configured to delete active room data ten minutes after all
players disconnect. Reconnecting before then keeps the room alive. Game answers,
guesses, and results reset when players return to the lobby. Choosing Leave game
removes your player profile and your authored answers from the room.

Your device saves room logins so you can return after closing the app. Choose
Delete saved room logins on Support to remove them. You lose access to return
as the same player, including as host. This applies to this device and does not
delete room content or emails you sent. Leave active games and close other AHA
tabs first. Your language and hidden players and answers remain stored locally;
you can remove them by clearing the app or website data on your device.

Support emails are retained [PERIOD OR SPECIFIC CRITERIA AND DELETION PROCESS].
Technical infrastructure data is retained [VERIFIED PERIOD OR CRITERIA].

### Grounds, recipients, and your rights

[INSERT LEGAL BASIS FOR EACH PURPOSE AND ANY LEGITIMATE INTERESTS].
[INSERT VERIFIED RECIPIENTS, COUNTRIES, ANY TRANSFER SAFEGUARDS, AND HOW TO
OBTAIN A COPY].

Depending on the processing, you may have rights to access, correction, deletion,
restriction, objection, and portability. Contact [VERIFIED CONTACT]. Where
processing relies on consent, you can withdraw it for future processing.
You can complain to [Datatilsynet](https://www.datatilsynet.dk/).

We may need the room code and approximate time to locate information relevant
to a request. Never send your login credentials or secret room access token to
support. We cannot reconstruct room content already deleted from the active
game server.
