# 01 — Teknisk arkitektur

## 1. Systemöversikt

```
                        ┌─────────────────────────────────────────────┐
                        │  Next.js 15 App Router (Hostinger Node.js)  │
                        │                                             │
  Elev/SYV/Admin ─────► │  /app/(portal)/…   statiska SEO-sidor (ISR) │
  (PWA, mobil)          │  /app/(app)/…      inloggad app (dynamisk)  │
  Googlebot ──────────► │  /app/api/…        API routes (allt AI här) │
                        └──────────┬──────────────────┬───────────────┘
                                   │                  │
                              Drizzle ORM        Anthropic API
                                   │             (server-side only)
                             MySQL (Hostinger)
                                   ▲
                                   │ upsert (idempotent)
                        tsx cron-scripts (Hostinger cron)
                                   ▲
              Skolverket API · UHR Excel · JobTech API · SCB PxWeb
```

En enda Node.js-slot, en MySQL-databas, inga externa tjänster utöver Anthropic.
Allt tillstånd ligger i MySQL; ingen Redis, ingen jobbkö.

### Kodstruktur (route groups skiljer publikа/app/api)

```
src/
  app/
    (portal)/                 # Publikt, SEO, ISR — ingen auth
      gymnasieprogram/[slug]/
      utbildning/[slug]/
      yrke/[slug]/
      hogskola/[slug]/
      jamfor/…
    (app)/                    # Inloggat, dynamiskt
      intervju/
      resultat/
      syv/
      skola/
      admin/
    api/
      interview/              # POST message, GET state, POST resume
      auth/
      report/
      handoff/                # SSO-token mot studiecoach.ai
      cron/                   # skyddade endpoints om cron-via-HTTP behövs
  db/
    schema.ts                 # Drizzle-schema (en fil, en källa till sanning)
    queries/                  # åtkomstlager, all scoped access här
  lib/
    ai/                       # Anthropic-klient, prompts, budgetvakt
    interview/                # fasmaskinen (ren TS, testbar utan LLM)
    recommend/                # kandidatgenerering + ranking
    privacy/                  # pseudonymisering, k-anonymitet, export/radering
  scripts/                    # tsx: import_skolverket.ts, import_uhr.ts, …
```

**Princip: API:t är UI-oberoende.** All affärslogik ligger i `lib/` och `db/queries/`
och exponeras via API routes med JSON in/ut. Server components anropar samma
query-funktioner direkt (inte via HTTP), men kontraktet i `/api` hålls komplett så
att en Expo-app i Fas 3 kan konsumera exakt samma endpoints. Zod-scheman för alla
API-payloads delas i `lib/contracts/` — det blir Expo-appens typkontrakt.

## 2. Intervjumotorn (rekommendation: hybrid fasmaskin + LLM-tool-calls)

Specen frågar: fritt LLM-samtal med tool-calls, eller state machine med
LLM-formulerade frågor? **Svar: en hybrid, med servern som ägare av förloppet.**

### Varför inte de rena alternativen

- **Fritt LLM-samtal** ger bäst samtalskänsla men: okontrollerbar kostnad (ingen övre
  gräns på turer), oförutsägbar täckning (modellen kan "glömma" fråga om geografi),
  svår QA (varje session unik), och risken att en 15-åring drar iväg samtalet off-topic
  är hög. Med Haiku-klass modell blir dessutom instruktionsföljsamheten över 20+ turer skör.
- **Ren state machine** (fasta frågor, LLM formulerar bara om) är förutsägbar och billig
  men känns som ett formulär i chattkostym — hela produktlöftet ("intervjuar eleven")
  faller. Följdfrågor ("varför tröttnade du på naturkunskap?") är där värdet skapas.

### Hybriddesignen

Servern äger en **fasmaskin** (ren TypeScript, testbar utan AI). Varje läge
(gymnasieval / högskola) definieras som en sekvens faser i en konfigfil:

