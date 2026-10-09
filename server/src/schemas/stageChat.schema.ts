import { z } from 'zod';

/**
 * Strict schema for AI Question Generation per Task P6.3
 * Output: { question, type, difficulty, expectedPoints }
 */
export const stageQuestionOutputSchema = z.object({
  question: z.string().trim().min(5, 'question must be at least 5 characters'),
  type: z.string().trim().min(1, 'type must be a non-empty string'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  expectedPoints: z
    .array(z.string().trim().min(1))
    .min(1, 'expectedPoints must have at least one key criterion'),
});

export type StageQuestionOutput = z.infer<typeof stageQuestionOutputSchema>;

export const stageQuestionJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description: 'The interview question tailored to the candidate and role.',
    },
    type: {
      type: 'string',
      description: 'Question category (e.g., CONCEPTUAL, CODING, ARCHITECTURE, BEHAVIORAL).',
    },
    difficulty: {
      type: 'string',
      enum: ['EASY', 'MEDIUM', 'HARD'],
      description: 'The target difficulty tier.',
    },
    expectedPoints: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key concepts or criteria an ideal response should touch on.',
    },
  },
  required: ['question', 'type', 'difficulty', 'expectedPoints'],
  additionalProperties: false,
};

/**
 * Strict schema for AI Answer Evaluation per Task P6.3
 * Output: { score 0-100, strengths, weaknesses, notes }
 */
export const stageAnswerEvaluationOutputSchema = z.object({
  score: z
    .number()
    .min(0, 'score cannot be negative')
    .max(100, 'score cannot exceed 100'),
  strengths: z.array(z.string().trim().min(1)).default([]),
  weaknesses: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().min(1, 'notes must not be empty'),
});

export type StageAnswerEvaluationOutput = z.infer<typeof stageAnswerEvaluationOutputSchema>;

export const stageAnswerEvaluationJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    score: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Quantitative rating of candidate answer from 0 to 100.',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Strong aspects demonstrated in the response.',
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Gaps, inaccuracies, or omitted points.',
    },
    notes: {
      type: 'string',
      description: 'Summary observation of the candidate response.',
    },
  },
  required: ['score', 'strengths', 'weaknesses', 'notes'],
  additionalProperties: false,
};

/**
 * Strict schema for AI Rejection Feedback per Task P6.3
 * Output: { whatToImprove, whatToAdd, skillsToWorkOn, summary }
 */
export const stageRejectionFeedbackOutputSchema = z.object({
  whatToImprove: z
    .array(z.string().trim().min(1))
    .min(1, 'whatToImprove must provide at least one suggestion'),
  whatToAdd: z
    .array(z.string().trim().min(1))
    .min(1, 'whatToAdd must provide at least one addition'),
  skillsToWorkOn: z
    .array(z.string().trim().min(1))
    .min(1, 'skillsToWorkOn must list at least one skill'),
  summary: z.string().trim().min(10, 'summary must provide an overview critique'),
});

export type StageRejectionFeedbackOutput = z.infer<typeof stageRejectionFeedbackOutputSchema>;

export const stageRejectionFeedbackJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    whatToImprove: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific areas of knowledge or answering style to improve.',
    },
    whatToAdd: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific topics or technologies to add to the candidate background.',
    },
    skillsToWorkOn: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete skills or tools the candidate should practice.',
    },
    summary: {
      type: 'string',
      description: 'Overall diagnostic summary of why the stage was not cleared.',
    },
  },
  required: ['whatToImprove', 'whatToAdd', 'skillsToWorkOn', 'summary'],
  additionalProperties: false,
};

/**
 * REST Request validation schema for submitting an answer
 */
export const postAnswerBodySchema = z.object({
  answer: z
    .string({ required_error: 'answer is required' })
    .trim()
    .min(1, 'answer cannot be empty')
    .max(10000, 'answer cannot exceed 10,000 characters'),
  questionSequence: z
    .number()
    .int()
    .min(1)
    .optional(),
});

export type PostAnswerInput = z.infer<typeof postAnswerBodySchema>;
