import { describe, expect, it } from 'vitest';
import { emptyProfile, mergeProfilePatch, studentProfilePatchSchema } from '@/lib/contracts/profile';
import { scoreCandidates, topCandidates, type CandidateProgram } from './heuristic';

const naturvetenskap: CandidateProgram = {
  id: 1,
  name: 'Naturvetenskapsprogrammet',
  kind: 'hogskoleforberedande',
  interestTags: ['matematik', 'naturvetenskap', 'forskning'],
};

const bygg: CandidateProgram = {
  id: 2,
  name: 'Bygg- och anläggningsprogrammet',
  kind: 'yrkesprogram',
  interestTags: ['bygg', 'praktiskt arbete', 'hantverk'],
};

const el: CandidateProgram = {
  id: 3,
  name: 'El- och energiprogrammet',
  kind: 'yrkesprogram',
  interestTags: ['el', 'teknik', 'praktiskt arbete'],
};

describe('scoreCandidates', () => {
  it('ranks a theoretical, matematik-interested profile above practical programs', () => {
    const profile = mergeProfilePatch(
      emptyProfile(),
      studentProfilePatchSchema.parse({
        interests: ['matematik', 'naturvetenskap'],
        practicalVsTheoretical: 2,
      }),
    );

    const ranked = scoreCandidates(profile, [bygg, naturvetenskap, el]);
    expect(ranked[0].id).toBe(naturvetenskap.id);
  });

  it('ranks a practical, hands-on profile above theoretical programs', () => {
    const profile = mergeProfilePatch(
      emptyProfile(),
      studentProfilePatchSchema.parse({
        interests: ['praktiskt arbete', 'teknik'],
        practicalVsTheoretical: -2,
      }),
    );

    const ranked = scoreCandidates(profile, [naturvetenskap, bygg, el]);
    expect(['yrkesprogram']).toContain(ranked[0].kind);
  });

  it('gives every candidate a score even with an empty profile (no crash, no NaN)', () => {
    const ranked = scoreCandidates(emptyProfile(), [naturvetenskap, bygg, el]);
    expect(ranked).toHaveLength(3);
    ranked.forEach((c) => expect(Number.isFinite(c.score)).toBe(true));
  });
});

describe('topCandidates', () => {
  it('respects the limit', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => ({ ...naturvetenskap, id: i }));
    const top = topCandidates(emptyProfile(), candidates, 15);
    expect(top).toHaveLength(15);
  });
});
