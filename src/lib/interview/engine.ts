import { getGymnasievalPhases } from './modes/gymnasieval';
import { ENGINE_VERSION, type EngineState, type InterviewMode, type InterviewVariant, type PhaseConfig } from './types';

/**
 * Pure phase machine (docs/01 §2). The server — never the model — owns
 * progression: a turn either stays in the current phase, or the engine
 * forces an advance once maxTurns is hit. Nothing here touches the network
 * or the DB, which is what makes it fully unit-testable.
 */

export function getPhases(mode: InterviewMode, variant: InterviewVariant): PhaseConfig[] {
  if (mode === 'gymnasieval') return getGymnasievalPhases(variant);
  // hogskola mode is Fas 2 scope (docs/05) — fail loudly rather than silently
  // running the wrong phase list.
  throw new Error(`Interview mode "${mode}" is not implemented yet.`);
}

export function initEngineState(mode: InterviewMode, variant: InterviewVariant): EngineState {
  const [first] = getPhases(mode, variant);
  if (!first) throw new Error(`Mode "${mode}"/"${variant}" has no phases configured.`);
  return { engineVersion: ENGINE_VERSION, phaseId: first.id, phaseTurns: 0, totalTurns: 0 };
}

export function getCurrentPhase(
  mode: InterviewMode,
  variant: InterviewVariant,
  state: EngineState,
): PhaseConfig {
  const phases = getPhases(mode, variant);
  const phase = phases.find((p) => p.id === state.phaseId);
  if (!phase) {
    throw new Error(`Unknown phase "${state.phaseId}" for ${mode}/${variant}`);
  }
  return phase;
}

/** Call once per turn after the model has replied. */
export function recordTurn(state: EngineState): EngineState {
  return { ...state, phaseTurns: state.phaseTurns + 1, totalTurns: state.totalTurns + 1 };
}

export function shouldForceAdvance(
  mode: InterviewMode,
  variant: InterviewVariant,
  state: EngineState,
): boolean {
  const phase = getCurrentPhase(mode, variant, state);
  return state.phaseTurns >= phase.maxTurns;
}

/**
 * Moves to the next phase and resets the per-phase turn counter. Returns
 * null when the current phase was the last one — the caller should treat
 * that as "interview complete" (transition interviews.status to 'completed').
 */
export function advancePhase(
  mode: InterviewMode,
  variant: InterviewVariant,
  state: EngineState,
): EngineState | null {
  const phases = getPhases(mode, variant);
  const index = phases.findIndex((p) => p.id === state.phaseId);
  const next = phases[index + 1];
  if (!next) return null;
  return { ...state, phaseId: next.id, phaseTurns: 0 };
}

export function isLastPhase(mode: InterviewMode, variant: InterviewVariant, state: EngineState): boolean {
  const phases = getPhases(mode, variant);
  return phases.at(-1)?.id === state.phaseId;
}
