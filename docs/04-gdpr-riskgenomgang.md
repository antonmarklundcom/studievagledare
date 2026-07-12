# 04 — GDPR-riskgenomgång

Specen (§6) beställer en egen riskgenomgång av arkitekturen med brister listade.
Målgruppen är barn 13–18 → förhöjda krav (IMY:s barnfokus, Schrems-frågor kring
tredjelandsöverföring, skolan som PUA). Riskerna nedan är rangordnade efter
sannolikhet × konsekvens. **Detta är teknisk analys, inte juridisk rådgivning —
en DPIA (konsekvensbedömning) med jurist krävs före skarp skoldrift, och den är
sannolikt obligatorisk: barn + profilering + stor skala träffar kriterierna.**

## Risk 1 — Fritext från barn innehåller känsliga uppgifter (HÖGST)

Intervjun bjuder in till öppenhet ("vad oroar dig?"). Barn KOMMER skriva om hälsa,
diagnoser (NPF är vanligt i målgruppen och direkt relevant för studieval!), familj,
religion, sexualitet. Det är särskilda kategorier (art. 9) — i chattloggar, i det
som skickas till Anthropic, och i det SYV läser.

**Åtgärder (delvis redan i designen):**
- Profilens `constraints`/`uncertainties` är enum-koder, inte fritext (docs/02).
  Modellen instrueras koda, inte citera.
