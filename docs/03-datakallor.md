# 03 — Datakällor: verifierat läge + import-pipelines

Spec-fråga 7 kräver verifiering, inte antaganden. Detta är läget per juli 2026
(kontrollerat mot källornas egna sidor — länkar sist i dokumentet). **Verifiera
licensvillkor och exakta fältformat mot varje API:s dokumentation innan import
byggs — sammanfattningen här är research, inte avtal.**

## Sammanfattning: vad som finns och inte finns

| Källa | Finns som | Format | Bedömning |
|---|---|---|---|
| Skolverket Skolenhetsregistret | Öppet REST-API, v2 | JSON/XML, uppdateras dagligen | ✅ Bra. Grund för `schools`. Har Gy25/Gyan25-stöd. |
| Skolverket Syllabus (läroplaner, program, ämnen) | Öppet API | JSON | ✅ Bra. Grund för `gy_programs` + ämneskoder. |
| Skolverket Planned Educations | Öppet API | JSON | ✅ Skolenheter + planerade utbildningar + viss statistik. |
| Skolverket Susa-navet (utbildningstillfällen, inkl. högskola) | Öppet API | JSON/XML | ✅ Kandidat som grund för `he_programs`. |
| UHR antagningsstatistik (högskola) | **INGET öppet API.** Sökfunktion på webben + nedladdningsbara Excel/PDF per antagningsomgång | Excel/PDF | ⚠️ Import = ladda ner + parsa Excel med script. Skört men görbart. |
| Gymnasieantagningens poäng | **INGET nationellt API.** Regionala antagningskanslier (Storsthlm/Indra, Göteborgsregionen, m.fl.) publicerar PDF/Excel per region | PDF/Excel, olika format per region | 🔴 **Största datarisken i projektet.** Se nedan. |
| AF/JobTech Yrkesprognoser | Öppna data (API + filer) | JSON | ✅ ~170 prognosyrken, utsikter 1 och 5 år, bygger på SSYK2012. |
| AF/JobTech Taxonomy | Öppet API | JSON/GraphQL | ✅ Yrkesbegrepp, SSYK-koppling, kompetenser. Grund för `occupations`. |
| SCB PxWeb API | Öppet API | JSON-stat | ✅ Kompletterande (löner per yrke, utbildningsnivåer). Inte kritiskt för v1. |

## Konsekvensanalys av de två luckorna

### UHR (högskolestatistik) — hanterbart
Excel-filerna per antagningsomgång är strukturerade och stabila nog att parsa med
`xlsx`-bibliotek i ett tsx-script. Uppdateringsfrekvens: 2 ggr/år (urval 1+2 för HT
resp. VT). Manuell körning med commit av rådatafilen till repo (spårbarhet) är helt
acceptabelt — det är 4 händelser per år, inte en realtidsström. Bygg parsern
defensivt: kolumnnamn ändras mellan år, `*`-värden förekommer.

### Gymnasieantagningen — kräver strategibeslut
Antagningsgränser till gymnasiet sätts **per skolenhet per region** och publiceras av
~15 regionala antagningskanslier i olika format (mest PDF). Att skrapa alla är inte
solo-utvecklar-realistiskt i Fas 1. **Rekommendation:**

1. **Fas 1 (pilotskola)**: importera ENDAST pilotskolans region manuellt
   (Excel/PDF → CSV → import-script). En region = en känd parser.
2. Gap-analysen för gymnasieval formuleras därefter: "meritvärde att sikta på"
   baseras på regionens data där den finns, annars visas programfakta utan
   poänggräns — **aldrig en nationell gissning**.
3. Fas 2+: lägg regioner i takt med betalande kommuner (kommunen kan ofta själv
   leverera sin antagningsstatistik som del av avtalet — gör det till onboarding-krav
   i licensen, så löser kunden datainsamlingen åt oss).

## Import-pipeline per källa

Alla scripts: `npx tsx scripts/import_<källa>.ts`, idempotenta (upsert på naturlig
nyckel), skriver `import_runs`-rad, uppdaterar `data_sources.last_fetched_at`,
triggar on-demand ISR-revalidate för berörda sidor.

| Script | Nyckel (upsert) | Frekvens (cron) | Anteckningar |
|---|---|---|---|
| `import_municipalities.ts` | kommunkod | engångs + årligen | Statisk SCB-lista, kan ligga som JSON i repo. |
| `import_schools.ts` | skolenhetskod | veckovis | Skolenhetsregistret v2. Filtrera på skolform. |
| `import_gy_programs.ts` | programkod + läroplan | månadsvis | Syllabus-API. Hämta både Gy11 och Gy25. Ämneskoder till egen referens-JSON. |
| `import_he_programs.ts` | utbildningskod + lärosäte | månadsvis | Susa-navet. Volymen är stor — börja med program (inte fristående kurser). |
| `import_uhr_stats.ts` | (utbildning, år, omgång, kvotgrupp) | manuellt 4 ggr/år | Excel-parser. Rådatafil committas till `data/raw/uhr/`. |
| `import_gy_admissions_<region>.ts` | (skola, program, år) | manuellt 1–2 ggr/år | En parser per region, endast aktiva regioner. |
| `import_occupations.ts` | taxonomy concept id | månadsvis | JobTech Taxonomy + Yrkesprognoser. Mappa prognos→`occupation_forecasts`. |
| `purge_guests.ts` | — | dagligen | GDPR: gästintervjuer > 30 dagar. |
| `purge_messages.ts` | — | dagligen | Retention på chattloggar (docs/02). |
| `ai_budget_report.ts` | — | dagligen | Summera `ai_usage`, larma via mejl vid >80 % budget. |

## Licens-/villkorskontroll (att göra innan lansering — affärsuppgift)

- Skolverkets öppna API:er: fria att använda; verifiera attributionskrav (CC0 vs CC-BY).
- UHR: Excel-filerna är offentliga handlingar; verifiera att vidarepublicering av
  bearbetad statistik är OK (det är den normalt — myndighetsdata) och attribuera.
- JobTech: öppna data, verifiera licens per dataset (oftast CC0/apache-aktigt).
- Regionala antagningskanslier: **fråga skriftligt** — deras publikationer saknar
  ofta uttalad licens. Pilotkommunens kansli först.
- Kravet i UI: varje faktaruta visar "Källa: Skolverket, hämtad 2026-07-01" —
  det uppfyller både attribution och specens anti-hallucinationsregel.

## Källänkar (verifierade juli 2026)

- Skolverket öppna data (översikt): https://www.skolverket.se/om-skolverket/oppna-data
- Skolenhetsregistrets API: https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-skolenhetsregistret
- Planned Educations API: https://www.skolverket.se/om-skolverket/oppna-data/api-for-skolor-utbildningar-och-statistik-planned-education
- Syllabus API: https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-laroplaner-kurs--och-amnesplaner-syllabus
- Susa-navet API: https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-utbildningstillfallen-susa-navet
- UHR antagningsstatistik: https://www.uhr.se/studier-och-antagning/antagningsstatistik/
- JobTech Yrkesprognoser: https://jobtechdev.se/sv/produkter/yrkesprognoser
- JobTech Taxonomy: https://data.arbetsformedlingen.se/data/dataset/taxonomy/
- Exempel regional gymnasiestatistik: https://gymnasieantagningen.storsthlm.se/ , https://gymnasieantagningen.goteborgsregionen.se/antagningspoang-och-statistik
