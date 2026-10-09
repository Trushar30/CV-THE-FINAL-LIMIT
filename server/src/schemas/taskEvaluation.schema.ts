import { z } from 'zod';

/**
 * Input schema for submitting a daily task
 */
export const taskSubmissionInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(10, 'Task submission content must be at least 10 characters')
    .max(50000, 'Task submission content cannot exceed 50,000 characters'),
});

export type TaskSubmissionInput = z.infer<typeof taskSubmissionInputSchema>;

/**
 * Criterion-level score detail from AI evaluation
 */
export const criterionScoreSchema = z.object({
  criterion: z.string().trim().min(1),
  score: z.number().min(0).max(100),
  comment: z.string().trim().default(''),
});

export type CriterionScore = z.infer<typeof criterionScoreSchema>;

/**
 * Strict output schema for TASK_EVALUATION AI tasks per Task P7.3 and Spec Section 9, 11
 */
export const taskEvaluationOutputSchema = z.object({
  score: z
    .number()
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100'),
  strengths: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one strength must be documented'),
  weaknesses: z
    .array(z.string().trim().min(1))
    .default([]),
  feedback: z
    .string()
    .trim()
    .min(10, 'Constructive feedback must be at least 10 characters'),
  criteriaScores: z
    .array(criterionScoreSchema)
    .default([]),
});

export type TaskEvaluationOutput = z.infer<typeof taskEvaluationOutputSchema>;

/**
 * JSON Schema descriptor for AIGateway structured output validation
 */
export const taskEvaluationJsonSchema: Record<string, unknown> = {
  type: 'object',
  required: ['score', 'strengths', 'weaknesses', 'feedback', 'criteriaScores'],
  properties: {
    score: {
      type: 'number',
      description: 'Overall technical solution performance score between 0 and 100',
      minimum: 0,
      maximum: 100,
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific positive technical deliverables or strengths observed in the submission',
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific areas of deficiency, missed edge cases, or potential architectural issues',
    },
    feedback: {
      type: 'string',
      description: 'Comprehensive, constructive feedback explaining the score and areas for technical improvement',
    },
    criteriaScores: {
      type: 'array',
      items: {
        type: 'object',
        required: ['criterion', 'score', 'comment'],
        properties: {
          criterion: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          comment: { type: 'string' },
        },
      },
      description: 'Detailed scores against each rubric evaluation criterion',
    },
  },
  additionalProperties: false,
};
