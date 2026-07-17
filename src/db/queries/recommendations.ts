import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { parseJsonColumn } from '../json-column';
import { gyPrograms, recommendationItems, recommendations } from '../schema';
import type { CandidateProgram } from '@/lib/recommend/heuristic';

/**
 * Broad SQL filter (docs/01 §3 step 1) — published, current-curriculum
 * gymnasieprogram. Deliberately loose: the heuristic step narrows this down,
 * not the SQL. Hard eligibility filtering against the student's own grades
 * isn't modeled yet (no grundskola-behörighet rule table exists) — this is
 * a known gap, not silently pretended away.
 */
export async function findGyProgramCandidates(curriculum: 'gy11' | 'gy25' = 'gy25'): Promise<
  CandidateProgram[]
> {
  const rows = await db
    .select({
      id: gyPrograms.id,
      name: gyPrograms.name,
      kind: gyPrograms.kind,
      interestTags: gyPrograms.interestTags,
    })
    .from(gyPrograms)
    .where(and(eq(gyPrograms.status, 'published'), eq(gyPrograms.curriculum, curriculum)));

  return rows.map((r) => ({
    ...r,
    interestTags: r.interestTags ? parseJsonColumn<string[]>(r.interestTags) : [],
  }));
}

export async function createRecommendation(input: {
  userId?: number | null;
  interviewId: number;
  profileId: number;
  modelUsed: string;
  items: Array<{
    rank: number;
    gyProgramId: number;
    motivation: string;
    factsSnapshot: unknown;
  }>;
}) {
  const [inserted] = await db
    .insert(recommendations)
    .values({
      userId: input.userId ?? null,
      interviewId: input.interviewId,
      profileId: input.profileId,
      status: 'ready',
      modelUsed: input.modelUsed,
    })
    .$returningId();

  if (input.items.length) {
    await db.insert(recommendationItems).values(
      input.items.map((item) => ({
        recommendationId: inserted.id,
        rank: item.rank,
        gyProgramId: item.gyProgramId,
        motivation: item.motivation,
        factsSnapshot: item.factsSnapshot,
      })),
    );
  }

  return getRecommendationByInterview(input.interviewId);
}

export async function getRecommendationByInterview(interviewId: number) {
  const [recommendation] = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.interviewId, interviewId))
    .limit(1);
  if (!recommendation) return null;

  const rawItems = await db
    .select()
    .from(recommendationItems)
    .where(eq(recommendationItems.recommendationId, recommendation.id))
    .orderBy(recommendationItems.rank);

  const items = rawItems.map((item) => ({
    ...item,
    factsSnapshot: parseJsonColumn<unknown>(item.factsSnapshot),
    gapAnalysis: item.gapAnalysis ? parseJsonColumn<unknown>(item.gapAnalysis) : null,
  }));

  return { ...recommendation, items };
}
