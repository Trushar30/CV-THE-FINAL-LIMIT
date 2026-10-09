import { z } from 'zod';

/**
 * Schema for AI Final Review Summary Generation (Task P6.4)
 * Strict output: { summary, recommendations }
 */
export const finalReviewSummaryOutputSchema = z.object({
  summary: z.string().trim().min(10, 'summary must be at least 10 characters'),
  recommendations: z.array(z.string().trim().min(1)).default([]),
});

export type FinalReviewSummaryOutput = z.infer<typeof finalReviewSummaryOutputSchema>;

export const finalReviewSummaryJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Comprehensive executive summary of candidate performance across all stages.',
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Actionable suggestions or recommended focus areas for onboarding/growth.',
    },
  },
  required: ['summary', 'recommendations'],
  additionalProperties: false,
};

/**
 * Schema for AI Offer Negotiation Turn (Task P6.4)
 * Strict output: { aiResponse, counterOfferSalary? }
 */
export const offerNegotiationOutputSchema = z.object({
  aiResponse: z.string().trim().min(5, 'aiResponse must be at least 5 characters'),
  counterOfferSalary: z.number().int().positive().optional(),
});

export type OfferNegotiationOutput = z.infer<typeof offerNegotiationOutputSchema>;

export const offerNegotiationJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    aiResponse: {
      type: 'string',
      description: 'The hiring manager or recruiter response discussing compensation and terms.',
    },
    counterOfferSalary: {
      type: 'integer',
      description: 'Revised counter-offer salary (simulated) if adjusted, or omit if maintaining previous.',
    },
  },
  required: ['aiResponse'],
  additionalProperties: false,
};

/**
 * Request body schema for Candidate Offer Negotiation
 */
export const negotiateOfferBodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Negotiation message is required')
    .max(1000, 'Message cannot exceed 1000 characters'),
  requestedSalary: z
    .number()
    .int('requestedSalary must be an integer')
    .positive('requestedSalary must be positive')
    .optional(),
});

export type NegotiateOfferBody = z.infer<typeof negotiateOfferBodySchema>;

/**
 * Request body schema for Candidate Offer Decline
 */
export const declineOfferBodySchema = z.object({
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export type DeclineOfferBody = z.infer<typeof declineOfferBodySchema>;
