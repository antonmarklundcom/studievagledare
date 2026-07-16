import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { interviewMessages, interviews, studentProfiles } from '../schema';
import { emptyProfile, type StudentProfile } from '@/lib/contracts/profile';
import { initEngineState } from '@/lib/interview/engine';
import type { EngineState, InterviewMode, InterviewVariant } from '@/lib/interview/types';

export function generateGuestToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashGuestToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * mysql2 auto-parses JSON columns to objects on real MySQL, but MariaDB
 * (used for local dev — it stores JSON as TEXT under the hood) returns the
 * raw string instead. Normalize explicitly rather than depend on which
 * server happens to be underneath (found by actually running this, not by
 * typechecking — see the interview engine round of Fas 1).
 */
function parseJsonColumn<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export async function createInterview(input: {
  userId?: number | null;
  guestToken?: string | null;
  mode: InterviewMode;
  variant: InterviewVariant;
}) {
  const engineState = initEngineState(input.mode, input.variant);

  const [inserted] = await db
    .insert(interviews)
    .values({
      userId: input.userId ?? null,
      guestTokenHash: input.guestToken ? hashGuestToken(input.guestToken) : null,
      mode: input.mode,
      variant: input.variant,
      status: 'active',
      engineState,
    })
    .$returningId();

  await db.insert(studentProfiles).values({
    userId: input.userId ?? null,
    interviewId: inserted.id,
    data: emptyProfile(),
    isCurrent: true,
  });

  return getInterviewById(inserted.id);
}

export async function getInterviewById(id: number) {
  const [interview] = await db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
  if (!interview) return null;
  return { ...interview, engineState: parseJsonColumn<EngineState>(interview.engineState!) };
}

export async function findInterviewByGuestToken(token: string) {
  const [interview] = await db
    .select()
    .from(interviews)
    .where(eq(interviews.guestTokenHash, hashGuestToken(token)))
    .limit(1);
  if (!interview) return null;
  return { ...interview, engineState: parseJsonColumn<EngineState>(interview.engineState!) };
}

export async function appendMessage(input: {
  interviewId: number;
  role: 'assistant' | 'user';
  content: string;
  toolPatch?: unknown;
}) {
  await db.insert(interviewMessages).values({
    interviewId: input.interviewId,
    role: input.role,
    content: input.content,
    toolPatch: input.toolPatch ?? null,
  });
}

/** Chronological order (oldest first) — the caller decides how much of the window to send. */
export async function getMessages(interviewId: number, limit = 20) {
  const rows = await db
    .select()
    .from(interviewMessages)
    .where(eq(interviewMessages.interviewId, interviewId))
    .orderBy(desc(interviewMessages.id))
    .limit(limit);
  return rows.reverse();
}

export async function updateEngineState(
  interviewId: number,
  engineState: EngineState,
  usage: { inputTokens: number; outputTokens: number },
) {
  const interview = await getInterviewById(interviewId);
  if (!interview) throw new Error(`Interview ${interviewId} not found`);

  await db
    .update(interviews)
    .set({
      engineState,
      inputTokensUsed: interview.inputTokensUsed + usage.inputTokens,
      outputTokensUsed: interview.outputTokensUsed + usage.outputTokens,
    })
    .where(eq(interviews.id, interviewId));
}

export async function completeInterview(interviewId: number) {
  await db
    .update(interviews)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(interviews.id, interviewId));
}

/** Hit the per-interview token cap (spec §7 "AI-kostnadstak") — pause, don't 500. */
export async function pauseInterview(interviewId: number) {
  await db.update(interviews).set({ status: 'paused' }).where(eq(interviews.id, interviewId));
}

export async function getProfileDraft(interviewId: number): Promise<StudentProfile> {
  const [row] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.interviewId, interviewId))
    .limit(1);
  if (!row) throw new Error(`No profile draft for interview ${interviewId}`);
  return parseJsonColumn<StudentProfile>(row.data);
}

export async function saveProfileDraft(interviewId: number, data: StudentProfile) {
  await db.update(studentProfiles).set({ data }).where(eq(studentProfiles.interviewId, interviewId));
}
