import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { studentProfilePatchSchema, type StudentProfilePatch } from '@/lib/contracts/profile';

/**
 * The model's only two levers on the interview state (docs/01 §2): patch the
 * profile with whatever it just learned, and signal that the current
 * phase's goals are met. The server still enforces maxTurns regardless —
 * advance_phase is a suggestion, not a guarantee (see engine.ts).
 */
export const UPDATE_PROFILE_TOOL: Anthropic.Tool = {
  name: 'update_profile',
  description:
    'Spara det du just fått reda på om eleven i den strukturerade profilen. Skicka bara de fält du faktiskt fick information om denna tur. Använd ALDRIG fritext för constraints eller uncertainties — bara de angivna kategorierna.',
  input_schema: zodToJsonSchema(studentProfilePatchSchema, {
    target: 'openApi3',
  }) as Anthropic.Tool.InputSchema,
};

export const ADVANCE_PHASE_TOOL: Anthropic.Tool = {
  name: 'advance_phase',
  description:
    'Signalera att den här fasens mål är uppfyllda och att intervjun kan gå vidare till nästa ämne. Servern avgör det slutgiltiga beslutet.',
  input_schema: { type: 'object', properties: {} },
};

export const INTERVIEW_TOOLS = [UPDATE_PROFILE_TOOL, ADVANCE_PHASE_TOOL];

export interface ProcessedTurn {
  assistantText: string;
  profilePatch: StudentProfilePatch;
  advanceRequested: boolean;
  rejectedPatches: Array<{ raw: unknown; error: string }>;
}

/**
 * Extracts text + tool calls from a model response. Invalid update_profile
 * inputs are dropped (not thrown) so one malformed tool call doesn't blow up
 * an otherwise-fine turn — the model never gets to write unvalidated data
 * into the profile either way (docs/01 §2).
 */
export function processTurn(content: Anthropic.ContentBlock[]): ProcessedTurn {
  let assistantText = '';
  let profilePatch: StudentProfilePatch = {};
  let advanceRequested = false;
  const rejectedPatches: Array<{ raw: unknown; error: string }> = [];

  for (const block of content) {
    if (block.type === 'text') {
      assistantText += block.text;
      continue;
    }
    if (block.type !== 'tool_use') continue;

    if (block.name === 'update_profile') {
      const result = studentProfilePatchSchema.safeParse(block.input);
      if (result.success) {
        profilePatch = { ...profilePatch, ...result.data };
      } else {
        rejectedPatches.push({ raw: block.input, error: result.error.message });
      }
    } else if (block.name === 'advance_phase') {
      advanceRequested = true;
    }
  }

  return { assistantText, profilePatch, advanceRequested, rejectedPatches };
}