```ts
// lib/interview/modes/gymnasieval.ts (illustration)
export const phases = [
  { id: 'warmup',    goals: [],                                   maxTurns: 2 },
  { id: 'interests', goals: ['interests', 'favorite_subjects'],   maxTurns: 6 },
  { id: 'strengths', goals: ['subject_strengths', 'grades_self'], maxTurns: 5 },
  { id: 'practical', goals: ['practical_vs_theoretical'],         maxTurns: 4 },
  { id: 'context',   goals: ['geography', 'constraints'],         maxTurns: 4 },
  { id: 'doubts',    goals: ['uncertainties'],                    maxTurns: 3 },
  { id: 'wrapup',    goals: [],                                   maxTurns: 2 },
] as const;
```

Per tur:

1. Servern bygger systemprompt av: aktuell fas + fasens mål + vilka profilfält som
   redan är ifyllda + de senaste N meddelandena (glidande fönster, inte hela historiken
   — profilen JSON är minnet, inte chatten).
2. LLM svarar eleven OCH anropar tool `update_profile(patch)` när den fångat något.
   Patchen valideras mot ett Zod-schema per fält innan den skrivs — modellen kan
   aldrig skriva skräp i profilen.
3. LLM kan anropa `advance_phase()` när fasens mål är uppfyllda; servern tvingar
   övergång vid `maxTurns` oavsett. Servern — aldrig modellen — avgör att intervjun är klar.
4. Hela det återupptagbara tillståndet = `(mode, phase_id, turn_count, profil-JSON)`
   i `interviews`-raden. Att återuppta = ladda raden, fortsätt. Inga in-memory-sessioner.

**Konsekvenser:** kostnadstak per intervju = Σ maxTurns × maxTokens (hård, beräkningsbar
gräns). Täckningsgaranti (faserna passeras alltid). QA per fas. Gästläget = samma motor
med en kortare faslista. Guardrail-prompten (håll dig till studievägledning, hänvisa
till kurator vid oro/mående — se docs/04 §8) ligger i systemprompten för varje tur.

### Modellval

- Intervjuturer: Haiku-klass. Kort systemprompt + fönster ≈ 2–4k input-tokens/tur.
- Rapport/rekommendationsmotivering: starkare modell, körs 1 gång per avslutad intervju.
- Modell-ID:n i env (`AI_MODEL_INTERVIEW`, `AI_MODEL_REPORT`). Aldrig hårdkodade.

### Kostnadsvakt (icke-funktionellt krav i specen)

Tabell `ai_usage` loggar tokens per anrop (user_id pseudonymiserad, model, in/out tokens).
`lib/ai/guard.ts` kollar före varje anrop: (a) per-användare-tak per dygn,
(b) global dygnsbudget i SEK (env `AI_DAILY_BUDGET`), (c) rate limit per IP för gäster.
Överskriden budget → intervjun pausas snyggt ("vi fortsätter imorgon") — ingen 500.

## 3. Rekommendationsmotorn & "RAG" inom MySQL

Specen frågar efter bästa RAG-arkitektur utan vektordatabas. **Svar: det här är inte
ett RAG-problem.** Kunskapsbasen är liten och strukturerad:

- 18 nationella gymnasieprogram + ~60 inriktningar (+ Gy25-varianter)
- några tusen högskoleutbildningar/utbildningstillfällen
- ~170 prognosyrken (AF), ~50 lärosäten

Detta är sökbart med SQL. Vektorsök tillför inget för behörighetskrav och poäng —
och specens kritiska regel ("AI:n får aldrig hitta på behörighetskrav") uppfylls
bäst genom att modellen **aldrig behöver återge fakta ur eget minne**.

### Pipeline (deterministisk kandidatgenerering → LLM-rankning)

