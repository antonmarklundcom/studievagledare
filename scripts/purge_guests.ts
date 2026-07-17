/**
 * GDPR retention (docs/01 §4, docs/04): guest interviews that never
 * converted to an account are hard-deleted after 30 days. Run daily via
 * Hostinger cron: `tsx --env-file=.env scripts/purge_guests.ts`.
 *
 * Deletes in FK-safe order (children before parents) — recommendation_items
 * -> recommendations -> interview_messages -> student_profiles -> interviews.
 * Only targets interviews.userId IS NULL (never claimed); a claimed
 * interview's guestTokenHash is already cleared by claimGuestInterviewsForUser,
 * so this can never delete a real user's data.
 */
import { and, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  interviewMessages,
  interviews,
  recommendationItems,
  recommendations,
  studentProfiles,
} from '../src/db/schema';
import { withImportRun } from './lib/import_run';

const RETENTION_DAYS = 30;

async function run(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(isNull(interviews.userId), lt(interviews.createdAt, cutoff)));

  if (stale.length === 0) return 0;
  const ids = stale.map((r) => r.id);

  const staleRecommendations = await db
    .select({ id: recommendations.id })
    .from(recommendations)
    .where(inArray(recommendations.interviewId, ids));
  const recommendationIds = staleRecommendations.map((r) => r.id);

  if (recommendationIds.length > 0) {
    await db.delete(recommendationItems).where(inArray(recommendationItems.recommendationId, recommendationIds));
    await db.delete(recommendations).where(inArray(recommendations.id, recommendationIds));
  }

  await db.delete(interviewMessages).where(inArray(interviewMessages.interviewId, ids));
  await db.delete(studentProfiles).where(inArray(studentProfiles.interviewId, ids));
  await db.delete(interviews).where(inArray(interviews.id, ids));

  return ids.length;
}

withImportRun('purge_guests', run).then(
  () => process.exit(0),
  () => process.exit(1),
);
