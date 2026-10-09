import { z } from 'zod';

/**
 * Strict output schema for ATS_SCREEN AI tasks per Task P6.2 and Spec Sections 7, 8.
 *
 * Constraints:
 * - matchScore: number clamped between 0 and 100
 * - matchedSkills: array of detected candidate skills aligned with job requisition
 * - missingSkills: array of job required skills missing in candidate resume
 * - strengths: strengths explicitly referencing verified resume content
 * - weaknesses: weaknesses explicitly referencing verified resume content
 * - improvementSuggestions: actionable next steps for the candidate
 * - recommendation: AI recommendation (PASS or FAIL) - backend decides authoritatively
 */
export const atsScreeningOutputSchema = z.object({
  matchScore: z
    .number()
    .min(0, 'matchScore cannot be negative')
    .max(100, 'matchScore cannot exceed 100'),
  matchedSkills: z.array(z.string().trim().min(1)).default([]),
  missingSkills: z.array(z.string().trim().min(1)).default([]),
  strengths: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one strength must be documented referencing candidate resume'),
  weaknesses: z
    .array(z.string().trim().min(1))
    .default([]),
  improvementSuggestions: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one actionable improvement suggestion is required'),
  recommendation: z.enum(['PASS', 'FAIL']),
});

export type AtsScreeningOutput = z.infer<typeof atsScreeningOutputSchema>;

/**
 * JSON Schema for LLM structured output enforcement via Provider adapters
 */
export const atsScreeningJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    matchScore: {
      type: 'number',
      description: 'Overall suitability match score from 0 to 100 based on domain, skills, and experience.',
      minimum: 0,
      maximum: 100,
    },
    matchedSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Skills present in candidate resume that match job requirements.',
    },
    missingSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Skills required by the job that are missing from candidate resume.',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Explicit strengths evidenced in the candidate resume and verified profile.',
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Gaps, weaknesses, or areas of shortfall relative to the job requirements.',
    },
    improvementSuggestions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Actionable, concrete suggestions for the candidate to improve their profile or resume.',
    },
    recommendation: {
      type: 'string',
      enum: ['PASS', 'FAIL'],
      description: 'AI recommendation for candidate advancement (PASS if overall match >= 70, FAIL otherwise).',
    },
  },
  required: [
    'matchScore',
    'matchedSkills',
    'missingSkills',
    'strengths',
    'weaknesses',
    'improvementSuggestions',
    'recommendation',
  ],
  additionalProperties: false,
};
