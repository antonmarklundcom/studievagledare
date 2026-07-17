import type { StudentProfile } from '@/lib/contracts/profile';

export interface CandidateProgram {
  id: number;
  name: string;
  kind: 'hogskoleforberedande' | 'yrkesprogram' | 'introduktion';
  interestTags: string[];
}

export interface ScoredCandidate extends CandidateProgram {
  score: number;
}

/** Rough practical(-2)↔theoretical(+2) leaning per program kind — a heuristic
 * nudge, not a hard rule (docs/01 §3: this narrows the AI's candidate list,
 * it doesn't decide anything on its own). */
const KIND_LEANING: Record<CandidateProgram['kind'], number> = {
  yrkesprogram: -1.5,
  hogskoleforberedande: 1.5,
  introduktion: 0,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function interestOverlapScore(profile: StudentProfile, candidate: CandidateProgram): number {
  const profileTags = new Set(
    [...profile.interests, ...profile.favoriteSubjects].map(normalize),
  );
  if (profileTags.size === 0 || candidate.interestTags.length === 0) return 0;

  const matches = candidate.interestTags.filter((tag) => profileTags.has(normalize(tag))).length;
  return matches / candidate.interestTags.length;
}

function practicalTheoreticalScore(profile: StudentProfile, candidate: CandidateProgram): number {
  const distance = Math.abs(profile.practicalVsTheoretical - KIND_LEANING[candidate.kind]);
  // Max possible distance is 3.5 (-2 vs 1.5, or +2 vs -1.5) — normalize to 0..1, higher is better.
  return 1 - distance / 3.5;
}

const WEIGHTS = { interest: 0.7, practicalTheoretical: 0.3 };

/**
 * Grovpoäng (docs/01 §3 step 2) — narrows a broad SQL candidate list down to
 * the ~15 the LLM actually sees. Pure and deterministic so it's testable
 * without a model or a DB.
 */
export function scoreCandidates(
  profile: StudentProfile,
  candidates: CandidateProgram[],
): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score:
        WEIGHTS.interest * interestOverlapScore(profile, candidate) +
        WEIGHTS.practicalTheoretical * practicalTheoreticalScore(profile, candidate),
    }))
    .sort((a, b) => b.score - a.score);
}

export function topCandidates(
  profile: StudentProfile,
  candidates: CandidateProgram[],
  limit = 15,
): ScoredCandidate[] {
  return scoreCandidates(profile, candidates).slice(0, limit);
}
