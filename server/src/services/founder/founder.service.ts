import mongoose, { Types } from 'mongoose';
import { UserModel } from '../../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../../models/Company.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../../models/CompanyEmployee.js';
import { WarningModel } from '../../models/Warning.js';
import { FounderModel, type IFounderDocument } from '../../models/Founder.js';
import { CompanyBotModel, type ICompanyBotDocument } from '../../models/CompanyBot.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../../models/CompanyJob.js';
import { ApplicationModel, type IApplicationDocument } from '../../models/Application.js';
import { EvaluationModel, type IEvaluationDocument } from '../../models/Evaluation.js';
import { FeedbackModel, type IFeedbackDocument } from '../../models/Feedback.js';
import { CorpCoinTransactionModel, type ICorpCoinTransactionDocument } from '../../models/CorpCoinTransaction.js';
import { ConfigService, configService as defaultConfigService } from '../config/config.service.js';
import { CorpCoinService } from '../economy/corpCoin.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import {
  type CareerDomain,
  type CompanyBotType,
} from '../../types/enums.js';
import type {
  CreateFounderCompanyInput,
  PurchaseBotInput,
  CreateFounderJobInput,
  ListFounderApplicationsQuery,
} from '../../schemas/founder.schema.js';

export interface FounderEligibilityResult {
  eligible: boolean;
  currentExp: number;
  requiredExp: number;
  expDeficit: number;
  careerRole: string;
  isCurrentFounder: boolean;
  starterCoinAmount: number;
  starterCoinAvailable: boolean;
  hasUnlockedBefore: boolean;
  reason?: string;
}

export interface CreateCompanyResult {
  success: boolean;
  company: ICompanyDocument;
  balanceAfter: number;
}

export interface BuyBotResult {
  success: boolean;
  bot: ICompanyBotDocument;
  balanceAfter: number;
  isOpenForHiring: boolean;
  totalBotsOwned: number;
}

export interface BotCatalogItem {
  botType: CompanyBotType;
  tier: 'BASIC' | 'ADVANCED';
  name: string;
  cost: number;
  description: string;
  owned: boolean;
  locked: boolean;
}

export interface FounderBotsResult {
  companyId: string;
  isOpenForHiring: boolean;
  bots: ICompanyBotDocument[];
  catalog: BotCatalogItem[];
}

export interface FounderCompanyDetailsResult {
  company: ICompanyDocument | null;
  bots: ICompanyBotDocument[];
  isOpenForHiring: boolean;
}

export interface FounderEmployeesResult {
  companyId: string;
  employees: ICompanyEmployeeDocument[];
  currentCount: number;
  maxEmployees: number;
  remainingCapacity: number;
}

export interface FounderApplicationDetailsResult {
  application: IApplicationDocument;
  evaluations: IEvaluationDocument[];
  feedbacks: IFeedbackDocument[];
}

export interface FounderUnlockResult {
  success: boolean;
  user: {
    id: string;
    careerRole: string;
    totalExp: number;
    corpCoinBalance: number;
    founderModeUnlockedAt: Date;
    founderStarterCoinGranted: boolean;
  };
  priorEmploymentTerminated: boolean;
  terminatedCompanyId?: string;
  starterCoinsGranted: number;
  founderRecord: IFounderDocument;
}

