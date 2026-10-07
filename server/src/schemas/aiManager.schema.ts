import { z } from 'zod';
import {
  AI_PROVIDERS,
  AIProvider,
  PROVIDER_HEALTH_STATES,
  ProviderHealthState,
} from '../types/enums.js';
import { AI_POOLS, AIPool } from '../ai/types.js';

export const createProviderSchema = z.object({
  code: z.enum(AI_PROVIDERS as [AIProvider, ...AIProvider[]]),
  name: z.string().min(1, 'Provider name is required').max(100),
  priority: z.coerce.number().int().min(1, 'Priority must be at least 1').max(100),
  pool: z.enum(AI_POOLS as [AIPool, ...AIPool[]]).default('PIPELINE'),
  modelId: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  rateLimitRpm: z.coerce.number().int().positive().optional().default(60),
  dailyLimit: z.coerce.number().int().positive().optional(),
  reason: z.string().min(3, 'Audit reason must be at least 3 characters').max(500),
});

export const updateProviderSchema = z.object({
  priority: z.coerce.number().int().min(1).max(100).optional(),
  modelId: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  status: z
    .enum(PROVIDER_HEALTH_STATES as [ProviderHealthState, ...ProviderHealthState[]])
    .optional(),
  rateLimitRpm: z.coerce.number().int().positive().optional(),
  dailyLimit: z.coerce.number().int().positive().optional(),
  reason: z.string().min(3, 'Audit reason must be at least 3 characters').max(500),
});

export const statusActionSchema = z.object({
  reason: z.string().min(3, 'Audit reason must be at least 3 characters').max(500),
});

export const queryPoolSchema = z.object({
  pool: z.enum(AI_POOLS as [AIPool, ...AIPool[]]).optional(),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type StatusActionInput = z.infer<typeof statusActionSchema>;
