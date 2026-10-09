import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { DisciplineService } from '../services/employee/discipline.service.js';
import { DisciplineController } from '../controllers/discipline.controller.js';
import { WarningModel, type IWarningDocument } from '../models/Warning.js';
import { DemotionModel } from '../models/Demotion.js';
import { EmploymentReviewModel, type IEmploymentReviewDocument } from '../models/EmploymentReview.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { CompanyModel } from '../models/Company.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ConfigService } from '../services/config/config.service.js';
import { AuditService } from '../services/audit/audit.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';

describe('Discipline System & Employment Review Suite (TASK P7.4)', () => {
  let disciplineService: DisciplineService;
  let controller: DisciplineController;
  let mockConfigService: ConfigService;
  let mockAuditService: AuditService;
  let mockNotificationService: NotificationService;

  const mockUserId = new Types.ObjectId();
  const mockAdminUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockEmployeeId = new Types.ObjectId();
  const mockSubmissionId = new Types.ObjectId();

  const mockUser = {
    _id: mockUserId,
    totalExp: 2500,
    careerRole: 'EMPLOYEE',
    status: 'ACTIVE',
    save: vi.fn().mockResolvedValue(true),
  } as unknown as IUserDocument;

  const createMockEmployee = (overrides?: Partial<ICompanyEmployeeDocument>): ICompanyEmployeeDocument => {
    return {
      _id: mockEmployeeId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      level: 3,
      positionTitle: 'Junior+',
      salarySimulated: 90000,
      status: 'ACTIVE',
      history: [],
      startedAt: new Date(Date.now() - 30 * 86400000),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyEmployeeDocument;
  };

  const createMockWarning = (overrides?: Partial<IWarningDocument>): IWarningDocument => {
    return {
      _id: new Types.ObjectId(),
      userId: mockUserId,
      companyId: mockCompanyId,
      taskSubmissionId: new Types.ObjectId(),
      status: 'ACTIVE',
      reason: 'Poor performance score',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      ...overrides,
    } as unknown as IWarningDocument;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
      getEmployeeConfig: vi.fn().mockResolvedValue({
        warningThreshold: 4,
        warningExpirationDays: 30,
        minimumPromotionScore: 70,
      }),
      getCareerConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.career),
    } as unknown as ConfigService;

    mockAuditService = {
      record: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as unknown as AuditService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as NotificationService;

    disciplineService = new DisciplineService(
      mockConfigService,
      mockAuditService,
      mockNotificationService
    );

    controller = new DisciplineController(disciplineService);
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
  // 1. Warning Decay & Cron-Free Expiration (Decay Invariant)
  // ===========================================================================
  describe('Warning Decay & Expiration (Cron-Free Query)', () => {
    it('getActiveWarningsCount filters out expired warnings (expiresAt <= now)', async () => {
      // Mock countDocuments directly checking the query
      vi.spyOn(WarningModel, 'countDocuments').mockImplementation(async (query?: Record<string, unknown>) => {
        // Assert that the query specifies status: ACTIVE and expiresAt > now
        expect(query?.status).toBe('ACTIVE');
        expect(query?.expiresAt).toHaveProperty('$gt');
        return 2;
      });

      const count = await disciplineService.getActiveWarningsCount(mockUserId, mockCompanyId);
      expect(count).toBe(2);
    });

    it('getActiveWarnings returns only unexpired active warnings without cron jobs', async () => {
      const active1 = createMockWarning({ expiresAt: new Date(Date.now() + 15 * 86400000) });
      const active2 = createMockWarning({ expiresAt: new Date(Date.now() + 2 * 86400000) });

      vi.spyOn(WarningModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([active1, active2]),
      } as unknown as ReturnType<typeof WarningModel.find>);

      const warnings = await disciplineService.getActiveWarnings(mockUserId, mockCompanyId);
      expect(warnings).toHaveLength(2);
      expect(warnings[0].status).toBe('ACTIVE');
    });
  });

  // ===========================================================================
  // 2. Warning Issuance per Rule D4
  // ===========================================================================
  describe('Warning Issuance per Rule D4', () => {
    it('issues an active warning when score is in the Poor band (score <= 39)', async () => {
      const mockCreatedWarning = createMockWarning({
        taskSubmissionId: mockSubmissionId,
        reason: 'Poor task evaluation score: 35/100',
      });

      vi.spyOn(WarningModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(WarningModel, 'create').mockResolvedValue(mockCreatedWarning as unknown as ReturnType<typeof WarningModel.create>);
      vi.spyOn(disciplineService, 'getActiveWarningsCount').mockResolvedValue(1);

      const result = await disciplineService.issueWarning({
        userId: mockUserId,
        companyId: mockCompanyId,
        taskSubmissionId: mockSubmissionId,
        score: 35,
      });

      expect(result.warning).toBeDefined();
      expect(result.activeCount).toBe(1);
      expect(result.employmentReview).toBeNull();
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'WARNING_ISSUED',
        })
      );
    });

    it('does NOT issue a warning when score is > 39 (e.g. 40, 60, 85)', async () => {
      vi.spyOn(disciplineService, 'getActiveWarningsCount').mockResolvedValue(0);

      const result = await disciplineService.issueWarning({
        userId: mockUserId,
        companyId: mockCompanyId,
        taskSubmissionId: mockSubmissionId,
        score: 40, // Needs improvement band, not Poor
      });

      expect(result.warning).toBeNull();
      expect(result.activeCount).toBe(0);
      expect(result.employmentReview).toBeNull();
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('INVARIANT: Duplicate warning for same taskSubmissionId is idempotent', async () => {
      const existingWarning = createMockWarning({ taskSubmissionId: mockSubmissionId });
      vi.spyOn(WarningModel, 'findOne').mockResolvedValue(existingWarning);
      const createSpy = vi.spyOn(WarningModel, 'create');
      vi.spyOn(disciplineService, 'getActiveWarningsCount').mockResolvedValue(2);

      const result = await disciplineService.issueWarning({
        userId: mockUserId,
        companyId: mockCompanyId,
        taskSubmissionId: mockSubmissionId,
        score: 20,
      });

      expect(result.warning).toBe(existingWarning);
      expect(result.activeCount).toBe(2);
      expect(createSpy).not.toHaveBeenCalled();
    });

  });

  // ===========================================================================
  // 3. Exact Threshold Boundary & Review Trigger
  // ===========================================================================
  describe('Exact Threshold Boundary (3 Warnings vs 4 Warnings)', () => {
    it('boundary check: 3 active warnings do NOT trigger an employment review', async () => {
      const mockCreated = createMockWarning();
      vi.spyOn(WarningModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(WarningModel, 'create').mockResolvedValue(mockCreated as unknown as ReturnType<typeof WarningModel.create>);
      vi.spyOn(disciplineService, 'getActiveWarningsCount').mockResolvedValue(3);
      const conductReviewSpy = vi.spyOn(disciplineService, 'conductEmploymentReview');

      const result = await disciplineService.issueWarning({
        userId: mockUserId,
        companyId: mockCompanyId,
        taskSubmissionId: mockSubmissionId,
        score: 15,
      });

      expect(result.activeCount).toBe(3);
      expect(result.employmentReview).toBeNull();
      expect(conductReviewSpy).not.toHaveBeenCalled();
    });

    it('boundary check: reaching exactly 4 active warnings triggers employment review', async () => {
      const mockCreated = createMockWarning();
      const mockReview = {
        _id: new Types.ObjectId(),
        decision: 'DEMOTION',
      } as unknown as IEmploymentReviewDocument;

      vi.spyOn(WarningModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(WarningModel, 'create').mockResolvedValue(mockCreated as unknown as ReturnType<typeof WarningModel.create>);
      vi.spyOn(disciplineService, 'getActiveWarningsCount').mockResolvedValue(4);
      const conductReviewSpy = vi
        .spyOn(disciplineService, 'conductEmploymentReview')
        .mockResolvedValue(mockReview);

      const result = await disciplineService.issueWarning({
        userId: mockUserId,
        companyId: mockCompanyId,
        taskSubmissionId: mockSubmissionId,
        score: 15,
      });

      expect(result.activeCount).toBe(4);
      expect(result.employmentReview).toBe(mockReview);
      expect(conductReviewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          companyId: mockCompanyId,
          activeWarningCount: 4,
        })
      );
    });
  });

  // ===========================================================================
  // 4. Demotion Branch (Level > 1) & EXP Invariant
  // ===========================================================================
  describe('Demotion Branch (D5) & EXP Invariant', () => {
    it('demotes Level 3 employee to Level 2, updates position, resets warnings, and preserves EXP untouched', async () => {
      const initialExp = mockUser.totalExp; // 2500 EXP
      const mockEmployee = createMockEmployee({ level: 3, positionTitle: 'Junior+' });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(DemotionModel, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
        previousLevel: 3,
        newLevel: 2,
      } as unknown as ReturnType<typeof DemotionModel.create>);
      vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({ modifiedCount: 4 } as unknown as ReturnType<typeof WarningModel.updateMany>);
      vi.spyOn(EmploymentReviewModel, 'create').mockImplementation((data: unknown) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...(data as Record<string, unknown>) } as unknown as ReturnType<typeof EmploymentReviewModel.create>)
      );

      const review = await disciplineService.conductEmploymentReview({
        userId: mockUserId,
        companyId: mockCompanyId,
        activeWarningCount: 4,
        reason: 'Threshold reached: 4 active warnings',
      });

      expect(review.decision).toBe('DEMOTION');

      // 1. Employee Level decremented by 1
      expect(mockEmployee.level).toBe(2);
      expect(mockEmployee.positionTitle).toBe('Junior');
      expect(mockEmployee.salarySimulated).toBe(70000); // Junior default salary from PlatformConfig
      expect(mockEmployee.status).toBe('ACTIVE');
      expect(mockEmployee.save).toHaveBeenCalled();

      // 2. Active warnings reset to 0
      expect(WarningModel.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, companyId: mockCompanyId, status: 'ACTIVE' },
        expect.objectContaining({ status: 'RESOLVED' })
      );

      // 3. User EXP untouched invariant: verify zero writes to totalExp
      expect(mockUser.totalExp).toBe(initialExp);
      const userUpdateSpy = vi.spyOn(UserModel, 'findByIdAndUpdate');
      expect(userUpdateSpy).not.toHaveBeenCalled();
    });
  });


  // ===========================================================================
  // 5. Termination Branch (Level 1 Intern) & EXP Invariant
  // ===========================================================================
  describe('Termination Branch (D5) & EXP Invariant', () => {
    it('terminates Level 1 employee to JOB_SEEKER, decrements company count, and preserves EXP untouched', async () => {
      const initialExp = mockUser.totalExp;
      const mockLevel1Employee = createMockEmployee({
        level: 1,
        positionTitle: 'Intern',
      });

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockLevel1Employee);
      vi.spyOn(CompanyModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ReturnType<typeof CompanyModel.findByIdAndUpdate>);
      vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ReturnType<typeof UserModel.findByIdAndUpdate>);
      vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({ modifiedCount: 4 } as unknown as ReturnType<typeof WarningModel.updateMany>);
      vi.spyOn(EmploymentReviewModel, 'create').mockImplementation((data: unknown) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...(data as Record<string, unknown>) } as unknown as ReturnType<typeof EmploymentReviewModel.create>)
      );

      const review = await disciplineService.conductEmploymentReview({
        userId: mockUserId,
        companyId: mockCompanyId,
        activeWarningCount: 4,
        reason: 'Threshold reached at Level 1 Intern',
      });

      expect(review.decision).toBe('TERMINATION');

      // 1. Employee status set to TERMINATED
      expect(mockLevel1Employee.status).toBe('TERMINATED');
      expect(mockLevel1Employee.endedAt).toBeDefined();
      expect(mockLevel1Employee.save).toHaveBeenCalled();

      // 2. Company employeeCount decremented by 1
      expect(CompanyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockCompanyId,
        { $inc: { employeeCount: -1 } }
      );

      // 3. User careerRole reverted to JOB_SEEKER
      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        { careerRole: 'JOB_SEEKER' }
      );

      // 4. EXP is untouched: totalExp remains 2500
      expect(mockUser.totalExp).toBe(initialExp);
    });
  });

  // ===========================================================================
  // 6. Admin Force-Terminate with Confirmation & Audit Log
  // ===========================================================================
  describe('Admin Force-Terminate with Confirmation & Audit Log', () => {
    it('rejects without exact dangerous-action confirmation string', async () => {
      await expect(
        disciplineService.adminForceTerminate({
          employeeId: mockEmployeeId,
          adminUserId: mockAdminUserId,
          reason: 'Severe violation of company terms and conditions',
          confirmation: 'WRONG_CONFIRMATION',
        })
      ).rejects.toThrow('Dangerous action confirmation failed');
    });

    it('rejects if reason is under 10 characters', async () => {
      await expect(
        disciplineService.adminForceTerminate({
          employeeId: mockEmployeeId,
          adminUserId: mockAdminUserId,
          reason: 'Too short',
          confirmation: 'CONFIRM_FORCE_TERMINATE',
        })
      ).rejects.toThrow('Termination reason must be at least 10 characters');
    });

    it('successfully terminates employee, records immutable audit log, and preserves EXP', async () => {
      const mockEmployee = createMockEmployee();
      vi.spyOn(CompanyEmployeeModel, 'findById').mockResolvedValue(mockEmployee);
      vi.spyOn(CompanyModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ReturnType<typeof CompanyModel.findByIdAndUpdate>);
      vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ReturnType<typeof UserModel.findByIdAndUpdate>);
      vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({} as unknown as ReturnType<typeof WarningModel.updateMany>);

      await disciplineService.adminForceTerminate({
        employeeId: mockEmployeeId,
        adminUserId: mockAdminUserId,
        reason: 'Breach of corporate data governance policies',
        confirmation: 'CONFIRM_FORCE_TERMINATE',
      });

      // 1. Audit log recorded with actorRole ADMIN
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockAdminUserId.toString(),
          actorRole: 'ADMIN',
          action: 'ADMIN_MUTATION',
          targetType: 'companyEmployees',
          targetId: mockEmployeeId.toString(),
          reason: 'Breach of corporate data governance policies',
        })
      );

      // 2. Employee terminated & user reverted to JOB_SEEKER
      expect(mockEmployee.status).toBe('TERMINATED');
      expect(CompanyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockCompanyId,
        { $inc: { employeeCount: -1 } }
      );
      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        { careerRole: 'JOB_SEEKER' }
      );

      // 3. User EXP untouched
      expect(mockUser.totalExp).toBe(2500);
    });
  });

  // ===========================================================================
  // 7. Controller Endpoints
  // ===========================================================================
  describe('DisciplineController Endpoints', () => {
    it('GET /api/employee/warnings: returns active warnings for employee', async () => {
      const mockWarnings = [createMockWarning(), createMockWarning()];
      vi.spyOn(disciplineService, 'getActiveWarnings').mockResolvedValue(mockWarnings as unknown as IWarningDocument[]);

      const req = {
        user: { _id: mockUserId, careerRole: 'EMPLOYEE' },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getEmployeeWarnings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          activeCount: 2,
          warnings: mockWarnings,
        },
      });
    });

    it('POST /api/admin/employees/:id/terminate: returns 200 on success', async () => {
      vi.spyOn(disciplineService, 'adminForceTerminate').mockResolvedValue(undefined);

      const req = {
        user: { _id: mockAdminUserId, platformRole: 'ADMIN' },
        params: { id: mockEmployeeId.toString() },
        body: {
          confirmation: 'CONFIRM_FORCE_TERMINATE',
          reason: 'Administrative contract termination',
        },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.adminForceTerminate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining('Employee force-terminated successfully'),
      });
    });
  });
});
