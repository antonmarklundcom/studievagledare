/**
 * Zero-cost stand-in for the real Anthropic call, enabled via
 * AI_PROVIDER=mock. Lets the whole plumbing (chat UI, API routes, phase
 * machine, DB persistence) be exercised for free during development.
 *
 * Deliberately dumb: it never calls update_profile or advance_phase, so the
 * profile stays empty and phases only progress via the engine's own
 * maxTurns limit (engine.ts) — exactly the same forced-advance path real
 * usage relies on anyway. It does NOT simulate prompt/conversation quality;
 * that can only be judged against the real model.
 */
const GENERIC_REPLIES = [
  'Vad kul att höra! Berätta gärna lite mer om det.',
  'Okej, tack för det! Vad tycker du är roligast i skolan just nu?',
  'Jag förstår. Vad skulle du säga är din starkaste sida?',
  'Tack för att du delar det. Hur känns det inför valet just nu?',
  'Bra att veta. Finns det något ämne du helst vill undvika?',
  'Intressant! Föredrar du att jobba praktiskt eller mer teoretiskt?',
];

export function mockReply(turnIndex: number): string {
  return `[MOCK] ${GENERIC_REPLIES[turnIndex % GENERIC_REPLIES.length]}`;
}

/**
 * When the caller passes the recommendation tool, the mock proposes the
 * first few candidate indices with placeholder motivations instead of plain
 * text — so the recommendation pipeline (persistence, facts_snapshot,
 * results page) can be exercised for free too. Indices are clamped by the
 * caller against the real candidate list either way (rank.ts), same as a
 * real model's output would be.
 */
export function mockRecommendationSelections(count: number) {
  const n = Math.min(Math.max(count, 1), 5);
  return {
    selections: Array.from({ length: n }, (_, i) => ({
      index: i,
      motivation: `[MOCK] Passar utifrån det du berättat i intervjun (plats ${i + 1}).`,
    })),
  };
}
