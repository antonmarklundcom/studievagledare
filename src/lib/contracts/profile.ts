import { z } from 'zod';

/**
 * Structured student profile filled by the interview (docs/02). Coded enums
 * for constraints/uncertainties are a deliberate GDPR decision, not just a
 * data-modeling one: free text here is where sensitive personal data
 * (health, family situation) would otherwise leak into what we send to the
 * model and show the SYV (docs/04 Risk 1). The model is instructed to code,
 * never to quote.
 */

export const PROFILE_SCHEMA_VERSION = 1 as const;

export const subjectStrengthLevel = z.enum(['svag', 'ok', 'stark']);
export const gradeLetter = z.enum(['F', 'E', 'D', 'C', 'B', 'A']);

// High-level categories only — never the student's own words. Kept short and
// reviewable; extend deliberately, don't let the model invent new codes.
export const constraintCode = z.enum([
  'economy',
  'family',
  'health',
  'motivation',
  'language',
  'other',
]);

export const uncertaintyCode = z.enum([
  'which_subject',
  'theoretical_vs_practical',
  'grades_not_enough',
  'what_job_it_leads_to',
  'where_to_study',
  'other',
]);

export const subjectStrengthSchema = z.object({
  subjectCode: z.string().min(1).max(20),
  level: subjectStrengthLevel,
});

export const gradesSelfSchema = z.object({
  reported: z.boolean(),
  meritEstimate: z.number().min(0).max(340).optional(),
  perSubject: z
    .array(z.object({ subjectCode: z.string().min(1).max(20), grade: gradeLetter }))
    .optional(),
});

export const geographySchema = z.object({
  homeMunicipalityCode: z.string().length(4),
  maxCommuteMin: z.number().int().min(0).max(240).optional(),
  canRelocate: z.boolean().optional(),
});

/** Full profile — what's stored in student_profiles.data once "complete". */
export const studentProfileSchema = z.object({
  schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
  interests: z.array(z.string().min(1).max(60)).max(20).default([]),
  favoriteSubjects: z.array(z.string().min(1).max(20)).max(20).default([]),
  dislikedSubjects: z.array(z.string().min(1).max(20)).max(20).default([]),
  subjectStrengths: z.array(subjectStrengthSchema).max(20).default([]),
  gradesSelf: gradesSelfSchema.default({ reported: false }),
  practicalVsTheoretical: z.number().min(-2).max(2).default(0),
  geography: geographySchema.optional(),
  constraints: z.array(constraintCode).max(10).default([]),
  uncertainties: z.array(uncertaintyCode).max(10).default([]),
  freeTextSummary: z.string().max(800).default(''),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;

/**
 * Patch schema — every field optional, this is the shape of what the
 * `update_profile` tool call is allowed to send per turn. Arrays are
 * replacements, not appends (the model re-sends the full current list plus
 * anything new — simpler to validate and to reason about than a diff format).
 */
export const studentProfilePatchSchema = studentProfileSchema
  .omit({ schemaVersion: true })
  .partial();

export type StudentProfilePatch = z.infer<typeof studentProfilePatchSchema>;

export function emptyProfile(): StudentProfile {
  return studentProfileSchema.parse({ schemaVersion: PROFILE_SCHEMA_VERSION });
}

/** Shallow-merges a validated patch into the current profile (arrays replace, not append). */
export function mergeProfilePatch(
  current: StudentProfile,
  patch: StudentProfilePatch,
): StudentProfile {
  return studentProfileSchema.parse({
    ...current,
    ...patch,
    gradesSelf: patch.gradesSelf ? { ...current.gradesSelf, ...patch.gradesSelf } : current.gradesSelf,
    geography: patch.geography ? { ...current.geography, ...patch.geography } : current.geography,
  });
}
