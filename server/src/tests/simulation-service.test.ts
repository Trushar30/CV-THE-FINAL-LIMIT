import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { SimulationService } from '../services/simulation/simulation.service.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyBotModel } from '../models/CompanyBot.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import {
  CompanyScenarioModel,
  type ICompanyScenarioDocument,
  type IScenarioOption,
} from '../models/CompanyScenario.js';
import {
  CompanyDecisionModel,
  type ICompanyDecisionDocument,
} from '../models/CompanyDecision.js';
import {
  CompanyFinancialsModel,
  type ICompanyFinancialsDocument,
} from '../models/CompanyFinancials.js';
import { FounderModel, type IFounderDocument } from '../models/Founder.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { NotificationModel } from '../models/Notification.js';
import { PerformanceRecordModel } from '../models/PerformanceRecord.js';
import { ConfigService } from '../services/config/config.service.js';
import { AIGateway, type AIResponse } from '../ai/index.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import { MODIFIER_TEMPLATES } from '../schemas/simulation.schema.js';

describe('Company Simulation Service Integration Suite (TASK P8.5)', () => {
  let simulationService: SimulationService;
  let mockAIGateway: AIGateway;
  let mockConfigService: ConfigService;

  const founderUserId = new Types.ObjectId();
  const foreignUserId = new Types.ObjectId();
  const companyId = new Types.ObjectId();
  const employeeUserId = new Types.ObjectId();
  const testDateKey = '2026-10-10';

  const createMockFounderUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    return {
      _id: founderUserId,
      email: 'founder@corpverse.io',
      totalExp: 16000,
      corpCoinBalance: 150,
      careerRole: 'FOUNDER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IUserDocument;
  };

  const createMockCompany = (overrides?: Partial<ICompanyDocument>): ICompanyDocument => {
    return {
      _id: companyId,
      name: 'CyberScale Technologies',
      ownerId: founderUserId,
      status: 'ACTIVE',
      employeeCount: 8,
      financialHealth: 150,
      companyRating: 65,
      employeeSatisfaction: 75,
      retentionRate: 100.0,
      cumulativeRevenue: 0,
      cumulativeProfit: 0,
      operatingDays: 0,
      isOpenForHiring: true,
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyDocument;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAIGateway = {
      execute: vi.fn(),
      submit: vi.fn(),
    } as unknown as AIGateway;

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
    } as unknown as ConfigService;

    simulationService = new SimulationService(mockAIGateway, mockConfigService);
    vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as unknown as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Role Gating & Access Control', () => {
    it('rejects non-founders from accessing simulation operations with 403 Forbidden', async () => {
      const nonFounder = {
        _id: foreignUserId,
        careerRole: 'EMPLOYEE',
      } as unknown as IUserDocument;
      vi.spyOn(UserModel, 'findById').mockResolvedValue(nonFounder);

      await expect(simulationService.getDailyScenario(foreignUserId, testDateKey)).rejects.toThrow(
        /Only active founders/
      );
    });

    it('rejects founders without active companies with 404 Not Found', async () => {
      const founderUser = createMockFounderUser();
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);

      await expect(simulationService.getDailyScenario(founderUserId, testDateKey)).rejects.toThrow(
        /No active company found/
      );
    });
  });

  describe('2. Scenario Generation & Modifier Template Enforcement', () => {
    it('generates scenario where every option strictly references a backend template ID and binds backend numbers', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(null);

      const aiMockResponse: Partial<AIResponse> = {
        success: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        requestId: 'req-sim-1',
        content: '',
        structuredData: {
          scenarioPrompt: 'A prominent enterprise client offers a high-value long-term support agreement.',
          category: 'CLIENT',
          options: [
            {
              optionId: 'A',
              title: 'Accept & Optimize',
              description: 'Deliver against SLAs with increased pricing.',
              expectedOutcome: 'High revenue growth.',
              modifierTemplateId: 'ACCEPT_ENTERPRISE_CONTRACT',
            },
            {
              optionId: 'B',
              title: 'Decline and Refactor',
              description: 'Focus on paying down technical debt.',
              expectedOutcome: 'High morale, lower expansion.',
              modifierTemplateId: 'TECH_DEBT_REFACTOR',
            },
          ],
        },
      };

      vi.spyOn(mockAIGateway, 'execute').mockResolvedValue(aiMockResponse as AIResponse);

      let createdScenarioData: { options: IScenarioOption[] } | null = null;
      vi.spyOn(CompanyScenarioModel, 'create').mockImplementation(async (doc: unknown) => {
        createdScenarioData = doc as { options: IScenarioOption[] };
        return { ...(doc as object), _id: new Types.ObjectId() } as unknown as ICompanyScenarioDocument;
      });

      const scenario = await simulationService.getDailyScenario(founderUserId, testDateKey);

      expect(scenario).toBeDefined();
      expect(createdScenarioData).toBeDefined();
      expect(createdScenarioData?.options).toHaveLength(2);

      const optA = createdScenarioData?.options[0];
      expect(optA?.modifierTemplateId).toBe('ACCEPT_ENTERPRISE_CONTRACT');
      expect(optA?.modifiers.revenueModifier).toBe(40);
      expect(optA?.modifiers.expenseModifier).toBe(15);
      expect(optA?.modifiers.satisfactionDelta).toBe(2);
      expect(optA?.modifiers.reputationDelta).toBe(3);

      const optB = createdScenarioData?.options[1];
      expect(optB?.modifierTemplateId).toBe('TECH_DEBT_REFACTOR');
      expect(optB?.modifiers.revenueModifier).toBe(-15);
    });

    it('enforces 1 scenario per founder per day (idempotent UTC dayKey)', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();
      const existingScenario = {
        _id: new Types.ObjectId(),
        companyId: company._id,
        date: testDateKey,
        scenarioPrompt: 'Existing Dilemma',
        status: 'ACTIVE',
      } as unknown as ICompanyScenarioDocument;

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(existingScenario);

      const result = await simulationService.getDailyScenario(founderUserId, testDateKey);

      expect(result).toBe(existingScenario);
      expect(mockAIGateway.execute).not.toHaveBeenCalled();
    });

    it('falls back to deterministic dilemma if AI Gateway fails or throws', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(null);

      vi.spyOn(mockAIGateway, 'execute').mockRejectedValue(new Error('AI Provider unavailable'));

      let createdScenarioData: { options: IScenarioOption[] } | null = null;
      vi.spyOn(CompanyScenarioModel, 'create').mockImplementation(async (doc: unknown) => {
        createdScenarioData = doc as { options: IScenarioOption[] };
        return { ...(doc as object), _id: new Types.ObjectId() } as unknown as ICompanyScenarioDocument;
      });

      const scenario = await simulationService.getDailyScenario(founderUserId, testDateKey);

      expect(scenario).toBeDefined();
      expect(createdScenarioData?.options.length).toBeGreaterThanOrEqual(2);
      expect(createdScenarioData?.options[0]?.modifiers).toBeDefined();
    });
  });

  describe('3. Decision Submission', () => {
    it('records founder option choice, marks scenario DECIDED, and saves in companyDecisions', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();
      const scenarioId = new Types.ObjectId();

      const mockScenario = {
        _id: scenarioId,
        companyId: company._id,
        date: testDateKey,
        status: 'ACTIVE',
        options: [
          {
            optionId: 'A',
            title: 'Accept',
            description: 'Accept deal',
            expectedOutcome: 'Profit',
            modifierTemplateId: 'ACCEPT_ENTERPRISE_CONTRACT',
            modifiers: MODIFIER_TEMPLATES.ACCEPT_ENTERPRISE_CONTRACT,
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyScenarioDocument;

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyScenarioModel, 'findById').mockResolvedValue(mockScenario);

      let createdDecisionDoc: ICompanyDecisionDocument | null = null;
      vi.spyOn(CompanyDecisionModel, 'create').mockImplementation(async (doc: unknown) => {
        createdDecisionDoc = doc as ICompanyDecisionDocument;
        return { ...(doc as object), _id: new Types.ObjectId() } as unknown as ICompanyDecisionDocument;
      });

      const result = await simulationService.submitDecision(founderUserId, {
        scenarioId: scenarioId.toString(),
        chosenOptionId: 'A',
        rationale: 'Strategic alignment with our Q4 ARR goals.',
      });

      expect(result).toBeDefined();
      expect(mockScenario.status).toBe('DECIDED');
      expect(mockScenario.chosenOptionId).toBe('A');
      expect(createdDecisionDoc).toBeDefined();
      expect(createdDecisionDoc?.chosenOptionId).toBe('A');
      expect(createdDecisionDoc?.modifierTemplateId).toBe('ACCEPT_ENTERPRISE_CONTRACT');
      expect(createdDecisionDoc?.calculatedDelta.revenueModifier).toBe(40);
    });

    it('rejects decision submission if scenario is already decided or expired', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();
      const scenarioId = new Types.ObjectId();

      const mockScenario = {
        _id: scenarioId,
        companyId: company._id,
        status: 'DECIDED',
        options: [{ optionId: 'A' }],
      } as unknown as ICompanyScenarioDocument;

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyScenarioModel, 'findById').mockResolvedValue(mockScenario);

      await expect(
        simulationService.submitDecision(founderUserId, {
          scenarioId: scenarioId.toString(),
          chosenOptionId: 'A',
        })
      ).rejects.toThrow(/already DECIDED/);
    });
  });

  describe('4. Daily Tick Execution & Financial Snapshots', () => {
    it('executes tick deterministically, updates Company state, and writes companyFinancials snapshot', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany({
        employeeCount: 8,
        financialHealth: 150,
        companyRating: 65,
        employeeSatisfaction: 75,
        retentionRate: 100.0,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyFinancialsModel, 'findOne').mockResolvedValue(null);

      const mockScenario = {
        status: 'DECIDED',
        calculatedDelta: MODIFIER_TEMPLATES.ACCEPT_ENTERPRISE_CONTRACT,
      } as unknown as ICompanyScenarioDocument;
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(mockScenario);

      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([
        { userId: employeeUserId } as unknown as ICompanyEmployeeDocument,
      ]);
      vi.spyOn(PerformanceRecordModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([{ aiScore: 86 }]),
      } as unknown as ReturnType<typeof PerformanceRecordModel.find>);
      vi.spyOn(CompanyBotModel, 'countDocuments').mockResolvedValue(3);

      let savedFinancials: ICompanyFinancialsDocument | null = null;
      vi.spyOn(CompanyFinancialsModel, 'create').mockImplementation(async (doc: unknown) => {
        savedFinancials = doc as ICompanyFinancialsDocument;
        return { ...(doc as object), _id: new Types.ObjectId() } as unknown as ICompanyFinancialsDocument;
      });

      const result = await simulationService.executeDailyTick(founderUserId, testDateKey);

      expect(result.alreadyTicked).toBe(false);
      expect(result.tickResult.dailyRevenue).toBe(304);
      expect(result.tickResult.dailyExpenses).toBe(175);
      expect(result.tickResult.dailyProfit).toBe(129);
      expect(result.tickResult.newFinancialHealth).toBe(279);
      expect(result.tickResult.newCompanyRating).toBe(68);
      expect(result.tickResult.newEmployeeSatisfaction).toBe(77);
      expect(result.tickResult.newRetentionRate).toBe(100.0);

      expect(company.financialHealth).toBe(279);
      expect(company.companyRating).toBe(68);
      expect(company.employeeSatisfaction).toBe(77);
      expect(company.cumulativeProfit).toBe(129);
      expect(company.operatingDays).toBe(1);
      expect(company.save).toHaveBeenCalled();

      expect(savedFinancials).toBeDefined();
      expect(savedFinancials?.revenue).toBe(304);
      expect(savedFinancials?.expenses).toBe(175);
      expect(savedFinancials?.profit).toBe(129);
      expect(savedFinancials?.financialHealth).toBe(279);
    });

    it('enforces idempotency: repeated tick on same date returns existing record without re-calculating', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();
      const existingFinancials = {
        _id: new Types.ObjectId(),
        companyId: company._id,
        date: testDateKey,
        revenue: 304,
        expenses: 175,
        profit: 129,
        financialHealth: 279,
        employeeRetentionRate: 100.0,
      } as unknown as ICompanyFinancialsDocument;

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyFinancialsModel, 'findOne').mockResolvedValue(existingFinancials);
      const createSpy = vi.spyOn(CompanyFinancialsModel, 'create');

      const result = await simulationService.executeDailyTick(founderUserId, testDateKey);

      expect(result.alreadyTicked).toBe(true);
      expect(result.financials).toBe(existingFinancials);
      expect(createSpy).not.toHaveBeenCalled();
      expect(company.save).not.toHaveBeenCalled();
    });

    it('applies DEFAULT_EXPIRED modifier when unselected scenario expires on tick', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany({ financialHealth: 0 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyFinancialsModel, 'findOne').mockResolvedValue(null);

      const activeScenario = {
        status: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyScenarioDocument;
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(activeScenario);

      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([]);
      vi.spyOn(PerformanceRecordModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof PerformanceRecordModel.find>);
      vi.spyOn(CompanyBotModel, 'countDocuments').mockResolvedValue(3);
      vi.spyOn(CompanyFinancialsModel, 'create').mockResolvedValue({} as unknown as ICompanyFinancialsDocument);

      await simulationService.executeDailyTick(founderUserId, testDateKey);

      expect(activeScenario.status).toBe('EXPIRED');
      expect(activeScenario.calculatedDelta).toEqual(MODIFIER_TEMPLATES.DEFAULT_EXPIRED);
    });
  });

  describe('5. Bankruptcy Liquidation Protocol (Health <= -1000)', () => {
    it('executes full liquidation when financial health crosses threshold: marks BANKRUPT, resets founder to JOB_SEEKER, terminates employees, closes jobs, and records audit log', async () => {
      const founderUser = createMockFounderUser({ corpCoinBalance: 200, totalExp: 16000 });
      const company = createMockCompany({
        financialHealth: -980,
        companyRating: 20,
        employeeCount: 4,
        isOpenForHiring: true,
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyFinancialsModel, 'findOne').mockResolvedValue(null);

      const mockScenario = {
        status: 'DECIDED',
        calculatedDelta: MODIFIER_TEMPLATES.DAY_2_LOSS,
      } as unknown as ICompanyScenarioDocument;
      vi.spyOn(CompanyScenarioModel, 'findOne').mockResolvedValue(mockScenario);

      const mockEmployee = {
        _id: new Types.ObjectId(),
        userId: employeeUserId,
        status: 'ACTIVE',
        history: [],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyEmployeeDocument;

      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([mockEmployee]);

      vi.spyOn(PerformanceRecordModel, 'find').mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof PerformanceRecordModel.find>);
      vi.spyOn(CompanyBotModel, 'countDocuments').mockResolvedValue(3);
      vi.spyOn(CompanyFinancialsModel, 'create').mockResolvedValue({} as unknown as ICompanyFinancialsDocument);

      vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(founderUser);
      vi.spyOn(FounderModel, 'findOne').mockResolvedValue({ status: 'ACTIVE', save: vi.fn() } as unknown as IFounderDocument);
      vi.spyOn(CompanyJobModel, 'updateMany').mockResolvedValue({ acknowledged: true, matchedCount: 2, modifiedCount: 2, upsertedCount: 0, upsertedId: null });
      vi.spyOn(NotificationModel, 'create').mockResolvedValue({} as unknown as never);
      const auditSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as unknown as never);

      const result = await simulationService.executeDailyTick(founderUserId, testDateKey);

      expect(result.tickResult.isBankrupt).toBe(true);
      expect(company.status).toBe('BANKRUPT');
      expect(company.isOpenForHiring).toBe(false);

      expect(founderUser.careerRole).toBe('JOB_SEEKER');
      expect(founderUser.corpCoinBalance).toBe(200);
      expect(founderUser.totalExp).toBe(16000);

      expect(mockEmployee.status).toBe('TERMINATED');
      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(employeeUserId, { careerRole: 'JOB_SEEKER' });

      expect(CompanyJobModel.updateMany).toHaveBeenCalledWith(
        { companyId: company._id, isOpen: true },
        { isOpen: false, status: 'CLOSED' }
      );

      expect(NotificationModel.create).toHaveBeenCalled();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPANY_BANKRUPTCY_LIQUIDATION',
          targetType: 'Company',
        })
      );
    });
  });

  describe('6. Historical Financial Snapshots', () => {
    it('returns historical records sorted newest first with limit', async () => {
      const founderUser = createMockFounderUser();
      const company = createMockCompany();

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founderUser);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);

      const mockSnapshots = [{ revenue: 304 }, { revenue: 250 }] as unknown as ICompanyFinancialsDocument[];
      vi.spyOn(CompanyFinancialsModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockSnapshots),
        }),
      } as unknown as ReturnType<typeof CompanyFinancialsModel.find>);

      const history = await simulationService.getFinancialHistory(founderUserId, 10);
      expect(history).toEqual(mockSnapshots);
    });
  });
});
