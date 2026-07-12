import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../client';
import { consents, schoolMemberships, shareGrants, users } from '../schema';

export type NewUser = typeof users.$inferInsert;

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return user ?? null;
}

export async function findUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function createUser(input: NewUser) {
  const [inserted] = await db
    .insert(users)
    .values({ ...input, email: input.email.toLowerCase().trim() })
    .$returningId();
  return findUserById(inserted.id);
}

export async function recordConsent(input: {
  userId: number;
  type: (typeof consents.$inferInsert)['type'];
  action: 'granted' | 'revoked';
  source: string;
  policyVersion?: string;
}) {
  await db.insert(consents).values(input);
}

/**
 * Scoped access check: a SYV may only read a student's data if the student
 * has an active, non-revoked share grant naming the SYV's school AND the
 * SYV currently belongs to that school. This is the single gate every
 * SYV-facing route must call — never query student data directly (docs/01 §7).
 */
export async function syvCanReadStudent(syvUserId: number, studentUserId: number): Promise<boolean> {
  const [membership] = await db
    .select({ schoolId: schoolMemberships.schoolId })
    .from(schoolMemberships)
    .where(
      and(
        eq(schoolMemberships.userId, syvUserId),
        eq(schoolMemberships.roleAtSchool, 'syv'),
        isNull(schoolMemberships.endedAt),
      ),
    )
    .limit(1);

  if (!membership) return false;

  const [grant] = await db
    .select({ id: shareGrants.id })
    .from(shareGrants)
    .where(
      and(
        eq(shareGrants.studentUserId, studentUserId),
        eq(shareGrants.kind, 'syv'),
        eq(shareGrants.schoolId, membership.schoolId),
        isNull(shareGrants.revokedAt),
      ),
    )
    .limit(1);

  return Boolean(grant);
}