- Intervju-systemprompten: styr bort från hälsodetaljer ("du behöver inte berätta
  mer — jag noterar att du vill ta hänsyn till det").
- Retention på `interview_messages` (6 mån efter avslut) — rådialogen är inte produkten.
- SYV-rapporten byggs ur den kodade profilen, ALDRIG ur rå chattext.
- **Kvarstående brist:** loggarna innehåller ändå det eleven faktiskt skrev fram till
  radering. Måste in i DPIA:n och PUB-avtalet; överväg art. 9-analys (sannolikt krävs
  uttryckligt samtycke eller att flödet designas så uppgifterna inte behandlas alls).

## Risk 2 — Anthropic som underbiträde / tredjelandsöverföring

AI-anropen går till Anthropics API (USA-bolag). Skolan som personuppgiftsansvarig
måste godkänna underbiträden; kommunala upphandlare frågar om tredjelandsöverföring.

**Åtgärder:**
- Pseudonymisering i prompten är redan spec-krav — schemat stödjer det
  (profil-JSON:en innehåller aldrig namn/e-post/skola; kommunkod är grövsta geodata).
  Enforcera med en `assertPseudonymous()`-vakt i `lib/ai/` som vägrar skicka payload
  som innehåller e-postmönster eller elevens visningsnamn.
- Teckna Anthropics DPA, verifiera zero-data-retention-villkor för API:t, och
  dokumentera SCC/adekvansläge som säljbilaga ihop med PUB-avtalet.
- **Brist i specen:** free-textmeddelanden går ändå till API:t (det är intervjuns
  natur) — pseudonymisering skyddar inte mot att eleven själv skriver "jag heter
  Alva och går på Björkskolan". Systemprompt + klient-side-hint ("skriv inte ditt
  namn") + acceptera restrisken i DPIA:n.

## Risk 3 — Vårdnadshavarlänken är en oautentiserad delning

`share_grants.kind='guardian_link'` = den som har länken ser rapporten. Länkar sprids.

**Åtgärder:** token är hashad i DB, länken har `expires_at` (kort, t.ex. 30 dagar),
visar en reducerad vy (inga chattutdrag), kan återkallas av eleven, och varje åtkomst
loggas i `activity_log`. Överväg PIN som eleven ger föräldern muntligt. **Restrisk
accepteras medvetet** — alternativet (förälderkonton) är fel komplexitet för v1.

## Risk 4 — Åldersgrinden är självdeklarerad

"Under 13 stoppas" bygger på att barnet anger rätt födelseår. Ingen verifiering finns
(BankID är Fas 3). Detta är branschstandard men ska erkännas i DPIA:n som känd
begränsning. Skollicensflödet mildrar: där sker onboarding via skolan som vet åldern.

## Risk 5 — k-anonymitet räcker inte ensamt

k≥5 på gruppstorlek hindrar inte utpekande via **kombination** av filter (skola +
årskurs + kön + "vill bli veterinär" = en person, även om skolan har 500 elever) eller
via **differens** mellan två dashboardvyer.

**Åtgärder:** (a) begränsa dimensionerna som får kombineras i dashboarden (hårdkodade
vyer, inte fri pivot), (b) k≥5 appliceras på VARJE cell efter filtrering, inte på
totalen, (c) materialisera aggregat i cron där för små celler aldrig skrivs (docs/02),
(d) kommunvyn visar bara skolnivå-aggregat som redan passerat k-filtret.

## Risk 6 — Radering vs. statistik och backuper

Hard delete + "anonymisering av aggregerad statistik" (spec) kolliderar med två saker:
FK-kedjor och backuper.

**Åtgärder:** aggregattabeller får aldrig FK:a mot `users` (räknare, inte rader).
Raderingsordning definieras i `lib/privacy/delete.ts` som EN transaktion: messages →
profiles → recommendations → interviews → consents/share_grants → user-raden
anonymiseras (e-post → `deleted-{id}@invalid`, status='deleted') så att `activity_log`
och aggregat förblir konsistenta utan att peka på persondata. Backup-retention (t.ex.
30 dagar) dokumenteras i integritetspolicyn — radering ur levande system sker direkt,
backuper roteras ut. `data_requests`-tabellen ger spårbarhet för att begäran uppfyllts.

## Risk 7 — Betyg som "elevens egen inmatning"

Bra dataminimering, men betyg är fortfarande personuppgifter med integritetsvärde och
har eget samtycke i schemat (`grades_processing`). Se till att intervjun fungerar UTAN
betygsuppgift (förslagen blir bredare, gap-analysen visas som "fyll i betyg för att se
detta") — annars är samtycket inte frivilligt i GDPR-mening.

## Risk 8 — Skyddet av barnet, bortom GDPR

Inte en personuppgiftsrisk men en produktrisk specen missar: en AI som pratar med
ungdomar om framtiden kommer få meddelanden om ångest, press hemifrån, i värsta fall
självskada. **Krav:** systemprompten har en eskaleringsregel (empatisk hänvisning till
skolkurator/Bris med telefonnummer, aldrig rådgivning), och SYV-rapporten flaggar
"samtalet berörde mående" som samtalspunkt utan citat. Detta måste QA-testas explicit
före pilot.

## Risk 9 — Hostinger som infrastrukturbiträde

Delad hosting-miljö för barns personuppgifter kommer granskas i kommunupphandling.
Verifiera: datacenter-region (EU?), Hostingers DPA, kryptering at rest, vem som har
åtkomst. Om svaren är svaga är detta ett argument att flytta DB:n (inte hela stacken)
till EU-managed MySQL senare — arkitekturen låser inte fast oss (en `DATABASE_URL`).

## Brister i specen ur GDPR-perspektiv (sammanfattning)

1. Ingen DPIA nämns — den är sannolikt obligatorisk (barn + profilering + skala).
2. Art. 9-frågan (känsliga uppgifter i fritext) är obehandlad. Störst juridisk lucka.
3. Rättslig grund per flöde är ospecificerad: konsumentflödet (samtycke/avtal) vs
   skolflödet (skolans myndighetsuppgift/allmänt intresse → vi biträde) har OLIKA
   grunder och OLIKA raderingslogik. Datamodellen klarar det (licenskoppling finns),
   men policy och UI-texter måste skilja på dem.
4. Ingen incidentplan (72h-anmälan). Behövs som en sida i README före pilot.
5. Retention-tider saknas helt i specen — förslag definierade i docs/02/03.
6. "Dela med vårdnadshavare (länk)" nämns utan säkerhetskrav — löst ovan (Risk 3).
7. Web push (Fas 3) kräver eget samtycke — finns nu i consent-enumen.
