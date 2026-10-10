import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { FounderService } from '../services/founder/founder.service.js';
import { FounderController } from '../controllers/founder.controller.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { WarningModel } from '../models/Warning.js';
import { FounderModel, type IFounderDocument } from '../models/Founder.js';
import { ConfigService } from '../services/config/config.service.js';
import { CorpCoinService } from '../services/economy/corpCoin.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';

describe('Founder Mode Unlock & Eligibility Suite (TASK P8.1)', () => {
  let founderService: FounderService;
  let controller: FounderController;
  let mockConfigService: ConfigService;
  let mockCorpCoinService: CorpCoinService;
  let mockNotificationService: NotificationService;

  const mockUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockEmployeeId = new Types.ObjectId();

  const createMockUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    return {
      _id: mockUserId,
      email: 'lead-dev@corpverse.io',
      totalExp: 12500,
      totalExpCached: 12500,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      careerRole: 'EMPLOYEE',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      founderModeUnlockedAt: null,
      founderStarterCoinGranted: false,
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IUserDocument;
  };

  const createMockEmployee = (
    overrides?: Partial<ICompanyEmployeeDocument>
  ): ICompanyEmployeeDocument => {
    return {
      _id: mockEmployeeId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      level: 9,
      positionTitle: 'Lead Software Engineer',
      salarySimulated: 300000,
      status: 'ACTIVE',
      history: [
        {
          status: 'ACTIVE',
          level: 9,
          positionTitle: 'Lead Software Engineer',
          reason: 'Hired',
          changedAt: new Date(Date.now() - 30 * 86400000),
        },
      ],
      startedAt: new Date(Date.now() - 30 * 86400000),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyEmployeeDocument;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
      getCareerConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.career),
      getFounderConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.founder),
    } as unknown as ConfigService;

    mockCorpCoinService = {
      credit: vi.fn().mockResolvedValue({
        transaction: { _id: new Types.ObjectId() },
        balanceAfter: 1000,
      }),
    } as unknown as CorpCoinService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as NotificationService;

    founderService = new FounderService(
      mockConfigService,
      mockCorpCoinService,
      mockNotificationService
    );

    controller = new FounderController(founderService);
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
  // 1. GET /api/founder/eligibility
  // ===========================================================================
  describe('1. Founder Mode Eligibility Check (GET /api/founder/eligibility)', () => {
    it('returns eligible: false when total EXP is below threshold (< 12,000)', async () => {
      const user = createMockUser({ totalExp: 11500 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      const eligibility = await founderService.getEligibility(mockUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.currentExp).toBe(11500);
      expect(eligibility.requiredExp).toBe(12000);
      expect(eligibility.expDeficit).toBe(500);
      expect(eligibility.starterCoinAvailable).toBe(true);
      expect(eligibility.hasUnlockedBefore).toBe(false);
      expect(eligibility.reason).toContain('deficit: 500 EXP');
    });

    it('returns eligible: true when user is EMPLOYEE with total EXP >= 12,000', async () => {
      const user = createMockUser({ totalExp: 12500 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      const eligibility = await founderService.getEligibility(mockUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.currentExp).toBe(12500);
      expect(eligibility.requiredExp).toBe(12000);
      expect(eligibility.expDeficit).toBe(0);
      expect(eligibility.careerRole).toBe('EMPLOYEE');
      expect(eligibility.starterCoinAmount).toBe(1000);
      expect(eligibility.starterCoinAvailable).toBe(true);
      expect(eligibility.hasUnlockedBefore).toBe(false);
    });

    it('returns eligible: false when user is already in FOUNDER role', async () => {
      const user = createMockUser({
        careerRole: 'FOUNDER',
        totalExp: 15000,
        founderModeUnlockedAt: new Date(),
        founderStarterCoinGranted: true,
      });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      const eligibility = await founderService.getEligibility(mockUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.isCurrentFounder).toBe(true);
      expect(eligibility.reason).toContain('currently in Founder Mode');
    });

    it('returns eligible: true for returning ex-founder (post-bankruptcy JOB_SEEKER) with >= 12,000 EXP', async () => {
      const user = createMockUser({
        careerRole: 'JOB_SEEKER',
        totalExp: 13000,
        founderModeUnlockedAt: new Date(Date.now() - 86400000),
        founderStarterCoinGranted: true,
      });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      const eligibility = await founderService.getEligibility(mockUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.hasUnlockedBefore).toBe(true);
      expect(eligibility.starterCoinAvailable).toBe(false);
    });

    it('returns eligible: false for fresh JOB_SEEKER who never previously unlocked', async () => {
      const user = createMockUser({
        careerRole: 'JOB_SEEKER',
        totalExp: 13000,
        founderModeUnlockedAt: null,
      });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      const eligibility = await founderService.getEligibility(mockUserId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('Must be an active Employee');
    });

    it('controller getEligibility returns 200 with eligibility payload', async () => {
      const user = createMockUser({ totalExp: 12500 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      const req = { user: { _id: mockUserId } } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getEligibility(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          eligible: true,
          currentExp: 12500,
        }),
      });
    });
  });

  // ===========================================================================
  // 2. Below-Threshold & Confirmation Rejection (POST /api/founder/unlock)
  // ===========================================================================
  describe('2. Confirmation & Threshold Guards (POST /api/founder/unlock)', () => {
    it('throws validation error when confirm !== true', async () => {
      await expect(founderService.unlockFounderMode(mockUserId, false)).rejects.toThrow(
        'Explicit confirmation (confirm: true) is required to unlock Founder Mode'
      );
    });

    it('throws business rule violation when total EXP is below threshold (< 12,000)', async () => {
      const user = createMockUser({ totalExp: 11999 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      await expect(founderService.unlockFounderMode(mockUserId, true)).rejects.toThrow(
        'Founder Mode requires at least 12000 total EXP. Current EXP: 11999'
      );
    });

    it('controller rejects request when confirm is missing or false via Zod validation', async () => {
      const req = {
        user: { _id: mockUserId },
        body: { confirm: false },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.unlock(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ===========================================================================
  // 3. Successful First-Time Founder Mode Unlock
  // ===========================================================================
  describe('3. Successful First-Time Founder Mode Unlock', () => {
    it('atomically transitions role, terminates prior employment, decrements count, resolves warnings, and grants 1,000 CorpCoin', async () => {
      const user = createMockUser({
        totalExp: 12500,
        careerRole: 'EMPLOYEE',
        corpCoinBalance: 0,
        founderStarterCoinGranted: false,
      });

      const employee = createMockEmployee();
      const mockFounderDoc = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        status: 'ACTIVE',
        unlockedAt: new Date(),
      } as unknown as IFounderDocument;

      const userFindByIdSpy = vi.spyOn(UserModel, 'findById').mockImplementation(async () => {
        return user;
      });

      const userFindOneAndUpdateSpy = vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue({
        ...user,
        careerRole: 'FOUNDER',
        founderModeUnlockedAt: new Date(),
        founderStarterCoinGranted: true,
      } as unknown as IUserDocument);

      const employeeFindOneSpy = vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(employee);
      const companyFindByIdAndUpdateSpy = vi
        .spyOn(CompanyModel, 'findByIdAndUpdate')
        .mockResolvedValue({} as never);
      const warningUpdateManySpy = vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({} as never);
      const founderFindOneAndUpdateSpy = vi
        .spyOn(FounderModel, 'findOneAndUpdate')
        .mockResolvedValue(mockFounderDoc);

      const result = await founderService.unlockFounderMode(mockUserId, true);

      // Verify result payload
      expect(result.success).toBe(true);
      expect(result.user.careerRole).toBe('FOUNDER');
      expect(result.user.founderStarterCoinGranted).toBe(true);
      expect(result.priorEmploymentTerminated).toBe(true);
      expect(result.terminatedCompanyId).toBe(mockCompanyId.toString());
      expect(result.starterCoinsGranted).toBe(1000);

      // Verify atomic user update
      expect(userFindOneAndUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUserId,
          careerRole: { $ne: 'FOUNDER' },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            careerRole: 'FOUNDER',
            founderStarterCoinGranted: true,
          }),
        }),
        expect.anything()
      );

      // Verify employment termination per Spec §3.1 & §12.1
      expect(employee.status).toBe('TERMINATED');
      expect(employee.endedAt).toBeDefined();
      expect(employee.save).toHaveBeenCalled();
      expect(companyFindByIdAndUpdateSpy).toHaveBeenCalledWith(
        mockCompanyId,
        { $inc: { employeeCount: -1 } },
        expect.anything()
      );

      // Verify active warnings resolved
      expect(warningUpdateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          companyId: mockCompanyId,
          status: 'ACTIVE',
        }),
        expect.objectContaining({
          status: 'RESOLVED',
          reason: 'Resolved upon transitioning to Founder Mode.',
        }),
        expect.anything()
      );

      // Verify CorpCoin starter grant
      expect(mockCorpCoinService.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          amount: 1000,
          type: 'FOUNDER_STARTER_GRANT',
          reason: 'Founder Mode unlock starter capital grant',
        })
      );

      // Verify Founder collection record
      expect(founderFindOneAndUpdateSpy).toHaveBeenCalledWith(
        { userId: mockUserId },
        expect.objectContaining({
          $set: { status: 'ACTIVE' },
        }),
        expect.anything()
      );

      // Verify Notification
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'FOUNDER_UNLOCKED',
          title: 'Founder Mode Unlocked!',
        })
      );

      expect(userFindByIdSpy).toHaveBeenCalled();
      expect(employeeFindOneSpy).toHaveBeenCalled();
    });

    it('handles unlock cleanly when user has no active employment (e.g. returning candidate)', async () => {
      const user = createMockUser({
        totalExp: 13000,
        careerRole: 'EMPLOYEE',
        founderStarterCoinGranted: false,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);
      vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue(user);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null); // No active job
      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const result = await founderService.unlockFounderMode(mockUserId, true);

      expect(result.success).toBe(true);
      expect(result.priorEmploymentTerminated).toBe(false);
      expect(result.terminatedCompanyId).toBeUndefined();
      expect(result.starterCoinsGranted).toBe(1000);
    });
  });

  // ===========================================================================
  // 4. Double-Click & Idempotency Guards
  // ===========================================================================
  describe('4. Double-Click & Replay Guards', () => {
    it('rejects duplicate unlock calls when user is already in FOUNDER role with 409 Conflict', async () => {
      const user = createMockUser({
        careerRole: 'FOUNDER',
        totalExp: 14000,
        founderModeUnlockedAt: new Date(),
        founderStarterCoinGranted: true,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);

      await expect(founderService.unlockFounderMode(mockUserId, true)).rejects.toThrow(
        'User is already in Founder Mode'
      );

      expect(mockCorpCoinService.credit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 5. Re-Unlock After Bankruptcy (Never Grants Starter Coins Again)
  // ===========================================================================
  describe('5. Re-Unlock After Bankruptcy (Never Grants Coins Again)', () => {
    it('successfully allows re-unlocking from post-bankruptcy JOB_SEEKER role without re-granting starter coins', async () => {
      const priorUnlockDate = new Date(Date.now() - 7 * 86400000);

      const exFounder = createMockUser({
        careerRole: 'JOB_SEEKER',
        totalExp: 14500,
        corpCoinBalance: 250,
        founderModeUnlockedAt: priorUnlockDate,
        founderStarterCoinGranted: true, // already claimed in past lifecycle
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(exFounder);
      vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue({
        ...exFounder,
        careerRole: 'FOUNDER',
      } as unknown as IUserDocument);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const result = await founderService.unlockFounderMode(mockUserId, true);

      expect(result.success).toBe(true);
      expect(result.user.careerRole).toBe('FOUNDER');
      expect(result.starterCoinsGranted).toBe(0); // 0 coins granted!
      expect(mockCorpCoinService.credit).not.toHaveBeenCalled(); // No credit method called!
    });
  });

  // ===========================================================================
  // 6. Concurrency Safety & Race Condition Protection
  // ===========================================================================
  describe('6. Concurrency Safety & Race Condition Protection', () => {
    it('detects concurrent atomic update collision and throws 409 Conflict', async () => {
      const user = createMockUser({
        totalExp: 16000,
        careerRole: 'EMPLOYEE',
        founderStarterCoinGranted: false,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);
      // Simulate atomic findOneAndUpdate returning null because a concurrent worker already transitioned the role
      vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(founderService.unlockFounderMode(mockUserId, true)).rejects.toThrow(
        'Concurrent founder mode unlock detected. User is already a Founder.'
      );

      // Verify starter capital was not granted
      expect(mockCorpCoinService.credit).not.toHaveBeenCalled();
    });
  });
});
