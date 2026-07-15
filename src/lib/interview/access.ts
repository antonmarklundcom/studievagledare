import { hashGuestToken } from '@/db/queries/interviews';

/**
 * A logged-in interview belongs to its user; a guest interview belongs to
 * whoever holds the guest_token cookie (docs/01 §4). Never both — one or
 * the other, checked here so no route re-derives this logic ad hoc.
 */
export function ownsInterview(
  interview: { userId: number | null; guestTokenHash: string | null },
  ctx: { userId?: number | null; guestToken?: string | null },
): boolean {
  if (interview.userId !== null) {
    return ctx.userId != null && interview.userId === ctx.userId;
  }
  if (interview.guestTokenHash !== null && ctx.guestToken) {
    return interview.guestTokenHash === hashGuestToken(ctx.guestToken);
  }
  return false;
}
