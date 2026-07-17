import type { StudentProfile } from '@/lib/contracts/profile';
import type { ScoredCandidate } from './heuristic';

/**
 * The system prompt is the entire anti-hallucination guardrail (docs/01
 * §3): the model is only ever allowed to reference facts we handed it in
 * this prompt, by index. No program name, code, or requirement it wasn't
 * given here should ever appear in its motivation text.
 */
export function buildRecommendationPrompt(profile: StudentProfile, candidates: ScoredCandidate[]) {
  const system = `Du är en studie- och yrkesvägledare som väljer ut gymnasieprogram åt en elev.
Du får ENDAST referera fakta ur kandidatlistan nedan — hitta aldrig på program,
krav eller statistik som inte finns där. Anropa submit_recommendations med
3–7 val (index i listan), rankade bäst först, och en kort motivering per val
som kopplar till elevens profil. Motiveringen ska vara varm och konkret, inte generisk.`;

  const candidateList = candidates.map((c, index) => ({
    index,
    name: c.name,
    kind: c.kind,
    interestTags: c.interestTags,
  }));

  const userMessage = JSON.stringify({
    elevprofil: {
      intressen: profile.interests,
      gillarAmnen: profile.favoriteSubjects,
      praktiskTeoretisk: profile.practicalVsTheoretical,
      osakerhetsomraden: profile.uncertainties,
    },
    kandidater: candidateList,
  });

  return { system, userMessage };
}