```
elevprofil (JSON)
   │  1. Regelbaserad filtrering (SQL):
   │     mode, region, programtyp, hårda constraints (behörighet given betygsläge)
   ▼
kandidatlista (20–50 rader med ALLA fakta: krav, poäng, statistik, källa+datum)
   │  2. Heuristisk grovpoäng (TS): intressematch via taggar, geografi, gap-storlek
   ▼
topp ~15 kandidater
   │  3. LLM (stark modell, ETT anrop): rankar 3–7, skriver motivering per förslag.
   │     Prompten innehåller kandidaternas fakta som strukturerad JSON.
   │     Systemprompt: "Du får ENDAST referera fakta ur kandidatlistan."
   ▼
recommendations-rader: rank, motivering, program_id (FK!), snapshot av fakta + källa
```

- **Faktacitering i UI**: varje faktapåstående renderas från DB-fältet (inte ur
  LLM-texten) med `källa + hämtad-datum` från `data_sources`-tabellen. LLM-texten
  är bara motiveringen ("därför passar detta dig").
- **Snapshot i `recommendations`**: fakta fryses vid genereringstillfället så att
  rapporten är stabil även när kunskapsbasen uppdateras senare.
- **Gap-analysen** ("vad krävs härifrån") är ren TS-beräkning: elevens självskattade
  betyg/meritvärde vs `admission_stats` + behörighetskrav. Ingen AI alls.
- **Fulltext**: MySQL `FULLTEXT`-index på program-/yrkes-/utbildningsnamn + beskrivning
  används för den **publika söket** på portalen, inte för rekommendationerna.
  (OBS: kräver `innodb_ft_min_token_size=2` eller ngram-parser för korta svenska ord —
  verifiera vad Hostinger tillåter; fallback är `LIKE`-sök + trigram-kolumn.)
- **Embeddings senare (valfritt)**: om intressematchningen behöver bli mjukare kan
  embeddings lagras som JSON-kolumn och cosine beräknas brute-force i Node — vid
  <10k rader tar det millisekunder. Ingen vektordatabas behövs ens då. Inte Fas 1.

## 4. Gäst → konto-konvertering

Design för max konvertering utan att bryta GDPR (spec-fråga 4):

1. **Anonym start, noll friktion**: CTA på varje SEO-sida → intervjun startar direkt.
   En `guest_token` (slumpad, httpOnly-cookie via iron-session) skapas; `interviews`-raden
   har `user_id = NULL` + `guest_token`. Ingen e-post, inget namn efterfrågas.
2. **Åldersgrind före första frågan**: "Hur gammal är du?" — under 13 stoppas flödet
   (hård grind per spec). Endast födelseår lagras.
3. **Kortintervju**: gästläget kör en trimmad faslista (~7–8 turer, ~5 min).
4. **Teaser med äkta värde**: förslag #1 visas i sin helhet (motivering + fakta).
   Förslag 2–5 visas som låsta kort med programnamn synligt men motivering blurrad.
   Att #1 är äkta och bra är vad som säljer kontot — inte blurren.
5. **Kontoskapande = merge**: e-post + lösenord (bcrypt). Vid registrering flyttas
   intervjun+profilen till user-raden via guest_token, och samtycken registreras
   (rader i `consents`). Eleven fortsätter till fullängdsintervjun med gästsvaren
   redan i profilen — inget görs om.
6. **GDPR-hygien för gäster**: gästintervjuer utan konvertering hard-deletas efter
   30 dagar (cron). Ingen e-postinsamling före konto = inget nyhetsbrevs-gråzon.
   Intervjuprompten instrueras att inte be om namn/identifierare i gästläget.

Mätpunkter: start→klar kortintervju, klar→konto, konto→klar fullintervju (activity_log).

## 5. SSO/handoff mot studiecoach.ai

Spec-fråga 5. **Rekommendation: signerad engångstoken över HTTPS — inte delad
users-tabell, inte delad DB.**

Delad users-tabell = delad deploy-risk, låst migrationsordning mellan två produkter,
och blandat personuppgiftsansvar (skollicens-elever får inte läcka in i en
konsumentprodukts databas). Full OAuth-server är overkill för två egna appar.

