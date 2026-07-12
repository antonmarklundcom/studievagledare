import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/db/queries/users';
import { verifyPassword } from '@/lib/auth/password';
import { getSession } from '@/lib/auth/session';
import { loginSchema } from '@/lib/contracts/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't leak which one it was.
  const invalid = () =>
    NextResponse.json({ error: 'Fel e-postadress eller lösenord.' }, { status: 401 });

  if (!user || user.status !== 'active') return invalid();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid();

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  await session.save();

  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
  });
}
