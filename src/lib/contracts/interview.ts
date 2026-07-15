import { z } from 'zod';

// 'hogskola' is Fas 2 scope (docs/05) — not accepted yet.
export const startInterviewSchema = z.object({
  mode: z.enum(['gymnasieval']).default('gymnasieval'),
});

export const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});
