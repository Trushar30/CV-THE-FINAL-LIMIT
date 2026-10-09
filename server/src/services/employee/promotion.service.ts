import { Types } from 'mongoose';
import { CompanyEmployeeModel } from '../../models/CompanyEmployee.js';
import { UserModel } from '../../models/User.js';
import { PromotionModel, IPromotionDocument } from '../../models/Promotion.js';
import { ConfigService, configService as defaultConfigService } from '../config/config.service.js';
import { TaskEvaluationService, taskEvaluationService as defaultTaskEvaluationService } from './taskEvaluation.service.js';
import { DisciplineService, disciplineService as defaultDisciplineService } from './discipline.service.js';
import { NotificationService, notificationService as defaultNotificationService } from '../notification/notification.service.js';
import { AIGateway, defaultAIGateway } from '../../ai/index.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';
import { PromotionRule, DEFAULT_PROMOTION_RULES } from '../../config/platformConfig.schema.js';

export interface PromotionCriterionProgress {
  current: number;
  required: number;
  met: boolean;
  missing: number;
}

export interface PromotionWarningsProgress {
  current: number;
  maxAllowed: number;
  met: boolean;
  excess: number;
}

export interface PromotionProgress {
  currentLevel: number;
  currentTitle: string;
  targetLevel: number | null;
  targetTitle: string | null;
  isMaxLevel: boolean;
  criteria: {
    exp: PromotionCriterionProgress;
    completedTasks: PromotionCriterionProgress;
    averageScore: PromotionCriterionProgress;
    activeWarnings: PromotionWarningsProgress;
  };
  isEligible: boolean;
  missingRequirements: string[];
}

export interface PromotionExecutionResult {
  promoted: boolean;
  progress: PromotionProgress;
  promotion: IPromotionDocument | null;
  reason?: string;
}

export class PromotionService {
  constructor(
    private readonly configService: ConfigService = defaultConfigService,
    private readonly taskEvaluationService: TaskEvaluationService = defaultTaskEvaluationService,
    private readonly disciplineService: DisciplineService = defaultDisciplineService,
    private readonly notificationService: NotificationService = defaultNotificationService,
    protected readonly _aiGateway: AIGateway = defaultAIGateway
  ) {}

  /**
   * Computes the employee's deterministic promotion progress toward the next level.
   * Compares totalExp, completedTasks, averageScore, and activeWarnings against PlatformConfig rules.
   */
  public async getPromotionProgress(userId: string | Types.ObjectId): Promise<PromotionProgress> {
    const userObjectId = new Types.ObjectId(userId.toString());

    const [employee, user, employeeConfig, careerConfig] = await Promise.all([
      CompanyEmployeeModel.findOne({ userId: userObjectId, status: 'ACTIVE' }),
      UserModel.findById(userObjectId),
      this.configService.getEmployeeConfig(),
      this.configService.getCareerConfig(),
    ]);

    if (!employee) {
      throw AppError.notFound('Active employee record not found for user');
    }

    if (!user) {
      throw AppError.notFound('User record not found');
    }

    const currentLevel = employee.level;
    const maxLevel = careerConfig.maxLevel || 10;

    // Boundary: Employee is already at max level (L10 Principal)
    if (currentLevel >= maxLevel) {
      return {
        currentLevel,
        currentTitle: employee.positionTitle,
        targetLevel: null,
        targetTitle: null,
        isMaxLevel: true,
        criteria: {
          exp: {
            current: user.totalExp,
            required: 16000,
            met: true,
            missing: 0,
          },
          completedTasks: {
            current: 0,
            required: 0,
            met: true,
            missing: 0,
          },
          averageScore: {
            current: 100,
            required: 70,
            met: true,
            missing: 0,
          },
          activeWarnings: {
            current: 0,
            maxAllowed: 1,
            met: true,
            excess: 0,
          },
        },
        isEligible: false,
        missingRequirements: ['Already at maximum level'],
      };
    }

    const targetLevel = currentLevel + 1;
    const targetLevelDef = careerConfig.levelTable.find((l) => l.level === targetLevel);
    const targetTitle = targetLevelDef?.title ?? `Level ${targetLevel}`;

    // Find rule in config or fallback to defaults
    const rulesList = (employeeConfig.promotionRules as PromotionRule[]) || DEFAULT_PROMOTION_RULES;
    const rule =
      rulesList.find((r) => r.targetLevel === targetLevel) ||
      DEFAULT_PROMOTION_RULES.find((r) => r.targetLevel === targetLevel) || {
        targetLevel,
        minExp: targetLevelDef?.minExp ?? 3000,
        requiredCompletedTasks: 10,
        minAverageScore: employeeConfig.minimumPromotionScore ?? 70,
        maxActiveWarnings: 1,
      };

    // Metrics gathering
    const [stats, activeWarningsCount] = await Promise.all([
      this.taskEvaluationService.getEmployeePerformanceStats(userObjectId),
      this.disciplineService.getActiveWarningsCount(userObjectId, employee.companyId),
    ]);

    const userExp = user.totalExp;
    const completedTasks = stats.completedTasksCount;
    const averageScore = stats.averageScore;

    // Evaluate 4 criteria independently
    const expMet = userExp >= rule.minExp;
    const tasksMet = completedTasks >= rule.requiredCompletedTasks;
    const scoreMet = averageScore >= rule.minAverageScore;
    const warningsMet = activeWarningsCount <= rule.maxActiveWarnings;

    const missingRequirements: string[] = [];

    if (!expMet) {
      missingRequirements.push(
        `Requires ${rule.minExp} EXP (currently ${userExp}, missing ${rule.minExp - userExp})`
      );
    }

    if (!tasksMet) {
      missingRequirements.push(
        `Requires ${rule.requiredCompletedTasks} completed tasks (currently ${completedTasks}, missing ${rule.requiredCompletedTasks - completedTasks})`
      );
    }

    if (!scoreMet) {
      missingRequirements.push(
        `Requires minimum average score of ${rule.minAverageScore} (currently ${averageScore})`
      );
    }

    if (!warningsMet) {
      missingRequirements.push(
        `Active warnings must be <= ${rule.maxActiveWarnings} (currently ${activeWarningsCount})`
      );
    }

    const isEligible = expMet && tasksMet && scoreMet && warningsMet;

    return {
      currentLevel,
      currentTitle: employee.positionTitle,
      targetLevel,
      targetTitle,
      isMaxLevel: false,
      criteria: {
        exp: {
          current: userExp,
          required: rule.minExp,
          met: expMet,
          missing: Math.max(0, rule.minExp - userExp),
        },
        completedTasks: {
          current: completedTasks,
          required: rule.requiredCompletedTasks,
          met: tasksMet,
          missing: Math.max(0, rule.requiredCompletedTasks - completedTasks),
        },
        averageScore: {
          current: averageScore,
          required: rule.minAverageScore,
          met: scoreMet,
          missing: Math.max(0, rule.minAverageScore - averageScore),
        },
        activeWarnings: {
          current: activeWarningsCount,
          maxAllowed: rule.maxActiveWarnings,
          met: warningsMet,
          excess: Math.max(0, activeWarningsCount - rule.maxActiveWarnings),
        },
      },
      isEligible,
      missingRequirements,
    };
  }

