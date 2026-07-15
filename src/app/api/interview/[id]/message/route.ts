import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById } from '@/db/queries/interviews';
import { getSession } from '@/lib/auth/session';
import { sendMessageSchema } from '@/lib/contracts/interview';
import { BudgetExceededError } from '@/lib/ai/guard';
import { ownsInterview } from '@/lib/interview/access';
import {
  InterviewBudgetExceededError,
  InterviewNotActiveError,
  takeInterviewTurn,
} from '@/lib/interview/step';
import { requestIpHash } from '@/lib/util/hash-ip';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const interviewId = Number(id);
  if (!Number.isInteger(interviewId)) {
    return NextResponse.json({ error: 'Ogiltigt intervju-id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const interview = await getInterviewById(interviewId);
  if (!interview) {
    return NextResponse.json({ error: 'Intervjun hittades inte.' }, { status: 404 });
  }

  const session = await getSession();
  if (!ownsInterview(interview, { userId: session.userId, guestToken: session.guestToken })) {
    return NextResponse.json({ error: 'Du har inte åtkomst till den här intervjun.' }, { status: 403 });
  }

  try {
    const turn = await takeInterviewTurn({
      interviewId,
      userMessage: parsed.data.message,
      userId: session.userId ?? null,
      ipHash: requestIpHash(req),
    });

    return NextResponse.json({
      assistantText: turn.assistantText,
      phaseId: turn.phaseId,
      status: turn.status,
    });
  } catch (err) {
    if (err instanceof BudgetExceededError || err instanceof InterviewBudgetExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof InterviewNotActiveError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
