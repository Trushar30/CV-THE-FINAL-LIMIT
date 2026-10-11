import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { consistencyChecker } from '../utils/consistencyChecker.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../models/CorpCoinTransaction.js';
import { ProfileModel } from '../models/Profile.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { ApplicationModel } from '../models/Application.js';
import { EmployeeTaskModel } from '../models/EmployeeTask.js';
import { WarningModel } from '../models/Warning.js';
import { CompanyBotModel } from '../models/CompanyBot.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { ResumeFile } from '../models/ResumeFile.js';
import { ResumeAnalysis } from '../models/ResumeAnalysis.js';
import { FounderModel } from '../models/Founder.js';
import { NotificationModel } from '../models/Notification.js';

describe('TASK P10.3: Database Consistency Checker & Orphan Records Audit Suite', () => {
  const user1Id = new Types.ObjectId();
  const user2Id = new Types.ObjectId();
  const company1Id = new Types.ObjectId();
  const job1Id = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Double-Entry Ledger Consistency Audit', () => {
    it('detects and flags EXP cached balance discrepancies against double-entry ledger transactions', async () => {
      // User 1: 500 cached vs 500 computed -> MATCH
      // User 2: 1200 cached vs 800 computed -> MISMATCH (400 difference)
      const mockUsers = [
        {
          _id: user1Id,
          email: 'user1@example.com',
          totalExp: 500,
          totalExpCached: 500,
        },
        {
          _id: user2Id,
          email: 'user2@example.com',
          totalExp: 1200,
          totalExpCached: 1200,
        },
      ];

      vi.spyOn(ExpTransactionModel, 'aggregate').mockResolvedValue([
        { _id: user1Id, totalExp: 500 },
        { _id: user2Id, totalExp: 800 },
      ] as never);

      vi.spyOn(UserModel, 'find').mockResolvedValue(mockUsers as unknown as IUserDocument[]);
      const updateOneSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      // Audit without fix
      const mismatches = await consistencyChecker.checkExpLedgers(false);

      expect(mismatches.length).toBe(1);
      expect(mismatches[0]?.userId).toBe(user2Id.toString());
      expect(mismatches[0]?.cachedValue).toBe(1200);
      expect(mismatches[0]?.computedValue).toBe(800);
      expect(mismatches[0]?.discrepancy).toBe(400);
      expect(updateOneSpy).not.toHaveBeenCalled();

      // Audit with fix enabled
      const repairedMismatches = await consistencyChecker.checkExpLedgers(true);
      expect(repairedMismatches.length).toBe(1);
      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: user2Id },
        { $set: { totalExp: 800, totalExpCached: 800 } }
      );
    });

    it('detects and flags CorpCoin cached balance discrepancies against transaction ledgers', async () => {
      // User 1: 1000 cached vs 1000 computed -> MATCH
      // User 2: 750 cached vs 250 computed -> MISMATCH (500 difference)
      const mockUsers = [
        {
          _id: user1Id,
          email: 'founder1@example.com',
          corpCoinBalance: 1000,
          corpCoinBalanceCached: 1000,
        },
        {
          _id: user2Id,
          email: 'founder2@example.com',
          corpCoinBalance: 750,
          corpCoinBalanceCached: 750,
        },
      ];

      vi.spyOn(CorpCoinTransactionModel, 'aggregate').mockResolvedValue([
        { _id: user1Id, totalBalance: 1000 },
        { _id: user2Id, totalBalance: 250 },
      ] as never);

      vi.spyOn(UserModel, 'find').mockResolvedValue(mockUsers as unknown as IUserDocument[]);
      const updateOneSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      // Audit without fix
      const mismatches = await consistencyChecker.checkCorpCoinLedgers(false);

      expect(mismatches.length).toBe(1);
      expect(mismatches[0]?.userId).toBe(user2Id.toString());
      expect(mismatches[0]?.cachedValue).toBe(750);
      expect(mismatches[0]?.computedValue).toBe(250);
      expect(mismatches[0]?.discrepancy).toBe(500);
      expect(updateOneSpy).not.toHaveBeenCalled();

      // Audit with fix enabled
      await consistencyChecker.checkCorpCoinLedgers(true);
      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: user2Id },
        { $set: { corpCoinBalance: 250, corpCoinBalanceCached: 250 } }
      );
    });
  });

  describe('2. Orphan Records Audit across Relational Collections', () => {
    it('detects and reports orphan records referencing non-existent parent documents', async () => {
      // Only user1Id and company1Id exist in database
      vi.spyOn(UserModel, 'find').mockResolvedValue([{ _id: user1Id }] as unknown as IUserDocument[]);
      vi.spyOn(CompanyModel, 'find').mockResolvedValue([{ _id: company1Id }] as never);
      vi.spyOn(CompanyJobModel, 'find').mockResolvedValue([{ _id: job1Id, companyId: company1Id }] as never);

      const nonExistentUserId = new Types.ObjectId();
      const nonExistentCompanyId = new Types.ObjectId();

      // 1. Orphan Profile (userId points to nonExistentUserId)
      vi.spyOn(ProfileModel, 'find').mockResolvedValue([
        { _id: new Types.ObjectId(), userId: user1Id },
        { _id: new Types.ObjectId(), userId: nonExistentUserId },
      ] as never);

      // 2. Orphan CompanyEmployee (companyId points to nonExistentCompanyId)
      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([
        { _id: new Types.ObjectId(), userId: user1Id, companyId: company1Id },
        { _id: new Types.ObjectId(), userId: user1Id, companyId: nonExistentCompanyId },
      ] as never);

      // 3. Orphan CompanyBot
      vi.spyOn(CompanyBotModel, 'find').mockResolvedValue([
        { _id: new Types.ObjectId(), companyId: nonExistentCompanyId },
      ] as never);

      // 4. Other collections with zero orphans
      vi.spyOn(ApplicationModel, 'find').mockResolvedValue([] as never);
      vi.spyOn(EmployeeTaskModel, 'find').mockResolvedValue([] as never);
      vi.spyOn(WarningModel, 'find').mockResolvedValue([] as never);
      vi.spyOn(ResumeFile, 'find').mockResolvedValue([] as never);
      vi.spyOn(ResumeAnalysis, 'find').mockResolvedValue([] as never);
      vi.spyOn(FounderModel, 'find').mockResolvedValue([] as never);
      vi.spyOn(NotificationModel, 'find').mockResolvedValue([] as never);

      const deleteProfilesSpy = vi.spyOn(ProfileModel, 'deleteMany').mockResolvedValue({} as never);
      const deleteEmployeesSpy = vi.spyOn(CompanyEmployeeModel, 'deleteMany').mockResolvedValue({} as never);
      const deleteBotsSpy = vi.spyOn(CompanyBotModel, 'deleteMany').mockResolvedValue({} as never);
      vi.spyOn(CompanyJobModel, 'deleteMany').mockResolvedValue({} as never);

      const orphanReports = await consistencyChecker.checkOrphanRecords(false);

      expect(orphanReports.profiles.count).toBe(1);
      expect(orphanReports.companyEmployees.count).toBe(1);
      expect(orphanReports.companyBots.count).toBe(1);
      expect(orphanReports.applications.count).toBe(0);

      expect(deleteProfilesSpy).not.toHaveBeenCalled();
      expect(deleteEmployeesSpy).not.toHaveBeenCalled();
      expect(deleteBotsSpy).not.toHaveBeenCalled();

      // Run with fix = true to clean up orphans
      const repairedReports = await consistencyChecker.checkOrphanRecords(true);
      expect(repairedReports.profiles.count).toBe(1);
      expect(deleteProfilesSpy).toHaveBeenCalledTimes(1);
      expect(deleteEmployeesSpy).toHaveBeenCalledTimes(1);
      expect(deleteBotsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Overall System Consistency Status', () => {
    it('returns isConsistent: true when all ledgers match and zero orphans exist', async () => {
      vi.spyOn(ExpTransactionModel, 'aggregate').mockResolvedValue([]);
      vi.spyOn(CorpCoinTransactionModel, 'aggregate').mockResolvedValue([]);
      vi.spyOn(UserModel, 'find').mockResolvedValue([]);
      vi.spyOn(UserModel, 'countDocuments').mockResolvedValue(0 as never);
      vi.spyOn(CompanyModel, 'find').mockResolvedValue([]);
      vi.spyOn(CompanyJobModel, 'find').mockResolvedValue([]);
      vi.spyOn(ProfileModel, 'find').mockResolvedValue([]);
      vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([]);
      vi.spyOn(ApplicationModel, 'find').mockResolvedValue([]);
      vi.spyOn(EmployeeTaskModel, 'find').mockResolvedValue([]);
      vi.spyOn(WarningModel, 'find').mockResolvedValue([]);
      vi.spyOn(CompanyBotModel, 'find').mockResolvedValue([]);
      vi.spyOn(ResumeFile, 'find').mockResolvedValue([]);
      vi.spyOn(ResumeAnalysis, 'find').mockResolvedValue([]);
      vi.spyOn(FounderModel, 'find').mockResolvedValue([]);
      vi.spyOn(NotificationModel, 'find').mockResolvedValue([]);

      const result = await consistencyChecker.runAudit();

      expect(result.isConsistent).toBe(true);
      expect(result.expMismatches.length).toBe(0);
      expect(result.corpCoinMismatches.length).toBe(0);
      expect(result.totalOrphansFound).toBe(0);
    });
  });
});
