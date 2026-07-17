import Anthropic from '@anthropic-ai/sdk';
import { assertWithinBudget, logAiUsage } from './guard';
import { mockReply, mockRecommendationSelections } from './mock';
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

/** What every caller (step.ts) relies on — kept independent of the SDK's own
 * Message type so the mock branch can return a plain object, not a fake SDK
 * instance. */
export interface AiCallResult {
  content: Anthropic.ContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

function isMockMode(): boolean {
  return process.env.AI_PROVIDER === 'mock';
}

/**
 * The ONLY sanctioned way to call an AI model in this codebase. Every
 * request goes through the budget guard and the pseudonymization vakt first
 * — never import the Anthropic SDK directly elsewhere (docs/01 §2, "AI-anrop
 * går ALLTID via server").
 *
 * Set AI_PROVIDER=mock to skip the real API entirely (see ./mock.ts) — free,
 * useful for exercising the chat UI/engine/DB plumbing, not for judging
 * conversation quality.
 */
export async function callClaude(params: CallParams): Promise<AiCallResult> {
  await assertWithinBudget();
  assertPseudonymous(
    { system: params.system, messages: params.messages },
    params.knownIdentifiers,
  );

  if (isMockMode()) {
    await logAiUsage({
      userId: params.userId,
      ipHash: params.ipHash,
      purpose: params.purpose,
      model: 'mock',
      inputTokens: 0,
      outputTokens: 0,
    });

    const recommendationTool = params.tools?.find((t) => t.name === 'submit_recommendations');
    if (recommendationTool) {
      return {
        content: [
          {
            type: 'tool_use',
            id: 'mock_tool_use_1',
            name: 'submit_recommendations',
            input: mockRecommendationSelections(5),
          },
        ],
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    }

    const text = mockReply(params.messages.length);
    return {
      content: [{ type: 'text', text }],
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

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
