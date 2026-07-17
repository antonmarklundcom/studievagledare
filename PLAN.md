# PLAN.md — Studievägledare: väg till lansering

> **Författad av Fable 5** (planerings-/arkitekturmodell) för handoff till **Sonnet 5 / Opus 4.8**.
> Version 1.0 — 2026-07-16. Status: väntar på Antons bekräftelse av affärsantagandena i §2.

---

## 1. Modell-tiering (läs detta först)

| Modell | Används till | Används INTE till |
|---|---|---|
| **Fable 5** | Arkitektur- och schemabeslut, ändringar i fasindelning/scope, gap-analys, granskningsgrindar (slutet av varje fas), GDPR-/promptdesignbeslut | Rutinimplementation, CRUD, UI-bygge, importscripts |
| **Sonnet 5** | Standardmodell för byggarbetet: scaffolding, API routes, UI, importscripts, tester, SEO-sidor, migrationer | Beslut som ändrar schema-/API-kontrakt utan Fable-grind |
| **Opus 4.8** | De svåraste enskilda problemen: intervjumotorns fasmaskin + tool-call-loop (1.1–1.3), rekommendationspipelinens LLM-steg (1.4), prompt-eval-riggen | Allt annat — bränn inte Opus-tid på mekanik |

**Regel:** varje fas avslutas med en kort Fable 5-granskning mot detta dokument innan
nästa fas påbörjas. Schemaändringar (`src/db/schema.ts`) och kontraktsändringar
(`lib/contracts/`) kräver alltid Fable-godkännande — de är repor:ts dyraste beslut.

---

## 2. Affärsantaganden (BEKRÄFTA/ÄNDRA, Anton)

Interaktiv fråga nådde inte fram vid planeringstillfället; planen bygger på
dokumentens egna rekommendationer. Ändras ett antagande → uppdatera denna fil, inte
huvudena hos byggmodellerna.

| # | Antagande (default) | Alternativ | Påverkan om ändrat |
|---|---|---|---|
| A1 | **Lanseringsmål = första betalda skollicensen.** SYV-rapporten är B2B-kroken (docs/05 M4). SEO/gästflödet är trafikmatare, inte intäktslinjen i v1. | Konsumentintäkt först, eller båda parallellt | Fas 2/4-innehåll och ordning ändras väsentligt |
| A2 | **Pilotregion = Storsthlm (Indra)** som default för antagningsdata under utveckling; pilotskole-outreach är en Fas 0-affärsuppgift (docs/06 risk 1: välj skola i region med bra publicerad statistik). | GR eller annan region; pilot redan klar | Endast vilken regionparser som byggs i 0.5 |
| A3 | **Prissättning bestäms under piloten** (gratis pilot mot signerad utvärderingsavsikt + PUB-avtal). Ingen prispunkt finns i något dokument. | Provisoriskt pris sätts i Fas 0 | Fas 4-checklistan får en extra leverans |
| A4 | **Hostinger (en Node-slot + Hostinger MySQL) är deploy-target.** Hela arkitekturen är formad kring detta; Fas 0 verifierar de flaggade riskerna (ISR på disk, cron-miljö, fulltext-config, minne). | Annan host / EU-managed MySQL (GDPR-risk 9) | docs/01 §6 skrivs om; annars liten påverkan |
| A5 | **SPEC v0.1 ligger utanför repot.** Om den finns som dokument: lägg in den som `docs/00-spec.md` så byggmodellerna kan läsa den. | — | Utan den är docs/01–06 enda sanningen |
| A6 | **studiecoach.ai-handoffen kräver arbete i det repot** (mottagar-endpoint + replay-skydd). Behandlas som tvärproduktberoende i Fas 2, inte som feature här. | — | — |

---

## 3. Nuläge: vad som finns vs. vad som saknas

### Finns (arkitekturleverans, ingen applikationskod)

