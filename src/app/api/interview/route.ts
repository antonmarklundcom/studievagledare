import { NextRequest, NextResponse } from 'next/server';
import { createInterview, generateGuestToken } from '@/db/queries/interviews';
import { getSession } from '@/lib/auth/session';
import { startInterviewSchema } from '@/lib/contracts/interview';
import { InterviewBudgetExceededError, takeInterviewTurn } from '@/lib/interview/step';
import { requestIpHash } from '@/lib/util/hash-ip';
import { BudgetExceededError } from '@/lib/ai/guard';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = startInterviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await getSession();
  const isLoggedIn = Boolean(session.userId);

  let guestToken: string | null = null;
  if (!isLoggedIn) {
    guestToken = generateGuestToken();
    session.guestToken = guestToken;
    await session.save();
  }

  const interview = await createInterview({
    userId: session.userId ?? null,
    guestToken,
    mode: parsed.data.mode,
    variant: isLoggedIn ? 'full' : 'guest_short',
  });

  if (!interview) {
    return NextResponse.json({ error: 'Kunde inte starta intervjun.' }, { status: 500 });
  }

  try {
    const turn = await takeInterviewTurn({
      interviewId: interview.id,
      userMessage: null,
      userId: session.userId ?? null,
      ipHash: requestIpHash(req),
    });

    return NextResponse.json({
      interviewId: interview.id,
      assistantText: turn.assistantText,
      phaseId: turn.phaseId,
      status: turn.status,
    });
  } catch (err) {
    if (err instanceof BudgetExceededError || err instanceof InterviewBudgetExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }
}
