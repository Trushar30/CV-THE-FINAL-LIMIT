import { z } from 'zod';
import { CAREER_DOMAINS } from '../types/enums.js';

export const createDemoSessionSchema = z.object({
  domain: z.enum(CAREER_DOMAINS as [string, ...string[]], {
    errorMap: () => ({
      message: `domain must be one of: ${CAREER_DOMAINS.join(', ')}`,
    }),
  }),
  questionsCount: z.coerce
    .number({ invalid_type_error: 'questionsCount must be a number' })
    .int('questionsCount must be an integer')
    .min(1, 'questionsCount must be at least 1')
    .max(10, 'questionsCount cannot exceed 10')
    .default(3),
  difficulty: z
    .enum(['EASY', 'MEDIUM', 'HARD', 'JUNIOR', 'MID', 'SENIOR'])
    .default('EASY')
    .transform((val) => {
      if (val === 'JUNIOR') return 'EASY';
      if (val === 'MID') return 'MEDIUM';
      if (val === 'SENIOR') return 'HARD';
      return val as 'EASY' | 'MEDIUM' | 'HARD';
    }),
  interviewType: z
    .string()
    .trim()
    .min(1, 'interviewType cannot be empty')
    .max(100, 'interviewType cannot exceed 100 characters')
    .default('TECHNICAL_DEEP_DIVE'),
});

export const demoSessionIdParamsSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID format'),
});

export const demoAnswerInputSchema = z.object({
  answer: z
    .string({ required_error: 'answer is required' })
    .trim()
    .min(1, 'Answer cannot be empty')
    .max(5000, 'Answer cannot exceed 5000 characters'),
});

export type CreateDemoSessionInput = z.infer<typeof createDemoSessionSchema>;
export type DemoSessionIdParams = z.infer<typeof demoSessionIdParamsSchema>;
export type DemoAnswerInput = z.infer<typeof demoAnswerInputSchema>;
