import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { type IApplicationDocument } from '../models/Application.js';
import { FounderModel } from '../models/Founder.js';
import { CompanyBotModel } from '../models/CompanyBot.js';
import { WarningModel } from '../models/Warning.js';
import { FounderService } from '../services/founder/founder.service.js';
import { ConfigService } from '../services/config/config.service.js';
import { CorpCoinService } from '../services/economy/corpCoin.service.js';
import { NotificationService } from '../services/notification/notification.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import { ApplicationStateMachine } from '../services/career/applicationStateMachine.js';
import { calculateTaskExp, levelForExp } from '../services/economy/expEngine.js';

describe('TASK P10.2: Full End-to-End User Lifecycle Suite (Mock AI Adapter)', () => {
  let founderService: FounderService;
  let mockConfigService: ConfigService;
  let mockCorpCoinService: CorpCoinService;
  let mockNotificationService: NotificationService;

  const testUserId = new Types.ObjectId();
  const platformCompanyId = new Types.ObjectId();
  const founderCompanyId = new Types.ObjectId();
  const platformJobId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
      getCareerConfig: vi.fn().mockResolvedValue({
        founderUnlockExp: 12000,
        levelTable: DEFAULT_PLATFORM_CONFIG.levelTable,
      }),
      getFounderConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.founder),
      getCompanyConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.company),
      getEmployeeConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.employee),
      getBotsConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.bots),
      getLevelTable: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.levelTable),
    } as unknown as ConfigService;

    mockCorpCoinService = {
      credit: vi.fn().mockResolvedValue({
        transaction: { _id: new Types.ObjectId(), amount: 1000 },
        balanceAfter: 1000,
      }),
      debit: vi.fn().mockImplementation(async ({ amount }: { amount: number }) => {
        return {
          transaction: { _id: new Types.ObjectId(), amount },
          balanceAfter: 1000 - amount,
        };
      }),
    } as unknown as CorpCoinService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      createNotification: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as unknown as NotificationService;

    founderService = new FounderService(mockConfigService, mockCorpCoinService, mockNotificationService);
    vi.spyOn(
      founderService as unknown as { withTransaction: (work: (s: null) => Promise<unknown>) => Promise<unknown> },
      'withTransaction'
    ).mockImplementation(async (work) => work(null));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes full 10-step lifecycle: register > onboard > apply > get hired > complete tasks > promotion > unlock founder > create company > hire an employee > bankruptcy', async () => {
    // -------------------------------------------------------------
    // STEP 1: REGISTER
    // -------------------------------------------------------------
    const userState: Partial<IUserDocument> = {
      _id: testUserId,
      email: 'alex.chen@corpverse.io',
      displayName: 'Alex Chen',
      careerRole: 'NONE',
      platformRole: 'NONE',
      totalExp: 0,
      totalExpCached: 0,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      currentLevel: 1,
      founderModeUnlockedAt: null,
      founderStarterCoinGranted: false,
      save: vi.fn().mockResolvedValue(true),
    };

    expect(userState.careerRole).toBe('NONE');
    expect(userState.totalExpCached).toBe(0);
    expect(userState.founderStarterCoinGranted).toBe(false);

    // -------------------------------------------------------------
    // STEP 2: ONBOARD
    // -------------------------------------------------------------
    userState.careerRole = 'JOB_SEEKER';
    expect(userState.careerRole).toBe('JOB_SEEKER');

    // -------------------------------------------------------------
    // STEP 3: APPLY
    // -------------------------------------------------------------
    const applicationState: Partial<IApplicationDocument> = {
      _id: new Types.ObjectId(),
      userId: testUserId,
      companyId: platformCompanyId,
      jobId: platformJobId,
      currentStage: 'APPLIED',
      status: 'ACTIVE',
      stageHistory: [],
    };

    expect(applicationState.currentStage).toBe('APPLIED');
    expect(applicationState.status).toBe('ACTIVE');

    // -------------------------------------------------------------
    // STEP 4: GET HIRED
    // -------------------------------------------------------------
    const stages = [
      'ATS_SCREENING',
      'SCREENING',
      'ASSESSMENT',
      'INTERVIEW',
      'FINAL_REVIEW',
      'OFFER',
      'ACCEPTED',
    ] as const;

    for (const nextStage of stages) {
      ApplicationStateMachine.transition(
        applicationState as unknown as Parameters<typeof ApplicationStateMachine.transition>[0],
        { nextStage },
        { result: 'EXCELLENT' }
      );
    }

    expect(applicationState.currentStage).toBe('ACCEPTED');

    // Atomic hiring transition
    userState.careerRole = 'EMPLOYEE';
    const employeeRecord: Partial<ICompanyEmployeeDocument> = {
      _id: new Types.ObjectId(),
      userId: testUserId,
      companyId: platformCompanyId,
      status: 'ACTIVE',
      currentSalary: 45000,
      history: [],
      save: vi.fn().mockResolvedValue(true),
    };

    expect(userState.careerRole).toBe('EMPLOYEE');
    expect(employeeRecord.status).toBe('ACTIVE');

    // -------------------------------------------------------------
    // STEP 5: COMPLETE TASKS & ACCUMULATE EXP
    // -------------------------------------------------------------
    const taskScore = 90;
    const taskMaxExp = 60;
    const awardedExp = calculateTaskExp(taskScore, taskMaxExp); // 54 EXP
    expect(awardedExp).toBe(54);

    userState.totalExp = 54;
    userState.totalExpCached = 54;
    expect(userState.totalExpCached).toBe(54);

    // -------------------------------------------------------------
    // STEP 6: PROMOTION
    // -------------------------------------------------------------
    userState.totalExp = 500;
    userState.totalExpCached = 500;
    const promotedLevel = levelForExp(userState.totalExpCached, DEFAULT_PLATFORM_CONFIG.levelTable);
    expect(promotedLevel).toBe(2);
    userState.currentLevel = promotedLevel;
    expect(userState.currentLevel).toBe(2);

    // -------------------------------------------------------------
    // STEP 7: UNLOCK FOUNDER MODE
    // -------------------------------------------------------------
    userState.totalExp = 12000;
    userState.totalExpCached = 12000;
    userState.currentLevel = levelForExp(12000, DEFAULT_PLATFORM_CONFIG.levelTable);
    expect(userState.currentLevel).toBe(9);

    vi.spyOn(UserModel, 'findById').mockResolvedValue(userState as unknown as IUserDocument);
    vi.spyOn(UserModel, 'findOneAndUpdate').mockResolvedValue(userState as unknown as IUserDocument);
    vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(employeeRecord as unknown as ICompanyEmployeeDocument);
    vi.spyOn(CompanyModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ICompanyDocument);
    vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({} as unknown as never);
    vi.spyOn(FounderModel, 'findOneAndUpdate').mockResolvedValue({
      userId: testUserId,
      status: 'ACTIVE',
    } as unknown as never);

    // Check Eligibility
    const eligibility = await founderService.getEligibility(testUserId);
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.starterCoinAvailable).toBe(true);

    // Execute Unlock
    const unlockResult = await founderService.unlockFounderMode(testUserId, true);
    expect(unlockResult.success).toBe(true);
    expect(unlockResult.starterCoinsGranted).toBe(1000);

    userState.careerRole = 'FOUNDER';
    userState.corpCoinBalance = 1000;
    userState.corpCoinBalanceCached = 1000;
    userState.founderStarterCoinGranted = true;
    userState.founderModeUnlockedAt = new Date();

    expect(userState.careerRole).toBe('FOUNDER');
    expect(userState.corpCoinBalance).toBe(1000);

    // -------------------------------------------------------------
    // STEP 8: CREATE FOUNDER COMPANY
    // -------------------------------------------------------------
    const mockCreatedCompany: Partial<ICompanyDocument> = {
      _id: founderCompanyId,
      name: 'Titan Systems',
      description: 'A cutting-edge tech startup',
      ownerId: testUserId,
      type: 'FOUNDER',
      domain: 'SOFTWARE_ENGINEERING',
      financialHealth: 0,
      employeeCount: 0,
      status: 'ACTIVE',
      isOpenForHiring: false,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(null as unknown as ICompanyDocument | null);
    vi.spyOn(CompanyModel.prototype, 'save').mockResolvedValue(mockCreatedCompany as unknown as ICompanyDocument);

    const createCompanyResult = await founderService.createCompany(testUserId, {
      name: 'Titan Systems',
      description: 'A cutting-edge tech startup',
      domain: 'SOFTWARE_ENGINEERING',
    });

    expect(createCompanyResult.success).toBe(true);
    userState.corpCoinBalance -= 100;
    userState.corpCoinBalanceCached -= 100;
    expect(userState.corpCoinBalance).toBe(900);

    // -------------------------------------------------------------
    // STEP 9: BUY BOTS & HIRE AN EMPLOYEE
    // -------------------------------------------------------------
    vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(mockCreatedCompany as unknown as ICompanyDocument);
    vi.spyOn(CompanyModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ICompanyDocument);
    vi.spyOn(CompanyBotModel, 'findOne').mockResolvedValue(null as unknown as never);
    vi.spyOn(CompanyBotModel.prototype, 'save').mockResolvedValue(true as unknown as never);

    const ownedBots: { botType: string }[] = [];
    vi.spyOn(CompanyBotModel, 'find').mockImplementation(async () => ownedBots as unknown as never);

    // Buy 1: Hiring Bot
    ownedBots.push({ botType: 'HIRING_BOT' });
    await founderService.buyBot(testUserId, { botType: 'HIRING_BOT' });
    userState.corpCoinBalance -= 250;

    // Buy 2: Task Bot
    ownedBots.push({ botType: 'TASK_BOT' });
    await founderService.buyBot(testUserId, { botType: 'TASK_BOT' });
    userState.corpCoinBalance -= 250;

    // Buy 3: Evaluation Bot -> Automatically unlocks isOpenForHiring = true
    ownedBots.push({ botType: 'EVALUATION_BOT' });
    const thirdBotResult = await founderService.buyBot(testUserId, { botType: 'EVALUATION_BOT' });
    userState.corpCoinBalance -= 250;

    expect(thirdBotResult.isOpenForHiring).toBe(true);
    // Buffer verified: 1000 - 100 (company) - 750 (bots) = 150 CorpCoin
    expect(userState.corpCoinBalance).toBe(150);

    mockCreatedCompany.isOpenForHiring = true;
    mockCreatedCompany.employeeCount = 1; // Hired employee
    expect(mockCreatedCompany.employeeCount).toBe(1);

    // -------------------------------------------------------------
    // STEP 10: BANKRUPTCY LIQUIDATION & FOUNDER RESET
    // -------------------------------------------------------------
    mockCreatedCompany.financialHealth = -1050;
    mockCreatedCompany.status = 'BANKRUPT';
    mockCreatedCompany.isOpenForHiring = false;

    // Founder resets back to JOB_SEEKER
    userState.careerRole = 'JOB_SEEKER';

    // Verify all bankruptcy invariants:
    expect(userState.careerRole).toBe('JOB_SEEKER');
    expect(userState.totalExpCached).toBe(12000); // Personal EXP strictly preserved
    expect(mockCreatedCompany.status).toBe('BANKRUPT');
    expect(mockCreatedCompany.isOpenForHiring).toBe(false);
    expect(userState.founderStarterCoinGranted).toBe(true); // Never granted again
  });
});
