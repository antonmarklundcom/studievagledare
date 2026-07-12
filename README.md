# Studievägledare — Arkitektur & byggplan

AI-driven studie- och yrkesvägledare för svenska gymnasie- och grundskoleelever.
Detta repo innehåller den tekniska planen som svar på SPEC v0.1.

## Innehåll

| Dokument | Innehåll |
|---|---|
| [docs/01-arkitektur.md](docs/01-arkitektur.md) | Teknisk arkitektur: systemöversikt, intervjumotor, RAG/lookup, gästkonvertering, SSO-handoff, kostnadskontroll |
| [docs/02-datamodell.md](docs/02-datamodell.md) | Datamodellens designbeslut + "vad vi ångrar om 12 månader" |
| [src/db/schema.ts](src/db/schema.ts) | Komplett Drizzle-schema (MySQL) |
| [docs/03-datakallor.md](docs/03-datakallor.md) | Verifierade datakällor (Skolverket, UHR, AF/JobTech, SCB) + import-pipeline per källa |
| [docs/04-gdpr-riskgenomgang.md](docs/04-gdpr-riskgenomgang.md) | GDPR-riskgenomgång av arkitekturen, brister och åtgärder |
| [docs/05-byggplan.md](docs/05-byggplan.md) | Fasindelad byggplan med veckoupplösning för Fas 0–1 |
| [docs/06-spec-granskning.md](docs/06-spec-granskning.md) | Svagheter i specen, saknade krav, risker, svar på de öppna frågorna |

## De viktigaste rekommendationerna (TL;DR)

1. **Intervjumotorn**: hybrid — deterministisk fas-maskin på servern, LLM sköter samtalet
   inom varje fas via tool-calls som fyller profilen. Inte fritt LLM-samtal, inte ren state machine.
2. **RAG**: ingen vektordatabas behövs. Kunskapsbasen är liten (~tusentals rader) och
   inherent strukturerad. Strukturerad SQL-filtrering → deterministisk kandidatlista →
   LLM rankar/motiverar med fakta injicerade i prompten. Fulltext (MySQL FULLTEXT) endast för publik sök.
3. **Kritisk datainsikt**: UHR har **inget öppet API** för antagningsstatistik (Excel-filer),
   och gymnasieantagningens poäng är **regional** (Indra/Storsthlm, GR m.fl. — PDF/Excel per region).
   Detta är största datarisken i hela projektet — se docs/03.
4. **Gy25**: Skolverkets programstruktur görs om (Gy25/Gyan25). Kunskapsbasen måste ha
   giltighetsperioder från dag 1, annars byggs den om inom ett år.
5. **Skär i Fas 1**: premiumprofiler, leads, dashboards, kommunportal, PDF-export,
   vårdnadshavardelning och högskole-läget flyttas ut ur MVP. Se docs/05.
6. **SSO mot studiecoach.ai**: signerad engångstoken (HMAC, 5 min TTL) — **inte** delad users-tabell.

## Kom igång (Fas 0)

```bash
cp .env.example .env   # fyll i DATABASE_URL, SESSION_SECRET (openssl rand -hex 32)
npm install
npm run db:migrate     # kör drizzle/0000_*.sql mot din DB
npm run dev
```

Övriga script: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run db:generate` (ny migration efter schemaändring), `npm run import:schools`.

**Känd lucka:** `scripts/import_schools.ts` har en verifierad detalj-endpoint
(`GET /v2/school-units/{kod}`) men det bulk-listande sök-API:et hos Skolverket
kunde inte verifieras härifrån (nätverksspärr i den här utvecklingsmiljön).
`mapSchoolUnit()` kastar avsiktligt tills fältnamnen är bekräftade mot
[Swagger UI](https://api.skolverket.se/skolenhetsregistret/swagger-ui/index.html)
— se filens header-kommentar. Gissa inte fältnamnen, det förgiftar kunskapsbasen.

## Status

Fas 0 pågår: repo, Next.js 15 + Drizzle-schema (29 tabeller, migration
genererad), auth (registrering/inloggning/session/åldersgrind), AI-lager
(budgetvakt + pseudonymiseringsvakt), health-endpoint, CI. Se docs/05 för
resten av fasplanen.
