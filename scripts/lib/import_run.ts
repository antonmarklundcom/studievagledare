import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { dataSources, importRuns } from '../../src/db/schema';

/**
 * Wraps an import script body with the import_runs bookkeeping every
 * pipeline needs (docs/03): status, rows upserted, error message, and it
 * bumps data_sources.last_fetched_at so the UI's "källa, hämtad {datum}"
 * citation (spec §4.2) has something to point to.
 */
export async function withImportRun(
  sourceKey: string,
  fn: () => Promise<number>,
): Promise<void> {
  const [run] = await db
    .insert(importRuns)
    .values({ sourceKey, status: 'running' })
    .$returningId();

  try {
    const rowsUpserted = await fn();

    await db
      .update(importRuns)
      .set({ status: 'ok', rowsUpserted, finishedAt: new Date() })
      .where(eq(importRuns.id, run.id));

    await db
      .update(dataSources)
      .set({ lastFetchedAt: new Date() })
      .where(eq(dataSources.key, sourceKey));

    console.log(`[${sourceKey}] ok — ${rowsUpserted} rader`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(importRuns)
      .set({ status: 'failed', errorMessage: message, finishedAt: new Date() })
      .where(eq(importRuns.id, run.id));

    console.error(`[${sourceKey}] misslyckades: ${message}`);
    throw err;
  }
}

export async function ensureDataSource(input: {
  key: string;
  name: string;
  url?: string;
  licenseNote?: string;
}): Promise<void> {
  const existing = await db.query.dataSources.findFirst({
    where: eq(dataSources.key, input.key),
  });
  if (existing) return;

  await db.insert(dataSources).values(input);
}
