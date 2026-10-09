import { z } from 'zod';
import {
  type ApplicationMode,
  APPLICATION_MODES,
  type ApplicationStage,
  APPLICATION_STAGES,
  type ApplicationStatus,
  APPLICATION_STATUSES,
} from '../types/enums.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Invalid ObjectId format (must be 24-character hexadecimal)');

export const applyJobBodySchema = z.object({
  jobId: objectIdSchema,
  mode: z
    .enum(APPLICATION_MODES as [ApplicationMode, ...ApplicationMode[]])
    .optional()
    .default('PRODUCTION'),
});

export const withdrawApplicationParamsSchema = z.object({
  id: objectIdSchema,
});

export const withdrawApplicationBodySchema = z.object({
  reason: z.string().trim().max(500, 'Withdrawal reason cannot exceed 500 characters').optional(),
});

export const getApplicationParamsSchema = z.object({
  id: objectIdSchema,
});

export const listApplicationsQuerySchema = z.object({
  status: z.enum(APPLICATION_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]).optional(),
  currentStage: z.enum(APPLICATION_STAGES as [ApplicationStage, ...ApplicationStage[]]).optional(),
  companyId: objectIdSchema.optional(),
  jobId: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ApplyJobInput = z.infer<typeof applyJobBodySchema>;
export type WithdrawApplicationBody = z.infer<typeof withdrawApplicationBodySchema>;
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
