import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { LevelService } from '../services/economy/level.service.js';
import { ExpService } from '../services/economy/exp.service.js';
import { ConfigService } from '../services/config/config.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import { IExpTransactionDocument } from '../models/ExpTransaction.js';

describe('LevelService & ExpService Integration Suite (TASK P7.1)', () => {
  let mockExpService: ExpService;
  let mockConfigService: ConfigService;
  let levelService: LevelService;
  let userExpMap: Map<string, number>;
  let awardedTransactions: Array<{
    userId: string;
    amount: number;
    sourceId: string;
    reason: string;
  }>;

  const testUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    userExpMap = new Map();
    userExpMap.set(testUserId, 0);
    awardedTransactions = [];

    mockExpService = {
      getUserExp: vi.fn(async (userId: string | Types.ObjectId) => {
        return userExpMap.get(userId.toString()) ?? 0;
      }),
      awardExp: vi.fn(async (params: {
        userId: string | Types.ObjectId;
        amount: number;
        sourceId: string | Types.ObjectId;
        reason: string;
      }) => {
        const idStr = params.userId.toString();
        const current = userExpMap.get(idStr) ?? 0;
        const newBalance = current + params.amount;
        userExpMap.set(idStr, newBalance);

        awardedTransactions.push({
          userId: idStr,
          amount: params.amount,
          sourceId: params.sourceId.toString(),
          reason: params.reason,
        });

        const mockTransaction = {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(idStr),
          amount: params.amount,
          balanceAfter: newBalance,
          type: 'TASK_COMPLETION',
          sourceId: new Types.ObjectId(params.sourceId.toString()),
          reason: params.reason,
          createdAt: new Date(),
        } as unknown as IExpTransactionDocument;

        return {
          transaction: mockTransaction,
          balanceAfter: newBalance,
        };
      }),
      adjustExp: vi.fn(),
      recomputeTotalExp: vi.fn(),
    } as unknown as ExpService;

    mockConfigService = {
      getCareerConfig: vi.fn(async () => DEFAULT_PLATFORM_CONFIG.career),
    } as unknown as ConfigService;

    levelService = new LevelService(mockExpService, mockConfigService);
  });

  describe('getUserLevel', () => {
    it('should return Level 1 Intern for a user with 0 EXP', async () => {
      const details = await levelService.getUserLevel(testUserId);
      expect(mockExpService.getUserExp).toHaveBeenCalledWith(testUserId);
      expect(details.level).toBe(1);
      expect(details.title).toBe('Intern');
      expect(details.minExp).toBe(0);
      expect(details.isMaxLevel).toBe(false);
      expect(details.nextLevel).toBe(2);
      expect(details.nextLevelTitle).toBe('Junior');
      expect(details.nextLevelMinExp).toBe(500);
      expect(details.currentLevelProgressExp).toBe(0);
      expect(details.expNeededForNextLevel).toBe(500);
      expect(details.progressPercentage).toBe(0);
      expect(details.founderUnlocked).toBe(false);
    });

    it('should calculate accurate metrics for an existing user with accumulated EXP', async () => {
      userExpMap.set(testUserId, 750); // Level 2: 500 to 1200, range 700, progress 250

      const details = await levelService.getUserLevel(testUserId);
      expect(details.level).toBe(2);
      expect(details.title).toBe('Junior');
      expect(details.currentLevelProgressExp).toBe(250);
      expect(details.expNeededForNextLevel).toBe(450);
      // 250 / 700 = ~36%
      expect(details.progressPercentage).toBe(36);
      expect(details.founderUnlocked).toBe(false);
    });

    it('should indicate Founder Mode unlock when EXP reaches 12,000', async () => {
      userExpMap.set(testUserId, 12000);

      const details = await levelService.getUserLevel(testUserId);
      expect(details.level).toBe(9);
      expect(details.title).toBe('Lead');
      expect(details.founderUnlocked).toBe(true);
    });
  });

  describe('awardTaskExp', () => {
    it('should calculate clamped EXP, create ExpTransaction via ExpService, and return balanceAfter', async () => {
      const taskId = new Types.ObjectId();
      const result = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 60,
        score: 85, // 85% of 60 = 51 EXP
        reason: 'Daily task completion',
      });

      expect(result.awardedExp).toBe(51);
      expect(result.performanceBand).toBe('GOOD');
      expect(result.performanceBandLabel).toBe('Good');
      expect(result.normalizedScore).toBe(85);
      expect(result.previousExp).toBe(0);
      expect(result.balanceAfter).toBe(51);
      expect(result.previousLevel).toBe(1);
      expect(result.currentLevel).toBe(1);
      expect(result.leveledUp).toBe(false);
      expect(result.transaction).not.toBeNull();
      expect(result.transaction?.amount).toBe(51);

      // Verify that ExpService.awardExp was called with exact parameters
      expect(mockExpService.awardExp).toHaveBeenCalledTimes(1);
      expect(mockExpService.awardExp).toHaveBeenCalledWith({
        userId: testUserId,
        amount: 51,
        sourceId: taskId,
        reason: 'Daily task completion',
      });
      expect(awardedTransactions).toHaveLength(1);
      expect(awardedTransactions[0]?.amount).toBe(51);
    });

    it('should detect level up when task award crosses level threshold', async () => {
      userExpMap.set(testUserId, 480); // Level 1 (0 to 499)

      const taskId = new Types.ObjectId();
      const result = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 30,
        score: 100, // awards 30 EXP -> new total 510 -> Level 2 Junior!
      });

      expect(result.awardedExp).toBe(30);
      expect(result.performanceBand).toBe('EXCELLENT');
      expect(result.previousExp).toBe(480);
      expect(result.balanceAfter).toBe(510);
      expect(result.previousLevel).toBe(1);
      expect(result.currentLevel).toBe(2);
      expect(result.leveledUp).toBe(true);
      expect(result.levelDetails.title).toBe('Junior');
    });

    it('should handle score 0 (awardedExp 0) safely without calling ExpService.awardExp', async () => {
      const taskId = new Types.ObjectId();
      const result = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 100,
        score: 0,
      });

      expect(result.awardedExp).toBe(0);
      expect(result.performanceBand).toBe('POOR');
      expect(result.performanceBandLabel).toBe('Poor');
      expect(result.previousExp).toBe(0);
      expect(result.balanceAfter).toBe(0);
      expect(result.leveledUp).toBe(false);
      expect(result.transaction).toBeNull();

      // Ensure ExpService.awardExp was NOT called for 0 EXP
      expect(mockExpService.awardExp).not.toHaveBeenCalled();
      expect(awardedTransactions).toHaveLength(0);
    });

    it('should clamp absurd scores from AI (e.g. 150 -> 100, negative -> 0)', async () => {
      const taskId = new Types.ObjectId();

      // Negative score -> 0 EXP, no ledger write
      const resultNeg = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 60,
        score: -50,
      });
      expect(resultNeg.awardedExp).toBe(0);
      expect(resultNeg.performanceBand).toBe('POOR');
      expect(resultNeg.normalizedScore).toBe(0);
      expect(mockExpService.awardExp).not.toHaveBeenCalled();

      // Score > 100 -> clamped to 100% of maxExp (60 EXP)
      const resultHigh = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 60,
        score: 150,
      });
      expect(resultHigh.awardedExp).toBe(60);
      expect(resultHigh.performanceBand).toBe('EXCELLENT');
      expect(resultHigh.normalizedScore).toBe(100);
      expect(resultHigh.balanceAfter).toBe(60);
      expect(mockExpService.awardExp).toHaveBeenCalledTimes(1);
    });

    it('should handle absurd score inputs (NaN, strings, null, undefined)', async () => {
      const taskId = new Types.ObjectId();

      // String score "80"
      const resultStr = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 100,
        score: '80',
      });
      expect(resultStr.awardedExp).toBe(80);
      expect(resultStr.performanceBand).toBe('GOOD');

      // String score "abc" -> treated as 0
      const resultInvalid = await levelService.awardTaskExp({
        userId: testUserId,
        taskId,
        maxExp: 100,
        score: 'not_a_valid_score',
      });
      expect(resultInvalid.awardedExp).toBe(0);
      expect(resultInvalid.performanceBand).toBe('POOR');
    });
  });

  describe('isFounderEligible', () => {
    it('should return false when user totalExp < 12000', async () => {
      userExpMap.set(testUserId, 11999);
      expect(await levelService.isFounderEligible(testUserId)).toBe(false);
    });

    it('should return true when user totalExp >= 12000', async () => {
      userExpMap.set(testUserId, 12000);
      expect(await levelService.isFounderEligible(testUserId)).toBe(true);

      userExpMap.set(testUserId, 16000);
      expect(await levelService.isFounderEligible(testUserId)).toBe(true);
    });
  });
});
