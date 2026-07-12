/**
 * Approximate USD pricing per 1M tokens, used only to estimate spend against
 * the daily SEK budget (docs/01 §2 "Kostnadsvakt"). This is NOT billing —
 * actual cost comes from the Anthropic invoice. Update when prices change;
 * unknown models fall back to a conservative default so the guard fails
 * closed (overestimates cost) rather than open.
 */
const USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 15, output: 75 },
};

const FALLBACK_PRICE = { input: 15, output: 75 };

function usdPerMillion(model: string) {
  return USD_PER_MILLION_TOKENS[model] ?? FALLBACK_PRICE;
}

export function estimateCostSek(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = usdPerMillion(model);
  const usd = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  const usdToSek = Number(process.env.AI_USD_TO_SEK ?? '10.5');
  return usd * usdToSek;
}
