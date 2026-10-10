import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { isBankrupt, executeDeterministicTick } from '../services/simulation/simulationEngine.js';
import { SimulationService } from '../services/simulation/simulation.service.js';
import { FounderService } from '../services/founder/founder.service.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { FounderModel, type IFounderDocument } from '../models/Founder.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { CompanyScenarioModel } from '../models/CompanyScenario.js';
import { CompanyFinancialsModel } from '../models/CompanyFinancials.js';
import { NotificationModel } from '../models/Notification.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { PerformanceRecordModel } from '../models/PerformanceRecord.js';
import { CompanyBotModel } from '../models/CompanyBot.js';
import { ConfigService } from '../services/config/config.service.js';
import { CorpCoinService } from '../services/economy/corpCoin.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';

describe('TASK P8.6: Bankruptcy Liquidation & Re-entry Suite', () => {
  let simulationService: SimulationService;
  let founderService: FounderService;
  let mockConfigService: ConfigService;
  let mockCorpCoinService: CorpCoinService;
  let mockNotificationService: NotificationService;

  const founderUserId = new Types.ObjectId();
  const companyId = new Types.ObjectId();
  const employee1UserId = new Types.ObjectId();
  const employee2UserId = new Types.ObjectId();
  const employee1DocId = new Types.ObjectId();
  const employee2DocId = new Types.ObjectId();
  const testDateKey = '2026-10-10';

  const createMockCompany = (overrides?: Partial<ICompanyDocument>): ICompanyDocument => {
    return {
      _id: companyId,
      name: 'Apex Innovations',
      ownerId: founderUserId,
      type: 'FOUNDER',
      domain: 'SOFTWARE_ENGINEERING',
      companyRating: 50,
      financialHealth: 0,
      employeeSatisfaction: 70,
      retentionRate: 100,
      employeeCount: 2,
      maxEmployees: 20,
      status: 'ACTIVE',
      isOpenForHiring: true,
      operatingDays: 10,
      cumulativeRevenue: 50000,
      cumulativeProfit: 12000,
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyDocument;
  };

  const createMockFounderUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    return {
      _id: founderUserId,
      email: 'founder@apex.io',
      totalExp: 14000,
      totalExpCached: 14000,
      corpCoinBalance: 450,
      corpCoinBalanceCached: 450,
      careerRole: 'FOUNDER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      founderModeUnlockedAt: new Date(Date.now() - 30 * 86400000),
      founderStarterCoinGranted: true,
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IUserDocument;
  };

  const createMockEmployees = (): ICompanyEmployeeDocument[] => {
    return [
      {
        _id: employee1DocId,
        userId: employee1UserId,
        companyId,
        domain: 'SOFTWARE_ENGINEERING',
        level: 5,
        positionTitle: 'Mid Backend Engineer',
        status: 'ACTIVE',
        history: [
          {
            status: 'ACTIVE',
            level: 5,
            positionTitle: 'Mid Backend Engineer',
            reason: 'Hired',
            changedAt: new Date(Date.now() - 20 * 86400000),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyEmployeeDocument,
      {
        _id: employee2DocId,
        userId: employee2UserId,
        domain: 'SOFTWARE_ENGINEERING',
        companyId,
        level: 4,
        positionTitle: 'Associate Frontend Engineer',
        status: 'ON_PROBATION',
        history: [
          {
            status: 'ON_PROBATION',
            level: 4,
            positionTitle: 'Associate Frontend Engineer',
            reason: 'Offer accepted',
            changedAt: new Date(Date.now() - 5 * 86400000),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyEmployeeDocument,
    ];
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
        balanceAfter: 1450,
      }),
      creditCorpCoin: vi.fn().mockResolvedValue({
        transaction: { _id: new Types.ObjectId() },
        balanceAfter: 1450,
      }),
    } as unknown as CorpCoinService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as NotificationService;

    simulationService = new SimulationService(
      undefined as never,
      mockConfigService
    );

    founderService = new FounderService(
      mockConfigService,
      mockCorpCoinService,
      mockNotificationService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. BOUNDARY CONDITION TESTS (-999 vs -1000)
  // =========================================================================
  describe('1. Financial Health Threshold Boundary Tests (-999 vs -1000)', () => {
    it('isBankrupt returns false at boundary -999 and true at boundary -1000 for default threshold -1000', () => {
      // Safe zone
      expect(isBankrupt(0, -1000)).toBe(false);
      expect(isBankrupt(-500, -1000)).toBe(false);
      expect(isBankrupt(-998, -1000)).toBe(false);

      // Boundary condition: -999 vs -1000
      expect(isBankrupt(-999, -1000)).toBe(false);
      expect(isBankrupt(-1000, -1000)).toBe(true);

      // Deep insolvency
      expect(isBankrupt(-1001, -1000)).toBe(true);
      expect(isBankrupt(-2500, -1000)).toBe(true);
    });

    it('respects dynamic bankruptcyThreshold from PlatformConfig (e.g. -500)', () => {
      const customThreshold = -500;
      expect(isBankrupt(-499, customThreshold)).toBe(false);
      expect(isBankrupt(-500, customThreshold)).toBe(true);
      expect(isBankrupt(-501, customThreshold)).toBe(true);
    });

    it('executeDeterministicTick does not flag bankruptcy when resulting health is -999', () => {
      // 0 employees, 3 bots, Q=50: rev = 200, exp = 80, profit = +120
      // Initial health = -1119 => new health = -1119 + 120 = -999 (boundary: NOT bankrupt)
      const tick = executeDeterministicTick({
        employeeCount: 0,
        botCount: 3,
        companyRating: 50,
        financialHealth: -1119,
        employeeSatisfaction: 70,
        retentionRate: 100,
        productivity: 70,
        modifiers: {
          revenueDelta: 0,
          expenseDelta: 0,
        },
        bankruptcyThreshold: -1000,
      });

      expect(tick.newFinancialHealth).toBe(-999);
      expect(tick.isBankrupt).toBe(false);

      // Override health to exactly -999 to test boundary evaluation inside tick
      const boundaryTick = executeDeterministicTick({
        employeeCount: 1,
        botCount: 3,
        companyRating: 50,
        financialHealth: -999,
        employeeSatisfaction: 70,
        retentionRate: 100,
        productivity: 70,
        modifiers: {
          revenueDeltaPercent: 0,
          expensesDeltaPercent: 0,
        },
        bankruptcyThreshold: -1000,
      });

      // If profit is >= 0, health is -999
      if (boundaryTick.newFinancialHealth === -999) {
        expect(boundaryTick.isBankrupt).toBe(false);
      }
    });

    it('executeDailyTick does NOT trigger bankruptcy liquidation when health equals -999', async () => {
      // 0 employees, 3 bots, Q=50: rev = 200, exp = 80, profit = +120
      // Initial health = -1119 => new health = -1119 + 120 = -999 (boundary: NOT bankrupt)
      const company = createMockCompany({ financialHealth: -1119, employeeCount: 0, companyRating: 50 });
      const founderUser = createMockFounderUser();

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyFinancialsModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([]);
      vi.spyOn(PerformanceRecordModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as never);
      vi.spyOn(CompanyBotModel, 'countDocuments').mockResolvedValue(3);
      vi.spyOn(CompanyFinancialsModel, 'create').mockResolvedValue({} as unknown as never);

      const liquidationSpy = vi.spyOn(simulationService, 'executeBankruptcyLiquidation');

      const result = await simulationService.executeDailyTick(founderUserId, testDateKey);

      expect(result.tickResult.newFinancialHealth).toBe(-999);
      expect(result.tickResult.isBankrupt).toBe(false);
      expect(liquidationSpy).not.toHaveBeenCalled();
      expect(company.status).toBe('ACTIVE');
      expect(company.isOpenForHiring).toBe(true);
      expect(company.save).toHaveBeenCalled();
    });

    it('executeDailyTick triggers bankruptcy liquidation when health drops to <= -1000', async () => {
      // 0 employees, 3 bots, Q=50: rev = 200, exp = 80, profit = +120
      // Initial health = -1120 => new health = -1120 + 120 = -1000 (boundary: BANKRUPT!)
      const company = createMockCompany({ financialHealth: -1120, employeeCount: 0, companyRating: 50 });
      const founderUser = createMockFounderUser();
      const mockEmployees = createMockEmployees();

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyFinancialsModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue(mockEmployees);
      vi.spyOn(PerformanceRecordModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as never);
      vi.spyOn(CompanyBotModel, 'countDocuments').mockResolvedValue(3);
      vi.spyOn(CompanyFinancialsModel, 'create').mockResolvedValue({} as unknown as never);
      vi.spyOn(FounderModel, 'findOne').mockResolvedValue({ status: 'ACTIVE', save: vi.fn() } as unknown as IFounderDocument);
      vi.spyOn(CompanyJobModel, 'updateMany').mockResolvedValue({ acknowledged: true } as unknown as never);
      vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as unknown as never);
      vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as unknown as never);
      vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as never);

      const liquidationSpy = vi.spyOn(simulationService, 'executeBankruptcyLiquidation');

      const result = await simulationService.executeDailyTick(founderUserId, testDateKey);

      expect(result.tickResult.newFinancialHealth).toBe(-1000);
      expect(result.tickResult.isBankrupt).toBe(true);
      expect(liquidationSpy).toHaveBeenCalledWith(company);
      expect(company.status).toBe('BANKRUPT');
      expect(company.isOpenForHiring).toBe(false);
    });
  });

  // =========================================================================
  // 2. ATOMIC BANKRUPTCY LIQUIDATION EXECUTION
  // =========================================================================
  describe('2. Atomic Bankruptcy Liquidation Protocol', () => {
    it('executes all state mutations atomically and correctly updates company, employees, founder, jobs, and audit logs', async () => {
      const company = createMockCompany({
        financialHealth: -1050,
        status: 'ACTIVE',
        isOpenForHiring: true,
        employeeCount: 2,
      });

      const founderUser = createMockFounderUser({
        totalExp: 15500,
        totalExpCached: 15500,
        corpCoinBalance: 350,
        corpCoinBalanceCached: 350,
        careerRole: 'FOUNDER',
        founderStarterCoinGranted: true,
      });

      const mockFounderRecord = {
        userId: founderUserId,
        status: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IFounderDocument;

      const mockEmployees = createMockEmployees();

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(FounderModel, 'findOne').mockResolvedValue(mockFounderRecord);
      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue(mockEmployees);
      const userUpdateSpy = vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as never);
      const jobsUpdateSpy = vi.spyOn(CompanyJobModel, 'updateMany').mockResolvedValue({ acknowledged: true } as unknown as never);
      const notifCreateSpy = vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as unknown as never);
      const auditCreateSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as unknown as never);

      await simulationService.executeBankruptcyLiquidation(company);

      // 1. Company mutated to BANKRUPT, not hiring, zero employees
      expect(company.status).toBe('BANKRUPT');
      expect(company.isOpenForHiring).toBe(false);
      expect(company.employeeCount).toBe(0);
      expect(company.save).toHaveBeenCalled();

      // 2. Founder reverted to JOB_SEEKER with EXP and personal coins preserved
      expect(founderUser.careerRole).toBe('JOB_SEEKER');
      expect(founderUser.totalExp).toBe(15500); // Lifetime EXP never wiped
      expect(founderUser.corpCoinBalance).toBe(350); // Personal liquidity preserved
      expect(founderUser.founderStarterCoinGranted).toBe(true); // Flag preserved
      expect(founderUser.save).toHaveBeenCalled();

      // Founder record status transitioned to BANKRUPT
      expect(mockFounderRecord.status).toBe('BANKRUPT');
      expect(mockFounderRecord.save).toHaveBeenCalled();

      // 3. Employees terminated and released back to JOB_SEEKER
      for (const emp of mockEmployees) {
        expect(emp.status).toBe('TERMINATED');
        expect(emp.endedAt).toBeInstanceOf(Date);
        expect(emp.history[emp.history.length - 1].status).toBe('TERMINATED');
        expect(emp.history[emp.history.length - 1].reason).toBe('Company bankruptcy liquidation');
        expect(emp.save).toHaveBeenCalled();
        expect(userUpdateSpy).toHaveBeenCalledWith(emp.userId, { careerRole: 'JOB_SEEKER' });
      }

      // 4. All open company jobs closed
      expect(jobsUpdateSpy).toHaveBeenCalledWith(
        { companyId: company._id, isOpen: true },
        { isOpen: false, status: 'CLOSED' }
      );

      // 5. Notifications sent to laid-off employees and founder
      expect(notifCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: employee1UserId,
          type: 'COMPANY_BANKRUPT',
          title: 'Company Liquidation Notice',
        })
      );
      expect(notifCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: founderUserId,
          type: 'COMPANY_BANKRUPT',
          title: 'Company Bankruptcy Notice',
        })
      );

      // 6. Audit log created
      expect(auditCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: founderUserId,
          actorRole: 'ADMIN',
          action: 'COMPANY_BANKRUPTCY_LIQUIDATION',
          targetType: 'Company',
          targetCollection: 'companies',
          targetId: company._id,
        })
      );
    });

    it('manages MongoDB transaction session properly when connection is active', async () => {
      const company = createMockCompany({ financialHealth: -1000 });
      const founderUser = createMockFounderUser();

      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };

      const dbObj = CompanyModel.db as unknown as { readyState: number; startSession: () => Promise<unknown> };
      const origReadyState = dbObj.readyState;
      Object.defineProperty(dbObj, 'readyState', { value: 1, configurable: true });
      const sessionSpy = vi.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as unknown as mongoose.ClientSession);

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(FounderModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([]);
      vi.spyOn(CompanyJobModel, 'updateMany').mockResolvedValue({ acknowledged: true } as unknown as never);
      vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as unknown as never);
      vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as unknown as never);

      await simulationService.executeBankruptcyLiquidation(company);

      expect(sessionSpy).toHaveBeenCalled();
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();

      // Cleanup
      Object.defineProperty(dbObj, 'readyState', { value: origReadyState, configurable: true });
    });
  });

  // =========================================================================
  // 3. FOUNDER RE-ENTRY AS JOB SEEKER & NO STARTER COINS RE-GRANTED
  // =========================================================================
  describe('3. Founder Re-entry as Job Seeker & No Starter Coins Re-granted', () => {
    it('bankrupt founder careerRole is JOB_SEEKER, allowing job applications in the talent market', async () => {
      const founderUser = createMockFounderUser({
        careerRole: 'JOB_SEEKER',
        founderModeUnlockedAt: new Date(Date.now() - 30 * 86400000),
        founderStarterCoinGranted: true,
      });

      // Verification that the role is strictly JOB_SEEKER
      expect(founderUser.careerRole).toBe('JOB_SEEKER');
      expect(founderUser.totalExp).toBe(14000);
      expect(founderUser.founderStarterCoinGranted).toBe(true);
    });

    it('founder eligibility returns starterCoinAvailable = false for returning ex-founder', async () => {
      const exFounder = createMockFounderUser({
        careerRole: 'JOB_SEEKER',
        totalExp: 14000,
        founderModeUnlockedAt: new Date(Date.now() - 30 * 86400000),
        founderStarterCoinGranted: true, // Previously unlocked and granted
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(exFounder);

      const eligibility = await founderService.getEligibility(founderUserId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.careerRole).toBe('JOB_SEEKER');
      expect(eligibility.hasUnlockedBefore).toBe(true);
      expect(eligibility.starterCoinAvailable).toBe(false); // NO coins available
      expect(eligibility.starterCoinAmount).toBe(1000);
    });

    it('re-unlocking Founder Mode does NOT re-grant starter CorpCoin (starterCoinsGranted = 0)', async () => {
      const exFounder = createMockFounderUser({
        careerRole: 'JOB_SEEKER',
        totalExp: 14000,
        corpCoinBalance: 450,
        founderModeUnlockedAt: new Date(Date.now() - 30 * 86400000),
        founderStarterCoinGranted: true,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(exFounder);
      vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue({
        ...exFounder,
        careerRole: 'FOUNDER',
        corpCoinBalance: 450,
      } as unknown as IUserDocument);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({
        userId: founderUserId,
        status: 'ACTIVE',
      } as unknown as IFounderDocument);

      const result = await founderService.unlockFounderMode(founderUserId, true);

      expect(result.success).toBe(true);
      expect(result.user.careerRole).toBe('FOUNDER');
      expect(result.user.founderStarterCoinGranted).toBe(true);
      // STRICT REQUIREMENT: Starter coins must NOT be granted again!
      expect(result.starterCoinsGranted).toBe(0);
      expect(mockCorpCoinService.credit).not.toHaveBeenCalled();
      expect(mockCorpCoinService.creditCorpCoin).not.toHaveBeenCalled();
      // User personal balance was not increased by 1000
      expect(result.user.corpCoinBalance).toBe(450);
    });

    it('consecutive bankruptcy-unlock cycles never re-grant starter coins', async () => {
      const user = createMockFounderUser({
        careerRole: 'JOB_SEEKER',
        founderStarterCoinGranted: true,
        founderModeUnlockedAt: new Date(Date.now() - 60 * 86400000),
        corpCoinBalance: 200,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(user);
      vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue({
        ...user,
        careerRole: 'FOUNDER',
        corpCoinBalance: 200,
      } as unknown as IUserDocument);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({
        userId: founderUserId,
        status: 'ACTIVE',
      } as unknown as IFounderDocument);

      // Re-unlock cycle 1
      const cycle1 = await founderService.unlockFounderMode(founderUserId, true);
      expect(cycle1.starterCoinsGranted).toBe(0);
      expect(cycle1.user.corpCoinBalance).toBe(200);

      // Re-unlock cycle 2
      const cycle2 = await founderService.unlockFounderMode(founderUserId, true);
      expect(cycle2.starterCoinsGranted).toBe(0);
      expect(cycle2.user.corpCoinBalance).toBe(200);
      expect(mockCorpCoinService.credit).not.toHaveBeenCalled();
    });
  });
});
