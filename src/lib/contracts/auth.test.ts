import { describe, expect, it } from 'vitest';
import { isUnderAgeLimit, registerSchema } from './auth';

describe('isUnderAgeLimit', () => {
  const currentYear = new Date().getFullYear();

  it('blocks a 12-year-old', () => {
    expect(isUnderAgeLimit(currentYear - 12)).toBe(true);
  });

  it('allows a 13-year-old', () => {
    expect(isUnderAgeLimit(currentYear - 13)).toBe(false);
  });

  it('allows an adult', () => {
    expect(isUnderAgeLimit(currentYear - 30)).toBe(false);
  });
});

describe('registerSchema', () => {
  it('rejects a future birth year', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      birthYear: new Date().getFullYear() + 1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid payload and defaults role to student', () => {
    const result = registerSchema.safeParse({
      email: 'Elev@Example.com',
      password: 'password123',
      birthYear: 2010,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('student');
      expect(result.data.email).toBe('elev@example.com');
    }
  });
});
