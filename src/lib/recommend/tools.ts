import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * The model's only output here: pick 3–7 indices from the candidate list it
 * was given and write a motivation for each. It cannot invent a program —
 * there is no free-text program name/id field, only an index into the list
 * we sent it (docs/01 §3: "Du får ENDAST referera fakta ur kandidatlistan").
 */
export const submitRecommendationsSchema = z.object({
  selections: z
    .array(
      z.object({
        index: z.number().int().min(0),
        motivation: z.string().min(1).max(500),
      }),
    )
    .min(1)
    .max(7),
});

export type SubmitRecommendations = z.infer<typeof submitRecommendationsSchema>;

export const SUBMIT_RECOMMENDATIONS_TOOL: Anthropic.Tool = {
  name: 'submit_recommendations',
  description:
    'Välj 3–7 av kandidaterna (via deras index i listan du fick) som bäst passar eleven, rankade bäst först, med en kort motivering per val som refererar elevens profil.',
  input_schema: {
    type: 'object',
    properties: {
      selections: {
        type: 'array',
        minItems: 1,
        maxItems: 7,
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', minimum: 0 },
            motivation: { type: 'string', maxLength: 500 },
          },
          required: ['index', 'motivation'],
        },
      },
    },
    required: ['selections'],
  },
};

export function extractSelections(content: Anthropic.ContentBlock[]): SubmitRecommendations | null {
  for (const block of content) {
    if (block.type !== 'tool_use' || block.name !== 'submit_recommendations') continue;
    const result = submitRecommendationsSchema.safeParse(block.input);
    if (result.success) return result.data;
  }
  return null;
}
