import { z } from 'zod';

const currentYear = new Date().getFullYear();

/**
 * Hard age gate (docs/04 §4, spec §6): under 13 is never allowed to create an
 * account. This is a self-declared birth year — no verification exists before
 * BankID (Phase 3) — but the gate is enforced server-side regardless.
 */
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ogiltig e-postadress'),
  password: z.string().min(8, 'Lösenordet måste vara minst 8 tecken'),
  birthYear: z
    .number()
    .int()
    .min(currentYear - 100, 'Ogiltigt födelseår')
    .max(currentYear, 'Ogiltigt födelseår'),
  displayName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['student', 'syv', 'school_admin', 'municipality']).default('student'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export function isUnderAgeLimit(birthYear: number, limit = 13): boolean {
  return currentYear - birthYear < limit;
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ogiltig e-postadress'),
  password: z.string().min(1, 'Lösenord krävs'),
});

export type LoginInput = z.infer<typeof loginSchema>;
