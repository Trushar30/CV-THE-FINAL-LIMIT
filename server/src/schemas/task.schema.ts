import { z } from 'zod';

/**
 * Strict output schema for daily employee task generation per Task P7.2 and Spec Section 9, 26.17.
 *
 * Expected fields:
 * - title: Short, professional task title
 * - scenario: Real-world engineering scenario context grounded in company operations
 * - requirements: Specific functional and technical expectations
 * - difficulty: Advisory difficulty level ('EASY' | 'MEDIUM' | 'HARD') - backend enforces authoritatively
 * - evaluationCriteria: Rubric criteria used to assess task submissions
 */
export const taskGenerationOutputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Task title must be at least 3 characters')
    .max(160, 'Task title cannot exceed 160 characters'),
  scenario: z
    .string()
    .trim()
    .min(20, 'Task scenario context must be at least 20 characters'),
  requirements: z
    .array(z.string().trim().min(3))
    .min(1, 'Task must specify at least one requirement'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  evaluationCriteria: z
    .array(z.string().trim().min(3))
    .min(1, 'Task must specify at least one evaluation criterion'),
});

export type TaskGenerationOutput = z.infer<typeof taskGenerationOutputSchema>;

/**
 * JSON Schema descriptor for AIGateway structured output validation
 */
export const taskGenerationJsonSchema: Record<string, unknown> = {
  type: 'object',
  required: ['title', 'scenario', 'requirements', 'difficulty', 'evaluationCriteria'],
  properties: {
    title: {
      type: 'string',
      description: 'Concise, realistic title of the daily engineering task',
    },
    scenario: {
      type: 'string',
      description: 'The real-world business and technical scenario explaining the problem in company context',
    },
    requirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of specific technical tasks and implementation requirements for the employee',
    },
    difficulty: {
      type: 'string',
      enum: ['EASY', 'MEDIUM', 'HARD'],
      description: 'Target task difficulty tier',
    },
    evaluationCriteria: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key criteria that will be used to evaluate the employee submission',
    },
  },
  additionalProperties: false,
};
