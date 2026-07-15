import { describe, expect, it } from 'vitest';
import { emptyProfile, mergeProfilePatch, studentProfilePatchSchema } from './profile';

describe('emptyProfile', () => {
  it('produces a valid, empty profile', () => {
    const profile = emptyProfile();
    expect(profile.schemaVersion).toBe(1);
    expect(profile.interests).toEqual([]);
    expect(profile.gradesSelf.reported).toBe(false);
  });
});

describe('mergeProfilePatch', () => {
  it('merges a partial patch without touching untouched fields', () => {
    const base = emptyProfile();
    const patch = studentProfilePatchSchema.parse({
      interests: ['matematik', 'natur'],
      practicalVsTheoretical: 1,
    });
    const merged = mergeProfilePatch(base, patch);

    expect(merged.interests).toEqual(['matematik', 'natur']);
    expect(merged.practicalVsTheoretical).toBe(1);
    expect(merged.favoriteSubjects).toEqual([]);
  });

  it('shallow-merges nested gradesSelf instead of overwriting it', () => {
    const base = mergeProfilePatch(
      emptyProfile(),
      studentProfilePatchSchema.parse({ gradesSelf: { reported: true, meritEstimate: 250 } }),
    );
    const patched = mergeProfilePatch(
      base,
      studentProfilePatchSchema.parse({ gradesSelf: { reported: true } }),
    );

    expect(patched.gradesSelf.meritEstimate).toBe(250);
  });

  it('rejects a patch with an invalid constraint code', () => {
    const result = studentProfilePatchSchema.safeParse({ constraints: ['made_up_code'] });
    expect(result.success).toBe(false);
  });

  it('replaces arrays rather than appending', () => {
    const withInterests = mergeProfilePatch(
      emptyProfile(),
      studentProfilePatchSchema.parse({ interests: ['matematik'] }),
    );
    const replaced = mergeProfilePatch(
      withInterests,
      studentProfilePatchSchema.parse({ interests: ['idrott'] }),
    );
    expect(replaced.interests).toEqual(['idrott']);
  });
});
