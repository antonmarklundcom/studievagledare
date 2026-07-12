import { describe, expect, it } from 'vitest';
import { assertPseudonymous, PseudonymizationViolation } from './pseudonymize';

describe('assertPseudonymous', () => {
  it('allows a clean profile payload', () => {
    expect(() =>
      assertPseudonymous({ interests: ['matematik', 'natur'], geography: { municipalityCode: '0180' } }),
    ).not.toThrow();
  });

  it('rejects a payload containing an email address', () => {
    expect(() => assertPseudonymous({ note: 'kontakta alva@example.com' })).toThrow(
      PseudonymizationViolation,
    );
  });

  it('rejects a payload containing a known identifier', () => {
    expect(() => assertPseudonymous({ freeText: 'Jag heter Alva och går i nian' }, ['Alva'])).toThrow(
      PseudonymizationViolation,
    );
  });

  it('ignores short/common substrings passed as identifiers', () => {
    expect(() => assertPseudonymous({ interests: ['id'] }, ['A'])).not.toThrow();
  });
});
