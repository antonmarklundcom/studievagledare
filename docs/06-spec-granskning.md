# 06 — Granskning av specen: svagheter, saknade krav, risker

Spec v0.1 är ovanligt bra: låst stack, tydlig affärsroll, GDPR som kärnkrav och
rätt instinkter (roller som enum, consents som tabell, AI aldrig från klient).
Granskningen nedan fokuserar därför på det som är fel, saknas eller är önsketänkande.

## Svar på de öppna frågorna (§9) — index

| Fråga | Svar finns i |
|---|---|
| 1. Vad är överambitiöst för Fas 1? | docs/05 (bortskuret-tabellen) |
| 2. RAG-arkitektur inom MySQL | docs/01 §3 — det är inte ett RAG-problem; SQL-kandidater + LLM-rankning |
| 3. Intervjumotorns design | docs/01 §2 — hybrid fasmaskin + tool-calls, med motivering |
| 4. Gäst→konto utan GDPR-brott | docs/01 §4 |
| 5. SSO/handoff mot studiecoach.ai | docs/01 §5 — signerad engångstoken, INTE delad DB |
| 6. Datamodell-ånger om 12 mån | docs/02 (egen sektion) |
| 7. Skolverkets/UHR:s API:er — verifierat | docs/03 — Skolverket ✅, UHR ❌ (Excel), gymnasiepoäng 🔴 (regionalt) |
| 8. Övriga svagheter | detta dokument |

## Sakfel och riskabla antaganden i specen

1. **"antagningsstatistik" behandlas som EN sak.** Högskolans (UHR, nationell,
   halvårsvis, Excel) och gymnasiets (regional, ~15 kanslier, PDF) är två helt olika
   dataproblem. Specens hjärtläge (gymnasieval åk 9) är det som har SÄMST
   datatillgång — gap-analysen "vad krävs härifrån" kan inte lova antagningsgränser
   nationellt. Specen bör skriva om 4.3 så löftet blir regionberoende. (docs/03)
2. **Gy25 nämns inte.** Programstrukturen eleverna väljer till håller på att bytas ut.
   En kunskapsbas utan läroplansversion är fel från dag 1. (docs/02 §Gy25)
3. **"RAG" är fel mental modell** och leder mot onödig komplexitet (embeddings,
   chunking) för data som är en relationsdatabas. Formulera om till "structured
   retrieval + LLM-rankning". (docs/01 §3)
4. **"200+ SEO-sidor" i Fas 1 är rätt mål men fel källa** — nås via gymnasieprogram +
   yrken, inte högskoleutbildningar. Annars drar högskoleimporten in i MVP:n. (docs/05)
5. **Cross-promo-flödet förutsätter att studiecoach.ai kan ta emot.** Handoffen kräver
   en mottagar-endpoint + replay-skydd i den andra produkten — det är ett beroende på
   ett annat teams backlog och ska stå som sådant i specen, inte som en feature här.
6. **"Offline-shell" ska inte överlovas**: intervjun och resultaten kräver nät. Offline
   = skal + tydligt meddelande. Att synka en halvfärdig intervju offline är ett träsk
   som inte ska byggas. (docs/01 §6)
7. **PDF/webbvy** (4.4): PDF-generering (Puppeteer/Chromium) på en enda Hostinger-slot
   är minnesmässigt riskabelt. Webbvy + print-CSS i Fas 1. (docs/05)

## Saknade krav (bör in i spec v0.2)

**Produkt:**
1. **Eskaleringsplan för mående** — barn kommer skriva om ångest/självskada till en
   empatisk AI. Kurator/Bris-hänvisning i systemprompt + flaggning i SYV-rapport +
   QA-test före pilot. Största osynliga risken i hela specen. (docs/04 §8)
2. **Kvalitetsmått för intervjun/rapporten.** Ingenstans definieras vad "bra
   vägledning" är. Minimum: SYV-betyg per rapport (tumme upp/ner + kommentar) —
   det är dessutom säljmaterial. Lägg till en `report_feedback`-mekanism i Fas 2.
3. **Onboarding av skolklass**: hur får 28 elever konton? Klasskod? SYV-genererade
   länkar? E-postkrav krockar med att många åk-9-elever inte kollar mejl. Ska
   specificeras före pilot — förslag: skol-kod + valfri e-post (e-post krävs bara
   för att kunna återfå lösenord).
4. **Vad händer efter rapporten?** Produkten är "one-shot" per läsår som specad.
   Återbesöksskäl (uppdaterade betyg → uppdaterad gap-analys, antagningsdatum-
   påminnelser) är vad som gör push (Fas 3) meningsfull. Bör in som Fas 2-tanke.

