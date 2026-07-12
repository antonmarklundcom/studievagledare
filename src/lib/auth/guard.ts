import { findUserById } from '@/db/queries/users';
import { getSession, type Role } from './session';

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
  }
}

/**
 * Loads the current user fresh from the DB — the session cookie's role is a
 * hint only, never the source of truth (docs/01 §7). Throws if not logged
 * in, blocked, or deleted.
 */
export async function requireUser() {
  const session = await getSession();
  if (!session.userId) throw new UnauthorizedError();

  const user = await findUserById(session.userId);
  if (!user || user.status !== 'active') throw new UnauthorizedError();

  return user;
}

export async function requireRole(...allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}
