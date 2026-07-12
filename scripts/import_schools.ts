/**
 * Imports municipalities (derived) and schools from Skolverket's
 * Skolenhetsregistret v2 API.
 *
 * Confirmed (via https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-skolenhetsregistret,
 * checked July 2026):
 *   - Base URL: https://api.skolverket.se/skolenhetsregistret
 *   - Detail endpoint: GET /v2/school-units/{schoolUnitCode}
 *   - Free, no API key, JSON or XML via Accept header, updated daily
 *   - Full spec: https://api.skolverket.se/skolenhetsregistret/swagger-ui/index.html
 *
 * NOT verified — this sandbox's network policy blocks api.skolverket.se, so
 * the bulk list/search endpoint's exact path, query params, and response
 * field names could not be checked live. `mapSchoolUnit` below intentionally
 * throws until someone with real network access opens the Swagger UI above,
 * confirms the field names (school unit code, name, municipality code,
 * school type, principal type, active/status), and fills it in. Do not guess
 * field names here — a wrong mapping would silently corrupt the knowledge
 * base (see docs/03, "AI:n får aldrig hitta på behörighetskrav" applies to
 * our own import pipeline too: garbage in, garbage cited).
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { municipalities, schools } from '../src/db/schema';
import { ensureDataSource, withImportRun } from './lib/import_run';

const SOURCE_KEY = 'skolverket_skolenhetsregistret';
const BASE_URL = 'https://api.skolverket.se/skolenhetsregistret/v2';

interface RawSchoolUnit {
  [key: string]: unknown;
}

interface MappedSchoolUnit {
  schoolUnitCode: string;
  name: string;
  municipalityCode: string;
  municipalityName: string;
  type: 'grundskola' | 'gymnasieskola' | 'komvux' | 'other';
  status: 'active' | 'inactive';
}

async function fetchAllSchoolUnits(): Promise<RawSchoolUnit[]> {
  // TODO: confirm the actual list/search path and pagination scheme against
  // the Swagger UI before relying on this. Left as a single best-guess call
  // (REST convention: GET {BASE_URL}/school-units) so the shape of the
  // pipeline is complete — verify and adjust before first real run.
  const res = await fetch(`${BASE_URL}/school-units`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Skolverket API svarade ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : (body.content ?? body.items ?? []);
}

function mapSchoolUnit(raw: RawSchoolUnit): MappedSchoolUnit {
  void raw;
  throw new Error(
    'mapSchoolUnit is not implemented yet. Open ' +
      'https://api.skolverket.se/skolenhetsregistret/swagger-ui/index.html, ' +
      'confirm the response field names for school unit code/name/' +
      'municipality code/school type/status, then implement this mapping. ' +
      'See the file header comment for context.',
  );
}

async function upsertMunicipality(code: string, name: string): Promise<number> {
  const existing = await db.query.municipalities.findFirst({
    where: eq(municipalities.code, code),
  });
  if (existing) return existing.id;

  const [inserted] = await db
    .insert(municipalities)
    .values({ code, name, countyCode: code.slice(0, 2) })
    .$returningId();
  return inserted.id;
}

async function run(): Promise<number> {
  await ensureDataSource({
    key: SOURCE_KEY,
    name: 'Skolverket Skolenhetsregistret v2',
    url: 'https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-skolenhetsregistret',
  });

  const raw = await fetchAllSchoolUnits();
  let count = 0;

  for (const rawUnit of raw) {
    const unit = mapSchoolUnit(rawUnit);
    const municipalityId = await upsertMunicipality(unit.municipalityCode, unit.municipalityName);

    const existing = await db.query.schools.findFirst({
      where: eq(schools.schoolUnitCode, unit.schoolUnitCode),
    });

    if (existing) {
      await db
        .update(schools)
        .set({ name: unit.name, municipalityId, type: unit.type, status: unit.status })
        .where(eq(schools.id, existing.id));
    } else {
      await db.insert(schools).values({
        schoolUnitCode: unit.schoolUnitCode,
        name: unit.name,
        municipalityId,
        type: unit.type,
        status: unit.status,
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