- **docs/01–06**: komplett arkitektur (intervjumotor, retrieval, gäst-konvertering,
  SSO-handoff, kostnadsvakter), datamodellmotivering, verifierad datakälls-audit,
  GDPR-riskgenomgång, fasindelad byggplan, spec-granskning med de-scope-beslut.
- **`src/db/schema.ts`**: komplett Drizzle/MySQL-schema (~30 tabeller) inkl.
  Gy25-giltighetsperioder, consents-historik, `ai_usage`, `import_runs`, `handoff_tokens`.

### Saknas (= 100 % av applikationen)

Ingen `package.json`, ingen Next.js-app, ingen CI, ingen deploy, ingen data i någon
databas, inga prompts, inga tester. Dessutom saknas (icke-kod): pilotskola, DPIA,
PUB-avtalsmall, Anthropic DPA-genomgång, licenskontroll av regionala antagningskanslier.

**Gap-analysens slutsats:** planeringsrisken är redan nedarbetad — docs/05 är en
trovärdig byggplan. Detta dokument omstrukturerar den till portfölj-standardens faser
och lägger till modell-tiering + sessionsestimat. Vid konflikt i detaljfrågor gäller
docs/01–06; vid konflikt om fas/scope gäller denna fil.

---

## 4. Fasindelade milstolpar

Estimat i **byggsessioner** (en fokuserad Claude Code-session ≈ en halv–hel arbetsdag).

### Fas 0 — Spec & fundament (≈ 4–5 sessioner, Sonnet 5)

Motsvarar docs/05 Fas 0. Klart när `npm run dev` fungerar, CI är grön, prod-URL:en
svarar och kunskapsbasens grunddata ligger i DB.

1. Scaffold: Next.js 15 + TS + Tailwind + Drizzle, lint/format, CI (typecheck + test).
2. Schema migrerat (drizzle-kit, migrations-SQL i repo — aldrig `db push` mot prod).
3. Deploy-pipeline mot Hostinger + `/api/health` + **verifiera A4-riskerna vecka 1**:
   ISR-cache på disk, cron-miljö, `innodb_ft_min_token_size`/ngram, minnestak.
4. Auth: registrering/login (iron-session + bcrypt), rollvakter, åldersgrind (<13 stoppas).
5. Import: kommuner, skolor (Skolenhetsregistret v2), gymnasieprogram Gy11+Gy25
   (Syllabus), yrken (JobTech). Idempotenta upserts, `import_runs`-loggning, cron.
6. `lib/ai/`: Anthropic-klient, budgetvakt (`AI_DAILY_BUDGET_SEK`, kill-switch),
   `ai_usage`-loggning, `assertPseudonymous()`-vakt. Enhetstester på vakterna.

**Affärsspår parallellt (Anton, inte modellerna):** pilotskole-outreach i vald region
(A2), Anthropic DPA + zero-retention-verifiering, påbörja DPIA (jurist har ledtid).

**Grind (Fable 5):** env-kontraktet, migrationsflödet och AI-vakterna granskas innan Fas 1.

### Fas 1 — Kärnbygge: intervju → rapport (≈ 8–10 sessioner, Sonnet 5 + Opus 4.8)

Motsvarar docs/05 punkt 1.1–1.7 + 1.9. Klart när en riktig elevpersona kan göra hela
resan intervju → rekommendationer → delad SYV-rapport, och GDPR-minimum finns.

