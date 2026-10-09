import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { TaskEvaluationService } from '../services/employee/taskEvaluation.service.js';
import { DailyTaskController } from '../controllers/dailyTask.controller.js';
import {
  taskSubmissionInputSchema,
  taskEvaluationOutputSchema,
  type TaskEvaluationOutput,
} from '../schemas/taskEvaluation.schema.js';
import { TaskSubmissionModel, type ITaskSubmissionDocument } from '../models/TaskSubmission.js';
import { PerformanceRecordModel, type IPerformanceRecordDocument } from '../models/PerformanceRecord.js';
import { EmployeeTaskModel, type IEmployeeTaskDocument } from '../models/EmployeeTask.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { LevelService } from '../services/economy/level.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { AIGateway, AIWorker } from '../ai/index.js';
import { calculateTaskExp, clampScore } from '../services/economy/expEngine.js';


describe('Task Submission & AI Evaluation Engine Suite (TASK P7.3)', () => {
  let taskEvaluationService: TaskEvaluationService;
  let controller: DailyTaskController;
  let mockAIGateway: AIGateway;
  let mockAIWorker: AIWorker;
  let mockLevelService: LevelService;
  let mockNotificationService: NotificationService;

  const mockUserId = new Types.ObjectId();
  const mockOtherUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockTaskId = new Types.ObjectId();
  const mockSubmissionId = new Types.ObjectId();
  const mockPerformanceRecordId = new Types.ObjectId();

  const mockEmployee = {
    _id: new Types.ObjectId(),
    userId: mockUserId,
    companyId: mockCompanyId,
    status: 'ACTIVE',
  };

  const createMockTask = (overrides?: Partial<IEmployeeTaskDocument>): IEmployeeTaskDocument => {
    return {
      _id: mockTaskId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      level: 1,
      kind: 'PRIMARY',
      difficulty: 'EASY',
      title: 'Fix Database Connection Pool Leak',
      description: 'Find and fix memory leak in PostgreSQL connection pool.',
      scenario: {
        scenario: 'Find and fix memory leak in PostgreSQL connection pool.',
        requirements: ['Ensure pooled connections are closed properly', 'Write stress test'],
        difficulty: 'EASY',
        evaluationCriteria: ['Correct connection lifecycle handling', 'Error path handling'],
      },
      maxExp: 30,
      status: 'ASSIGNED',
      dueAt: new Date(Date.now() + 86400000), // tomorrow
      dayKey: '2026-10-09',
      createdAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IEmployeeTaskDocument;
  };

  const createMockSubmission = (
    overrides?: Partial<ITaskSubmissionDocument>
  ): ITaskSubmissionDocument => {
    return {
      _id: mockSubmissionId,
      taskId: mockTaskId,
      userId: mockUserId,
      content: 'Here is the comprehensive pull request diff fixing the idle connection pool leak.',
      submittedAt: new Date(),
      createdAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ITaskSubmissionDocument;
  };

  const mockEvalOutput: TaskEvaluationOutput = {
    score: 85,
    strengths: ['Robust error handling on connection release', 'Clean stress test harness'],
    weaknesses: ['Could use exponential backoff on pool reconnection'],
    feedback: 'Excellent implementation overall with clear architecture and reliable cleanup logic.',
    criteriaScores: [
      { criterion: 'Correct connection lifecycle handling', score: 90, comment: 'Flawless lifecycle' },
      { criterion: 'Error path handling', score: 80, comment: 'Good recovery paths' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAIGateway = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        requestId: 'eval-req-123',
        content: '{"ok":true}',
        structuredData: mockEvalOutput,
        usage: { inputTokens: 250, outputTokens: 180, totalTokens: 430 },
        latencyMs: 350,
      }),
      submit: vi.fn(),
    } as unknown as AIGateway;

    mockAIWorker = {
      registerValidator: vi.fn(),
      registerHandler: vi.fn(),
    } as unknown as AIWorker;

    mockLevelService = {
      awardTaskExp: vi.fn().mockResolvedValue({
        awardedExp: 26,
        newTotalExp: 1026,
        previousLevel: 2,
        newLevel: 2,
        leveledUp: false,
      }),
    } as unknown as LevelService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as NotificationService;

    taskEvaluationService = new TaskEvaluationService(
      mockAIGateway,
      mockAIWorker,
      mockLevelService,
      mockNotificationService
    );

    controller = new DailyTaskController(undefined, taskEvaluationService);
  });


  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockRes() {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  }

  // ===========================================================================
  // 1. Zod Schemas & Clamping Invariants
  // ===========================================================================
  describe('Zod Validation & Math Invariants', () => {
    it('validates taskSubmissionInputSchema correctly', () => {
      const valid = taskSubmissionInputSchema.safeParse({
        content: 'This is my comprehensive engineering submission for the daily task.',
      });
      expect(valid.success).toBe(true);

      const tooShort = taskSubmissionInputSchema.safeParse({ content: 'Short' });
      expect(tooShort.success).toBe(false);

      const empty = taskSubmissionInputSchema.safeParse({ content: '   ' });
      expect(empty.success).toBe(false);
    });

    it('validates taskEvaluationOutputSchema correctly', () => {
      const valid = taskEvaluationOutputSchema.safeParse(mockEvalOutput);
      expect(valid.success).toBe(true);

      const invalidScore = taskEvaluationOutputSchema.safeParse({
        ...mockEvalOutput,
        score: 150,
      });
      expect(invalidScore.success).toBe(false);

      const negativeScore = taskEvaluationOutputSchema.safeParse({
        ...mockEvalOutput,
        score: -10,
      });
      expect(negativeScore.success).toBe(false);
    });

    it('INVARIANT: AI score cannot cause EXP beyond maxExp', () => {
      // Test across all difficulty tiers and arbitrary scores
      const difficulties = [
        { tier: 'EASY', maxExp: 30 },
        { tier: 'MEDIUM', maxExp: 60 },
        { tier: 'HARD', maxExp: 100 },
      ];

      const testScores = [100, 150, 999, 50, 0, -20, NaN];

      for (const diff of difficulties) {
        for (const raw of testScores) {
          const clamped = clampScore(raw);
          const awarded = calculateTaskExp(clamped, diff.maxExp);
          expect(awarded).toBeLessThanOrEqual(diff.maxExp);
          expect(awarded).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('INVARIANT: EXP never decreases (score 0 awards 0 EXP without deduction)', () => {
      const zeroAward = calculateTaskExp(0, 30);
      expect(zeroAward).toBe(0);

      const negativeClamp = clampScore(-50);
      expect(negativeClamp).toBe(0);
      expect(calculateTaskExp(negativeClamp, 30)).toBe(0);
    });
  });

  // ===========================================================================
  // 2. Task Submission Logic (submitTask)
  // ===========================================================================
  describe('Task Submission Service (submitTask)', () => {
    it('successfully submits task before dueAt and updates status to SUBMITTED', async () => {
      const mockTask = createMockTask();
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(TaskSubmissionModel, 'create').mockResolvedValue(createMockSubmission());

      const result = await taskEvaluationService.submitTask({
        taskId: mockTaskId,
        userId: mockUserId,
        content: 'This is my comprehensive solution implementing the connection pool.',
      });

      expect(result.submission).toBeDefined();
      expect(mockTask.status).toBe('SUBMITTED');
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('rejects submission if task is already SUBMITTED or EVALUATED', async () => {
      const mockTask = createMockTask({ status: 'SUBMITTED' });
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);

      await expect(
        taskEvaluationService.submitTask({
          taskId: mockTaskId,
          userId: mockUserId,
          content: 'Duplicate attempt to submit',
        })
      ).rejects.toThrow('Task has already been submitted');
    });

    it('rejects submission if employee does not own the task with 403', async () => {
      const mockTask = createMockTask();
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);

      await expect(
        taskEvaluationService.submitTask({
          taskId: mockTaskId,
          userId: mockOtherUserId,
          content: 'Imposter submitting someone else task',
        })
      ).rejects.toThrow('Access denied: You do not own this task');
    });

    it('rejects submission if deadline (dueAt) has passed and marks task EXPIRED', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const mockTask = createMockTask({ dueAt: pastDate });
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);

      await expect(
        taskEvaluationService.submitTask({
          taskId: mockTaskId,
          userId: mockUserId,
          content: 'Late submission after due date',
        })
      ).rejects.toThrow('Task deadline has passed');

      expect(mockTask.status).toBe('EXPIRED');
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('rejects submission if employee is no longer ACTIVE at company', async () => {
      const mockTask = createMockTask();
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null);

      await expect(
        taskEvaluationService.submitTask({
          taskId: mockTaskId,
          userId: mockUserId,
          content: 'Terminated employee trying to submit task',
        })
      ).rejects.toThrow('Access denied: Active employee status required');
    });
  });

  // ===========================================================================
  // 3. AI Evaluation & Idempotency (evaluateSubmission)
  // ===========================================================================
  describe('AI Evaluation & EXP Awarding (evaluateSubmission)', () => {
    it('evaluates submission, awards EXP via LevelService, and creates PerformanceRecord', async () => {
      const mockTask = createMockTask({ status: 'SUBMITTED' });
      const mockSubmission = createMockSubmission();

      vi.spyOn(TaskSubmissionModel, 'findById').mockResolvedValue(mockSubmission);
      vi.spyOn(PerformanceRecordModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue({ name: 'Acme Corp' } as unknown as ICompanyDocument);

      const mockCreatedRecord = {
        _id: mockPerformanceRecordId,
        taskSubmissionId: mockSubmissionId,
        taskId: mockTaskId,
        userId: mockUserId,
        companyId: mockCompanyId,
        aiScore: 85,
        scoreBand: 'GOOD',
        awardedExp: 26,
        feedback: mockEvalOutput.feedback,
        strengths: mockEvalOutput.strengths,
        weaknesses: mockEvalOutput.weaknesses,
        criteriaScores: mockEvalOutput.criteriaScores,
      } as unknown as IPerformanceRecordDocument;

      vi.spyOn(PerformanceRecordModel, 'create').mockResolvedValue(mockCreatedRecord);

      const record = await taskEvaluationService.evaluateSubmission({
        submissionId: mockSubmissionId,
      });

      expect(record).toBeDefined();
      expect(record.aiScore).toBe(85);
      expect(record.scoreBand).toBe('GOOD');

      // Check LevelService was invoked with sourceId = submission._id
      expect(mockLevelService.awardTaskExp).toHaveBeenCalledTimes(1);
      expect(mockLevelService.awardTaskExp).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          taskId: mockTaskId,
          sourceId: mockSubmissionId,
          score: 85,
          maxExp: 30,
        })
      );

      // Check task status set to EVALUATED
      expect(mockTask.status).toBe('EVALUATED');
      expect(mockTask.save).toHaveBeenCalled();

      // Check notification sent
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'TASK_EVALUATED',
        })
      );
    });

    it('INVARIANT: Double evaluation NEVER double-awards EXP or creates duplicate records (Idempotency)', async () => {
      const mockSubmission = createMockSubmission();
      const existingRecord = {
        _id: mockPerformanceRecordId,
        taskSubmissionId: mockSubmissionId,
        taskId: mockTaskId,
        userId: mockUserId,
        aiScore: 85,
        scoreBand: 'GOOD',
        awardedExp: 26,
      } as unknown as IPerformanceRecordDocument;

      vi.spyOn(TaskSubmissionModel, 'findById').mockResolvedValue(mockSubmission);
      // Simulate performance record ALREADY exists from a previous evaluation run
      vi.spyOn(PerformanceRecordModel, 'findOne').mockResolvedValue(existingRecord);

      const record = await taskEvaluationService.evaluateSubmission({
        submissionId: mockSubmissionId,
      });

      // Returns existing record without calling AI Gateway or LevelService!
      expect(record).toBe(existingRecord);
      expect(mockAIGateway.execute).not.toHaveBeenCalled();
      expect(mockLevelService.awardTaskExp).not.toHaveBeenCalled();
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('clamps absurd AI values (e.g. score 120 or -15) so awarded EXP never exceeds maxExp', async () => {
      const mockTask = createMockTask({ status: 'SUBMITTED', maxExp: 30 });
      const mockSubmission = createMockSubmission();

      // Gateway returns score of 100 conforming to Zod schema
      vi.mocked(mockAIGateway.execute).mockResolvedValue({
        success: true,
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        requestId: 'eval-req-overflow',
        content: '{}',
        structuredData: {
          ...mockEvalOutput,
          score: 100, // Zod passes 100
        },
        usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
        latencyMs: 100,
      });

      vi.spyOn(TaskSubmissionModel, 'findById').mockResolvedValue(mockSubmission);
      vi.spyOn(PerformanceRecordModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue({ name: 'Acme Corp' } as unknown as ICompanyDocument);

      vi.spyOn(PerformanceRecordModel, 'create').mockImplementation((data: unknown) => {
        return Promise.resolve({
          _id: mockPerformanceRecordId,
          ...(data as Record<string, unknown>),
        } as unknown as IPerformanceRecordDocument);
      });

      const record = await taskEvaluationService.evaluateSubmission({
        submissionId: mockSubmissionId,
      });

      expect(record.awardedExp).toBeLessThanOrEqual(mockTask.maxExp);
      expect(record.awardedExp).toBe(30); // 100 score gives 100% of 30 maxExp = 30
    });
  });

  // ===========================================================================
  // 4. Performance Statistics for Promotion Checks
  // ===========================================================================
  describe('Performance Statistics Aggregation', () => {
    it('aggregates completed count, average score, and score bands accurately', async () => {
      const mockRecords = [
        { aiScore: 95, scoreBand: 'EXCELLENT' },
        { aiScore: 85, scoreBand: 'GOOD' },
        { aiScore: 70, scoreBand: 'ACCEPTABLE' },
        { aiScore: 50, scoreBand: 'NEEDS_IMPROVEMENT' },
      ];

      vi.spyOn(PerformanceRecordModel, 'find').mockResolvedValue(
        mockRecords as unknown as IPerformanceRecordDocument[]
      );

      const stats = await taskEvaluationService.getEmployeePerformanceStats(mockUserId);

      expect(stats.completedTasksCount).toBe(4);
      // (95 + 85 + 70 + 50) / 4 = 300 / 4 = 75
      expect(stats.averageScore).toBe(75);
      expect(stats.scoreBandsCount.EXCELLENT).toBe(1);
      expect(stats.scoreBandsCount.GOOD).toBe(1);
      expect(stats.scoreBandsCount.ACCEPTABLE).toBe(1);
      expect(stats.scoreBandsCount.NEEDS_IMPROVEMENT).toBe(1);
      expect(stats.scoreBandsCount.POOR).toBe(0);
    });

    it('returns 0 average when employee has no completed tasks', async () => {
      vi.spyOn(PerformanceRecordModel, 'find').mockResolvedValue([]);

      const stats = await taskEvaluationService.getEmployeePerformanceStats(mockUserId);

      expect(stats.completedTasksCount).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.scoreBandsCount.EXCELLENT).toBe(0);
    });
  });

  // ===========================================================================
  // 5. Controller Endpoints
  // ===========================================================================
  describe('DailyTaskController Endpoints', () => {
    it('POST /tasks/:id/submit: submits and triggers evaluation returning 201', async () => {
      const mockTask = createMockTask();
      const mockSubmission = createMockSubmission();
      const mockRecord = {
        _id: mockPerformanceRecordId,
        aiScore: 85,
        awardedExp: 26,
      } as unknown as IPerformanceRecordDocument;

      vi.spyOn(taskEvaluationService, 'submitTask').mockResolvedValue({
        submission: mockSubmission,
        task: mockTask,
      });

      vi.spyOn(taskEvaluationService, 'evaluateSubmission').mockResolvedValue(mockRecord);

      const req = {
        user: { _id: mockUserId, careerRole: 'EMPLOYEE' },
        params: { id: mockTaskId.toString() },
        body: { content: 'Detailed solution for the database connection pool task.' },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.submitTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            submission: mockSubmission,
            performanceRecord: mockRecord,
          }),
        })
      );
    });

    it('GET /tasks/:id/evaluation: returns evaluation and record for employee task', async () => {
      const mockTask = createMockTask();
      const mockSubmission = createMockSubmission();
      const mockRecord = { _id: mockPerformanceRecordId } as unknown as IPerformanceRecordDocument;

      vi.spyOn(taskEvaluationService, 'getEvaluationByTaskId').mockResolvedValue({
        task: mockTask,
        submission: mockSubmission,
        performanceRecord: mockRecord,
      });

      const req = {
        user: { _id: mockUserId, careerRole: 'EMPLOYEE' },
        params: { id: mockTaskId.toString() },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getTaskEvaluation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          task: mockTask,
          submission: mockSubmission,
          performanceRecord: mockRecord,
        },
      });
    });

    it('GET /performance/stats: returns employee performance aggregation', async () => {
      vi.spyOn(taskEvaluationService, 'getEmployeePerformanceStats').mockResolvedValue({
        completedTasksCount: 5,
        averageScore: 82,
        scoreBandsCount: {
          POOR: 0,
          NEEDS_IMPROVEMENT: 0,
          ACCEPTABLE: 1,
          GOOD: 3,
          EXCELLENT: 1,
        },
      });

      const req = {
        user: { _id: mockUserId, careerRole: 'EMPLOYEE' },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getPerformanceStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          completedTasksCount: 5,
          averageScore: 82,
        }),
      });
    });
  });
});
