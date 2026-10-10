import { z } from 'zod';
import { AI_JOB_STATUSES, type AIJobStatus } from '../types/enums.js';
import { AI_POOLS, AI_TASK_TYPES, type AIPool, type AITaskType } from '../ai/types.js';

/**
 * Zod validation schemas for Admin Analytics & Telemetry (TASK P9.4).
 * Enforces bounded date ranges and indexed parameter filters to prevent
 * unindexed table scans on large production databases.
 */

const MAX_DATE_RANGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days max bounded window

export const boundedDateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    interval: z.enum(['day', 'week', 'month']).default('day'),
  })
  .refine(
    (data) => {
      const now = new Date();
      const end = data.endDate || now;
      const start = data.startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return start.getTime() <= end.getTime();
    },
    {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    }
  )
  .refine(
    (data) => {
      const now = new Date();
      const end = data.endDate || now;
      const start = data.startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return end.getTime() - start.getTime() <= MAX_DATE_RANGE_MS;
    },
    {
      message: 'Date range window cannot exceed 90 days to prevent unindexed database scans',
      path: ['endDate'],
    }
  );

export type BoundedDateRangeInput = z.infer<typeof boundedDateRangeSchema>;

// Helper to resolve validated defaults
export function resolveDateRange(query?: Partial<BoundedDateRangeInput>): {
  startDate: Date;
  endDate: Date;
  interval: 'day' | 'week' | 'month';
} {
  const endDate = query?.endDate ? new Date(query.endDate) : new Date();
  const startDate = query?.startDate
    ? new Date(query.startDate)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const interval = query?.interval || 'day';

  return { startDate, endDate, interval };
}

// 1. Audit Logs Viewer Query Schema
export const auditLogsViewerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().trim().optional(),
  actorRole: z.enum(['ADMIN', 'AI_MANAGER']).optional(),
  action: z.string().trim().optional(),
  targetType: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type AuditLogsViewerQueryInput = z.infer<typeof auditLogsViewerQuerySchema>;

// 2. AI Logs Viewer Query Schema
export const aiLogsViewerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  providerCode: z.string().trim().optional(),
  taskType: z.enum(AI_TASK_TYPES as unknown as [AITaskType, ...AITaskType[]]).optional(),
  pool: z.enum(AI_POOLS as unknown as [AIPool, ...AIPool[]]).optional(),
  success: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type AiLogsViewerQueryInput = z.infer<typeof aiLogsViewerQuerySchema>;

// 3. AI Queue Viewer Query Schema
export const aiQueueViewerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(AI_JOB_STATUSES as unknown as [AIJobStatus, ...AIJobStatus[]]).optional(),
  pool: z.enum(AI_POOLS as unknown as [AIPool, ...AIPool[]]).optional(),
  taskType: z.enum(AI_TASK_TYPES as unknown as [AITaskType, ...AITaskType[]]).optional(),
});

export type AiQueueViewerQueryInput = z.infer<typeof aiQueueViewerQuerySchema>;