| Leverans | Modell | Not |
|---|---|---|
| Fasmaskinen `lib/interview/` (gymnasieval-läget), enhetstestad UTAN LLM | **Opus 4.8** | Svåraste komponenten. Kontrakt i docs/01 §2. |
| LLM-loopen: tool-calls → Zod-validerad profilpatch, guardrail-prompt, glidande fönster | **Opus 4.8** | Inkl. eskaleringsregeln mående (kurator/Bris) — docs/04 §8. QA-testas explicit. |
| Intervju-UI (chatt, mobile-first 380px, avbryt/återuppta) + API routes | Sonnet 5 | Kontrakt i `lib/contracts/` (Zod) — framtida Expo-app konsumerar samma API. |
| Rekommendationsmotor: kandidat-SQL → heuristik → LLM-rankning → snapshot | **Opus 4.8** | "Endast fakta ur kandidatlistan"-regeln. Fakta renderas ur DB, aldrig ur LLM-text. |
| Resultatvy + gap-analys (ren TS, endast där regiondata finns) + källcitering | Sonnet 5 | Antagningsdata: ENDAST pilotregionens (A2) — manuell parser, aldrig nationell gissning. |
| Gästläge: kortintervju, teaser (#1 äkta, 2–5 låsta), konto-merge, 30-dagars purge | Sonnet 5 | docs/01 §4. |
| SYV-flöde: elevens delning (consent), SYV-inbox, rapport som **webbvy** (print-CSS, ej PDF) | Sonnet 5 | B2B-kroken. Mående-flagga utan citat. |
| GDPR-minimum: export (JSON), raderingstransaktionen (docs/04 §6), policy, retention-crons | Sonnet 5 | Raderingsordningen är exakt specad — följ den. |
| Prompt-eval-rigg: 10 syntetiska personas → assert profil fylls + rekommendationer refererar kandidater | **Opus 4.8** | docs/06 punkt 8. Körs vid varje promptändring. Prompts versioneras i repo. |

**Grind (Fable 5):** M2-motsvarigheten — hela flödet med riktig persona, go/no-go på
promptkvalitet och kostnad/elev innan SEO-fasen.

### Fas 2 — Content/SEO (≈ 3–4 sessioner, Sonnet 5)

Motsvarar docs/05 punkt 1.8. Klart när ~250 sidor är live, indexerbara och citerar källa.

1. `/gymnasieprogram/[slug]` (18 program + ~60 inriktningar × Gy11/Gy25) och
   `/yrke/[slug]` (~170 prognosyrken) med `generateStaticParams` + ISR (revalidate ~24h,
   on-demand från import-scripts).
2. Sitemap, metadata, strukturerad data; CTA → gästintervjun på varje sida.
3. Publik sök (MySQL FULLTEXT om Hostinger-verifieringen höll, annars LIKE-fallback).
4. **SEO-strategi (docs/06 punkt 13):** long-tail ("behörighet till X efter Y") — inte
   huvudtermer där gymnasium.se/utbildning.se äger topplaceringarna. Jämförelse-/
   behörighetssidor väntar dock till efter lansering (bevisa indexering först).

**Regel:** varje faktatyp i UI måste ha `data_sources`-koppling innan den renderas.

### Fas 3 — Polish & pilot-QA (≈ 3 sessioner, Sonnet 5)

Motsvarar docs/05 punkt 1.10 + saknade krav ur docs/06. Klart = pilotredo.

1. PWA-manifest + app-shell-SW (offline = skal + meddelande, inget mer).
2. WCAG 2.1 AA på portal + intervju-UI; skärmläsartest av chatten (DOS-lagen).
3. Lasttest klass-scenariot: 30 samtidiga intervjuer kl. 09:15 på en Node-slot.
4. Incidentplan (72h-anmälan) + uptime-ping + fel-larm via mejl — en sida i README.
5. Backup-restore-test mot Hostinger MySQL (en backup är ingen strategi förrän en restore genomförts).
6. Klass-onboarding: skol-kod + valfri e-post (e-post endast för lösenordsåterställning) — docs/06 punkt 3.
7. Pilot-QA: 10 testelever, prompt-tuning via eval-riggen, kostnadsmätning
   (mål: < 2 SEK/gäst, < 10 SEK/full intervju).

**Grind (Fable 5):** pilot-go/no-go. DPIA-status, mående-QA och kostnadsmålen är hårda villkor.

### Fas 4 — Lansering/graduering (≈ 2–3 sessioner + affärsledtid)

Klart = A1 uppfyllt: signerad skollicens.

1. Pilotkörning med skolklass + 1 SYV. Mät: slutförandegrad, SYV-betyg på rapporten
   (enkät), AI-kostnad/elev. Utan dessa mätetal går Fas 2-investeringen (B2B-produkt)
   inte att motivera — de ÄR beslutsunderlaget.
2. Licenshantering + school_admin-vy (SYV-konton, seats) — krävs för första fakturan.
   (Detta är enda posten ur docs/05 "Fas 2" som dras in före intäkt.)
3. PUB-avtal signerat, DPIA klar, prissättning beslutad (A3).
4. Graduering: repo:t går från "plan-repo" till driftläge; docs/05:s Fas 2/3-backlog
   (dashboard med k-anonyma aggregat, PDF-export, högskole-läget, studiecoach-handoff,
   premiumprofiler/leads, vårdnadshavarlänk, push, Expo, BankID) blir nästa plancykel —
   **ny Fable 5-session innan den påbörjas.**

---

## 5. Vad som krävs för att bli klar (sammanfattning)

**Kod (Sonnet/Opus, ≈ 20–25 sessioner totalt):** hela applikationen enligt Fas 0–4 ovan.

**Icke-kod (Anton, kan blockera oavsett kodtakt):**
1. Pilotskola i region med publicerad antagningsstatistik (A2) — styr regionparsern.
2. DPIA med jurist (sannolikt obligatorisk: barn + profilering + skala) + PUB-avtalsmall.
3. Anthropic DPA + zero-data-retention-verifiering, dokumenterat SCC/adekvansläge.
4. Hostinger-svar på GDPR-risk 9 (EU-datacenter, DPA, kryptering at rest).
5. Skriftlig licensfråga till pilotregionens antagningskansli (docs/03).
6. Prissättningsbeslut senast Fas 4 (A3).

**Kritisk väg:** Fas 0 → intervjumotorn (Opus-posterna i Fas 1) → pilot-QA. SEO-fasen
kan löpa parallellt med Fas 3 om det behövs. Juridikspåret (DPIA/PUB) har längst
extern ledtid — starta i Fas 0, inte Fas 3.

**Största riskerna (rangordnade, ur docs/06):** regional antagningsdata,
barn + fritext + AI (art. 9/mående), solo-utvecklare + bred yta (mitigering =
de-scope-tabellen i docs/05 — respektera den), promptkvalitet på billig modell
(mitigering = fasmaskin + eval-rigg + `AI_MODEL_INTERVIEW` bytbar per env),
Hostinger-begränsningar (mitigering = Fas 0-verifiering).

---

## 6. Återanvändbart från syskonrepon

- **Intern playbook** (Next.js + Drizzle + iron-session + bcrypt-konventioner)
  refereras i docs/01 och schema-huvudet men ligger inte i detta repo. Om den finns
  som skill/dokument i ett syskonrepo: länka eller kopiera in den före Fas 0 —
  scaffoldingen ska följa den, inte återuppfinna den.
- **studiecoach.ai**: handoff-kontraktet (docs/01 §5: HMAC-token, 5 min TTL,
  jti-replay-skydd) är specen för mottagar-endpointen i det repot. När handoffen
  byggs (efter lansering) ska samma kontraktsfil delas, inte dupliceras.
- Denna PLAN.md följer portföljens standardmönster (Fable 5-header, modell-tiering,
  fasindelning, "vad som krävs"), så tvärrepo-verktyg som läser mönstret fungerar här.

---

## 7. Öppna frågor till Anton

1. Bekräfta/ändra A1–A4 i §2 (lanseringsmål, pilotregion, prissättning, Hostinger).
2. Finns SPEC v0.1 som dokument? Lägg in som `docs/00-spec.md` (A5).
3. Var ligger den interna playbooken (§6)? Länk eller kopia före Fas 0.
4. Finns en pilotskole-kontakt redan, eller ska outreach planeras från noll?
