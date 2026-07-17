import { NextRequest, NextResponse } from 'next/server';
import { claimGuestInterviewsForUser } from '@/db/queries/interviews';
import { createUser, findUserByEmail, recordConsent } from '@/db/queries/users';
import { hashPassword } from '@/lib/auth/password';
import { getSession } from '@/lib/auth/session';
import { isUnderAgeLimit, registerSchema } from '@/lib/contracts/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, birthYear, displayName, role } = parsed.data;

  // Hard age gate — never build for under-13 (spec §6). Reject, don't degrade.
  if (isUnderAgeLimit(birthYear)) {
    return NextResponse.json(
      { error: 'Studievägledare kan tyvärr inte användas av barn under 13 år.' },
      { status: 403 },
    );
  }

  // Read before we start mutating the session below (docs/01 §4 gäst→konto merge).
  const session = await getSession();
  const guestToken = session.guestToken;

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: 'E-postadressen är redan registrerad.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    email,
    passwordHash,
    birthYear,
    displayName,
    role,
  });

  if (!user) {
    return NextResponse.json({ error: 'Kunde inte skapa kontot.' }, { status: 500 });
  }

  await recordConsent({
    userId: user.id,
    type: 'terms_privacy',
    action: 'granted',
    source: 'register_form',
    policyVersion: 'v0.1',
  });

  const claimedInterviewId = guestToken
    ? await claimGuestInterviewsForUser(guestToken, user.id)
    : null;

  session.userId = user.id;
  session.role = user.role;
  delete session.guestToken;
  await session.save();

  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
    claimedInterviewId,
  });
}
