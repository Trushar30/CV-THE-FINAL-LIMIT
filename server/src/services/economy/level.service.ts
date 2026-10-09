import { Types } from 'mongoose';
import { IExpTransactionDocument } from '../../models/ExpTransaction.js';
import { expService, ExpService } from './exp.service.js';
import {
  calculateTaskExp,
  clampScore,
  getLevelDetails,
  LevelDetails,
  levelForExp,
  performanceBand,
  performanceBandLabel,
} from './expEngine.js';
import { configService, ConfigService } from '../config/config.service.js';
import { PerformanceBand, PerformanceBandLabel } from '../../types/enums.js';
import { logger } from '../../utils/logger.js';

export interface AwardTaskExpParams {
  userId: string | Types.ObjectId;
  taskId: string | Types.ObjectId;
  sourceId?: string | Types.ObjectId;
  maxExp: number;
  score: unknown;
  reason?: string;
}

export interface AwardTaskExpResult {
  awardedExp: number;
  performanceBand: PerformanceBand;
  performanceBandLabel: PerformanceBandLabel;
  normalizedScore: number;
  previousExp: number;
  balanceAfter: number;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
  levelDetails: LevelDetails;
  transaction: IExpTransactionDocument | null;
}

export class LevelService {
  constructor(
    private expSvc: ExpService = expService,
    private configSvc: ConfigService = configService
  ) {}

  /**
   * Retrieve authoritative level details and progress metrics for a user.
   * Total EXP is read through ExpService; level is calculated dynamically
   * against PlatformConfig without stale persisted level columns.
   */
  async getUserLevel(userId: string | Types.ObjectId): Promise<LevelDetails> {
    const totalExp = await this.expSvc.getUserExp(userId);
    const careerConfig = await this.configSvc.getCareerConfig();

    return getLevelDetails(
      totalExp,
      careerConfig.levelTable,
      careerConfig.founderUnlockExp
    );
  }

  /**
   * Deterministically calculate task EXP from evaluation score and maxExp,
   * clamp all values strictly, and record an immutable ledger entry via ExpService.
   * Guarantees zero direct writes to totalExp.
   */
  async awardTaskExp(params: AwardTaskExpParams): Promise<AwardTaskExpResult> {
    const normalizedScore = clampScore(params.score);
    const awardedExp = calculateTaskExp(params.score, params.maxExp);
    const band = performanceBand(params.score);
    const bandLabel = performanceBandLabel(params.score);

    const careerConfig = await this.configSvc.getCareerConfig();
    const levelTable = careerConfig.levelTable;
    const founderUnlockExp = careerConfig.founderUnlockExp;

    const previousExp = await this.expSvc.getUserExp(params.userId);
    const previousLevel = levelForExp(previousExp, levelTable);

    let balanceAfter = previousExp;
    let transaction: IExpTransactionDocument | null = null;

    if (awardedExp > 0) {
      const reason =
        params.reason && params.reason.trim().length > 0
          ? params.reason.trim()
          : `Task evaluation award: ${awardedExp} EXP (score: ${normalizedScore}, maxExp: ${params.maxExp})`;

      const awardResult = await this.expSvc.awardExp({
        userId: params.userId,
        amount: awardedExp,
        sourceId: params.sourceId ?? params.taskId,
        reason,
      });

      balanceAfter = awardResult.balanceAfter;
      transaction = awardResult.transaction;
    } else {
      logger.info(
        `[LevelService] Awarded 0 EXP for user ${params.userId} on task ${params.taskId} (score: ${normalizedScore})`
      );
    }

    const currentLevel = levelForExp(balanceAfter, levelTable);
    const leveledUp = currentLevel > previousLevel;
    const levelDetails = getLevelDetails(balanceAfter, levelTable, founderUnlockExp);

    if (leveledUp) {
      logger.info(
        `[LevelService] User ${params.userId} leveled up from L${previousLevel} to L${currentLevel} (${levelDetails.title})!`
      );
    }

    return {
      awardedExp,
      performanceBand: band,
      performanceBandLabel: bandLabel,
      normalizedScore,
      previousExp,
      balanceAfter,
      previousLevel,
      currentLevel,
      leveledUp,
      levelDetails,
      transaction,
    };
  }

  /**
   * Check whether a user has unlocked Founder Mode (>= 12,000 total accumulated EXP).
   */
  async isFounderEligible(userId: string | Types.ObjectId): Promise<boolean> {
    const totalExp = await this.expSvc.getUserExp(userId);
    const careerConfig = await this.configSvc.getCareerConfig();
    return totalExp >= careerConfig.founderUnlockExp;
  }
}

export const levelService = new LevelService();
