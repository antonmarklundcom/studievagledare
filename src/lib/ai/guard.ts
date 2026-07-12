import { gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiUsage } from '@/db/schema';
import { estimateCostSek } from './pricing';

export class BudgetExceededError extends Error {
  constructor(reason: string) {
    super(reason);
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Checked BEFORE every AI call (docs/01 §2, spec §7 "AI-kostnadstak").
 * Fails closed: global kill switch, then dygnsbudget in SEK, computed from
 * today's logged usage. Per-interview token caps are enforced separately by
 * the interview engine's maxTurns config, not here.
 */
export async function assertWithinBudget(): Promise<void> {
  if (process.env.AI_KILL_SWITCH === 'true') {
    throw new BudgetExceededError('AI-tjänsten är tillfälligt avstängd (kill switch).');
  }

  const dailyBudgetSek = Number(process.env.AI_DAILY_BUDGET_SEK ?? '0');
  if (!dailyBudgetSek || dailyBudgetSek <= 0) return; // no budget configured = no cap (dev default)

  const rows = await db
    .select({ model: aiUsage.model, inputTokens: aiUsage.inputTokens, outputTokens: aiUsage.outputTokens })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, startOfTodayUtc()));

  const spentSek = rows.reduce(
    (sum, r) => sum + estimateCostSek(r.model, r.inputTokens, r.outputTokens),
    0,
  );

  if (spentSek >= dailyBudgetSek) {
    throw new BudgetExceededError(
      `Dygnsbudgeten för AI (${dailyBudgetSek} SEK) är förbrukad. Försök igen imorgon.`,
    );
  }
}

export async function logAiUsage(input: {
  userId?: number | null;
  ipHash?: string | null;
  purpose: 'interview' | 'report';
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await db.insert(aiUsage).values({
    userId: input.userId ?? null,
    ipHash: input.ipHash ?? null,
    purpose: input.purpose,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  });
}
