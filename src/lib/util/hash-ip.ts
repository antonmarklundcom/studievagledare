import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

/** Next 15 doesn't expose req.ip reliably behind a proxy — read the forwarded header instead. */
export function requestIpHash(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim();
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}
