import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type Role = 'student' | 'syv' | 'school_admin' | 'municipality' | 'admin';

export interface SessionData {
  userId?: number;
  role?: Role;
  // Hint only — every access decision is re-checked against the DB in
  // db/queries/*, never trusted from the cookie alone (see docs/01 §7).
}

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set and at least 32 characters. Generate with: openssl rand -hex 32',
    );
  }
  return secret;
}

function sessionOptions(): SessionOptions {
  return {
    password: requireSessionSecret(),
    cookieName: 'sv_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

// Resolved lazily (not at module load) so importing this file doesn't blow up
// build-time static analysis before env vars are available.
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
