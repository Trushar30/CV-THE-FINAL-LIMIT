import { Types } from 'mongoose';
import {
  CorpCoinTransactionModel,
  ICorpCoinTransactionDocument,
} from '../../models/CorpCoinTransaction.js';
import { UserModel } from '../../models/User.js';
import { CorpCoinTransactionType } from '../../types/enums.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface CreditCorpCoinParams {
  userId: string | Types.ObjectId;
  amount: number;
  type: CorpCoinTransactionType;
  companyId?: string | Types.ObjectId | null;
  referenceId?: string | Types.ObjectId | null;
  reason: string;
}

export interface DebitCorpCoinParams {
  userId: string | Types.ObjectId;
  amount: number;
  type: CorpCoinTransactionType;
  companyId?: string | Types.ObjectId | null;
  referenceId?: string | Types.ObjectId | null;
  reason: string;
}

export interface CorpCoinOperationResult {
  transaction: ICorpCoinTransactionDocument;
  balanceAfter: number;
}

export interface CorpCoinVerificationResult {
  userId: string;
  ledgerTotal: number;
  cachedTotal: number;
  isConsistent: boolean;
}

export class CorpCoinService {
  /**
   * Credit CorpCoin to a user.
   * Atomically increments cached balance and writes an immutable ledger entry.
   */
  async credit(params: CreditCorpCoinParams): Promise<CorpCoinOperationResult> {
    if (
      typeof params.amount !== 'number' ||
      !Number.isInteger(params.amount) ||
      params.amount <= 0
    ) {
      throw AppError.businessRuleViolation(
        'Credit CorpCoin amount must be a strictly positive integer'
      );
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw AppError.validation('Reason is required for CorpCoin transaction');
    }

    const userObjectId =
      params.userId instanceof Types.ObjectId ? params.userId : new Types.ObjectId(params.userId);
    const companyObjectId = params.companyId
      ? params.companyId instanceof Types.ObjectId
        ? params.companyId
        : new Types.ObjectId(params.companyId)
      : null;
    const referenceObjectId = params.referenceId
      ? params.referenceId instanceof Types.ObjectId
        ? params.referenceId
        : new Types.ObjectId(params.referenceId)
      : null;

    // Atomically increment user's cached corpCoinBalanceCached
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userObjectId },
      { $inc: { corpCoinBalanceCached: params.amount, corpCoinBalance: params.amount } },
      { new: true }
    );

    if (!updatedUser) {
      throw AppError.notFound(`User with ID ${userObjectId} not found`);
    }

    const balanceAfter = updatedUser.corpCoinBalanceCached;

    // Write immutable ledger entry (positive amount for credit)
    const transaction = new CorpCoinTransactionModel({
      userId: userObjectId,
      companyId: companyObjectId,
      amount: params.amount,
      balanceAfter,
      type: params.type,
      referenceId: referenceObjectId,
      reason: params.reason.trim(),
      createdAt: new Date(),
    });

    await transaction.save();

    logger.info(
      `[CorpCoinService] Credited ${params.amount} CorpCoin to user ${userObjectId}. New balance: ${balanceAfter}`,
      {
        userId: userObjectId.toString(),
        amount: params.amount,
        balanceAfter,
        type: params.type,
      }
    );

    return { transaction, balanceAfter };
  }

  /**
   * Debit CorpCoin from a user.
   * Refuses debit that would make balance negative.
   * Enforces atomic conditional decrement ($gte) to strictly prevent concurrent overdraws.
   */
  async debit(params: DebitCorpCoinParams): Promise<CorpCoinOperationResult> {
    if (
      typeof params.amount !== 'number' ||
      !Number.isInteger(params.amount) ||
      params.amount <= 0
    ) {
      throw AppError.businessRuleViolation(
        'Debit CorpCoin amount must be a strictly positive integer'
      );
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw AppError.validation('Reason is required for CorpCoin transaction');
    }

    const userObjectId =
      params.userId instanceof Types.ObjectId ? params.userId : new Types.ObjectId(params.userId);
    const companyObjectId = params.companyId
      ? params.companyId instanceof Types.ObjectId
        ? params.companyId
        : new Types.ObjectId(params.companyId)
      : null;
    const referenceObjectId = params.referenceId
      ? params.referenceId instanceof Types.ObjectId
        ? params.referenceId
        : new Types.ObjectId(params.referenceId)
      : null;

    // Atomic conditional decrement: matches ONLY if current balance >= amount to prevent race-condition overdrafts
    const updatedUser = await UserModel.findOneAndUpdate(
      {
        _id: userObjectId,
        corpCoinBalanceCached: { $gte: params.amount },
      },
      {
        $inc: { corpCoinBalanceCached: -params.amount, corpCoinBalance: -params.amount },
      },
      { new: true }
    );

    if (!updatedUser) {
      // Check if user exists
      const userExists = await UserModel.findById(userObjectId);
      if (!userExists) {
        throw AppError.notFound(`User with ID ${userObjectId} not found`);
      }
      throw AppError.businessRuleViolation(
        `Insufficient CorpCoin balance: required ${params.amount}, available ${userExists.corpCoinBalanceCached}`
      );
    }

    const balanceAfter = updatedUser.corpCoinBalanceCached;

    // Write immutable ledger entry (negative amount for debit)
    const transaction = new CorpCoinTransactionModel({
      userId: userObjectId,
      companyId: companyObjectId,
      amount: -params.amount,
      balanceAfter,
      type: params.type,
      referenceId: referenceObjectId,
      reason: params.reason.trim(),
      createdAt: new Date(),
    });

    await transaction.save();

    logger.info(
      `[CorpCoinService] Debited ${params.amount} CorpCoin from user ${userObjectId}. New balance: ${balanceAfter}`,
      {
        userId: userObjectId.toString(),
        amount: -params.amount,
        balanceAfter,
        type: params.type,
      }
    );

    return { transaction, balanceAfter };
  }

  /**
   * Recompute CorpCoin balance from immutable ledger transactions.
   * Verifies that cached user corpCoinBalanceCached matches ledger sum.
   */
  async recomputeCorpCoinBalance(
    userId: string | Types.ObjectId,
    syncIfInconsistent: boolean = false
  ): Promise<CorpCoinVerificationResult> {
    const userObjectId = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);

    const user = await UserModel.findById(userObjectId);
    if (!user) {
      throw AppError.notFound(`User with ID ${userObjectId} not found`);
    }

    const aggregation = await CorpCoinTransactionModel.aggregate<{ _id: null; total: number }>([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const ledgerTotal = aggregation.length > 0 && aggregation[0] ? aggregation[0].total : 0;
    const cachedTotal = user.corpCoinBalanceCached;
    const isConsistent = ledgerTotal === cachedTotal;

    if (!isConsistent) {
      logger.warn(
        `[CorpCoinService] Inconsistency detected for user ${userObjectId}: ledger=${ledgerTotal}, cached=${cachedTotal}`
      );
      if (syncIfInconsistent) {
        user.corpCoinBalanceCached = ledgerTotal;
        user.corpCoinBalance = ledgerTotal;
        await user.save();
        logger.info(
          `[CorpCoinService] Synchronized cached corpCoinBalance for user ${userObjectId} to ${ledgerTotal}`
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
   * Get cached user CorpCoin balance.
   */
  async getUserBalance(userId: string | Types.ObjectId): Promise<number> {
    const userObjectId = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);
    const user = await UserModel.findById(userObjectId, { corpCoinBalanceCached: 1 });
    if (!user) {
      throw AppError.notFound(`User with ID ${userObjectId} not found`);
    }
    return user.corpCoinBalanceCached;
  }
}

export const corpCoinService = new CorpCoinService();
