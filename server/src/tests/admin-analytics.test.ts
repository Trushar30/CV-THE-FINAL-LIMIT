import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/admin/analytics.service.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { requirePlatformRole } from '../middleware/auth.middleware.js';
import {
  boundedDateRangeSchema,
  auditLogsViewerQuerySchema,
  aiLogsViewerQuerySchema,
  aiQueueViewerQuerySchema,
  resolveDateRange,
} from '../schemas/analytics.schema.js';
import { UserModel } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { ApplicationModel } from '../models/Application.js';
import { FeedbackModel } from '../models/Feedback.js';
import { EmployeeTaskModel } from '../models/EmployeeTask.js';
import { TaskSubmissionModel } from '../models/TaskSubmission.js';
import { PerformanceRecordModel } from '../models/PerformanceRecord.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../models/CorpCoinTransaction.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { CompanyFinancialsModel } from '../models/CompanyFinancials.js';
import { AIRequestLogModel } from '../models/AIRequestLog.js';
import { AIResponseLogModel } from '../models/AIResponseLog.js';
import { AIJobModel } from '../models/AIJob.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';

describe('Admin Analytics & Telemetry Suite (TASK P9.4)', () => {
  let analyticsService: AnalyticsService;
  let analyticsController: AnalyticsController;

  const mockAdminId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    analyticsService = new AnalyticsService();
    analyticsController = new AnalyticsController(analyticsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Date Range Bounding & Validation Tests
  // =========================================================================
  describe('1. Date Bounding and Query Schema Validation', () => {
    it('accepts valid bounded date ranges within 90 days', () => {
      const now = new Date();
      const past20Days = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      const parsed = boundedDateRangeSchema.safeParse({
        startDate: past20Days.toISOString(),
        endDate: now.toISOString(),
        interval: 'day',
      });

      expect(parsed.success).toBe(true);
    });

    it('rejects date range if startDate is after endDate', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      const parsed = boundedDateRangeSchema.safeParse({
        startDate: future.toISOString(),
        endDate: now.toISOString(),
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('startDate must be less than or equal to endDate');
      }
    });

    it('rejects window exceeding 90 days to prevent unindexed full scans', () => {
      const end = new Date();
      const start = new Date(end.getTime() - 95 * 24 * 60 * 60 * 1000);

      const parsed = boundedDateRangeSchema.safeParse({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('Date range window cannot exceed 90 days');
      }
    });

    it('resolveDateRange defaults to past 30 days if omitted', () => {
      const resolved = resolveDateRange({});
      expect(resolved.interval).toBe('day');
      const diffDays = Math.round(
        (resolved.endDate.getTime() - resolved.startDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(30);
    });

    it('validates viewer query schemas with pagination constraints', () => {
      const validAuditQuery = auditLogsViewerQuerySchema.safeParse({
        page: '2',
        limit: '25',
        actorRole: 'ADMIN',
        action: 'USER_SUSPENDED',
      });
      expect(validAuditQuery.success).toBe(true);

      const validAiLogsQuery = aiLogsViewerQuerySchema.safeParse({
        page: '1',
        limit: '10',
        providerCode: 'gemini',
        taskType: 'RESUME_ANALYSIS',
        pool: 'PIPELINE',
      });
      expect(validAiLogsQuery.success).toBe(true);

      const validAiQueueQuery = aiQueueViewerQuerySchema.safeParse({
        page: '1',
        limit: '10',
        status: 'PENDING',
      });
      expect(validAiQueueQuery.success).toBe(true);

      const invalidLimit = auditLogsViewerQuerySchema.safeParse({
        limit: '500', // exceeds max 100
      });
      expect(invalidLimit.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Admin Analytics Aggregations
  // =========================================================================
  describe('2. Admin Analytics Aggregations', () => {
    it('getUserAnalytics aggregates user distribution by role, domain, and status', async () => {
      vi.spyOn(UserModel, 'countDocuments').mockImplementation(async (filter?: Record<string, unknown>) => {
        if (filter?.status === 'ACTIVE') return 24;
        if (filter?.status === 'SUSPENDED') return 1;
        return 25;
      });

      vi.spyOn(UserModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, Record<string, unknown>>[];
        // First pipeline groups by careerRole
        if (pipeline[0]?.$group?._id === '$careerRole') {
          return [
            { _id: 'JOB_SEEKER', count: 15 },
            { _id: 'EMPLOYEE', count: 8 },
            { _id: 'FOUNDER', count: 2 },
          ];
        }
        // Second pipeline groups by platformRole
        if (pipeline[0]?.$group?._id === '$platformRole') {
          return [
            { _id: 'NONE', count: 24 },
            { _id: 'ADMIN', count: 1 },
          ];
        }
        return [{ _id: '2026-10-10', count: 5 }];
      });

      vi.spyOn(ProfileModel, 'aggregate').mockResolvedValue([
        { _id: 'SOFTWARE_ENGINEERING', count: 12 },
        { _id: 'CLOUD_ENGINEERING', count: 7 },
        { _id: 'AI_ENGINEERING', count: 5 },
      ] as never);

      const result = await analyticsService.getUserAnalytics();

      expect(result.totals.totalUsers).toBe(25);
      expect(result.byRole).toEqual([
        { role: 'JOB_SEEKER', count: 15 },
        { role: 'EMPLOYEE', count: 8 },
        { role: 'FOUNDER', count: 2 },
      ]);
      expect(result.byDomain).toHaveLength(3);
      expect(result.registrationTrends).toEqual([{ date: '2026-10-10', count: 5 }]);
      expect(result.dateRange).toBeDefined();
    });

    it('getApplicationAnalytics aggregates stages, rejection reasons and top missing skills', async () => {
      vi.spyOn(ApplicationModel, 'countDocuments').mockResolvedValue(18 as never);
      vi.spyOn(ApplicationModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, Record<string, unknown>>[];
        const groupField = pipeline[1]?.$group?._id;
        if (groupField === '$status') {
          return [
            { _id: 'ACTIVE', count: 12 },
            { _id: 'REJECTED', count: 4 },
            { _id: 'ACCEPTED', count: 2 },
          ];
        }
        return [
          { _id: 'APPLIED', count: 10 },
          { _id: 'ASSESSMENT', count: 6 },
          { _id: 'OFFER', count: 2 },
        ];
      });

      vi.spyOn(FeedbackModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, unknown>[];
        if (pipeline.some((s) => s.$unwind)) {
          return [{ _id: 'TypeScript', count: 5 }];
        }
        return [{ _id: 'ATS_SCREENING', count: 4 }];
      });

      const result = await analyticsService.getApplicationAnalytics();

      expect(result.totalApplications).toBe(18);
      expect(result.byStage).toHaveLength(3);
      expect(result.byStatus).toHaveLength(3);
      expect(result.rejectionReasons).toHaveLength(1);
      expect(result.topMissingSkills).toEqual([{ skill: 'TypeScript', count: 5 }]);
    });

    it('getTaskAnalytics aggregates completed submissions, avg scores, and score bands', async () => {
      vi.spyOn(EmployeeTaskModel, 'countDocuments').mockResolvedValue(50 as never);
      vi.spyOn(TaskSubmissionModel, 'countDocuments').mockResolvedValue(40 as never);

      vi.spyOn(EmployeeTaskModel, 'aggregate').mockResolvedValue([
        { _id: 'EASY', count: 20 },
        { _id: 'MEDIUM', count: 20 },
        { _id: 'HARD', count: 10 },
      ] as never);

      vi.spyOn(PerformanceRecordModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, Record<string, unknown>>[];
        const groupField = pipeline[1]?.$group?._id;
        if (groupField === '$scoreBand') {
          return [
            { _id: 'Poor', count: 2 },
            { _id: 'Needs Improvement', count: 5 },
            { _id: 'Acceptable', count: 15 },
            { _id: 'Good', count: 12 },
            { _id: 'Excellent', count: 6 },
          ];
        }
        if (groupField === null) {
          return [{ _id: null, avgScore: 74.5, minScore: 35, maxScore: 98, totalEvaluations: 40 }];
        }
        return [{ _id: '2026-10-10', avgScore: 74.5, count: 40 }];
      });

      const result = await analyticsService.getTaskAnalytics();

      expect(result.totalTasks).toBe(50);
      expect(result.totalSubmissions).toBe(40);
      expect(result.submissionRate).toBe(80.0);
      expect(result.averageScore).toBe(74.5);
      expect(result.byDifficulty).toHaveLength(3);
      expect(result.byScoreBand).toHaveLength(5);
    });

    it('getEconomyAnalytics aggregates circulation and ledger movements', async () => {
      vi.spyOn(UserModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, Record<string, unknown>>[];
        if (pipeline[0]?.$group?.totalExp) {
          return [{ _id: null, totalExp: 50000 }];
        }
        return [{ _id: null, totalCorpCoin: 12500 }];
      });

      vi.spyOn(ExpTransactionModel, 'aggregate').mockResolvedValue([
        { _id: 'TASK_COMPLETION', totalAmount: 48000, count: 250 },
        { _id: 'ADMIN_ADJUSTMENT', totalAmount: 2000, count: 5 },
      ] as never);

      vi.spyOn(CorpCoinTransactionModel, 'aggregate').mockResolvedValue([
        { _id: 'FOUNDER_STARTER_GRANT', totalAmount: 5000, count: 5 },
        { _id: 'BOT_PURCHASE', totalAmount: -2500, count: 10 },
      ] as never);

      const result = await analyticsService.getEconomyAnalytics();

      expect(result.circulation.totalExpCirculation).toBe(50000);
      expect(result.circulation.totalCorpCoinCirculation).toBe(12500);
      expect(result.expTransactions).toHaveLength(2);
      expect(result.corpCoinTransactions).toHaveLength(2);
    });

    it('getCompanyAnalytics aggregates company counts, active workforce, and financial aggregates', async () => {
      vi.spyOn(CompanyModel, 'aggregate').mockResolvedValue([
        { _id: 'ACTIVE', count: 8 },
        { _id: 'BANKRUPT', count: 1 },
      ] as never);

      vi.spyOn(CompanyEmployeeModel, 'countDocuments').mockResolvedValue(42 as never);

      vi.spyOn(CompanyFinancialsModel, 'aggregate').mockResolvedValue([
        {
          _id: null,
          totalRevenue: 100000,
          totalExpenses: 70000,
          totalProfit: 30000,
          avgDailyRevenue: 2500,
          avgDailyExpenses: 1750,
          totalSimulationDaysRecorded: 40,
        },
      ] as never);

      const result = await analyticsService.getCompanyAnalytics();

      expect(result.companiesByStatus).toEqual([
        { status: 'ACTIVE', count: 8 },
        { status: 'BANKRUPT', count: 1 },
      ]);
      expect(result.totalActiveWorkforce).toBe(42);
      expect(result.financialOutcomes.totalProfit).toBe(30000);
    });

    it('getAiAnalytics aggregates provider requests, telemetry, failure rate and queue depth', async () => {
      vi.spyOn(AIRequestLogModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, Record<string, unknown>>[];
        if (pipeline[1]?.$group?._id === '$providerCode') {
          return [
            { _id: 'gemini', count: 120 },
            { _id: 'groq', count: 80 },
          ];
        }
        return [
          { _id: 'RESUME_ANALYSIS', count: 100 },
          { _id: 'INTERVIEW_QUESTION', count: 100 },
        ];
      });

      vi.spyOn(AIResponseLogModel, 'aggregate').mockImplementation(async (rawPipeline: unknown) => {
        const pipeline = rawPipeline as Record<string, Record<string, unknown>>[];
        if (pipeline[1]?.$group?.avgLatencyMs) {
          return [
            {
              _id: null,
              avgLatencyMs: 420.55,
              minLatencyMs: 150,
              maxLatencyMs: 1800,
              totalTokens: 54000,
              totalCalls: 200,
              successCalls: 190,
              failedCalls: 10,
            },
          ];
        }
        // Error breakdown
        return [{ _id: 'RATE_LIMIT_EXCEEDED', count: 8 }, { _id: 'PROVIDER_TIMEOUT', count: 2 }];
      });

      vi.spyOn(AIJobModel, 'aggregate').mockResolvedValue([
        { _id: 'PENDING', count: 3 },
        { _id: 'PROCESSING', count: 1 },
      ] as never);

      const result = await analyticsService.getAiAnalytics();

      expect(result.requestsByProvider).toHaveLength(2);
      expect(result.telemetry.avgLatencyMs).toBe(420.6);
      expect(result.telemetry.failureRate).toBe(5.0); // 10 / 200 * 100
      expect(result.errorSummary).toHaveLength(2);
      expect(result.liveQueueDepth).toHaveLength(2);
    });
  });

  // =========================================================================
  // 3. Paginated Viewers Tests
  // =========================================================================
  describe('3. Paginated Viewers (Audit, System/AI Logs, AI Queues)', () => {
    it('getAuditLogsViewer returns paginated records with filters', async () => {
      const mockLogs = [
        {
          _id: new Types.ObjectId(),
          actorId: mockAdminId,
          actorRole: 'ADMIN',
          action: 'USER_RESTORED',
          targetType: 'USER',
          createdAt: new Date(),
        },
      ];

      vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValue(1 as never);
      vi.spyOn(AuditLogModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockLogs as never),
      } as never);

      const result = await analyticsService.getAuditLogsViewer({
        page: 1,
        limit: 10,
        actorRole: 'ADMIN',
        action: 'USER_RESTORED',
      });

      expect(result.logs).toHaveLength(1);
      expect(result.pagination).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('getAiLogsViewer returns paginated request logs with filters', async () => {
      const mockAiLogs = [
        {
          _id: new Types.ObjectId(),
          providerCode: 'gemini',
          taskType: 'RESUME_ANALYSIS',
          pool: 'PIPELINE',
          createdAt: new Date(),
        },
      ];

      vi.spyOn(AIRequestLogModel, 'countDocuments').mockResolvedValue(1 as never);
      vi.spyOn(AIRequestLogModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockAiLogs as never),
      } as never);

      const result = await analyticsService.getAiLogsViewer({
        page: 1,
        limit: 10,
        providerCode: 'gemini',
        taskType: 'RESUME_ANALYSIS',
        pool: 'PIPELINE',
      });

      expect(result.logs).toHaveLength(1);
      expect(result.pagination).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('getAiQueueViewer returns queued background jobs with status filters', async () => {
      const mockJobs = [
        {
          _id: new Types.ObjectId(),
          status: 'PENDING',
          pool: 'PIPELINE',
          taskType: 'ATS_SCREEN',
          createdAt: new Date(),
        },
      ];

      vi.spyOn(AIJobModel, 'countDocuments').mockResolvedValue(1 as never);
      vi.spyOn(AIJobModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockJobs as never),
      } as never);

      const result = await analyticsService.getAiQueueViewer({
        page: 1,
        limit: 10,
        status: 'PENDING',
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.pagination).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  // =========================================================================
  // 4. Controller Handlers & Permission Matrix RBAC Tests
  // =========================================================================
  describe('4. Analytics Controller & RBAC Matrix', () => {
    it('controller getUserAnalytics invokes service and sends JSON response', async () => {
      vi.spyOn(analyticsService, 'getUserAnalytics').mockResolvedValue({
        totalUsers: 10,
        byCareerRole: [],
        byDomain: [],
        byStatus: [],
        dateRange: { startDate: new Date(), endDate: new Date() },
      });

      const req = { query: {} } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await analyticsController.getUserAnalytics(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ totalUsers: 10 }),
        })
      );
    });

    it('validation middleware rejects invalid bounded date ranges', async () => {
      const middleware = validate({ query: boundedDateRangeSchema });
      const end = new Date();
      const start = new Date(end.getTime() + 10000); // Invalid: start > end

      const req = {
        query: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      } as unknown as Request;
      const res = {} as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const errorPassed = next.mock.calls[0][0];
      expect(errorPassed).toBeDefined();
    });

    it('controller passes service errors to next()', async () => {
      const testError = new Error('Database connection failed');
      vi.spyOn(analyticsService, 'getUserAnalytics').mockRejectedValue(testError);

      const req = { query: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await analyticsController.getUserAnalytics(req, res, next);

      expect(next).toHaveBeenCalledWith(testError);
    });

    it('RBAC permission matrix: requirePlatformRole("ADMIN") grants ADMIN access', () => {
      const adminMiddleware = requirePlatformRole('ADMIN');
      const req = {
        user: {
          userId: mockAdminId.toString(),
          careerRole: 'NONE',
          platformRole: 'ADMIN',
        },
      } as unknown as Request;
      const res = {} as unknown as Response;
      const next = vi.fn() as NextFunction;

      adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('RBAC permission matrix: requirePlatformRole("ADMIN") denies non-admin users with 403', () => {
      const adminMiddleware = requirePlatformRole('ADMIN');
      const req = {
        user: {
          userId: new Types.ObjectId().toString(),
          careerRole: 'JOB_SEEKER',
          platformRole: 'NONE',
        },
      } as unknown as Request;
      const res = {} as unknown as Response;
      const next = vi.fn() as NextFunction;

      adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
    });

    it('RBAC permission matrix: requirePlatformRole("ADMIN") denies AI_MANAGER from admin analytics endpoints', () => {
      const adminMiddleware = requirePlatformRole('ADMIN');
      const req = {
        user: {
          userId: new Types.ObjectId().toString(),
          careerRole: 'NONE',
          platformRole: 'AI_MANAGER',
        },
      } as unknown as Request;
      const res = {} as unknown as Response;
      const next = vi.fn() as NextFunction;

      adminMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
    });
  });
});
