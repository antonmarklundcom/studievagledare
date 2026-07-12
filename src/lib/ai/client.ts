import Anthropic from '@anthropic-ai/sdk';
import { assertWithinBudget, logAiUsage } from './guard';
import { assertPseudonymous } from './pseudonymize';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function interviewModel(): string {
  const model = process.env.AI_MODEL_INTERVIEW;
  if (!model) throw new Error('AI_MODEL_INTERVIEW is not set.');
  return model;
}

export function reportModel(): string {
  const model = process.env.AI_MODEL_REPORT;
  if (!model) throw new Error('AI_MODEL_REPORT is not set.');
  return model;
}

interface CallParams {
  purpose: 'interview' | 'report';
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens: number;
  userId?: number | null;
  ipHash?: string | null;
  /** Values that must never appear in the outgoing payload (docs/04 Risk 2). */
  knownIdentifiers?: string[];
}

/**
 * The ONLY sanctioned way to call Anthropic in this codebase. Every AI
 * request goes through the budget guard and the pseudonymization vakt first
 * — never import the Anthropic SDK directly elsewhere (docs/01 §2, "AI-anrop
 * går ALLTID via server").
 */
export async function callClaude(params: CallParams) {
  await assertWithinBudget();
  assertPseudonymous(
    { system: params.system, messages: params.messages },
    params.knownIdentifiers,
  );

  const response = await getClient().messages.create({
    model: params.model,
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    max_tokens: params.maxTokens,
  });

  await logAiUsage({
    userId: params.userId,
    ipHash: params.ipHash,
    purpose: params.purpose,
    model: params.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return response;
}