export class FounderService {
  constructor(
    private readonly configService: ConfigService = defaultConfigService,
    private readonly corpCoinService: CorpCoinService = new CorpCoinService(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  /**
   * Helper to execute operations in a MongoDB transaction when available,
   * with graceful fallback for standalone MongoDB instances in test environments.
   */
  private async withTransaction<T>(
    work: (session?: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    if (mongoose.connection.readyState !== 1) {
      return await work();
    }

    let session: mongoose.ClientSession | null = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch {
      if (session) {
        session.endSession();
        session = null;
      }
    }

    if (session && useTransaction) {
      try {
        const result = await work(session);
        await session.commitTransaction();
        return result;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          errMsg.includes('replica set member') ||
          errMsg.includes('Transaction numbers are only allowed')
        ) {
          logger.warn(
            '[FounderService] Standalone MongoDB detected, executing without transaction'
          );
          return await work();
        }
        try {
          await session.abortTransaction();
        } catch {
          // ignore abort error if transaction was never started on server
        }
        throw err;
      } finally {
        session.endSession();
      }
    } else {
      return await work();
    }
  }

  /**
   * Checks whether the user meets the requirements to unlock Founder Mode.
   * Requirements per Spec Sections 3.1, 5, 12:
   * - totalExp >= PlatformConfig.career.founderUnlockExp (12,000)
   * - careerRole is EMPLOYEE (first-time unlock) or returning ex-founder (e.g. post-bankruptcy JOB_SEEKER).
   */
  public async getEligibility(userId: string | Types.ObjectId): Promise<FounderEligibilityResult> {
    const userObjectId = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);
    const user = await UserModel.findById(userObjectId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const careerConfig = await this.configService.getCareerConfig();
    const founderConfig = await this.configService.getFounderConfig();
    const founderUnlockExp = careerConfig.founderUnlockExp;
    const starterCorpCoin = founderConfig.starterCorpCoin;

    const currentExp = user.totalExp;
    const isCurrentFounder = user.careerRole === 'FOUNDER';
    const hasEnoughExp = currentExp >= founderUnlockExp;
    const expDeficit = Math.max(0, founderUnlockExp - currentExp);
    const hasUnlockedBefore = Boolean(user.founderModeUnlockedAt);
    const starterCoinAvailable = !user.founderStarterCoinGranted;

    // Role eligibility: EMPLOYEE for initial unlock, or returning ex-founder if post-bankruptcy
    const isRoleEligible =
      user.careerRole === 'EMPLOYEE' ||
      (user.careerRole === 'JOB_SEEKER' && hasUnlockedBefore);

    let reason: string | undefined;
    if (isCurrentFounder) {
      reason = 'User is currently in Founder Mode.';
    } else if (!hasEnoughExp) {
      reason = `Accumulate at least ${founderUnlockExp} total EXP to unlock Founder Mode (deficit: ${expDeficit} EXP).`;
    } else if (!isRoleEligible) {
      reason = `Current role (${user.careerRole}) is not eligible to unlock Founder Mode. Must be an active Employee.`;
    }

    const eligible = !isCurrentFounder && hasEnoughExp && isRoleEligible;

    return {
      eligible,
      currentExp,
      requiredExp: founderUnlockExp,
      expDeficit,
      careerRole: user.careerRole,
      isCurrentFounder,
      starterCoinAmount: starterCorpCoin,
      starterCoinAvailable,
      hasUnlockedBefore,
      reason,
    };
  }

  /**
   * Authoritatively unlocks Founder Mode for a user in an atomic transaction:
   * 1. Validates eligibility and explicit user confirmation.
   * 2. Enforces concurrency protection against race conditions / double-clicks.
   * 3. Terminates prior employment (updates CompanyEmployee, decrements employeeCount, resolves active warnings).
   * 4. Updates user careerRole = 'FOUNDER', records founderModeUnlockedAt.
   * 5. Grants starter capital (1,000 CorpCoin) once ever (tracked by founderStarterCoinGranted).
   * 6. Creates or upserts record in founders collection (Spec Collection 23).
   * 7. Dispatches in-app notification.
   */
  public async unlockFounderMode(
    userId: string | Types.ObjectId,
    confirm: boolean
  ): Promise<FounderUnlockResult> {
    if (confirm !== true) {
      throw AppError.validation('Explicit confirmation (confirm: true) is required to unlock Founder Mode');
    }

    const userObjectId = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);

    const careerConfig = await this.configService.getCareerConfig();
    const founderConfig = await this.configService.getFounderConfig();
    const founderUnlockExp = careerConfig.founderUnlockExp;
    const starterCorpCoin = founderConfig.starterCorpCoin;

    return await this.withTransaction(async (session) => {
      // 1. Fetch user to check state
      const user = await UserModel.findById(userObjectId, null, {
        session: session ?? undefined,
      });
      if (!user) {
        throw AppError.notFound('User not found');
      }

      if (user.careerRole === 'FOUNDER') {
        throw AppError.conflict('User is already in Founder Mode');
      }

      const currentExp = user.totalExp;
      if (currentExp < founderUnlockExp) {
        throw AppError.businessRuleViolation(
          `Founder Mode requires at least ${founderUnlockExp} total EXP. Current EXP: ${currentExp}`
        );
      }

      const hasUnlockedBefore = Boolean(user.founderModeUnlockedAt);
      const isRoleEligible =
        user.careerRole === 'EMPLOYEE' ||
        (user.careerRole === 'JOB_SEEKER' && hasUnlockedBefore);

      if (!isRoleEligible) {
        throw AppError.businessRuleViolation(
          `User in role '${user.careerRole}' cannot unlock Founder Mode. Must be an active EMPLOYEE or returning ex-founder.`
        );
      }

      // 2. Concurrency guard: Atomically update careerRole to FOUNDER to prevent double-click race conditions
      const shouldGrantCoins = !user.founderStarterCoinGranted;
      const unlockedAt = user.founderModeUnlockedAt || new Date();

      const updatedUser = await UserModel.findOneAndUpdate(
        {
          _id: userObjectId,
          careerRole: { $ne: 'FOUNDER' },
          $or: [
            { totalExp: { $gte: founderUnlockExp } },
            { totalExpCached: { $gte: founderUnlockExp } },
          ],
        },
        {
          $set: {
            careerRole: 'FOUNDER',
            founderModeUnlockedAt: unlockedAt,
            ...(shouldGrantCoins ? { founderStarterCoinGranted: true } : {}),
          },
        },
        { new: true, session: session ?? undefined }
      );

      if (!updatedUser) {
        throw AppError.conflict('Concurrent founder mode unlock detected. User is already a Founder.');
      }

      // 3. Terminate prior employment per Spec Section 3.1 & 12.1
      let priorEmploymentTerminated = false;
      let terminatedCompanyId: string | undefined;

      const activeEmployee = await CompanyEmployeeModel.findOne(
        {
          userId: userObjectId,
          status: 'ACTIVE',
        },
        null,
        { session: session ?? undefined }
      );

      if (activeEmployee) {
        priorEmploymentTerminated = true;
        terminatedCompanyId = activeEmployee.companyId.toString();

        activeEmployee.status = 'TERMINATED';
        activeEmployee.endedAt = new Date();
        activeEmployee.history.push({
          status: 'TERMINATED',
          level: activeEmployee.level,
          positionTitle: activeEmployee.positionTitle,
          reason: 'Voluntarily transitioned to Founder Mode',
          changedAt: new Date(),
        });
        await activeEmployee.save({ session: session ?? undefined });

        // Decrement company employee count
        await CompanyModel.findByIdAndUpdate(
          activeEmployee.companyId,
          { $inc: { employeeCount: -1 } },
          { session: session ?? undefined }
        );

        // Resolve active disciplinary warnings at the prior company
        await WarningModel.updateMany(
          {
            userId: userObjectId,
            companyId: activeEmployee.companyId,
            status: 'ACTIVE',
          },
          {
            status: 'RESOLVED',
            reason: 'Resolved upon transitioning to Founder Mode.',
          },
          { session: session ?? undefined }
        );

        logger.info(
          `[FounderService] Terminated prior employment for user ${userObjectId} at company ${activeEmployee.companyId}`
        );
      }

      // 4. Grant Starter CorpCoin (Strictly ONE-TIME across entire account lifetime)
      let starterCoinsGranted = 0;
      if (shouldGrantCoins) {
        starterCoinsGranted = starterCorpCoin;
        await this.corpCoinService.credit({
          userId: userObjectId,
          amount: starterCorpCoin,
          type: 'FOUNDER_STARTER_GRANT',
          reason: 'Founder Mode unlock starter capital grant',
          session: session ?? undefined,
        });
        logger.info(
          `[FounderService] Granted ${starterCorpCoin} starter CorpCoin to user ${userObjectId}`
        );
      } else {
        logger.info(
          `[FounderService] Starter CorpCoin already previously granted for user ${userObjectId}; skipping grant.`
        );
      }

      // 5. Create or Upsert Founder record in founders collection (Spec Collection 23)
      const founderRecord = await FounderModel.findOneAndUpdate(
        { userId: userObjectId },
        {
          $setOnInsert: { unlockedAt },
          $set: { status: 'ACTIVE' },
        },
        { upsert: true, new: true, session: session ?? undefined }
      );

      // 6. Dispatch In-App Notification
      try {
        await this.notificationService.create({
          userId: userObjectId,
          type: 'FOUNDER_UNLOCKED',
          title: 'Founder Mode Unlocked!',
          message: shouldGrantCoins
            ? `Congratulations! You unlocked Founder Mode and received ${starterCorpCoin} CorpCoin in starter capital.`
            : 'Welcome back to Founder Mode!',
          link: '/founder/dashboard',
        });
      } catch (notifErr) {
        logger.error('[FounderService] Failed to send founder unlocked notification', {
          error: notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
      }

      // 7. Refresh user document to retrieve up-to-date balances
      const finalUser = await UserModel.findById(userObjectId, null, {
        session: session ?? undefined,
      });

      return {
        success: true,
        user: {
          id: userObjectId.toString(),
          careerRole: 'FOUNDER',
          totalExp: finalUser?.totalExp ?? updatedUser.totalExp,
          corpCoinBalance: finalUser?.corpCoinBalance ?? updatedUser.corpCoinBalance,
          founderModeUnlockedAt: unlockedAt,
          founderStarterCoinGranted: true,
        },
        priorEmploymentTerminated,
        terminatedCompanyId,
        starterCoinsGranted,
        founderRecord,
      };
    });
  }

  /**
   * Creates a new company for the founder (Spec Sections 12, 26 Collection 7).
   *
   * Rules:
   * - Requires careerRole = 'FOUNDER'.
   * - Operating limits enforce max 1 active company per founder in v1.
   * - Cost is read dynamically from PlatformConfig (default: 100 CorpCoin).
   * - Company name must be unique.
   * - Debits founder's CorpCoin balance with ledger transaction (type: 'COMPANY_CREATION').
   * - Newly created company starts with isOpenForHiring = false until 3 basic bots are bought.
   * - Links founder record to the newly created company.
   */
  async createCompany(
    userId: string | Types.ObjectId,
    input: CreateFounderCompanyInput
  ): Promise<CreateCompanyResult> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const trimmedName = input.name.trim();

    // 1. Verify user exists and holds FOUNDER role
    const user = await UserModel.findById(userObjectId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    if (user.careerRole !== 'FOUNDER') {
      throw AppError.forbidden('Only users in FOUNDER careerRole can create a company');
    }

    // 2. Enforce 1 active company per founder limit (Spec §12.3)
    const existingActiveCompany = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (existingActiveCompany) {
      throw AppError.badRequest(
        'Founder already owns an active company. Operating limits enforce exactly 1 active company per founder in v1.'
      );
    }

    // 3. Verify company name uniqueness
    const nameCollision = await CompanyModel.findOne({ name: trimmedName });
    if (nameCollision) {
      throw AppError.conflict(`Company name "${trimmedName}" is already registered`);
    }

    // 4. Retrieve company creation cost and capacity limits from PlatformConfig
    const config = await this.configService.getConfig();
    const creationCost = config.founder.companyCreationCost;
    const maxEmployees = config.company.maxEmployees || 20;

    // 5. Verify sufficient CorpCoin funds
    if (user.corpCoinBalance < creationCost) {
      throw AppError.badRequest(
        `Insufficient CorpCoin balance. Company creation requires ${creationCost} CorpCoin, but current balance is ${user.corpCoinBalance}.`
      );
    }

    // 6. Execute atomic creation and debit inside transaction
    return await this.withTransaction(async (session) => {
      const newCompanyId = new Types.ObjectId();

      // 6a. Double-entry CorpCoin debit with ledger entry
      const debitResult = await this.corpCoinService.debit({
        userId: userObjectId,
        amount: creationCost,
        type: 'COMPANY_CREATION',
        reason: `Company creation fee for "${trimmedName}"`,
        referenceId: newCompanyId,
        session: session ?? undefined,
      });

      // 6b. Instantiate and persist Company document
      const domainsToHire: CareerDomain[] =
        input.domainsHired && input.domainsHired.length > 0
          ? (input.domainsHired as CareerDomain[])
          : ['SOFTWARE_ENGINEERING'];

      const company = new CompanyModel({
        _id: newCompanyId,
        name: trimmedName,
        description: input.description.trim(),
        type: 'FOUNDER',
        isPlatformCompany: false,
        ownerId: userObjectId,
        domainsHired: domainsToHire,
        status: 'ACTIVE',
        ratings: { overall: 50, culture: 50, workLife: 50, technicalExcellence: 50 },
        companyRating: 50,
        financialHealth: 0,
        employeeCount: 0,
        maxEmployees,
        isOpenForHiring: false, // Becomes open only when all 3 basic bots exist
        aiProviderPool: 'PIPELINE',
      });

      await company.save({ session: session ?? undefined });

      // 6c. Link company to Founder model
      await FounderModel.findOneAndUpdate(
        { userId: userObjectId },
        { $set: { companyId: newCompanyId, status: 'ACTIVE' } },
        { session: session ?? undefined }
      );

      logger.info(
        `[FounderService] Created company "${trimmedName}" (${newCompanyId}) for founder ${userObjectId}. Debited ${creationCost} CorpCoin.`
      );

      return {
        success: true,
        company,
        balanceAfter: debitResult.balanceAfter,
      };
    });
  }

  /**
   * Purchases an AI Bot for the founder's active company (Spec Sections 13, 26 Collection 9).
   *
   * Rules:
   * - Abstract bot type only ('HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT'), never a provider.
   * - Advanced bots are configuration-only and cannot be purchased in v1 (D13).
   * - Duplicate bot purchases for the same company are blocked.
   * - Deducts CorpCoin from founder balance via CorpCoinService.debit with type 'BOT_PURCHASE'.
   * - A company transitions to isOpenForHiring = true ONLY when all three basic bots exist!
   */
  async buyBot(
    userId: string | Types.ObjectId,
    input: PurchaseBotInput | string
  ): Promise<BuyBotResult> {
    const userObjectId = new Types.ObjectId(userId.toString());

    // 1. Normalize and validate requested bot type
    const rawType = typeof input === 'string' ? input : input.botType;
    const requestedTier = typeof input === 'object' && input.tier ? input.tier : 'BASIC';

    if (requestedTier === 'ADVANCED' || rawType.startsWith('ADVANCED')) {
      throw AppError.badRequest(
        'Advanced bots are locked and cannot be purchased in v1 (Decision D13).'
      );
    }

    let botType: CompanyBotType;
    if (rawType === 'HIRING' || rawType === 'HIRING_BOT') {
      botType = 'HIRING_BOT';
    } else if (rawType === 'TASK' || rawType === 'TASK_BOT') {
      botType = 'TASK_BOT';
    } else if (rawType === 'EVALUATION' || rawType === 'EVALUATION_BOT') {
      botType = 'EVALUATION_BOT';
    } else {
      throw AppError.badRequest(
        `Invalid bot type: "${rawType}". Permitted types: HIRING_BOT, TASK_BOT, EVALUATION_BOT.`
      );
    }

    // 2. Fetch founder's active company
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest(
        'Founder does not own an active company. You must create a company before purchasing bots.'
      );
    }

    // 3. Verify bot is not already owned (unique compound index { companyId, botType })
    const existingBot = await CompanyBotModel.findOne({
      companyId: company._id,
      botType,
      isActive: true,
    });
    if (existingBot) {
      throw AppError.badRequest(
        `Company already owns an active ${botType}. Duplicate bot purchases are not permitted.`
      );
    }

    // 4. Retrieve pricing from PlatformConfig
    const config = await this.configService.getConfig();
    let cost = 250;
    if (botType === 'HIRING_BOT') {
      cost = config.bots.hiring;
    } else if (botType === 'TASK_BOT') {
      cost = config.bots.task;
    } else if (botType === 'EVALUATION_BOT') {
      cost = config.bots.evaluation;
    }

    // 5. Verify user has sufficient CorpCoin funds
    const user = await UserModel.findById(userObjectId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    if (user.corpCoinBalance < cost) {
      throw AppError.badRequest(
        `Insufficient CorpCoin balance. ${botType} costs ${cost} CorpCoin, but current balance is ${user.corpCoinBalance}.`
      );
    }

    // 6. Execute atomic purchase in transaction
    return await this.withTransaction(async (session) => {
      const botId = new Types.ObjectId();

      // 6a. Double-entry CorpCoin debit
      const debitResult = await this.corpCoinService.debit({
        userId: userObjectId,
        amount: cost,
        type: 'BOT_PURCHASE',
        reason: `Purchased ${botType} for company "${company.name}"`,
        referenceId: botId,
        session: session ?? undefined,
      });

      // 6b. Persist CompanyBot document (Collection 9)
      const bot = new CompanyBotModel({
        _id: botId,
        companyId: company._id,
        botType,
        tier: 'BASIC',
        purchaseCost: cost,
        isActive: true,
        purchasedAt: new Date(),
      });
      await bot.save({ session: session ?? undefined });

      // 6c. Check if all 3 basic bots exist -> Transition to OPEN FOR HIRING
      const activeBots = await CompanyBotModel.find(
        { companyId: company._id, isActive: true },
        null,
        { session: session ?? undefined }
      );
      const ownedTypes = new Set(activeBots.map((b) => b.botType));
      const hasAllThree =
        ownedTypes.has('HIRING_BOT') &&
        ownedTypes.has('TASK_BOT') &&
        ownedTypes.has('EVALUATION_BOT');

      let isOpenForHiring = Boolean(company.isOpenForHiring);
      if (hasAllThree && !company.isOpenForHiring) {
        await CompanyModel.findByIdAndUpdate(
          company._id,
          { $set: { isOpenForHiring: true } },
          { session: session ?? undefined }
        );
        isOpenForHiring = true;
        logger.info(
          `[FounderService] Company ${company._id} (${company.name}) now has all 3 basic bots. Marked OPEN FOR HIRING!`
        );
      }

      logger.info(
        `[FounderService] User ${userObjectId} purchased ${botType} (${botId}) for company ${company._id}. Balance after: ${debitResult.balanceAfter}`
      );

      return {
        success: true,
        bot,
        balanceAfter: debitResult.balanceAfter,
        isOpenForHiring,
        totalBotsOwned: activeBots.length,
      };
    });
  }

  /**
   * Retrieves all purchased bots for the founder's active company, along with the storefront catalog.
   */
  async getBots(userId: string | Types.ObjectId): Promise<FounderBotsResult> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    const bots = await CompanyBotModel.find({
      companyId: company._id,
      isActive: true,
    });
    const ownedTypes = new Set(bots.map((b) => b.botType));
    const config = await this.configService.getConfig();

    const catalog: BotCatalogItem[] = [
      {
        botType: 'HIRING_BOT',
        tier: 'BASIC',
        name: 'Basic Hiring Bot',
        cost: config.bots.hiring,
        description: 'Screens applicants, conducts technical interviews, and issues offers.',
        owned: ownedTypes.has('HIRING_BOT'),
        locked: false,
      },
      {
        botType: 'TASK_BOT',
        tier: 'BASIC',
        name: 'Basic Task Bot',
        cost: config.bots.task,
        description: 'Generates daily engineering tasks for active company employees.',
        owned: ownedTypes.has('TASK_BOT'),
        locked: false,
      },
      {
        botType: 'EVALUATION_BOT',
        tier: 'BASIC',
        name: 'Basic Evaluation Bot',
        cost: config.bots.evaluation,
        description: 'Evaluates employee task submissions against objective rubrics.',
        owned: ownedTypes.has('EVALUATION_BOT'),
        locked: false,
      },
      {
        botType: 'HIRING_BOT',
        tier: 'ADVANCED',
        name: 'Advanced Hiring Bot',
        cost: config.bots.advancedHiring,
        description: 'Multi-agent hiring committee with in-depth domain challenges.',
        owned: false,
        locked: true,
      },
      {
        botType: 'TASK_BOT',
        tier: 'ADVANCED',
        name: 'Advanced Task Bot',
        cost: config.bots.advancedTask,
        description: 'Dynamic real-world microservice architecture and incident scenarios.',
        owned: false,
        locked: true,
      },
      {
        botType: 'EVALUATION_BOT',
        tier: 'ADVANCED',
        name: 'Advanced Evaluation Bot',
        cost: config.bots.advancedEvaluation,
        description: 'Automated test suite execution and AST-level code critique.',
        owned: false,
        locked: true,
      },
    ];

    return {
      companyId: company._id.toString(),
      isOpenForHiring: Boolean(company.isOpenForHiring),
      bots,
      catalog,
    };
  }

  /**
   * Retrieves the founder's active company details, bot roster, and hiring state.
   */
  async getFounderCompany(
    userId: string | Types.ObjectId
  ): Promise<FounderCompanyDetailsResult> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      return {
        company: null,
        bots: [],
        isOpenForHiring: false,
      };
    }

    const bots = await CompanyBotModel.find({
      companyId: company._id,
      isActive: true,
    });

    return {
      company,
      bots,
      isOpenForHiring: Boolean(company.isOpenForHiring),
    };
  }

