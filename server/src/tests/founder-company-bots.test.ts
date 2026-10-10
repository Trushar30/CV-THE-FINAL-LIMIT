import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { FounderService } from '../services/founder/founder.service.js';
import { FounderController } from '../controllers/founder.controller.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyBotModel, type ICompanyBotDocument } from '../models/CompanyBot.js';
import { FounderModel } from '../models/Founder.js';
import { ConfigService } from '../services/config/config.service.js';
import { CorpCoinService, type DebitCorpCoinParams, type DebitCorpCoinResult } from '../services/economy/corpCoin.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';

interface SimulatedLedgerTx {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  balanceAfter: number;
  type: string;
  referenceId: Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

describe('Founder Company Creation & AI Bot Store Suite (TASK P8.2)', () => {
  let founderService: FounderService;
  let controller: FounderController;
  let mockConfigService: ConfigService;
  let mockCorpCoinService: CorpCoinService;
  let mockNotificationService: NotificationService;

  const mockUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();

  const createMockFounderUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    return {
      _id: mockUserId,
      email: 'founder@corpverse.io',
      totalExp: 16000,
      totalExpCached: 16000,
      corpCoinBalance: 1000, // Starter capital
      corpCoinBalanceCached: 1000,
      careerRole: 'FOUNDER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      founderModeUnlockedAt: new Date(),
      founderStarterCoinGranted: true,
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IUserDocument;
  };

  const createMockCompany = (overrides?: Partial<ICompanyDocument>): ICompanyDocument => {
    return {
      _id: mockCompanyId,
      name: 'CyberCore Dynamics',
      description: 'Distributed AI cloud infrastructure',
      type: 'FOUNDER',
      isPlatformCompany: false,
      ownerId: mockUserId,
      domainsHired: ['SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING'],
      status: 'ACTIVE',
      ratings: { overall: 50, culture: 50, workLife: 50, technicalExcellence: 50 },
      companyRating: 50,
      financialHealth: 0,
      employeeCount: 0,
      maxEmployees: 20,
      isOpenForHiring: false,
      aiProviderPool: 'PIPELINE',
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyDocument;
  };

  const createMockBot = (
    botType: 'HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT',
    overrides?: Partial<ICompanyBotDocument>
  ): ICompanyBotDocument => {
    return {
      _id: new Types.ObjectId(),
      companyId: mockCompanyId,
      botType,
      tier: 'BASIC',
      purchaseCost: 250,
      isActive: true,
      purchasedAt: new Date(),
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyBotDocument;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
    } as unknown as ConfigService;

    mockCorpCoinService = {
      credit: vi.fn(),
      debit: vi.fn(),
      getBalance: vi.fn().mockResolvedValue(1000),
    } as unknown as CorpCoinService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as unknown as NotificationService;

    founderService = new FounderService(
      mockConfigService,
      mockCorpCoinService,
      mockNotificationService
    );

    controller = new FounderController(founderService);

    // Bypass transaction session in standalone test mode
    vi.spyOn(
      founderService as unknown as { withTransaction: (work: (s: null) => Promise<unknown>) => Promise<unknown> },
      'withTransaction'
    ).mockImplementation(async (work) => await work(null));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Company Creation Guards & Limits
  // =========================================================================
  describe('1. Company Creation Rules & Validation', () => {
    it('blocks non-founder career roles from creating a company with 403 Forbidden', async () => {
      const nonFounder = createMockFounderUser({ careerRole: 'EMPLOYEE' });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(nonFounder);

      await expect(
        founderService.createCompany(mockUserId, {
          name: 'Apex Robotics',
          description: 'Autonomous systems laboratory',
          domainsHired: ['SOFTWARE_ENGINEERING'],
        })
      ).rejects.toThrow('Only users in FOUNDER careerRole can create a company');
    });

    it('blocks company creation when CorpCoin balance is insufficient (< 100 CorpCoin)', async () => {
      const brokeFounder = createMockFounderUser({ corpCoinBalance: 50 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(brokeFounder);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);

      await expect(
        founderService.createCompany(mockUserId, {
          name: 'Apex Robotics',
          description: 'Autonomous systems laboratory',
          domainsHired: ['SOFTWARE_ENGINEERING'],
        })
      ).rejects.toThrow(/Insufficient CorpCoin balance. Company creation requires 100 CorpCoin/);
    });

    it('blocks duplicate company names with 409 Conflict', async () => {
      const founder = createMockFounderUser();
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founder);
      vi.spyOn(CompanyModel, 'findOne')
        .mockResolvedValueOnce(null) // No existing company owned by user
        .mockResolvedValueOnce({ _id: new Types.ObjectId(), name: 'Taken Name' } as unknown as ICompanyDocument); // Name conflict

      await expect(
        founderService.createCompany(mockUserId, {
          name: 'Taken Name',
          description: 'Autonomous systems laboratory',
          domainsHired: ['SOFTWARE_ENGINEERING'],
        })
      ).rejects.toThrow(/Company name "Taken Name" is already registered/);
    });

    it('enforces 1 active company limit per founder (blocks second active company)', async () => {
      const founder = createMockFounderUser();
      const existingCompany = createMockCompany({ status: 'ACTIVE' });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(founder);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValueOnce(existingCompany);

      await expect(
        founderService.createCompany(mockUserId, {
          name: 'Second Company Inc',
          description: 'Attempting a second active enterprise',
          domainsHired: ['SOFTWARE_ENGINEERING'],
        })
      ).rejects.toThrow(
        /Founder already owns an active company. Operating limits enforce exactly 1 active company per founder/
      );
    });

    it('allows creating a company if previous company was BANKRUPT', async () => {
      const founder = createMockFounderUser({ corpCoinBalance: 500 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founder);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({} as unknown as ICompanyDocument);

      const mockSavedCompany = createMockCompany({ name: 'Phoenix Corp' });
      vi.spyOn(CompanyModel.prototype, 'save').mockResolvedValue(mockSavedCompany as unknown as ICompanyDocument);

      vi.spyOn(mockCorpCoinService, 'debit').mockResolvedValue({
        success: true,
        balanceAfter: 400,
        transaction: { _id: new Types.ObjectId(), type: 'COMPANY_CREATION', amount: 100 } as unknown as DebitCorpCoinResult['transaction'],
      });

      const result = await founderService.createCompany(mockUserId, {
        name: 'Phoenix Corp',
        description: 'Rising from the ashes',
        domainsHired: ['SOFTWARE_ENGINEERING'],
      });

      expect(result.success).toBe(true);
      expect(result.balanceAfter).toBe(400);
      expect(mockCorpCoinService.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          amount: 100,
          type: 'COMPANY_CREATION',
        })
      );
    });

    it('successfully creates company, debits 100 CorpCoin, sets isOpenForHiring=false, and links founder', async () => {
      const founder = createMockFounderUser({ corpCoinBalance: 1000 });
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founder);
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({} as unknown as ICompanyDocument);

      const mockSavedCompany = createMockCompany({
        name: 'Nexus Dynamics',
        isOpenForHiring: false,
      });
      vi.spyOn(CompanyModel.prototype, 'save').mockResolvedValue(mockSavedCompany as unknown as ICompanyDocument);

      vi.spyOn(mockCorpCoinService, 'debit').mockResolvedValue({
        success: true,
        balanceAfter: 900,
        transaction: { _id: new Types.ObjectId(), type: 'COMPANY_CREATION', amount: 100 } as unknown as DebitCorpCoinResult['transaction'],
      });

      const result = await founderService.createCompany(mockUserId, {
        name: 'Nexus Dynamics',
        description: 'Next-gen enterprise software',
        domainsHired: ['SOFTWARE_ENGINEERING'],
      });

      expect(result.success).toBe(true);
      expect(result.company.isOpenForHiring).toBe(false);
      expect(result.balanceAfter).toBe(900);
      expect(mockCorpCoinService.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          amount: 100,
          type: 'COMPANY_CREATION',
        })
      );
      expect(FounderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockUserId },
        expect.objectContaining({
          $set: expect.objectContaining({ status: 'ACTIVE' }),
        }),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // 2. AI Bot Purchase Guards & Abstract Type Enforcement
  // =========================================================================
  describe('2. AI Bot Purchase Rules & Guards', () => {
    it('blocks bot purchase if founder has no active company with 400 Bad Request', async () => {
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null);

      await expect(founderService.buyBot(mockUserId, 'HIRING_BOT')).rejects.toThrow(
        /Founder does not own an active company. You must create a company before purchasing bots/
      );
    });

    it('blocks advanced bot purchase in v1 per Decision D13', async () => {
      await expect(
        founderService.buyBot(mockUserId, {
          botType: 'ADVANCED_HIRING_BOT' as unknown as 'HIRING_BOT',
          tier: 'ADVANCED',
        })
      ).rejects.toThrow(/Advanced bots are locked and cannot be purchased in v1 \(Decision D13\)/);
    });

    it('blocks bot purchase when CorpCoin balance is insufficient (< 250 CorpCoin)', async () => {
      const activeCompany = createMockCompany();
      const brokeFounder = createMockFounderUser({ corpCoinBalance: 200 });

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(activeCompany);
      vi.spyOn(CompanyBotModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(brokeFounder);

      await expect(founderService.buyBot(mockUserId, 'HIRING_BOT')).rejects.toThrow(
        /Insufficient CorpCoin balance. HIRING_BOT costs 250 CorpCoin, but current balance is 200/
      );
    });

    it('blocks duplicate purchase of the same bot type for the same company', async () => {
      const activeCompany = createMockCompany();
      const existingBot = createMockBot('HIRING_BOT');

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(activeCompany);
      vi.spyOn(CompanyBotModel, 'findOne').mockResolvedValue(existingBot);

      await expect(founderService.buyBot(mockUserId, 'HIRING_BOT')).rejects.toThrow(
        /Company already owns an active HIRING_BOT. Duplicate bot purchases are not permitted/
      );
    });

    it('normalizes alias input types (e.g. HIRING -> HIRING_BOT, TASK -> TASK_BOT, EVALUATION -> EVALUATION_BOT)', async () => {
      const activeCompany = createMockCompany();
      const founder = createMockFounderUser({ corpCoinBalance: 500 });

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(activeCompany);
      vi.spyOn(CompanyBotModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founder);
      vi.spyOn(CompanyBotModel.prototype, 'save').mockResolvedValue({} as unknown as ICompanyBotDocument);
      vi.spyOn(CompanyBotModel, 'find').mockResolvedValue([createMockBot('TASK_BOT')]);

      vi.spyOn(mockCorpCoinService, 'debit').mockResolvedValue({
        success: true,
        balanceAfter: 250,
        transaction: { _id: new Types.ObjectId(), type: 'BOT_PURCHASE', amount: 250 } as unknown as DebitCorpCoinResult['transaction'],
      });

      const result = await founderService.buyBot(mockUserId, 'TASK');

      expect(result.bot.botType).toBe('TASK_BOT');
      expect(mockCorpCoinService.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BOT_PURCHASE',
          amount: 250,
        })
      );
    });

    it('references an abstract bot type with NO underlying AI provider stored', async () => {
      const activeCompany = createMockCompany();
      const founder = createMockFounderUser({ corpCoinBalance: 500 });

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(activeCompany);
      vi.spyOn(CompanyBotModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(founder);
      vi.spyOn(CompanyBotModel.prototype, 'save').mockResolvedValue({} as unknown as ICompanyBotDocument);
      vi.spyOn(CompanyBotModel, 'find').mockResolvedValue([createMockBot('HIRING_BOT')]);

      vi.spyOn(mockCorpCoinService, 'debit').mockResolvedValue({
        success: true,
        balanceAfter: 250,
        transaction: { _id: new Types.ObjectId(), type: 'BOT_PURCHASE', amount: 250 } as unknown as DebitCorpCoinResult['transaction'],
      });

      const result = await founderService.buyBot(mockUserId, 'HIRING_BOT');

      expect(result.bot.botType).toBe('HIRING_BOT');
      const botObj = result.bot as unknown as Record<string, unknown>;
      expect(botObj.provider).toBeUndefined();
      expect(botObj.aiProvider).toBeUndefined();
      expect(botObj.apiKey).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Complete Economic Lifecycle: The 850 Total, 150 Remaining & OPEN FOR HIRING
  // =========================================================================
  describe('3. Economic Lifecycle: 850 Total Spend, 150 Remaining & OPEN FOR HIRING Transition', () => {
    it('executes full sequence: company (100) + 3 basic bots (250x3) = 850 spent, leaves 150 balance, and transitions to OPEN FOR HIRING', async () => {
      let currentBalance = 1000; // Initial starter capital
      let companyExists = false;
      const companyId = new Types.ObjectId();
      let companyDoc = createMockCompany({
        _id: companyId,
        name: 'Apex AI Labs',
        isOpenForHiring: false,
      });

      const ownedBots: ICompanyBotDocument[] = [];
      const ledgerTransactions: SimulatedLedgerTx[] = [];

      // Mock User
      vi.spyOn(UserModel, 'findById').mockImplementation(async () => {
        return createMockFounderUser({ corpCoinBalance: currentBalance });
      });

      // Mock Company Model with dynamic query resolution
      vi.spyOn(CompanyModel, 'findOne').mockImplementation(async (query: unknown) => {
        const q = query as { ownerId?: Types.ObjectId; name?: string } | undefined;
        if (q?.ownerId) {
          return companyExists ? companyDoc : null;
        }
        if (q?.name) {
          return null; // Name is available
        }
        return companyExists ? companyDoc : null;
      });

      vi.spyOn(CompanyModel, 'findByIdAndUpdate').mockImplementation(async (_id, update: unknown) => {
        const u = update as { $set?: { isOpenForHiring?: boolean } };
        if (u?.$set?.isOpenForHiring !== undefined) {
          companyDoc.isOpenForHiring = u.$set.isOpenForHiring;
        }
        return companyDoc;
      });

      vi.spyOn(CompanyModel.prototype, 'save').mockImplementation(async function () {
        companyDoc = this as unknown as ICompanyDocument;
        companyExists = true;
        return this;
      });

      vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({} as unknown as ICompanyDocument);

      // Mock CompanyBot Model
      vi.spyOn(CompanyBotModel, 'findOne').mockImplementation(async (query: unknown) => {
        const q = query as { botType?: string; isActive?: boolean } | undefined;
        return ownedBots.find((b) => b.botType === q?.botType && b.isActive) || null;
      });

      vi.spyOn(CompanyBotModel, 'find').mockImplementation(async () => {
        return ownedBots;
      });

      vi.spyOn(CompanyBotModel.prototype, 'save').mockImplementation(async function () {
        ownedBots.push(this as unknown as ICompanyBotDocument);
        return this;
      });

      // Mock CorpCoin debit with double-entry simulation
      vi.spyOn(mockCorpCoinService, 'debit').mockImplementation(async (params: DebitCorpCoinParams) => {
        currentBalance -= params.amount;
        const tx: SimulatedLedgerTx = {
          _id: new Types.ObjectId(),
          userId: params.userId,
          amount: params.amount,
          balanceAfter: currentBalance,
          type: params.type,
          referenceId: params.referenceId || new Types.ObjectId(),
          reason: params.reason,
          createdAt: new Date(),
        };
        ledgerTransactions.push(tx);
        return {
          success: true,
          balanceAfter: currentBalance,
          transaction: tx as unknown as DebitCorpCoinResult['transaction'],
        };
      });

      // -----------------------------------------------------------------------
      // Step 1: Create Company (-100 CorpCoin)
      // -----------------------------------------------------------------------
      const companyResult = await founderService.createCompany(mockUserId, {
        name: 'Apex AI Labs',
        description: 'Autonomous enterprise architectures',
        domainsHired: ['SOFTWARE_ENGINEERING'],
      });

      expect(companyResult.success).toBe(true);
      expect(companyResult.balanceAfter).toBe(900);
      expect(currentBalance).toBe(900);
      expect(companyDoc.isOpenForHiring).toBe(false);

      // -----------------------------------------------------------------------
      // Step 2: Buy Basic Hiring Bot (-250 CorpCoin)
      // -----------------------------------------------------------------------
      const hiringBotResult = await founderService.buyBot(mockUserId, 'HIRING_BOT');

      expect(hiringBotResult.success).toBe(true);
      expect(hiringBotResult.balanceAfter).toBe(650);
      expect(currentBalance).toBe(650);
      expect(hiringBotResult.isOpenForHiring).toBe(false);
      expect(companyDoc.isOpenForHiring).toBe(false);

      // -----------------------------------------------------------------------
      // Step 3: Buy Basic Task Bot (-250 CorpCoin)
      // -----------------------------------------------------------------------
      const taskBotResult = await founderService.buyBot(mockUserId, 'TASK_BOT');

      expect(taskBotResult.success).toBe(true);
      expect(taskBotResult.balanceAfter).toBe(400);
      expect(currentBalance).toBe(400);
      expect(taskBotResult.isOpenForHiring).toBe(false);
      expect(companyDoc.isOpenForHiring).toBe(false);

      // -----------------------------------------------------------------------
      // Step 4: Buy Basic Evaluation Bot (-250 CorpCoin) -> TRANSITION!
      // -----------------------------------------------------------------------
      const evalBotResult = await founderService.buyBot(mockUserId, 'EVALUATION_BOT');

      expect(evalBotResult.success).toBe(true);
      expect(evalBotResult.balanceAfter).toBe(150);
      expect(currentBalance).toBe(150);
      expect(evalBotResult.isOpenForHiring).toBe(true);
      expect(companyDoc.isOpenForHiring).toBe(true);

      // -----------------------------------------------------------------------
      // Verifications: Total Spend, Buffer Balance & Ledger Integrity
      // -----------------------------------------------------------------------
      const totalSpent = 1000 - currentBalance;
      expect(totalSpent).toBe(850); // 100 + 250 + 250 + 250 = 850
      expect(currentBalance).toBe(150); // Remaining buffer

      // Verify all 4 ledger transactions exist and are valid
      expect(ledgerTransactions).toHaveLength(4);

      // 1. Company Creation Ledger Entry
      expect(ledgerTransactions[0].type).toBe('COMPANY_CREATION');
      expect(ledgerTransactions[0].amount).toBe(100);
      expect(ledgerTransactions[0].balanceAfter).toBe(900);
      expect(ledgerTransactions[0].referenceId).toBeDefined();

      // 2. Hiring Bot Purchase Ledger Entry
      expect(ledgerTransactions[1].type).toBe('BOT_PURCHASE');
      expect(ledgerTransactions[1].amount).toBe(250);
      expect(ledgerTransactions[1].balanceAfter).toBe(650);
      expect(ledgerTransactions[1].referenceId.toString()).toBe(
        hiringBotResult.bot._id.toString()
      );

      // 3. Task Bot Purchase Ledger Entry
      expect(ledgerTransactions[2].type).toBe('BOT_PURCHASE');
      expect(ledgerTransactions[2].amount).toBe(250);
      expect(ledgerTransactions[2].balanceAfter).toBe(400);
      expect(ledgerTransactions[2].referenceId.toString()).toBe(taskBotResult.bot._id.toString());

      // 4. Evaluation Bot Purchase Ledger Entry
      expect(ledgerTransactions[3].type).toBe('BOT_PURCHASE');
      expect(ledgerTransactions[3].amount).toBe(250);
      expect(ledgerTransactions[3].balanceAfter).toBe(150);
      expect(ledgerTransactions[3].referenceId.toString()).toBe(evalBotResult.bot._id.toString());
    });
  });

  // =========================================================================
  // 4. Controller Endpoints Integration
  // =========================================================================
  describe('4. Controller Endpoints', () => {
    it('POST /api/founder/company responds with 201 on valid input', async () => {
      const mockCompany = createMockCompany();
      vi.spyOn(founderService, 'createCompany').mockResolvedValue({
        success: true,
        company: mockCompany,
        balanceAfter: 900,
      });

      const req = {
        user: { _id: mockUserId },
        body: {
          name: 'Quantum Systems',
          description: 'High throughput computing',
          domainsHired: ['SOFTWARE_ENGINEERING'],
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await controller.createCompany(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ balanceAfter: 900 }),
        })
      );
    });

    it('POST /api/founder/bots/purchase responds with 201 on valid bot purchase', async () => {
      const mockBot = createMockBot('HIRING_BOT');
      vi.spyOn(founderService, 'buyBot').mockResolvedValue({
        success: true,
        bot: mockBot,
        balanceAfter: 650,
        isOpenForHiring: false,
        totalBotsOwned: 1,
      });

      const req = {
        user: { _id: mockUserId },
        body: {
          botType: 'HIRING_BOT',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await controller.buyBot(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ balanceAfter: 650, isOpenForHiring: false }),
        })
      );
    });

    it('GET /api/founder/bots responds with 200 and bot catalog', async () => {
      vi.spyOn(founderService, 'getBots').mockResolvedValue({
        companyId: mockCompanyId.toString(),
        isOpenForHiring: false,
        bots: [createMockBot('HIRING_BOT')],
        catalog: [
          {
            botType: 'HIRING_BOT',
            tier: 'BASIC',
            name: 'Basic Hiring Bot',
            cost: 250,
            description: 'Screens applicants',
            owned: true,
            locked: false,
          },
        ],
      });

      const req = {
        user: { _id: mockUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await controller.getBots(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            companyId: mockCompanyId.toString(),
            isOpenForHiring: false,
          }),
        })
      );
    });

    it('GET /api/founder/company responds with 200 and company state', async () => {
      const mockCompany = createMockCompany({ isOpenForHiring: true });
      vi.spyOn(founderService, 'getFounderCompany').mockResolvedValue({
        company: mockCompany,
        bots: [createMockBot('HIRING_BOT'), createMockBot('TASK_BOT'), createMockBot('EVALUATION_BOT')],
        isOpenForHiring: true,
      });

      const req = {
        user: { _id: mockUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await controller.getCompany(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            isOpenForHiring: true,
            bots: expect.arrayContaining([expect.anything()]),
          }),
        })
      );
    });
  });
});