```
Studievägledare                              studiecoach.ai
──────────────                               ──────────────
POST /api/handoff  (inloggad elev klickar)
  → skapa payload {
      sub: user_id (SV:s id),
      email, birth_year,
      profile_summary: {…pseudonymiserad delmängd…},
      goal: 'hp_plan' | 'study_plan',
      iat, exp: iat+300, jti
    }
  → signera HMAC-SHA256 med delad hemlighet (env, olika per miljö)
  → redirect: https://studiecoach.ai/onboarding?token=…
                                             verifiera signatur+exp,
                                             jti-replay-skydd (tabell),
                                             skapa/länka konto på email,
                                             förifyll onboarding
```

- Payloaden innehåller **bara det studiecoach behöver** (dataminimering) och skickas
  aldrig via query-loggbara GET utom som opak token med 5 min TTL.
- `external_ids`-tabellen i schemat lagrar kopplingen SV-user ↔ SC-user för framtida
  djupare integration, utan att låsa något nu.
- Samtycke: handoff sker endast på elevens klick och registreras i `consents`
  (`type = 'studiecoach_handoff'`).
- Detta mönster uppgraderas senare till riktig OAuth/OIDC om en tredje produkt tillkommer.

## 6. PWA, prestanda, deploy

- **PWA**: web app manifest + service worker med app-shell-caching (offline = skal +
  "du är offline"-vy; intervjun kräver nät, låtsas inte annat). Web push först i Fas 3
  — notisvärde före dess är noll och iOS-PWA-push kräver installerad app + tillstånd.
- **Portalen**: `generateStaticParams` + ISR (revalidate ~24h, on-demand revalidate
  från import-scripts via revalidate-tag när data ändrats). Hostinger kör Next
  standalone; ISR-cache på disk fungerar i en enda nodslot.
- **Appdelen**: dynamisk rendering, `Cache-Control: private`.
- **Cron**: Hostinger cron → `npx tsx scripts/import_x.ts`. Varje script är idempotent
  (upsert på källkod/slug), loggar till `import_runs`-tabellen (status, antal rader,
  fel) — det är vår enda observability för pipelinen, gör den bra.
- **Deploy**: git push → Hostinger build. Drizzle-migrationer körs som deploy-steg
  (`drizzle-kit migrate` i postbuild eller manuellt script — testa vad Hostinger
  tillåter; ha alltid migrations-SQL i repo, aldrig `db push` mot prod).
- **Backup**: Hostinger MySQL-backup + egen dump-cron till extern lagring (kryptera).

## 7. Auth & behörighet

- iron-session (krypterad cookie) + bcrypt enligt playbook. Sessionen bär
  `{ userId, role, schoolId }` men **alla** behörighetsbeslut görs om server-side
  mot DB per request (rollen i cookien är en hint, inte en sanning).
- Central `assertAccess()` i `db/queries/` — t.ex. `syvCanReadStudent(syvId, studentId)`
  = JOIN via `share_grants` + samma skola + aktiv licens. Ingen route får köra rå
  Drizzle-query mot elevdata utan att gå via query-lagret.
- BankID senare: `users` har `personal_identity_verified_at` + `auth_provider`-fält
  förberett (se schema), inget personnummer lagras ens då (BankID-verifiering ger
  ålder/identitet — vi sparar bara resultatet, inte numret).

## 8. Miljövariabler (kontrakt)

```
DATABASE_URL, SESSION_SECRET,
ANTHROPIC_API_KEY, AI_MODEL_INTERVIEW, AI_MODEL_REPORT,
AI_DAILY_BUDGET_SEK, AI_MAX_TOKENS_PER_INTERVIEW, AI_KILL_SWITCH,
HANDOFF_SHARED_SECRET, STUDIECOACH_BASE_URL,
CRON_SECRET (om cron går via HTTP), APP_BASE_URL
```