  /**
   * Creates a new job opening for the founder's active company.
   *
   * Rules:
   * - Company must be active and OPEN FOR HIRING (all 3 basic bots acquired).
   * - Domain must be in company's domainsHired.
   * - Company must have available employee capacity (< maxEmployees).
   */
  async createJob(
    userId: string | Types.ObjectId,
    input: CreateFounderJobInput
  ): Promise<ICompanyJobDocument> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    if (!company.isOpenForHiring) {
      throw AppError.badRequest(
        'Company must acquire all three basic bots (Hiring, Task, Evaluation) and be open for hiring before posting job openings.'
      );
    }

    if (!company.domainsHired.includes(input.domain as CareerDomain)) {
      throw AppError.badRequest(
        `Domain "${input.domain}" is not in company's hired domains (${company.domainsHired.join(', ')}).`
      );
    }

    const config = await this.configService.getConfig();
    const maxCapacity = company.maxEmployees || config.company.maxEmployees || 20;
    if (company.employeeCount >= maxCapacity) {
      throw AppError.badRequest(
        `Company has reached maximum employee capacity (${maxCapacity}) and cannot post new job openings.`
      );
    }

    const job = new CompanyJobModel({
      companyId: company._id,
      title: input.title.trim(),
      description: input.description.trim(),
      domain: input.domain,
      minLevel: input.minLevel,
      maxLevel: input.maxLevel,
      targetLevel: input.targetLevel || input.minLevel,
      requiredSkills: input.requiredSkills,
      openings: input.openings,
      status: 'OPEN',
      isOpen: true,
    });

