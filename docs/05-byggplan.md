# 05 — Fasindelad byggplan

Planerad för EN utvecklare + Claude Code. Estimaten antar heltid; skala linjärt annars.
Principen för allt scope: **Fas 1 ska kunna säljas till EN pilotskola och ge SYV där
en "wow"-rapport.** Allt som inte krävs för den meningen är flyttat.

## Fas 0 — Fundament (vecka 1–2)

| # | Leverans | Klart när |
|---|---|---|
| 0.1 | Repo, Next.js 15 + TS + Tailwind + Drizzle enligt playbook, lint/format, CI (typecheck + test) | `npm run dev` + grön CI |
| 0.2 | Schema (från detta repo) migrerat, drizzle-kit-migrationsflöde etablerat | Migrations-SQL i repo, körd mot Hostinger-MySQL |
| 0.3 | Deploy-pipeline: git push → Hostinger, env-kontrakt, hälso-endpoint `/api/health` | Prod-URL svarar |
| 0.4 | Auth: registrering, login, session, rollvakter, åldersgrind | Testad happy path + blockerad <13 |
| 0.5 | Import: kommuner, skolor (Skolenhetsregistret), gymnasieprogram Gy11+Gy25 (Syllabus) | `import_runs` gröna, data i DB, cron schemalagd |
| 0.6 | `lib/ai/`: Anthropic-klient, budgetvakt, `ai_usage`-loggning, pseudonymiseringsvakt | Enhetstester på vakterna |

**Risk att bevaka redan här:** Hostingers Node-slot + Next standalone + ISR-cache på
disk — verifiera i vecka 1, inte vecka 6. Om ISR strular: `next build`-tid SSG +
webhook-omdeploy är fallback.

## Fas 1 — MVP för pilotskola (vecka 3–10)

### Ingår

| # | Leverans | Vecka (ca) |
|---|---|---|
| 1.1 | Fasmaskinen (`lib/interview/`) med gymnasieval-läget, enhetstestad UTAN LLM | 3 |
| 1.2 | Intervju-UI (chatt, mobile-first 380px, avbryt/återuppta), API routes | 3–4 |
| 1.3 | LLM-integration: tool-calls → profilpatch, Zod-validering, guardrail-prompt | 4–5 |
| 1.4 | Rekommendationsmotor: kandidat-SQL + heuristik + LLM-rankning + snapshot | 5–6 |
| 1.5 | Resultatvy + gap-analys (endast om regiondata finns) + källcitering i UI | 6 |
| 1.6 | Gästläge: kortintervju, teaser, konto-merge, 30-dagars purge | 7 |
| 1.7 | SYV-flöde: elevens delning (consent), SYV-inbox, rapport som **webbvy** | 7–8 |
| 1.8 | SEO-portal: `/gymnasieprogram/[slug]` + `/yrke/[slug]` (ISR), sitemap, metadata → 200+ sidor ur KB | 8–9 |
| 1.9 | GDPR-minimum: export (JSON), radering (transaktionen i docs/04 §6), integritetspolicy, retention-crons | 9 |
| 1.10 | PWA-manifest + app-shell-SW; pilot-QA: 10 testelever, prompt-tuning, kostnadsmätning | 10 |

### Skärs bort ur Fas 1 (spec-fråga 1 — vad som är överambitiöst)

| Bortskuret | Motiv | Återkommer |
|---|---|---|
| Högskola/yrkes-läget | Dubblar frågeträd, KB-yta (Susa+UHR) och QA. Pilotskolan är en grundskola. | Fas 2 |
| PDF-export av SYV-rapport | Webbvy + `window.print`-CSS ger 90 % av värdet. PDF-generering på en Node-slot är ett eget projekt. | Fas 2 |
| Skoldashboard + kommunvy | Kräver volymdata för att ens vara meningsfull; k-anonymitet gör små piloter tomma. Pilotens "dashboard" = SYV-inboxen. | Fas 2/3 |
| Premiumprofiler + leads | Intäktsspår utan trafik är död kod. Schema finns redo. | Fas 2 |
| Studiecoach-handoff | Länk utan SSO kan läggas in på 1h om det behövs; riktiga handoffen kräver ändringar i studiecoach också. | Fas 2 |
| Vårdnadshavarlänk | Trevligt, inte säljande. SYV-delningen är B2B-kroken. | Fas 2 |
| Web push, offline utöver skal, Expo, BankID | Per spec redan Fas 3. | Fas 3 |
| Jämförelsesidor, "behörighet till X"-sidor | SEO-yta växer bäst när grundsidorna bevisat indexering. | Fas 2 |
| `/utbildning/` + `/hogskola/`-sidor | Följer högskole-läget. | Fas 2 |

**Största de-scope-beslutet:** Fas 1-målet "200+ SEO-sidor" behålls men uppfylls med
gymnasieprogram (18 + ~60 inriktningar × Gy11/Gy25) + yrkessidor (~170 prognosyrken)
— inte högskoleutbildningar. Det ger ~250 sidor från två redan importerade källor.

## Fas 2 — B2B-produkt + andra läget (vecka 11–20)

Ordnat efter intäktsnärhet:

1. **Licenshantering + school_admin-vy** (SYV-konton, seats) — krävs för första fakturan.
2. **Skoldashboard** med materialiserade k-anonyma aggregat (docs/02 §3, docs/04 §5).
3. **PDF-export** av SYV-rapporten.
4. **Högskola/yrkes-läget**: Susa-import, UHR-Excel-import, nytt frågeträd i samma motor, `/utbildning/`+`/hogskola/`-sidor.
5. **Studiecoach-handoff** (docs/01 §5) — kräver mottagar-endpoint i studiecoach.ai.
6. **Premiumprofiler + leads** med `lead_forwarding`-samtycke.
7. **Vårdnadshavarlänk** (docs/04 §3-designen).
8. Jämförelse- och behörighetssidor (SEO-expansion).

## Fas 3 — Skala (vecka 21+)

1. Kommunportal (aggregat över skolor, samma k-pipeline).
2. Web push (consent-typ finns) — främst "din rapport är klar" + SYV-notiser.
3. Expo-app ovanpå `/api` (kontraktet i `lib/contracts/` är förberedelsen).
4. BankID (`auth_provider`-fältet finns; ingen personnummerlagring ens då).
5. Fler antagningsregioner för gymnasiepoäng (kommun-onboarding-kravet, docs/03).

## Milstolpar & mätpunkter

- **M1 (v. 2):** deploy-pipeline + KB-data live → internt demo på riktiga program.
- **M2 (v. 6):** första hela flödet intervju→rapport med riktig elevpersona → go/no-go på promptkvalitet.
- **M3 (v. 10):** pilot med 10 elever + 1 SYV → mät: slutförandegrad intervju,
  SYV:s betyg på rapporten (enkät), AI-kostnad/elev (mål: < 2 SEK gäst, < 10 SEK full).
- **M4 (Fas 2):** första signerade skollicensen + PUB-avtal.

## Stående regler under bygget

- Varje ny fakta-typ i UI: måste ha `data_sources`-koppling innan den renderas.
- Varje ny route som rör elevdata: går via query-lagrets `assert*`-funktioner.
- Prompt-ändringar versioneras i repo (`lib/ai/prompts/`) — aldrig i env eller DB.
- AI-kostnad per intervju loggas från dag 1; budget-kill-switch testas i Fas 0.
