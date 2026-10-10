import mongoose, { Types } from 'mongoose';
import {
  AIGateway,
  defaultAIGateway,
} from '../../ai/index.js';
import { CompanyModel, type ICompanyDocument } from '../../models/Company.js';
import { CompanyBotModel } from '../../models/CompanyBot.js';
import { CompanyEmployeeModel } from '../../models/CompanyEmployee.js';
import { CompanyJobModel } from '../../models/CompanyJob.js';
import { UserModel } from '../../models/User.js';
import { FounderModel } from '../../models/Founder.js';
import { AuditLogModel } from '../../models/AuditLog.js';
import { NotificationModel } from '../../models/Notification.js';
import { PerformanceRecordModel } from '../../models/PerformanceRecord.js';
import {
  CompanyScenarioModel,
  type ICompanyScenarioDocument,
  type IScenarioModifier,
  type IScenarioOption,
} from '../../models/CompanyScenario.js';
import {
  CompanyDecisionModel,
  type ICompanyDecisionDocument,
} from '../../models/CompanyDecision.js';
import {
  CompanyFinancialsModel,
  type ICompanyFinancialsDocument,
} from '../../models/CompanyFinancials.js';
import { ConfigService, configService as defaultConfigService } from '../config/config.service.js';
import type { ScenarioOptionId } from '../../types/enums.js';
import {
  resolveTemplateModifiers,
  aiScenarioGenerationJsonSchema,
  aiScenarioGenerationSchema,
  type AIScenarioGenerationOutput,
  type SubmitDecisionInput,
} from '../../schemas/simulation.schema.js';
import {
  executeDeterministicTick,
  calculateProductivity,
  type DailyTickResult,
} from './simulationEngine.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const SCENARIO_SYSTEM_PROMPT = `You are the Executive Simulation Engine for CorpVerse.
Generate a realistic, high-stakes corporate dilemma for an engineering startup founder.
You MUST provide:
1. A narrative scenario prompt (dilemma description).
2. A category ('PRODUCT' | 'ENGINEERING' | 'CLIENT' | 'CULTURE' | 'FINANCE').
3. Between 2 and 4 distinct options ('A', 'B', 'C', 'D').
IMPORTANT RULE: You CANNOT specify numeric stat deltas directly. Every option MUST select a registered 'modifierTemplateId' from the backend catalog:
[ACCEPT_ENTERPRISE_CONTRACT, EMERGENCY_CONTRACTOR_PATCH, STATUS_QUO, AGGRESSIVE_EXPANSION, AUSTERITY_MEASURES, EMPLOYEE_WELLBEING, MARKETING_PUSH, TECH_DEBT_REFACTOR, DEFAULT_EXPIRED].`;

export class SimulationService {
  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly configService: ConfigService = defaultConfigService
  ) {}

  /**
   * Helper to format UTC YYYY-MM-DD dayKey
   */
  public getUtcDayKey(date: Date = new Date()): string {
    return date.toISOString().split('T')[0] ?? '';
  }

  /**
   * Authoritatively retrieves active company owned by the founder
   */
  private async getActiveFounderCompany(userId: string | Types.ObjectId): Promise<ICompanyDocument> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    if (user.careerRole !== 'FOUNDER') {
      throw AppError.forbidden('Only active founders can access company simulation operations');
    }

    const company = await CompanyModel.findOne({
      ownerId: user._id,
      status: { $in: ['ACTIVE', 'ON_PROBATION'] },
    });

    if (!company) {
      throw AppError.notFound('No active company found for this founder');
    }

    return company;
  }

  /**
   * Helper to execute operations within a MongoDB transaction session,
   * with graceful fallback for standalone MongoDB instances.
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
            '[SimulationService] Standalone MongoDB detected, executing without transaction'
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
   * 1. GET OR GENERATE TODAY'S SCENARIO (Idempotent per UTC dayKey)
   */
  public async getDailyScenario(
    userId: string | Types.ObjectId,
    dateKey?: string
  ): Promise<ICompanyScenarioDocument> {
    const company = await this.getActiveFounderCompany(userId);
    const dayKey = dateKey || this.getUtcDayKey();

    // Idempotency: return existing scenario if already created for this dayKey
    const existing = await CompanyScenarioModel.findOne({
      companyId: company._id,
      date: dayKey,
    });
    if (existing) {
      return existing;
    }

    // Generate new scenario dilemma via AI Gateway PIPELINE pool
    let generatedOutput: AIScenarioGenerationOutput | null = null;
    try {
      const response = await this.aiGateway.execute(
        {
          taskType: 'SCENARIO_GENERATION',
          systemInstruction: SCENARIO_SYSTEM_PROMPT,
          userInput: JSON.stringify({
            companyName: company.name,
            domainsHired: company.domainsHired,
            employeeCount: company.employeeCount,
            financialHealth: company.financialHealth,
            companyRating: company.companyRating,
            dayKey,
          }),
          outputSchema: aiScenarioGenerationJsonSchema,
          temperature: 0.7,
        },
        { pool: 'PIPELINE' }
      );

      if (response.structuredData) {
        const parsed = aiScenarioGenerationSchema.safeParse(response.structuredData);
        if (parsed.success) {
          generatedOutput = parsed.data;
        }
      }
    } catch (aiErr) {
      logger.warn(`[SimulationService] AI scenario generation failed, using fallback dilemma`, {
        error: aiErr instanceof Error ? aiErr.message : String(aiErr),
      });
    }

    // Deterministic fallback if AI is unavailable or produces invalid schema
    if (!generatedOutput) {
      generatedOutput = {
        scenarioPrompt: `A major prospective enterprise client approaches ${company.name} requesting a tailored service contract with tight SLAs and rapid engineering onboarding.`,
        category: 'CLIENT',
        options: [
          {
            optionId: 'A',
            title: 'Accept & Optimize Architecture',
            description: 'Commit senior resources to deliver against client SLAs while increasing billings.',
            expectedOutcome: 'High revenue growth with minor overhead expansion.',
            modifierTemplateId: 'ACCEPT_ENTERPRISE_CONTRACT',
          },
          {
            optionId: 'B',
            title: 'Focus on Internal Engineering Quality',
            description: 'Decline enterprise customization to prioritize core code architecture and team culture.',
            expectedOutcome: 'Strengthened developer satisfaction and reduced technical debt.',
            modifierTemplateId: 'EMPLOYEE_WELLBEING',
          },
          {
            optionId: 'C',
            title: 'Aggressive Market Expansion',
            description: 'Undertake extensive hiring and rapid feature deployment.',
            expectedOutcome: 'Rapid growth but elevated burn rate.',
            modifierTemplateId: 'AGGRESSIVE_EXPANSION',
          },
          {
            optionId: 'D',
            title: 'Maintain Current Operations',
            description: 'Keep current trajectory without expanding commitments.',
            expectedOutcome: 'Stable operations with zero financial volatility.',
            modifierTemplateId: 'STATUS_QUO',
          },
        ],
      };
    }

    // Authoritatively resolve modifiers from backend templates (AI CANNOT INVENT NUMBERS)
    const optionsWithBackendModifiers: IScenarioOption[] = generatedOutput.options.map((opt) => ({
      optionId: opt.optionId as ScenarioOptionId,
      title: opt.title,
      description: opt.description,
      expectedOutcome: opt.expectedOutcome,
      modifierTemplateId: opt.modifierTemplateId,
      modifiers: resolveTemplateModifiers(opt.modifierTemplateId),
    }));

    try {
      return await CompanyScenarioModel.create({
        companyId: company._id,
        founderId: company.ownerId!,
        date: dayKey,
        scenarioPrompt: generatedOutput.scenarioPrompt,
        category: generatedOutput.category,
        options: optionsWithBackendModifiers,
        status: 'ACTIVE',
      });
    } catch (createErr: unknown) {
      // Handle race condition: concurrent request created scenario
      if (
        typeof createErr === 'object' &&
        createErr !== null &&
        'code' in createErr &&
        (createErr as { code: number }).code === 11000
      ) {
        const raced = await CompanyScenarioModel.findOne({ companyId: company._id, date: dayKey });
        if (raced) return raced;
      }
      throw createErr;
    }
  }

  /**
   * 2. SUBMIT SCENARIO DECISION
   */
  public async submitDecision(
    userId: string | Types.ObjectId,
    input: SubmitDecisionInput
  ): Promise<{ scenario: ICompanyScenarioDocument; decision: ICompanyDecisionDocument }> {
    const company = await this.getActiveFounderCompany(userId);

    const scenario = await CompanyScenarioModel.findById(input.scenarioId);
    if (!scenario) {
      throw AppError.notFound('Scenario not found');
    }

    if (scenario.companyId.toString() !== company._id.toString()) {
      throw AppError.forbidden('Access denied: You do not own this company scenario');
    }

    if (scenario.status !== 'ACTIVE') {
      throw AppError.badRequest(`Scenario is already ${scenario.status}`);
    }

    const selectedOption = scenario.options.find((opt) => opt.optionId === input.chosenOptionId);
    if (!selectedOption) {
      throw AppError.badRequest(`Invalid optionId '${input.chosenOptionId}' for this scenario`);
    }

    // Resolve modifiers strictly from template
    const calculatedDelta = resolveTemplateModifiers(selectedOption.modifierTemplateId);

    // Update scenario state
    scenario.status = 'DECIDED';
    scenario.chosenOptionId = input.chosenOptionId as ScenarioOptionId;
    scenario.calculatedDelta = calculatedDelta;
    await scenario.save();

    // Create immutable companyDecisions record (Collection 25)
    const decision = await CompanyDecisionModel.create({
      companyId: company._id,
      founderId: company.ownerId!,
      scenarioId: scenario._id,
      date: scenario.date,
      chosenOptionId: input.chosenOptionId as ScenarioOptionId,
      modifierTemplateId: selectedOption.modifierTemplateId,
      calculatedDelta,
      rationale: input.rationale,
    });

    return { scenario, decision };
  }

  /**
   * 3. EXECUTE DAILY TICK (Deterministic Math Engine & Bankruptcy Check)
   */
  public async executeDailyTick(
    userId: string | Types.ObjectId,
    dateKey?: string
  ): Promise<{
    financials: ICompanyFinancialsDocument;
    company: ICompanyDocument;
    tickResult: DailyTickResult;
    alreadyTicked: boolean;
  }> {
    const company = await this.getActiveFounderCompany(userId);
    const dayKey = dateKey || this.getUtcDayKey();

    // Idempotency: return existing financials if this day has already ticked
    const existingFinancials = await CompanyFinancialsModel.findOne({
      companyId: company._id,
      date: dayKey,
    });

    if (existingFinancials) {
      return {
        financials: existingFinancials,
        company,
        tickResult: {
          baseRevenue: existingFinancials.revenue,
          dailyRevenue: existingFinancials.revenue,
          baseExpenses: existingFinancials.expenses,
          dailyExpenses: existingFinancials.expenses,
          dailyProfit: existingFinancials.profit,
          newFinancialHealth: existingFinancials.financialHealth,
          newCompanyRating: existingFinancials.companyRating,
          newEmployeeSatisfaction: existingFinancials.employeeSatisfaction,
          newRetentionRate: existingFinancials.employeeRetentionRate,
          isBankrupt: company.status === 'BANKRUPT',
        },
        alreadyTicked: true,
      };
    }

    // Determine scenario modifiers for today
    let activeModifiers: IScenarioModifier = resolveTemplateModifiers('DEFAULT_EXPIRED');
    const scenario = await CompanyScenarioModel.findOne({
      companyId: company._id,
      date: dayKey,
    });

    if (scenario) {
      if (scenario.status === 'DECIDED' && scenario.calculatedDelta) {
        activeModifiers = scenario.calculatedDelta;
      } else if (scenario.status === 'ACTIVE') {
        // Day rollover without decision: mark EXPIRED
        scenario.status = 'EXPIRED';
        scenario.calculatedDelta = resolveTemplateModifiers('DEFAULT_EXPIRED');
        await scenario.save();
        activeModifiers = resolveTemplateModifiers('DEFAULT_EXPIRED');
      }
    }

    // Aggregate today's employee task evaluation scores for productivity P
    const activeEmployees = await CompanyEmployeeModel.find({
      companyId: company._id,
      status: { $in: ['ACTIVE', 'ON_PROBATION', 'UNDER_REVIEW'] },
    });

    const employeeUserIds = activeEmployees.map((e) => e.userId);
    const todayPerformance = await PerformanceRecordModel.find({
      userId: { $in: employeeUserIds },
      createdAt: {
        $gte: new Date(`${dayKey}T00:00:00.000Z`),
        $lte: new Date(`${dayKey}T23:59:59.999Z`),
      },
    }).select('aiScore');

    const taskScores = todayPerformance.map((p) => p.aiScore);
    const productivity = calculateProductivity(taskScores);

    // Bot count
    const botCount = await CompanyBotModel.countDocuments({
      companyId: company._id,
      isActive: true,
    });

    // Configuration threshold
    const config = await this.configService.getConfig();
    const bankruptcyThreshold = config.company?.bankruptcyThreshold ?? -1000;

    // Run deterministic formula
    const tickResult = executeDeterministicTick({
      employeeCount: company.employeeCount,
      botCount: Math.max(3, botCount),
      companyRating: company.companyRating,
      financialHealth: company.financialHealth,
      employeeSatisfaction: company.employeeSatisfaction ?? 70,
      retentionRate: company.retentionRate ?? 100,
      productivity,
      modifiers: activeModifiers,
      bankruptcyThreshold,
    });

    // Record point-in-time snapshot in companyFinancials (Collection 26)
    const financials = await CompanyFinancialsModel.create({
      companyId: company._id,
      date: dayKey,
      revenue: tickResult.dailyRevenue,
      expenses: tickResult.dailyExpenses,
      profit: tickResult.dailyProfit,
      financialHealth: tickResult.newFinancialHealth,
      employeeRetentionRate: tickResult.newRetentionRate,
      employeeCount: company.employeeCount,
      employeeSatisfaction: tickResult.newEmployeeSatisfaction,
      companyRating: tickResult.newCompanyRating,
      recordedAt: new Date(),
    });

    // Update Company model live fields
    company.financialHealth = tickResult.newFinancialHealth;
    company.companyRating = tickResult.newCompanyRating;
    company.employeeSatisfaction = tickResult.newEmployeeSatisfaction;
    company.retentionRate = tickResult.newRetentionRate;
    company.cumulativeRevenue = (company.cumulativeRevenue ?? 0) + tickResult.dailyRevenue;
    company.cumulativeProfit = (company.cumulativeProfit ?? 0) + tickResult.dailyProfit;
    company.operatingDays = (company.operatingDays ?? 0) + 1;

    // Insolvency trigger: Health <= bankruptcyThreshold
    if (tickResult.isBankrupt) {
      await this.executeBankruptcyLiquidation(company);
    } else {
      await company.save();
    }

    return {
      financials,
      company,
      tickResult,
      alreadyTicked: false,
    };
  }

  /**
   * 4. BANKRUPTCY LIQUIDATION PROTOCOL ($H <= -1000)
   * Executed in a single atomic database transaction:
   * - Company status transitions to 'BANKRUPT', isOpenForHiring = false, employeeCount = 0.
   * - Employees are terminated and released back to 'JOB_SEEKER' with notifications.
   * - Founder careerRole reverts to 'JOB_SEEKER', preserving lifetime EXP, history,
   *   and personal CorpCoin balance untouched.
   * - founderStarterCoinGranted stays true (no starter coins re-granted on future unlocks).
   * - Open job listings are closed.
   * - Immutable audit log record created.
   */
  public async executeBankruptcyLiquidation(company: ICompanyDocument): Promise<void> {
    logger.warn(
      `[SimulationService] Executing bankruptcy liquidation for company "${company.name}" (${company._id.toString()})`
    );

    await this.withTransaction(async (session) => {
      // 1. Mark company BANKRUPT and close hiring
      company.status = 'BANKRUPT';
      company.isOpenForHiring = false;
      company.employeeCount = 0;
      await company.save({ session: session ?? undefined });

      // 2. Revert founder career role back to JOB_SEEKER while preserving EXP & personal coins
      if (company.ownerId) {
        const founderUser = await UserModel.findById(company.ownerId, null, {
          session: session ?? undefined,
        });
        if (founderUser) {
          founderUser.careerRole = 'JOB_SEEKER';
          // NOTE: totalExp, totalExpCached, and corpCoinBalance are preserved untouched.
          // founderStarterCoinGranted stays true so starter coins are never granted again.
          await founderUser.save({ session: session ?? undefined });
        }

        const founderRecord = await FounderModel.findOne(
          { userId: company.ownerId },
          null,
          { session: session ?? undefined }
        );
        if (founderRecord) {
          founderRecord.status = 'BANKRUPT';
          await founderRecord.save({ session: session ?? undefined });
        }
      }

      // 3. Terminate all active company employees and release them back to JOB_SEEKER
      const activeEmployees = await CompanyEmployeeModel.find(
        {
          companyId: company._id,
          status: { $in: ['ACTIVE', 'ON_PROBATION', 'UNDER_REVIEW'] },
        },
        null,
        { session: session ?? undefined }
      );

      const now = new Date();
      for (const emp of activeEmployees) {
        emp.status = 'TERMINATED';
        emp.endedAt = now;
        emp.history.push({
          status: 'TERMINATED',
          reason: 'Company bankruptcy liquidation',
          changedAt: now,
          level: emp.level,
          positionTitle: emp.positionTitle,
        });
        await emp.save({ session: session ?? undefined });

        // Release employee back to JOB_SEEKER
        if (session) {
          await UserModel.findByIdAndUpdate(
            emp.userId,
            { careerRole: 'JOB_SEEKER' },
            { session }
          );
        } else {
          await UserModel.findByIdAndUpdate(emp.userId, { careerRole: 'JOB_SEEKER' });
        }

        // Notify laid-off employee
        const employeeNotif = {
          userId: emp.userId,
          type: 'COMPANY_BANKRUPT' as const,
          title: 'Company Liquidation Notice',
          message: `${company.name} has entered bankruptcy liquidation. You have been released back to Job Seeker status with your career EXP preserved.`,
        };
        if (session) {
          await NotificationModel.create([employeeNotif], { session });
        } else {
          await NotificationModel.create(employeeNotif);
        }
      }

      // 4. Close all open job listings
      if (session) {
        await CompanyJobModel.updateMany(
          { companyId: company._id, isOpen: true },
          { isOpen: false, status: 'CLOSED' },
          { session }
        );
      } else {
        await CompanyJobModel.updateMany(
          { companyId: company._id, isOpen: true },
          { isOpen: false, status: 'CLOSED' }
        );
      }

      // 5. Notify founder
      if (company.ownerId) {
        const founderNotif = {
          userId: company.ownerId,
          type: 'COMPANY_BANKRUPT' as const,
          title: 'Company Bankruptcy Notice',
          message: `Your company ${company.name} has reached insolvent financial health and entered bankruptcy liquidation. Your career role is now Job Seeker. Your lifetime accumulated EXP and CorpCoin balance remain preserved.`,
        };
        if (session) {
          await NotificationModel.create([founderNotif], { session });
        } else {
          await NotificationModel.create(founderNotif);
        }
      }

      // 6. Write immutable audit log
      const auditPayload = {
        actorId: company.ownerId,
        actorRole: 'ADMIN' as const,
        action: 'COMPANY_BANKRUPTCY_LIQUIDATION',
        targetType: 'Company',
        targetCollection: 'companies',
        targetId: company._id,
        oldValue: { status: 'ACTIVE', isOpenForHiring: true },
        newValue: {
          status: 'BANKRUPT',
          isOpenForHiring: false,
          finalHealth: company.financialHealth,
          employeesReleased: activeEmployees.length,
        },
        reason: `Financial health dropped to ${company.financialHealth} <= liquidation threshold`,
      };
      if (session) {
        await AuditLogModel.create([auditPayload], { session });
      } else {
        await AuditLogModel.create(auditPayload);
      }
    });
  }

  /**
   * 5. GET HISTORICAL FINANCIAL SNAPSHOTS
   */
  public async getFinancialHistory(
    userId: string | Types.ObjectId,
    limit = 30
  ): Promise<ICompanyFinancialsDocument[]> {
    const company = await this.getActiveFounderCompany(userId);
    return CompanyFinancialsModel.find({ companyId: company._id })
      .sort({ recordedAt: -1 })
      .limit(Math.min(100, Math.max(1, limit)));
  }
}

export const simulationService = new SimulationService();
