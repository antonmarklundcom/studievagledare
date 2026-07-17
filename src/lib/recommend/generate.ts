import { callClaude, reportModel } from '@/lib/ai/client';
import { getProfileDraft, getProfileRecordId } from '@/db/queries/interviews';
import {
  createRecommendation,
  findGyProgramCandidates,
  getRecommendationByInterview,
} from '@/db/queries/recommendations';
import { topCandidates } from './heuristic';
import { buildRecommendationPrompt } from './prompt';
import { extractSelections, SUBMIT_RECOMMENDATIONS_TOOL } from './tools';

export class NoCandidatesError extends Error {
  constructor() {
    super('Inga publicerade gymnasieprogram finns att rekommendera från än.');
  }
}

export class NoValidSelectionsError extends Error {
  constructor() {
    super('Modellen returnerade inga giltiga rekommendationer.');
  }
}

/**
 * The LLM ranking step of docs/01 §3's pipeline. Idempotent — calling this
 * twice for the same interview returns the already-generated recommendation
 * rather than spending another AI call, since the results page may re-fetch
 * on load.
 */
export async function generateRecommendations(input: {
  interviewId: number;
  userId?: number | null;
  ipHash?: string | null;
}) {
  const existing = await getRecommendationByInterview(input.interviewId);
  if (existing) return existing;

  const [profile, profileId, allCandidates] = await Promise.all([
    getProfileDraft(input.interviewId),
    getProfileRecordId(input.interviewId),
    findGyProgramCandidates(),
  ]);

  if (allCandidates.length === 0) throw new NoCandidatesError();

  const top = topCandidates(profile, allCandidates, 15);
  const { system, userMessage } = buildRecommendationPrompt(profile, top);

  const response = await callClaude({
    purpose: 'report',
    model: reportModel(),
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [SUBMIT_RECOMMENDATIONS_TOOL],
    maxTokens: 1500,
    userId: input.userId,
    ipHash: input.ipHash,
  });

  const selections = extractSelections(response.content);
  if (!selections) throw new NoValidSelectionsError();

  const seen = new Set<number>();
  const items = selections.selections
    .filter((s) => s.index >= 0 && s.index < top.length && !seen.has(s.index) && seen.add(s.index))
    .map((s, i) => {
      const candidate = top[s.index];
      return {
        rank: i + 1,
        gyProgramId: candidate.id,
        motivation: s.motivation,
        factsSnapshot: {
          name: candidate.name,
          kind: candidate.kind,
          interestTags: candidate.interestTags,
        },
      };
    });

  if (items.length === 0) throw new NoValidSelectionsError();

  return createRecommendation({
    userId: input.userId,
    interviewId: input.interviewId,
    profileId,
    modelUsed: reportModel(),
    items,
  });
}
