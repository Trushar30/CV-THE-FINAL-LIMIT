import { Types } from 'mongoose';
import { ExpTransactionModel, IExpTransactionDocument } from '../../models/ExpTransaction.js';
import { UserModel } from '../../models/User.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface AwardExpParams {
  userId: string | Types.ObjectId;
  amount: number;
  sourceId: string | Types.ObjectId;
  reason: string;
}

export interface AdjustExpParams {
  userId: string | Types.ObjectId;
  amount: number;
  sourceId: string | Types.ObjectId;
  reason: string;
}

export interface ExpOperationResult {
  transaction: IExpTransactionDocument;
  balanceAfter: number;
}

export interface ExpVerificationResult {
  userId: string;
  ledgerTotal: number;
  cachedTotal: number;
  isConsistent: boolean;
}

export class ExpService {
  /**
   * Award EXP to a user for task completion.
   * Awarded EXP must be strictly positive per Spec Section 10 & 27.
   * Atomically updates user's cached totalExp and writes an immutable ledger entry.
   */
  async awardExp(params: AwardExpParams): Promise<ExpOperationResult> {
    if (
      typeof params.amount !== 'number' ||
      !Number.isInteger(params.amount) ||
      params.amount <= 0
    ) {
      throw AppError.businessRuleViolation(
        'Awarded EXP amount must be a strictly positive integer'
      );
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw AppError.validation('Reason is required for EXP transaction');
    }

    const userObjectId =
      params.userId instanceof Types.ObjectId ? params.userId : new Types.ObjectId(params.userId);
    const sourceObjectId =
      params.sourceId instanceof Types.ObjectId
        ? params.sourceId
        : new Types.ObjectId(params.sourceId);

    // Atomically increment user's cached totalExp
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userObjectId },
      { $inc: { totalExpCached: params.amount, totalExp: params.amount } },
      { new: true }
    );

    if (!updatedUser) {
      throw AppError.notFound(`User with ID ${userObjectId} not found`);
    }

    const balanceAfter = updatedUser.totalExpCached;

    // Write immutable ledger entry
    const transaction = new ExpTransactionModel({
      userId: userObjectId,
      amount: params.amount,
      balanceAfter,
      type: 'TASK_COMPLETION',
      sourceId: sourceObjectId,
      reason: params.reason.trim(),
      createdAt: new Date(),
    });

    await transaction.save();

    logger.info(
      `[ExpService] Awarded ${params.amount} EXP to user ${userObjectId}. New balance: ${balanceAfter}`,
      {
        userId: userObjectId.toString(),
        amount: params.amount,
        balanceAfter,
        type: 'TASK_COMPLETION',
        sourceId: sourceObjectId.toString(),
      }
    );

    return { transaction, balanceAfter };
  }

  /**
   * Administrative EXP adjustment.
   * Total accumulated EXP cannot be reduced below 0.
   */
  async adjustExp(params: AdjustExpParams): Promise<ExpOperationResult> {
    if (
      typeof params.amount !== 'number' ||
      !Number.isInteger(params.amount) ||
      params.amount === 0
    ) {
      throw AppError.businessRuleViolation('Adjusted EXP amount must be a non-zero integer');
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw AppError.validation('Reason is required for EXP adjustment');
    }

    const userObjectId =
      params.userId instanceof Types.ObjectId ? params.userId : new Types.ObjectId(params.userId);
    const sourceObjectId =
      params.sourceId instanceof Types.ObjectId
        ? params.sourceId
        : new Types.ObjectId(params.sourceId);

    // If negative adjustment, ensure totalExpCached + amount >= 0 atomically
    const filter =
      params.amount < 0
        ? { _id: userObjectId, totalExpCached: { $gte: Math.abs(params.amount) } }
        : { _id: userObjectId };

    const updatedUser = await UserModel.findOneAndUpdate(
      filter,
      { $inc: { totalExpCached: params.amount, totalExp: params.amount } },
      { new: true }
    );

    if (!updatedUser) {
      // Check if user exists but has insufficient balance
      const exists = await UserModel.findById(userObjectId);
      if (!exists) {
        throw AppError.notFound(`User with ID ${userObjectId} not found`);
      }
      throw AppError.businessRuleViolation('Cannot adjust EXP below zero balance');
    }

    const balanceAfter = updatedUser.totalExpCached;

    // Write immutable ledger entry
    const transaction = new ExpTransactionModel({
      userId: userObjectId,
      amount: params.amount,
      balanceAfter,
      type: 'ADMIN_ADJUSTMENT',
      sourceId: sourceObjectId,
      reason: params.reason.trim(),
      createdAt: new Date(),
    });

    await transaction.save();

    logger.info(
      `[ExpService] Adjusted ${params.amount} EXP for user ${userObjectId}. New balance: ${balanceAfter}`,
      {
        userId: userObjectId.toString(),
        amount: params.amount,
        balanceAfter,
        type: 'ADMIN_ADJUSTMENT',
        sourceId: sourceObjectId.toString(),
      }
    );

    return { transaction, balanceAfter };
  }

  /**
   * Recompute total accumulated EXP from immutable ledger transactions.
   * Verifies that cached user totalExp matches ledger sum.
   */
  async recomputeTotalExp(
    userId: string | Types.ObjectId,
    syncIfInconsistent: boolean = false
  ): Promise<ExpVerificationResult> {
    const userObjectId = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);

    const user = await UserModel.findById(userObjectId);
    if (!user) {
      throw AppError.notFound(`User with ID ${userObjectId} not found`);
    }

    const aggregation = await ExpTransactionModel.aggregate<{ _id: null; total: number }>([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const ledgerTotal = aggregation.length > 0 && aggregation[0] ? aggregation[0].total : 0;
    const cachedTotal = user.totalExpCached;
    const isConsistent = ledgerTotal === cachedTotal;

    if (!isConsistent) {
      logger.warn(
        `[ExpService] Inconsistency detected for user ${userObjectId}: ledger=${ledgerTotal}, cached=${cachedTotal}`
      );
      if (syncIfInconsistent) {
        user.totalExpCached = ledgerTotal;
        user.totalExp = ledgerTotal;
        await user.save();
        logger.info(
          `[ExpService] Synchronized cached totalExp for user ${userObjectId} to ${ledgerTotal}`
        );
      }
    }

    return {
      userId: userObjectId.toString(),
      ledgerTotal,
      cachedTotal,
      isConsistent,
    };
  }

  /**
   * Get cached user EXP balance.
   */
  async getUserExp(userId: string | Types.ObjectId): Promise<number> {
    const userObjectId = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);
    const user = await UserModel.findById(userObjectId, { totalExpCached: 1 });
    if (!user) {
      throw AppError.notFound(`User with ID ${userObjectId} not found`);
    }
    return user.totalExpCached;
  }
}

export const expService = new ExpService();
