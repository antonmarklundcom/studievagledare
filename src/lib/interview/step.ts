import { callClaude, interviewModel } from '@/lib/ai/client';
import { mergeProfilePatch } from '@/lib/contracts/profile';
import {
  appendMessage,
  completeInterview,
  getInterviewById,
  getMessages,
  getProfileDraft,
  pauseInterview,
  saveProfileDraft,
  updateEngineState,
} from '@/db/queries/interviews';
import { advancePhase, getCurrentPhase, recordTurn, shouldForceAdvance } from './engine';
import { buildSystemPrompt } from './prompt';
import { INTERVIEW_TOOLS, processTurn } from './tools';
import type { EngineState } from './types';

const INTERVIEW_MAX_OUTPUT_TOKENS = 1024;
// Sliding window, not the full transcript — the profile JSON is the engine's
// memory, not the chat history (docs/01 §2).
const MESSAGE_WINDOW = 10;

export class InterviewNotActiveError extends Error {
  constructor() {
    super('Den här intervjun är inte aktiv.');
  }
}

export class InterviewBudgetExceededError extends Error {
  constructor() {
    super('Den här intervjun har nått sin tokenbudget just nu. Försök igen senare.');
  }
}

export interface TurnResult {
  assistantText: string;
  phaseId: string;
  status: 'active' | 'completed' | 'paused';
}

/**
 * Runs exactly one turn of the interview: persists the student's message (if
 * any), asks the model for a reply within the current phase's frame, applies
 * whatever profile patch it returns, and lets the engine — not the model —
 * decide whether to advance or finish. This is the only place that ties the
 * phase machine, the profile contract, and the AI client together.
 */
export async function takeInterviewTurn(input: {
  interviewId: number;
  userMessage: string | null;
  userId?: number | null;
  ipHash?: string | null;
  knownIdentifiers?: string[];
}): Promise<TurnResult> {
  const interview = await getInterviewById(input.interviewId);
  if (!interview || interview.status !== 'active') throw new InterviewNotActiveError();

  const maxTokensPerInterview = Number(process.env.AI_MAX_TOKENS_PER_INTERVIEW ?? '0');
  const usedTokens = interview.inputTokensUsed + interview.outputTokensUsed;
  if (maxTokensPerInterview > 0 && usedTokens >= maxTokensPerInterview) {
    await pauseInterview(input.interviewId);
    throw new InterviewBudgetExceededError();
  }

  if (input.userMessage !== null) {
    await appendMessage({ interviewId: input.interviewId, role: 'user', content: input.userMessage });
  }

  const engineState = interview.engineState as EngineState;
  const phase = getCurrentPhase(interview.mode, interview.variant, engineState);
  const profile = await getProfileDraft(input.interviewId);
  const history = await getMessages(input.interviewId, MESSAGE_WINDOW);

  const system = buildSystemPrompt({
    mode: interview.mode,
    phase,
    profile,
    isFirstTurn: input.userMessage === null,
  });

  const response = await callClaude({
    purpose: 'interview',
    model: interviewModel(),
    system,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    tools: INTERVIEW_TOOLS,
    maxTokens: INTERVIEW_MAX_OUTPUT_TOKENS,
    userId: input.userId,
    ipHash: input.ipHash,
    knownIdentifiers: input.knownIdentifiers,
  });

  const { assistantText, profilePatch, advanceRequested, rejectedPatches } = processTurn(
    response.content,
  );

  if (rejectedPatches.length) {
    console.warn(`[interview ${input.interviewId}] rejected profile patch(es):`, rejectedPatches);
  }

  const updatedProfile = mergeProfilePatch(profile, profilePatch);
  await saveProfileDraft(input.interviewId, updatedProfile);

  const replyText =
    assistantText.trim() ||
    'Kan du berätta lite mer om det, så vi kan fortsätta?';

  await appendMessage({
    interviewId: input.interviewId,
    role: 'assistant',
    content: replyText,
    toolPatch: Object.keys(profilePatch).length ? profilePatch : null,
  });

  let nextState = recordTurn(engineState);
  const mustAdvance = shouldForceAdvance(interview.mode, interview.variant, nextState);

  let status: TurnResult['status'] = 'active';
  if (mustAdvance || advanceRequested) {
    const advanced = advancePhase(interview.mode, interview.variant, nextState);
    if (advanced === null) {
      status = 'completed';
      await completeInterview(input.interviewId);
    } else {
      nextState = advanced;
    }
  }

  // Token usage is recorded either way, even if the interview just completed.
  await updateEngineState(input.interviewId, nextState, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return { assistantText: replyText, phaseId: nextState.phaseId, status };
}
