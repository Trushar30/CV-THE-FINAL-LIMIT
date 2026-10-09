import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { PromotionService } from '../services/employee/promotion.service.js';
import { PromotionController } from '../controllers/promotion.controller.js';
import { PromotionModel, type IPromotionDocument } from '../models/Promotion.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ConfigService } from '../services/config/config.service.js';
import { TaskEvaluationService } from '../services/employee/taskEvaluation.service.js';
import { DisciplineService } from '../services/employee/discipline.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';

describe('Employee Promotion & Career Advancement Suite (TASK P7.5)', () => {
  let promotionService: PromotionService;
  let controller: PromotionController;
  let mockConfigService: ConfigService;
  let mockTaskEvaluationService: TaskEvaluationService;
  let mockDisciplineService: DisciplineService;
  let mockNotificationService: NotificationService;

  const mockUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockEmployeeId = new Types.ObjectId();

  const createMockEmployee = (overrides?: Partial<ICompanyEmployeeDocument>): ICompanyEmployeeDocument => {
    return {
      _id: mockEmployeeId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      level: 4,
      positionTitle: 'Associate',
      salarySimulated: 110000,
      status: 'ACTIVE',
      history: [],
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyEmployeeDocument;
  };

  const createMockUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    return {
      _id: mockUserId,
      totalExp: 3000,
      careerRole: 'EMPLOYEE',
      status: 'ACTIVE',
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IUserDocument;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
      getEmployeeConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.employee),
      getCareerConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.career),
    } as unknown as ConfigService;

    mockTaskEvaluationService = {
      getEmployeePerformanceStats: vi.fn().mockResolvedValue({
        completedTasksCount: 10,
        averageScore: 75,
        scoreBandsCount: {
          POOR: 0,
          NEEDS_IMPROVEMENT: 0,
          ACCEPTABLE: 2,
          GOOD: 5,
          EXCELLENT: 3,
        },
      }),
    } as unknown as TaskEvaluationService;

    mockDisciplineService = {
      getActiveWarningsCount: vi.fn().mockResolvedValue(1),
    } as unknown as DisciplineService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as NotificationService;

    promotionService = new PromotionService(
      mockConfigService,
      mockTaskEvaluationService,
      mockDisciplineService,
      mockNotificationService
    );

    controller = new PromotionController(promotionService);
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
  // 1. Spec Canonical 4 -> 5 Promotion Example
  // ===========================================================================
  describe("Spec Canonical 4 -> 5 Example (3,000 EXP, 10 tasks, avg >= 70, active warnings <= 1)", () => {
    it('promotes Level 4 Associate to Level 5 Mid when all 4 criteria are satisfied', async () => {
      const mockEmployee = createMockEmployee({ level: 4, positionTitle: 'Associate', salarySimulated: 110000 });
      const mockUser = createMockUser({ totalExp: 3000 });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const mockCreatedPromotion = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        companyId: mockCompanyId,
        previousLevel: 4,
        newLevel: 5,
        previousPositionTitle: 'Associate',
        newPositionTitle: 'Mid',
        totalExpSnapshot: 3000,
        promotedAt: new Date(),
      } as unknown as IPromotionDocument;

      const createPromotionSpy = vi
        .spyOn(PromotionModel, 'create')
        .mockResolvedValue(mockCreatedPromotion as unknown as ReturnType<typeof PromotionModel.create>);

      const result = await promotionService.checkAndExecutePromotion({
        userId: mockUserId,
        companyId: mockCompanyId,
      });

      // 1. Success verification
      expect(result.promoted).toBe(true);
      expect(result.progress.isEligible).toBe(true);
      expect(result.progress.missingRequirements).toHaveLength(0);

      // 2. Employee level, position title, and salary upgraded
      expect(mockEmployee.level).toBe(5);
      expect(mockEmployee.positionTitle).toBe('Mid');
      expect(mockEmployee.salarySimulated).toBe(140000); // Level 5 default salary from PlatformConfig
      expect(mockEmployee.save).toHaveBeenCalled();

      // 3. Immutable promotion record created
      expect(createPromotionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          companyId: mockCompanyId,
          previousLevel: 4,
          newLevel: 5,
          previousPositionTitle: 'Associate',
          newPositionTitle: 'Mid',
          totalExpSnapshot: 3000,
        })
      );

      // 4. In-app notification sent
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'PROMOTION',
          title: 'Promoted to Mid!',
        })
      );
    });
  });

  // ===========================================================================
  // 2. Each Requirement Failing Alone for 4 -> 5 Promotion
  // ===========================================================================
  describe('Each Requirement Failing Alone (4 -> 5 Boundaries)', () => {
    it('Requirement 1 failing alone: insufficient EXP (< 3,000) blocks promotion', async () => {
      const mockEmployee = createMockEmployee({ level: 4 });
      const mockUser = createMockUser({ totalExp: 2990 }); // 2,990 < 3,000

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);
      // Tasks: 10 (ok), Avg: 75 (ok), Warnings: 1 (ok)

      const result = await promotionService.checkAndExecutePromotion({
        userId: mockUserId,
      });

      expect(result.promoted).toBe(false);
      expect(result.progress.isEligible).toBe(false);
      expect(result.progress.criteria.exp.met).toBe(false);
      expect(result.progress.criteria.exp.missing).toBe(10);
      expect(result.progress.criteria.completedTasks.met).toBe(true);
      expect(result.progress.criteria.averageScore.met).toBe(true);
      expect(result.progress.criteria.activeWarnings.met).toBe(true);
      expect(result.progress.missingRequirements[0]).toContain('Requires 3000 EXP');
      expect(mockEmployee.save).not.toHaveBeenCalled();
    });

    it('Requirement 2 failing alone: insufficient completed tasks (< 10) blocks promotion', async () => {
      const mockEmployee = createMockEmployee({ level: 4 });
      const mockUser = createMockUser({ totalExp: 3500 }); // EXP ok

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      // Only 9 tasks completed (need 10)
      vi.spyOn(mockTaskEvaluationService, 'getEmployeePerformanceStats').mockResolvedValue({
        completedTasksCount: 9,
        averageScore: 80,
        scoreBandsCount: { POOR: 0, NEEDS_IMPROVEMENT: 0, ACCEPTABLE: 0, GOOD: 5, EXCELLENT: 4 },
      });

      const result = await promotionService.checkAndExecutePromotion({
        userId: mockUserId,
      });

      expect(result.promoted).toBe(false);
      expect(result.progress.isEligible).toBe(false);
      expect(result.progress.criteria.exp.met).toBe(true);
      expect(result.progress.criteria.completedTasks.met).toBe(false);
      expect(result.progress.criteria.completedTasks.missing).toBe(1);
      expect(result.progress.criteria.averageScore.met).toBe(true);
      expect(result.progress.criteria.activeWarnings.met).toBe(true);
      expect(result.progress.missingRequirements[0]).toContain('Requires 10 completed tasks');
      expect(mockEmployee.save).not.toHaveBeenCalled();
    });

    it('Requirement 3 failing alone: average score below 70 blocks promotion', async () => {
      const mockEmployee = createMockEmployee({ level: 4 });
      const mockUser = createMockUser({ totalExp: 3200 }); // EXP ok

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      // Average score 69 < 70
      vi.spyOn(mockTaskEvaluationService, 'getEmployeePerformanceStats').mockResolvedValue({
        completedTasksCount: 12,
        averageScore: 69,
        scoreBandsCount: { POOR: 0, NEEDS_IMPROVEMENT: 3, ACCEPTABLE: 8, GOOD: 1, EXCELLENT: 0 },
      });

      const result = await promotionService.checkAndExecutePromotion({
        userId: mockUserId,
      });

      expect(result.promoted).toBe(false);
      expect(result.progress.isEligible).toBe(false);
      expect(result.progress.criteria.exp.met).toBe(true);
      expect(result.progress.criteria.completedTasks.met).toBe(true);
      expect(result.progress.criteria.averageScore.met).toBe(false);
      expect(result.progress.criteria.averageScore.missing).toBe(1);
      expect(result.progress.criteria.activeWarnings.met).toBe(true);
      expect(result.progress.missingRequirements[0]).toContain('Requires minimum average score of 70');
      expect(mockEmployee.save).not.toHaveBeenCalled();
    });

    it('Requirement 4 failing alone: active warnings exceeding 1 blocks promotion', async () => {
      const mockEmployee = createMockEmployee({ level: 4 });
      const mockUser = createMockUser({ totalExp: 3200 });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      // Active warnings = 2 (max allowed is 1)
      vi.spyOn(mockDisciplineService, 'getActiveWarningsCount').mockResolvedValue(2);

      const result = await promotionService.checkAndExecutePromotion({
        userId: mockUserId,
      });

      expect(result.promoted).toBe(false);
      expect(result.progress.isEligible).toBe(false);
      expect(result.progress.criteria.exp.met).toBe(true);
      expect(result.progress.criteria.completedTasks.met).toBe(true);
      expect(result.progress.criteria.averageScore.met).toBe(true);
      expect(result.progress.criteria.activeWarnings.met).toBe(false);
      expect(result.progress.criteria.activeWarnings.excess).toBe(1);
      expect(result.progress.missingRequirements[0]).toContain('Active warnings must be <= 1');
      expect(mockEmployee.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 3. Max Level Boundary Handling (L10 Principal)
  // ===========================================================================
  describe('Max Level Boundary Handling (Level 10 Principal)', () => {
    it('returns isMaxLevel = true with no next target level when already at Level 10', async () => {
      const mockPrincipal = createMockEmployee({
        level: 10,
        positionTitle: 'Principal',
        salarySimulated: 380000,
      });
      const mockUser = createMockUser({ totalExp: 18000 });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockPrincipal);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const progress = await promotionService.getPromotionProgress(mockUserId);

      expect(progress.isMaxLevel).toBe(true);
      expect(progress.currentLevel).toBe(10);
      expect(progress.targetLevel).toBeNull();
      expect(progress.targetTitle).toBeNull();
      expect(progress.isEligible).toBe(false);
      expect(progress.missingRequirements).toContain('Already at maximum level');

      const result = await promotionService.checkAndExecutePromotion({ userId: mockUserId });
      expect(result.promoted).toBe(false);
      expect(result.reason).toBe('Already at maximum career level');
    });
  });

  // ===========================================================================
  // 4. Advisory AI Recommendation Text Non-Deciding Invariant
  // ===========================================================================
  describe('Advisory AI Recommendation Text Invariant', () => {
    it('records AI recommendation text when provided, but backend decision remains authoritative', async () => {
      const mockEmployee = createMockEmployee({ level: 4 });
      const mockUser = createMockUser({ totalExp: 3000 });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const createPromotionSpy = vi.spyOn(PromotionModel, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
      } as unknown as ReturnType<typeof PromotionModel.create>);

      const advisoryText = 'Exceptional engineering leadership observed across distributed systems tasks.';

      await promotionService.checkAndExecutePromotion({
        userId: mockUserId,
        aiRecommendation: advisoryText,
      });

      expect(createPromotionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          previousLevel: 4,
          newLevel: 5,
          aiRecommendation: advisoryText,
        })
      );
    });
  });

  // ===========================================================================
  // 5. Read Endpoint: GET /api/employee/promotion/progress
  // ===========================================================================
  describe('PromotionController Endpoint (GET /api/employee/promotion/progress)', () => {
    it('returns 200 with full progress details for authenticated employee', async () => {
      const mockEmployee = createMockEmployee({ level: 4 });
      const mockUser = createMockUser({ totalExp: 3000 });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const req = {
        user: { _id: mockUserId, careerRole: 'EMPLOYEE' },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getPromotionProgress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            currentLevel: 4,
            targetLevel: 5,
            isEligible: true,
            criteria: expect.objectContaining({
              exp: expect.objectContaining({ required: 3000, current: 3000, met: true }),
              completedTasks: expect.objectContaining({ required: 10, current: 10, met: true }),
              averageScore: expect.objectContaining({ required: 70, current: 75, met: true }),
              activeWarnings: expect.objectContaining({ maxAllowed: 1, current: 1, met: true }),
            }),
          }),
        })
      );
    });
  });
});