    await job.save();

    logger.info(
      `[FounderService] Founder ${userObjectId} created job "${job.title}" (${job._id}) for company ${company._id}`
    );

    return job;
  }

  /**
   * Closes an active job opening.
   *
   * Security Invariant: Founder cannot modify job requisitions belonging to another company.
   */
  async closeJob(
    userId: string | Types.ObjectId,
    jobId: string | Types.ObjectId
  ): Promise<ICompanyJobDocument> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const jobObjectId = new Types.ObjectId(jobId.toString());

    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    const job = await CompanyJobModel.findById(jobObjectId);
    if (!job) {
      throw AppError.notFound('Job requisition not found.');
    }

    if (!job.companyId.equals(company._id)) {
      throw AppError.forbidden(
        'Founder cannot modify job requisitions belonging to another company.'
      );
    }

    job.status = 'CLOSED';
    job.isOpen = false;
    await job.save();

    logger.info(
      `[FounderService] Founder ${userObjectId} closed job "${job.title}" (${job._id})`
    );

    return job;
  }

  /**
   * Retrieves all job requisitions belonging to the founder's active company.
   */
  async getJobs(userId: string | Types.ObjectId): Promise<ICompanyJobDocument[]> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    return await CompanyJobModel.find({ companyId: company._id }).sort({ createdAt: -1 });
  }

  /**
   * Retrieves active company employee roster with capacity bounds.
   */
  async getEmployees(userId: string | Types.ObjectId): Promise<FounderEmployeesResult> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    const employees = await CompanyEmployeeModel.find({
      companyId: company._id,
      status: { $in: ['ACTIVE', 'UNDER_REVIEW'] },
    }).sort({ joinedAt: -1 });

    const config = await this.configService.getConfig();
    const maxEmployees = company.maxEmployees || config.company.maxEmployees || 20;
    const currentCount = employees.length;

    return {
      companyId: company._id.toString(),
      employees,
      currentCount,
      maxEmployees,
      remainingCapacity: Math.max(0, maxEmployees - currentCount),
    };
  }

  /**
   * Retrieves applications submitted to the founder's active company.
   *
   * Security Invariant: Founder cannot read applicant data belonging to another company.
   */
  async getApplications(
    userId: string | Types.ObjectId,
    filters?: ListFounderApplicationsQuery
  ): Promise<IApplicationDocument[]> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    const query: Record<string, unknown> = { companyId: company._id };

    if (filters?.jobId) {
      const jobObjectId = new Types.ObjectId(filters.jobId);
      const job = await CompanyJobModel.findById(jobObjectId);
      if (!job || !job.companyId.equals(company._id)) {
        throw AppError.forbidden(
          'Founder cannot access applicant data belonging to another company.'
        );
      }
      query.jobId = jobObjectId;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.stage) {
      query.currentStage = filters.stage;
    }

    return await ApplicationModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Retrieves single application details, stage progression, and evaluation outcomes.
   *
   * Security Invariant:
   * - Scoped strictly to founder's company.
   * - Evaluation outcomes are read-only (founders cannot edit evaluations or scores).
   */
  async getApplicationById(
    userId: string | Types.ObjectId,
    applicationId: string | Types.ObjectId
  ): Promise<FounderApplicationDetailsResult> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const appObjectId = new Types.ObjectId(applicationId.toString());

    const company = await CompanyModel.findOne({
      ownerId: userObjectId,
      status: 'ACTIVE',
    });
    if (!company) {
      throw AppError.badRequest('Founder does not own an active company.');
    }

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (!application.companyId.equals(company._id)) {
      throw AppError.forbidden(
        'Founder cannot access applicant data belonging to another company.'
      );
    }

    const evaluations = await EvaluationModel.find({ applicationId: application._id });
    const feedbacks = await FeedbackModel.find({ applicationId: application._id });

    return {
      application,
      evaluations,
      feedbacks,
    };
  }

  /**
   * Retrieves the founder's CorpCoin double-entry transaction history.
   */
  public async getCorpCoinLedger(
    userId: string | Types.ObjectId,
    limit = 50
  ): Promise<ICorpCoinTransactionDocument[]> {
    const userObjectId = new Types.ObjectId(userId.toString());
    return await CorpCoinTransactionModel.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Math.max(1, limit)));
  }
}

export const founderService = new FounderService();
