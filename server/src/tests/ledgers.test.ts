import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, IUserDocument } from '../models/User.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../models/CorpCoinTransaction.js';
import { auditService } from '../services/audit/audit.service.js';
import { expService } from '../services/economy/exp.service.js';
import { corpCoinService } from '../services/economy/corpCoin.service.js';
import { ConfigService } from '../services/config/config.service.js';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import { AppError } from '../utils/errors.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_ledgers';

describe('Audit Log, EXP Ledger & CorpCoin Economy Integration Suite', () => {
  let testUser: IUserDocument;

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await AuditLogModel.collection.deleteMany({});
      await ExpTransactionModel.collection.deleteMany({});
      await CorpCoinTransactionModel.collection.deleteMany({});
      await PlatformConfigModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await UserModel.collection.deleteMany({});
    await AuditLogModel.collection.deleteMany({});
    await ExpTransactionModel.collection.deleteMany({});
    await CorpCoinTransactionModel.collection.deleteMany({});
    await PlatformConfigModel.collection.deleteMany({});

    testUser = new UserModel({
      email: 'engineer@corpverse.io',
      passwordHash: 'argon2id_mock_hash',
      careerRole: 'EMPLOYEE',
      platformRole: 'NONE',
      totalExpCached: 0,
      corpCoinBalanceCached: 0,
    });
    await testUser.save();
  });

  describe('AuditService & auditLogs Collection', () => {
    const adminId = new Types.ObjectId();
    const targetId = new Types.ObjectId();

    it('should record append-only audit log entry in MongoDB', async () => {
      const recorded = await auditService.record({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'USER_SUSPENDED',
        targetType: 'users',
        targetId,
        oldValue: { isSuspended: false },
        newValue: { isSuspended: true },
        reason: 'Violation of corporate terms of conduct',
      });

      expect(recorded._id).toBeDefined();
      expect(recorded.action).toBe('USER_SUSPENDED');
      expect(recorded.actorRole).toBe('ADMIN');
      expect(recorded.targetType).toBe('users');
      expect(recorded.reason).toBe('Violation of corporate terms of conduct');

      // Verify in MongoDB
      const found = await AuditLogModel.findById(recorded._id);
      expect(found).not.toBeNull();
      expect(found?.actorId.toString()).toBe(adminId.toString());
      expect(found?.targetId.toString()).toBe(targetId.toString());
      expect(found?.oldValue).toEqual({ isSuspended: false });
      expect(found?.newValue).toEqual({ isSuspended: true });
    });

    it('should reject audit records missing mandatory fields', async () => {
      await expect(
        auditService.record({
          actorId: '',
          actorRole: 'ADMIN',
          action: 'ACTION',
          targetType: 'users',
          targetId,
          reason: 'Reason',
        })
      ).rejects.toThrow(AppError);

      await expect(
        auditService.record({
          actorId: adminId,
          actorRole: 'ADMIN',
          action: '',
          targetType: 'users',
          targetId,
          reason: 'Reason',
        })
      ).rejects.toThrow(AppError);

      await expect(
        auditService.record({
          actorId: adminId,
          actorRole: 'ADMIN',
          action: 'ACTION',
          targetType: 'users',
          targetId,
          reason: '   ',
        })
      ).rejects.toThrow(AppError);
    });

    it('should enforce append-only rule and prevent modification or deletion of audit logs', async () => {
      const log = await auditService.record({
        actorId: adminId,
        actorRole: 'ADMIN',
        action: 'UPDATE',
        targetType: 'platformConfigs',
        targetId,
        reason: 'Initial record',
      });

      // Mongoose update hooks block updates
      await expect(
        AuditLogModel.updateOne({ _id: log._id }, { reason: 'Tampered reason' })
      ).rejects.toThrow(/append-only/i);

      await expect(
        AuditLogModel.findOneAndUpdate({ _id: log._id }, { reason: 'Tampered reason' })
      ).rejects.toThrow(/append-only/i);

      // Save on existing doc blocks updates
      log.reason = 'Direct document edit';
      await expect(log.save()).rejects.toThrow(/append-only/i);

      // Deletion blocked
      await expect(AuditLogModel.deleteOne({ _id: log._id })).rejects.toThrow(/append-only/i);
      await expect(AuditLogModel.deleteMany({ _id: log._id })).rejects.toThrow(/append-only/i);
    });

    it('should wire AuditService into ConfigService and write real auditLogs in MongoDB', async () => {
      const configServiceWithRealAudit = new ConfigService(auditService);
      await configServiceWithRealAudit.seedDefaultsIfMissing();

      const newConfig = {
        ...DEFAULT_PLATFORM_CONFIG,
        applications: { maxActive: 8 },
      };

      await configServiceWithRealAudit.updateConfig({
        newConfig,
        adminId: adminId.toString(),
        reason: 'Increased max applications to 8 in production',
      });

      const auditEntries = await AuditLogModel.find({ action: 'UPDATE_PLATFORM_CONFIG' });
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0]?.actorId.toString()).toBe(adminId.toString());
      expect(auditEntries[0]?.targetType).toBe('platformConfigs');
      expect(auditEntries[0]?.reason).toBe('Increased max applications to 8 in production');
    });
  });

  describe('ExpService & expTransactions Ledger', () => {
    const taskId = new Types.ObjectId();

    it('should award EXP, write ledger entry, and atomically update user totalExpCached', async () => {
      const result1 = await expService.awardExp({
        userId: testUser._id,
        amount: 30,
        sourceId: taskId,
        reason: 'Completed Easy Engineering Task #101',
      });

      expect(result1.balanceAfter).toBe(30);
      expect(result1.transaction.amount).toBe(30);
      expect(result1.transaction.type).toBe('TASK_COMPLETION');
      expect(result1.transaction.balanceAfter).toBe(30);

      // Verify cached balance on User document
      const userCheck1 = await UserModel.findById(testUser._id);
      expect(userCheck1?.totalExpCached).toBe(30);

      // Award a second task
      const result2 = await expService.awardExp({
        userId: testUser._id,
        amount: 60,
        sourceId: new Types.ObjectId(),
        reason: 'Completed Medium Engineering Task #102',
      });

      expect(result2.balanceAfter).toBe(90);

      const userCheck2 = await UserModel.findById(testUser._id);
      expect(userCheck2?.totalExpCached).toBe(90);

      // Verify 2 ledger entries in MongoDB
      const txs = await ExpTransactionModel.find({ userId: testUser._id }).sort({ createdAt: 1 });
      expect(txs).toHaveLength(2);
      expect(txs[0]?.amount).toBe(30);
      expect(txs[0]?.balanceAfter).toBe(30);
      expect(txs[1]?.amount).toBe(60);
      expect(txs[1]?.balanceAfter).toBe(90);
    });

    it('should reject non-positive EXP awards', async () => {
      await expect(
        expService.awardExp({
          userId: testUser._id,
          amount: 0,
          sourceId: taskId,
          reason: 'Zero exp',
        })
      ).rejects.toThrow(AppError);

      await expect(
        expService.awardExp({
          userId: testUser._id,
          amount: -50,
          sourceId: taskId,
          reason: 'Negative exp',
        })
      ).rejects.toThrow(AppError);
    });

    it('should support administrative adjustment and reject reducing balance below 0', async () => {
      await expService.awardExp({
        userId: testUser._id,
        amount: 100,
        sourceId: taskId,
        reason: 'Task 1',
      });

      // Valid adjustment
      const adj = await expService.adjustExp({
        userId: testUser._id,
        amount: -25,
        sourceId: new Types.ObjectId(),
        reason: 'Correction of accidental over-allocation',
      });

      expect(adj.balanceAfter).toBe(75);
      const user = await UserModel.findById(testUser._id);
      expect(user?.totalExpCached).toBe(75);

      // Excessive negative adjustment rejected
      await expect(
        expService.adjustExp({
          userId: testUser._id,
          amount: -100,
          sourceId: new Types.ObjectId(),
          reason: 'Excessive penalty',
        })
      ).rejects.toThrow(AppError);

      // Balance remains untouched
      const userAfter = await UserModel.findById(testUser._id);
      expect(userAfter?.totalExpCached).toBe(75);
    });

    it('should prove ledger sum equals cached balance with recomputeTotalExp()', async () => {
      await expService.awardExp({
        userId: testUser._id,
        amount: 30,
        sourceId: new Types.ObjectId(),
        reason: 'Task A',
      });
      await expService.awardExp({
        userId: testUser._id,
        amount: 60,
        sourceId: new Types.ObjectId(),
        reason: 'Task B',
      });
      await expService.awardExp({
        userId: testUser._id,
        amount: 100,
        sourceId: new Types.ObjectId(),
        reason: 'Task C',
      });

      const verification = await expService.recomputeTotalExp(testUser._id);
      expect(verification.isConsistent).toBe(true);
      expect(verification.ledgerTotal).toBe(190);
      expect(verification.cachedTotal).toBe(190);
    });

    it('should detect inconsistency and optionally synchronize cached balance', async () => {
      await expService.awardExp({
        userId: testUser._id,
        amount: 50,
        sourceId: new Types.ObjectId(),
        reason: 'Initial task',
      });

      // Artificially corrupt user cache to test detection
      await UserModel.updateOne({ _id: testUser._id }, { $set: { totalExpCached: 999 } });

      const checkBefore = await expService.recomputeTotalExp(testUser._id, false);
      expect(checkBefore.isConsistent).toBe(false);
      expect(checkBefore.ledgerTotal).toBe(50);
      expect(checkBefore.cachedTotal).toBe(999);

      // Synchronize
      const checkAfter = await expService.recomputeTotalExp(testUser._id, true);
      expect(checkAfter.ledgerTotal).toBe(50);
      const restoredUser = await UserModel.findById(testUser._id);
      expect(restoredUser?.totalExpCached).toBe(50);
    });

    it('should prevent modification or deletion of expTransactions ledger records', async () => {
      const res = await expService.awardExp({
        userId: testUser._id,
        amount: 30,
        sourceId: taskId,
        reason: 'Tamper test',
      });

      await expect(
        ExpTransactionModel.updateOne({ _id: res.transaction._id }, { amount: 500 })
      ).rejects.toThrow(/immutable/i);

      await expect(ExpTransactionModel.deleteOne({ _id: res.transaction._id })).rejects.toThrow(
        /immutable/i
      );
    });
  });

  describe('CorpCoinService & corpCoinTransactions Ledger', () => {
    it('should credit CorpCoin, record ledger entry, and update cached balance', async () => {
      const res1 = await corpCoinService.credit({
        userId: testUser._id,
        amount: 1000,
        type: 'FOUNDER_STARTER_GRANT',
        reason: 'Unlocked Founder Mode starter capital',
      });

      expect(res1.balanceAfter).toBe(1000);
      expect(res1.transaction.amount).toBe(1000);
      expect(res1.transaction.balanceAfter).toBe(1000);

      const user = await UserModel.findById(testUser._id);
      expect(user?.corpCoinBalanceCached).toBe(1000);

      const tx = await CorpCoinTransactionModel.findById(res1.transaction._id);
      expect(tx?.amount).toBe(1000);
      expect(tx?.type).toBe('FOUNDER_STARTER_GRANT');
    });

    it('should debit CorpCoin and record negative amount in ledger', async () => {
      await corpCoinService.credit({
        userId: testUser._id,
        amount: 1000,
        type: 'FOUNDER_STARTER_GRANT',
        reason: 'Starter funds',
      });

      const debitRes = await corpCoinService.debit({
        userId: testUser._id,
        amount: 100,
        type: 'COMPANY_CREATION',
        reason: 'Founded NexusTech LLC',
      });

      expect(debitRes.balanceAfter).toBe(900);
      expect(debitRes.transaction.amount).toBe(-100);
      expect(debitRes.transaction.balanceAfter).toBe(900);

      const user = await UserModel.findById(testUser._id);
      expect(user?.corpCoinBalanceCached).toBe(900);
    });

    it('should refuse a debit that would make balance negative', async () => {
      await corpCoinService.credit({
        userId: testUser._id,
        amount: 200,
        type: 'FOUNDER_STARTER_GRANT',
        reason: 'Starter balance',
      });

      // Try debiting 250 (more than available)
      await expect(
        corpCoinService.debit({
          userId: testUser._id,
          amount: 250,
          type: 'BOT_PURCHASE',
          reason: 'Purchase Basic Hiring Bot',
        })
      ).rejects.toThrow(AppError);

      // Verify balance remains exactly 200 and no debit transaction was recorded
      const user = await UserModel.findById(testUser._id);
      expect(user?.corpCoinBalanceCached).toBe(200);

      const txs = await CorpCoinTransactionModel.find({ userId: testUser._id });
      expect(txs).toHaveLength(1);
      expect(txs[0]?.amount).toBe(200);
    });

    it('should guarantee concurrent debits do not overdraw account', async () => {
      // Seed account with 100 CorpCoin
      await corpCoinService.credit({
        userId: testUser._id,
        amount: 100,
        type: 'FOUNDER_STARTER_GRANT',
        reason: 'Exact 100 funds',
      });

      // Run 5 simultaneous debits of 40 CorpCoin
      // Total requested = 200. With 100 available, ONLY 2 debits of 40 can succeed (80 total).
      // The other 3 MUST fail atomically with insufficient balance.
      const attempts = [1, 2, 3, 4, 5].map((i) =>
        corpCoinService.debit({
          userId: testUser._id,
          amount: 40,
          type: 'BUSINESS_EXPENSE',
          reason: `Concurrent operational charge #${i}`,
        })
      );

      const results = await Promise.allSettled(attempts);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(3);

      // Verify final balance is exactly 20 (100 - 40 - 40)
      const userFinal = await UserModel.findById(testUser._id);
      expect(userFinal?.corpCoinBalanceCached).toBe(20);

      // Verify ledger sum equals cached balance (100 - 40 - 40 = 20)
      const verification = await corpCoinService.recomputeCorpCoinBalance(testUser._id);
      expect(verification.isConsistent).toBe(true);
      expect(verification.ledgerTotal).toBe(20);
      expect(verification.cachedTotal).toBe(20);
    });

    it('should prove ledger sum equals cached balance with recomputeCorpCoinBalance()', async () => {
      await corpCoinService.credit({
        userId: testUser._id,
        amount: 1000,
        type: 'FOUNDER_STARTER_GRANT',
        reason: 'Grant',
      });
      await corpCoinService.debit({
        userId: testUser._id,
        amount: 100,
        type: 'COMPANY_CREATION',
        reason: 'Company',
      });
      await corpCoinService.debit({
        userId: testUser._id,
        amount: 250,
        type: 'BOT_PURCHASE',
        reason: 'Bot',
      });
      await corpCoinService.credit({
        userId: testUser._id,
        amount: 120,
        type: 'BUSINESS_REVENUE',
        reason: 'Client contract revenue',
      });

      // 1000 - 100 - 250 + 120 = 770
      const verification = await corpCoinService.recomputeCorpCoinBalance(testUser._id);
      expect(verification.isConsistent).toBe(true);
      expect(verification.ledgerTotal).toBe(770);
      expect(verification.cachedTotal).toBe(770);
    });

    it('should prevent modification or deletion of corpCoinTransactions ledger records', async () => {
      const res = await corpCoinService.credit({
        userId: testUser._id,
        amount: 500,
        type: 'FOUNDER_STARTER_GRANT',
        reason: 'Tamper test',
      });

      await expect(
        CorpCoinTransactionModel.updateOne({ _id: res.transaction._id }, { amount: 99999 })
      ).rejects.toThrow(/immutable/i);

      await expect(
        CorpCoinTransactionModel.deleteOne({ _id: res.transaction._id })
      ).rejects.toThrow(/immutable/i);
    });
  });
});