**Teknik/drift:**
5. **Incidenthantering & övervakning**: 72h-anmälan (GDPR), uptime-övervakning
   (extern ping), fel-larm (mejl räcker). En sida i README före pilot.
6. **Backupstrategi + restore-test** — Hostinger-backup är inte en strategi förrän
   en restore är genomförd. (docs/01 §6)
7. **Miljöer**: specen nämner bara prod. Minimum: lokal dev med seed-data +
   staging-DB. Seed-scriptet är samma import-scripts mot dev-DB.
8. **Prompt-versionering och regressionstest**: prompts i repo + ett litet
   eval-script (10 syntetiska elevpersonas → kör intervjun → assert:a att profilen
   fylls och att rekommendationer refererar kandidatlistan). Utan detta blir varje
   promptändring rysk roulette. (docs/05 stående regler)
9. **Tillgänglighet konkretiserat**: "WCAG-grundnivå" → definiera: WCAG 2.1 AA på
   portal + intervju-UI (det är vad upphandlingar kräver via DOS-lagen om skolor
   köper). Chatt-UI med skärmläsare ska testas i Fas 1-QA, inte efteråt.
10. **Svensk fulltext i MySQL**: Hostingers `innodb_ft_min_token_size`/ngram-läge
    måste verifieras i Fas 0 — påverkar publika söket. (docs/01 §3)

**Affär:**
11. **Pilotens definition av framgång saknas.** Föreslagna mätetal i docs/05 M3.
    Utan dem går det inte att avgöra om Fas 2 ska byggas.
12. **PUB-avtal + DPIA som leveranser med ägare och deadline**, inte en flaggad
    bisats. Båda blockerar skolaffären, båda har ledtid. (docs/04)
13. **Konkurrensbilden nämns inte** (gymnasium.se, utbildning.se, Mitt Gymnasieval
    m.fl. har SEO-försprånget). Differentieringen är AI-intervjun + SYV-rapporten —
    det bör styra SEO-strategin mot long-tail ("behörighet till X efter Y") snarare
    än huvudtermer där etablerade sajter äger topplaceringarna.

## Största riskerna, rangordnade

1. **Datarisk gymnasieantagning** (regional, PDF) — mitigering: pilotregion-strategin
   i docs/03. Denna risk styr vilken pilotskola som väljs: välj en i en region med
   bra publicerad statistik (Storsthlm eller GR).
2. **Barn + fritext + AI** (art. 9 / mående) — mitigering: docs/04 §1+§8. Kräver
   jurist-timmar före pilot, inte efter.
3. **Solo-utvecklare + bred yta** — mitigering: Fas 1-skärningen i docs/05. Om
   tidsplanen spricker: skär gästläget före SYV-rapporten (B2B-kroken är intäkten;
   SEO-konvertering kan vänta en månad).
4. **Promptkvalitet på Haiku-klass över 20 turer** — mitigering: fasmaskinen minskar
   kraven på modellen (kort kontext, ett mål i taget); eval-scriptet (punkt 8 ovan)
   fångar regressioner. Ha `AI_MODEL_INTERVIEW` bytbar per env = A/B-testa modellnivå
   på riktiga piloter innan kostnadsoptimering.
5. **Hostinger-begränsningar** (ISR på disk, cron-miljö, fulltext-config, minne vid
   trafiktopp när en hel klass kör intervju samtidigt kl. 09:15) — mitigering:
   verifieras i Fas 0; klass-scenariot lasttestas före pilot (30 samtidiga intervjuer
   är den verkliga toppen, inte genomsnittet).

## Förslag till spec v0.2 (sammanfattning av ändringar)

1. Skriv om 4.2/4.3: separera högskole- och gymnasiestatistik, regionberoende löfte.
2. Lägg till Gy25-krav på kunskapsbasen.
3. Ersätt "RAG" med "structured retrieval + LLM-rankning".
4. Lägg till: eskaleringsplan mående, klass-onboarding, kvalitetsmått, incidentplan,
   miljöer, prompt-eval, WCAG 2.1 AA, DPIA+PUB som milstolpar med ägare.
5. Flytta i fasplanen: premiumprofiler/leads, dashboards, PDF, vårdnadshavarlänk,
   högskole-läget → Fas 2 (per docs/05).
6. Markera studiecoach-handoff som tvärproduktberoende med eget kontrakt (docs/01 §5).
