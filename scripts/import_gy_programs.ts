/**
 * Imports national gymnasieprogram (+ inriktningar) from Skolverket's
 * Syllabus API into gy_programs.
 *
 * Confirmed (via web search of Skolverket's own docs and the API's Swagger
 * UI listing, checked July 2026 — this sandbox's network policy blocks
 * api.skolverket.se directly, see scripts/import_schools.ts for the same
 * caveat):
 *   - Base URL: https://api.skolverket.se/syllabus
 *   - Free, no API key, JSON responses
 *   - v2 program endpoints exist under /v2/programs (search results
 *     reference "/v2/programs" and "/v1/programs/{code}" — v2 is current)
 *   - Full spec: https://api.skolverket.se/syllabus/swagger-ui/index.html
 *
 * NOT verified — could not reach the Swagger UI or any third-party mirror
 * of the response shape from this sandbox (every fetch attempt was blocked
 * or 403'd). `mapProgram` below intentionally throws until someone with
 * real network access confirms the field names for: program code, name,
 * kind (högskoleförberedande/yrkesprogram/introduktion), and — important,
 * see docs/02 — whether/how this API exposes curriculum version (Gy11 vs
 * the incoming Gy25/Gyan25 reform) and orientations (inriktningar) as
 * separate records or nested under the program. Do not guess this shape;
 * gy_programs.curriculum is a unique-key column (docs/02 "Gy25-säkring") —
 * getting it wrong silently double-imports or mis-tags the whole catalog.
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { gyPrograms } from '../src/db/schema';
import { ensureDataSource, withImportRun } from './lib/import_run';

const SOURCE_KEY = 'skolverket_syllabus';
const BASE_URL = 'https://api.skolverket.se/syllabus/v2';

interface RawProgram {
  [key: string]: unknown;
}

interface MappedProgram {
  code: string;
  slug: string;
  name: string;
  kind: 'hogskoleforberedande' | 'yrkesprogram' | 'introduktion';
  curriculum: 'gy11' | 'gy25';
  description: string | null;
}

async function fetchAllPrograms(): Promise<RawProgram[]> {
  // TODO: confirm the actual path/pagination against the Swagger UI before
  // relying on this — same caveat as import_schools.ts.
  const res = await fetch(`${BASE_URL}/programs`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Skolverket Syllabus API svarade ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : (body.content ?? body.items ?? []);
}

function mapProgram(raw: RawProgram): MappedProgram {
  void raw;
  throw new Error(
    'mapProgram is not implemented yet. Open ' +
      'https://api.skolverket.se/syllabus/swagger-ui/index.html, confirm the ' +
      'response field names for program code/name/kind/curriculum version, ' +
      'then implement this mapping. See the file header comment for context.',
  );
}

async function run(): Promise<number> {
  await ensureDataSource({
    key: SOURCE_KEY,
    name: 'Skolverket Syllabus API (program/kursplaner)',
    url: 'https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-laroplaner-kurs--och-amnesplaner-syllabus',
  });

  const raw = await fetchAllPrograms();
  let count = 0;

  for (const rawProgram of raw) {
    const program = mapProgram(rawProgram);

    const existing = await db.query.gyPrograms.findFirst({
      where: (t, { and, eq: eqOp }) => and(eqOp(t.code, program.code), eqOp(t.curriculum, program.curriculum)),
    });

    if (existing) {
      await db
        .update(gyPrograms)
        .set({ name: program.name, kind: program.kind, description: program.description })
        .where(eq(gyPrograms.id, existing.id));
    } else {
      await db.insert(gyPrograms).values({
        code: program.code,
        slug: program.slug,
        name: program.name,
        kind: program.kind,
        curriculum: program.curriculum,
        description: program.description,
        status: 'draft', // publiceras manuellt efter granskning, se docs/05
      });
    }
    count += 1;
  }

  return count;
}

withImportRun(SOURCE_KEY, run).then(
  () => process.exit(0),
  () => process.exit(1),
);