  /**
   * Deterministically checks promotion criteria after an evaluation and executes promotion if met.
   * AI may supply an advisory recommendation text, but the backend alone decides and writes state.
   */
  public async checkAndExecutePromotion(params: {
    userId: string | Types.ObjectId;
    companyId?: string | Types.ObjectId;
    aiRecommendation?: string;
  }): Promise<PromotionExecutionResult> {
    const { userId, aiRecommendation } = params;
    const userObjectId = new Types.ObjectId(userId.toString());

    const progress = await this.getPromotionProgress(userObjectId);

    if (!progress.isEligible || progress.isMaxLevel || !progress.targetLevel) {
      return {
        promoted: false,
        progress,
        promotion: null,
        reason: progress.isMaxLevel
          ? 'Already at maximum career level'
          : `Promotion criteria not met: ${progress.missingRequirements.join('; ')}`,
      };
    }

    const [employee, careerConfig] = await Promise.all([
      CompanyEmployeeModel.findOne({ userId: userObjectId, status: 'ACTIVE' }),
      this.configService.getCareerConfig(),
    ]);

    if (!employee) {
      throw AppError.notFound('Active employee record not found');
    }

    const previousLevel = employee.level;
    const newLevel = progress.targetLevel;
    const previousTitle = employee.positionTitle;
    const newTitle = progress.targetTitle || `Level ${newLevel}`;

    // Compute updated simulated salary
    const previousSalary = employee.salarySimulated;
    const targetSalaryBand = careerConfig.salaryBands.find((b) => b.level === newLevel);
    const newSalary = targetSalaryBand?.defaultSalary ?? previousSalary;

    // 1. Authoritative Backend Mutation: Update CompanyEmployee
    employee.level = newLevel;
    employee.positionTitle = newTitle;
    if (newSalary) {
      employee.salarySimulated = newSalary;
    }
    await employee.save();

    // 2. Write immutable record in promotions collection (Spec 26.21)
    const reason = `Satisfied all Level ${newLevel} promotion requirements: ${progress.criteria.exp.current} EXP, ${progress.criteria.completedTasks.current} tasks completed, ${progress.criteria.averageScore.current}% avg score, ${progress.criteria.activeWarnings.current} active warnings.`;

    const promotion = await PromotionModel.create({
      userId: userObjectId,
      companyId: employee.companyId,
      employeeId: employee._id,
      previousLevel,
      newLevel,
      previousPositionTitle: previousTitle,
      newPositionTitle: newTitle,
      previousSalarySimulated: previousSalary,
      newSalarySimulated: newSalary,
      totalExpSnapshot: progress.criteria.exp.current,
      reason,
      aiRecommendation: aiRecommendation?.trim() || undefined,
      promotedAt: new Date(),
    });

    // 3. Dispatch in-app notification to employee
    try {
      const salaryText = newSalary ? `$${newSalary.toLocaleString()}` : 'an increased rate';
      await this.notificationService.create({
        userId: userObjectId,
        type: 'PROMOTION',
        title: `Promoted to ${newTitle}!`,
        message: `Congratulations! You have been promoted to Level ${newLevel} (${newTitle}) with an updated compensation package of ${salaryText}.`,
        link: '/employee/dashboard',
      });
    } catch (notifErr) {
      logger.error('[PromotionService] Failed to send promotion notification', {
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    logger.info(
      `[PromotionService] Promoted user ${userObjectId.toString()} at company ${employee.companyId.toString()} from L${previousLevel} to L${newLevel} (${newTitle})`
    );

    return {
      promoted: true,
      progress,
      promotion,
      reason: 'Promoted successfully',
    };
  }
}

export const promotionService = new PromotionService();
defaultTaskEvaluationService.setPromotionService(promotionService);

