import type { StudentProfile } from '@/lib/contracts/profile';

export type InterviewMode = 'gymnasieval' | 'hogskola';
export type InterviewVariant = 'full' | 'guest_short';

export interface PhaseConfig {
  id: string;
  /** Profile fields this phase aims to fill — informs the system prompt, not enforced. */
  goals: Array<keyof StudentProfile>;
  maxTurns: number;
}

export const ENGINE_VERSION = 1 as const;

export interface EngineState {
  engineVersion: typeof ENGINE_VERSION;
  phaseId: string;
  phaseTurns: number;
  totalTurns: number;
}
