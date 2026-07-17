import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById } from '@/db/queries/interviews';
import { getSession } from '@/lib/auth/session';
import { BudgetExceededError } from '@/lib/ai/guard';
import { ownsInterview } from '@/lib/interview/access';
import { generateRecommendations, NoCandidatesError, NoValidSelectionsError } from '@/lib/recommend/generate';
import { requestIpHash } from '@/lib/util/hash-ip';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const interviewId = Number(id);
  if (!Number.isInteger(interviewId)) {
    return NextResponse.json({ error: 'Ogiltigt intervju-id.' }, { status: 400 });
  }

  const interview = await getInterviewById(interviewId);
  if (!interview) {
    return NextResponse.json({ error: 'Intervjun hittades inte.' }, { status: 404 });
  }

  const session = await getSession();
  if (!ownsInterview(interview, { userId: session.userId, guestToken: session.guestToken })) {
    return NextResponse.json({ error: 'Du har inte åtkomst till den här intervjun.' }, { status: 403 });
  }

  if (interview.status !== 'completed') {
    return NextResponse.json({ error: 'Intervjun är inte klar än.' }, { status: 409 });
  }

  try {
    const recommendation = await generateRecommendations({
      interviewId,
      userId: session.userId ?? null,
      ipHash: requestIpHash(req),
    });

    return NextResponse.json({ recommendation });
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof NoCandidatesError || err instanceof NoValidSelectionsError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
