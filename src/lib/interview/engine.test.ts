import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  getCurrentPhase,
  getPhases,
  initEngineState,
  isLastPhase,
  recordTurn,
  shouldForceAdvance,
} from './engine';

describe('initEngineState', () => {
  it('starts on the first phase of the full gymnasieval flow', () => {
    const state = initEngineState('gymnasieval', 'full');
    expect(state.phaseId).toBe('warmup');
    expect(state.phaseTurns).toBe(0);
    expect(state.totalTurns).toBe(0);
  });

  it('starts on a different, shorter phase list for guest_short', () => {
    const full = getPhases('gymnasieval', 'full');
    const guest = getPhases('gymnasieval', 'guest_short');
    expect(guest.length).toBeLessThan(full.length);
  });

  it('throws for a mode that is not implemented yet', () => {
    expect(() => initEngineState('hogskola', 'full')).toThrow();
  });
});

describe('recordTurn / shouldForceAdvance', () => {
  it('forces advance once a phase hits its maxTurns', () => {
    let state = initEngineState('gymnasieval', 'guest_short');
    const phase = getCurrentPhase('gymnasieval', 'guest_short', state);

    for (let i = 0; i < phase.maxTurns - 1; i++) {
      state = recordTurn(state);
      expect(shouldForceAdvance('gymnasieval', 'guest_short', state)).toBe(false);
    }

    state = recordTurn(state);
    expect(shouldForceAdvance('gymnasieval', 'guest_short', state)).toBe(true);
  });
});

describe('advancePhase', () => {
  it('resets phaseTurns and moves to the next phase id', () => {
    let state = initEngineState('gymnasieval', 'full');
    state = recordTurn(recordTurn(state));
    const advanced = advancePhase('gymnasieval', 'full', state);

    expect(advanced).not.toBeNull();
    expect(advanced!.phaseId).not.toBe('warmup');
    expect(advanced!.phaseTurns).toBe(0);
    expect(advanced!.totalTurns).toBe(state.totalTurns); // total carries over
  });

  it('returns null after advancing past the last phase', () => {
    let state = initEngineState('gymnasieval', 'guest_short');
    let next: ReturnType<typeof advancePhase> = state;

    while (next !== null) {
      state = next;
      next = advancePhase('gymnasieval', 'guest_short', state);
    }

    expect(isLastPhase('gymnasieval', 'guest_short', state)).toBe(true);
  });

  it('walking the full phase list from start to finish visits every phase exactly once', () => {
    const phases = getPhases('gymnasieval', 'full');
    let state = initEngineState('gymnasieval', 'full');
    const visited = [state.phaseId];

    let next = advancePhase('gymnasieval', 'full', state);
    while (next !== null) {
      state = next;
      visited.push(state.phaseId);
      next = advancePhase('gymnasieval', 'full', state);
    }

    expect(visited).toEqual(phases.map((p) => p.id));
  });
});
