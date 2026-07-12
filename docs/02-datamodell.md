# 02 — Datamodell: designbeslut

Schemat finns i [`src/db/schema.ts`](../src/db/schema.ts). Här motiveras avvikelserna
från specens utkast och de beslut som annars skulle bitas om ett år.

## Avvikelser från specens entitetslista (medvetna)

| Specen sa | Schemat gör | Varför |
|---|---|---|
| `users.school_id nullable` | egen tabell `school_memberships` | Elever byter skola (åk 9 → gymnasiet är ju hela produktresan!), SYV kan jobba på flera skolor, och licensräkning behöver historik. En FK-kolumn hade varit ånger #1 om 12 månader. |
| `programs / courses` generisk | `gy_programs` och `he_programs` separata | Gymnasieprogram och högskoleutbildningar har olika nycklar, olika källor, olika statistikmodeller. En generisk tabell ger JSON-soppa; två konkreta tabeller ger typade frågor. `admission_stats` är däremot gemensam med diskriminator. |
| `interviews (resumable state)` | `engine_state` JSON med `engineVersion` | Fasmaskinen kommer ändras. Versionsfält gör att pågående intervjuer kan återupptas även efter deploy av ny motor (eller migreras/avslutas kontrollerat). |
| `student_profiles (JSON + versionering)` | + `schema_version` separat från `version` | `version` = elevens iteration (gjorde om intervjun), `schema_version` = formatets version (kod-migrering). Två olika axlar som inte får blandas ihop. |
| `licenses` under school | `school_id` **eller** `municipality_id` | Kommuner köper centralt för alla sina skolor. Att bygga om licensmodellen mitt i en kommunaffär är värsta tänkbara timing. Kostar inget nu. |
| — (saknades) | `data_sources` + `import_runs` | Specens kärnregel "citeras med källa + datum" kräver en källtabell som fakta-FK:ar mot. `import_runs` är enda observabiliteten för cron-pipelinen. |
| — (saknades) | `ai_usage` | Dygnsbudget-kill-switchen (icke-funktionellt krav §7) behöver mätdata att agera på. |
| — (saknades) | `handoff_tokens`, `external_ids` | Studiecoach-handoff med replay-skydd (docs/01 §5). |
| `consents` | + `action: granted/revoked` + `policy_version` | Historik = append-only-logg. Att kunna visa *vilken* policyversion som godkändes är vad IMY faktiskt frågar efter. |

## Nyckelbeslut i kunskapsbasen

1. **Gy25-säkring**: `gy_programs.curriculum ('gy11'|'gy25')` + `valid_from/valid_to`,
   unik nyckel `(code, curriculum)`. Skolverket rullar ut Gy25/Gyan25 — elever som
   väljer nu möter den nya strukturen. Utan detta byggs kunskapsbasen om under drift.
2. **Antagningsstatistik är polymorf men explicit**: `admission_stats.subject_type`
   skiljer högskola (UHR: kvotgrupper BI/BII/HP per antagningsomgång) från gymnasium
   (regionalt: meritvärde per skola+program). Gymnasiepoäng kräver `school_id` —
   antagningsgränsen är per skolenhet, inte per program nationellt.
3. **`cutoff_value` är varchar, inte decimal**: UHR-data innehåller `*` (alla antagna),
   saknade värden och olika skalor (HP 0.00–2.00, betyg 0–22.5, meritvärde 0–340).
   Presentationslagret tolkar; lagringen ljuger aldrig.
4. **`interest_tags` JSON på alla KB-entiteter**: den gemensamma matchningsvalutan
   mellan elevprofil och utbildningar. Kurateras delvis manuellt (admin-CMS), delvis
   LLM-genererat vid import och granskat. Detta är den verkliga "vallgraven" — öppna
   data har alla, taggningen har bara vi.
5. **`facts_snapshot` i `recommendation_items`**: rapporten fryser fakta vid
   genereringsögonblicket. Kunskapsbasen uppdateras via cron; elevens rapport från
   i mars får inte tyst ändra innehåll i maj. (SYV-möten refererar till rapporten.)

## Vad vi ändå kommer ångra om 12 månader (spec-fråga 6) — och mitigering

1. **`interview_messages` växer obegränsat.** 1 000 elever × 30 meddelanden × 2 lägen
   är hanterbart, men chattloggar är också den känsligaste datan vi har (fritext från
   barn). *Mitigering redan nu:* retention-cron som raderar meddelanden X månader
   efter avslutad intervju — profilen och rapporten är det bestående värdet, inte
   rådialogen. Bestäm X i PUB-avtalet (förslag: 6 mån).
2. **Självrapporterade betyg i profil-JSON:en** utan struktur blir omöjliga att
   gap-analysera exakt. *Mitigering:* definiera betygsdelen av profilschemat strikt
   (ämne → betygssteg enligt Skolverkets ämneskoder) från dag 1, även om inmatningen
   är frivillig och grov ("mest B och C" → strukturerad approximation med flagga).
3. **k-anonymitet vid query-tid** blir långsam och buggig när dashboards växer.
   *Mitigering (Fas 2):* nattlig cron materialiserar aggregat till en `school_stats`-tabell
   där rader med n<5 aldrig ens skrivs. Dashboarden läser bara materialiserat.
   (Tabellen är medvetet inte med i v1-schemat — den designas när måtten är kända.)
4. **`recommendations.report_data` som JSON** kommer klia när SYV vill kommentera/
   bocka av enskilda samtalspunkter. Acceptabelt v1; bryt ut när behovet är bevisat.
5. **Ingen soft-delete-strategi för users**: `status='deleted'` + hard delete av
   relaterat är rätt för GDPR, men aggregerad statistik måste överleva radering.
   Se docs/04 §6 — aggregaten får aldrig FK:a mot users.
6. **Slug-kollisioner och slug-byten** på SEO-sidor när källdata byter namn.
   *Mitigering:* slugs är immutable efter publicering; namnbyte ändrar `name`, inte
   `slug`. (En redirects-tabell läggs till när första riktiga kollisionen inträffar.)

## Profilschemat (JSON i `student_profiles.data`) — v1-kontrakt

Zod-definierat i `lib/contracts/profile.ts`, speglat här för diskussion:

```ts
{
  schemaVersion: 1,
  interests: string[],            // fri vokabulär, normaliseras mot interest_tags
  favoriteSubjects: string[],     // Skolverkets ämneskoder
  dislikedSubjects: string[],
  subjectStrengths: { subjectCode: string, level: 'svag'|'ok'|'stark' }[],
  gradesSelf: {                   // frivilligt, eget samtycke (consents: grades_processing)
    reported: boolean,
    meritEstimate?: number,       // grundskola 0–340 / gy-snitt 0–22.5 beroende på mode
    perSubject?: { subjectCode: string, grade: 'F'|'E'|'D'|'C'|'B'|'A' }[]
  },
  practicalVsTheoretical: number, // -2..+2
  geography: { homeMunicipalityCode: string, maxCommuteMin?: number, canRelocate?: boolean },
  constraints: string[],          // ekonomi, familj, hälsa — FRITEXT FÖRBJUDEN här, enum-koder
  uncertainties: string[],        // osäkerhetsområden, kodade + kort LLM-sammanfattning
  freeTextSummary: string         // LLM:s pseudonyma sammanfattning, max 800 tecken
}
```

Notera `constraints` som enum-koder: fritext här är där känsliga personuppgifter
(hälsa, familjesituation) annars läcker in i det vi skickar till modellen och visar
SYV. Kodning är ett GDPR-beslut, inte bara ett datamodellsbeslut (docs/04 §2).
