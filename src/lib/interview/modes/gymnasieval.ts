import type { InterviewVariant, PhaseConfig } from '../types';

/**
 * Phase list for the gymnasieval mode (docs/01 §2). The full sequence is the
 * illustration from the architecture doc; guest_short trims it to the
 * gäst→konto flow (docs/01 §4) — roughly a third of the turns, teaser-grade
 * coverage, no wrapup.
 */
const FULL_PHASES: PhaseConfig[] = [
  { id: 'warmup', goals: [], maxTurns: 2 },
  { id: 'interests', goals: ['interests', 'favoriteSubjects', 'dislikedSubjects'], maxTurns: 6 },
  { id: 'strengths', goals: ['subjectStrengths', 'gradesSelf'], maxTurns: 5 },
  { id: 'practical', goals: ['practicalVsTheoretical'], maxTurns: 4 },
  { id: 'context', goals: ['geography', 'constraints'], maxTurns: 4 },
  { id: 'doubts', goals: ['uncertainties', 'freeTextSummary'], maxTurns: 3 },
  { id: 'wrapup', goals: [], maxTurns: 2 },
];

const GUEST_SHORT_PHASES: PhaseConfig[] = [
  { id: 'warmup', goals: [], maxTurns: 1 },
  { id: 'interests', goals: ['interests', 'favoriteSubjects'], maxTurns: 3 },
  { id: 'practical', goals: ['practicalVsTheoretical'], maxTurns: 2 },
  { id: 'doubts', goals: ['uncertainties', 'freeTextSummary'], maxTurns: 2 },
];

export function getGymnasievalPhases(variant: InterviewVariant): PhaseConfig[] {
  return variant === 'guest_short' ? GUEST_SHORT_PHASES : FULL_PHASES;
}
