import { Types } from 'mongoose';
import { UserModel } from '../models/User.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../models/CorpCoinTransaction.js';
import { ProfileModel } from '../models/Profile.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { CompanyBotModel } from '../models/CompanyBot.js';
import { ApplicationModel } from '../models/Application.js';
import { EmployeeTaskModel } from '../models/EmployeeTask.js';
import { WarningModel } from '../models/Warning.js';
import { ResumeFile } from '../models/ResumeFile.js';
import { ResumeAnalysis } from '../models/ResumeAnalysis.js';
import { FounderModel } from '../models/Founder.js';
import { NotificationModel } from '../models/Notification.js';
import { logger } from './logger.js';

export interface LedgerMismatch {
  userId: string;
  email: string;
  cachedValue: number;
  computedValue: number;
  discrepancy: number;
}

export interface OrphanReport {
  collection: string;
  count: number;
  sampleIds: string[];
}

export interface ConsistencyCheckResult {
  timestamp: string;
  totalUsersChecked: number;
  expMismatches: LedgerMismatch[];
  corpCoinMismatches: LedgerMismatch[];
  orphanReports: Record<string, OrphanReport>;
  totalOrphansFound: number;
  isConsistent: boolean;
  repairedCount?: number;
}

export interface ConsistencyCheckOptions {
  fix?: boolean;
}

export interface RelationalDoc {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | string | null;
  companyId?: Types.ObjectId | string | null;
  jobId?: Types.ObjectId | string | null;
  [key: string]: unknown;
}

/**
 * Validates that double-entry transaction ledgers equal cached balances
 * and identifies orphan records across all relational collections.
 */
export class ConsistencyChecker {
  /**
   * Run the full integrity audit across all collections.
   */
  public async runAudit(options: ConsistencyCheckOptions = {}): Promise<ConsistencyCheckResult> {
    const timestamp = new Date().toISOString();
    logger.info('[ConsistencyChecker] Starting integrity and orphan audit...');

    // 1. Verify EXP Ledgers
    const expMismatches = await this.checkExpLedgers(options.fix);

    // 2. Verify CorpCoin Ledgers
    const corpCoinMismatches = await this.checkCorpCoinLedgers(options.fix);

    // 3. Check Orphan Records
    const orphanReports = await this.checkOrphanRecords(options.fix);

    const totalOrphansFound = Object.values(orphanReports).reduce(
      (sum, report) => sum + report.count,
      0
    );

    const isConsistent =
      expMismatches.length === 0 &&
      corpCoinMismatches.length === 0 &&
      totalOrphansFound === 0;

    const totalUsersChecked = await UserModel.countDocuments();

    logger.info('[ConsistencyChecker] Audit completed', {
      totalUsersChecked,
      expMismatches: expMismatches.length,
      corpCoinMismatches: corpCoinMismatches.length,
      totalOrphansFound,
      isConsistent,
    });

    return {
      timestamp,
      totalUsersChecked,
      expMismatches,
      corpCoinMismatches,
      orphanReports,
      totalOrphansFound,
      isConsistent,
    };
  }

  /**
   * Compare users.totalExpCached against SUM(expTransactions.amount).
   */
  public async checkExpLedgers(fix = false): Promise<LedgerMismatch[]> {
    const mismatches: LedgerMismatch[] = [];

    // Aggregate total EXP per user directly from ledger
    const ledgerAggregates = await ExpTransactionModel.aggregate<{
      _id: Types.ObjectId;
      totalExp: number;
    }>([
      {
        $group: {
          _id: '$userId',
          totalExp: { $sum: '$amount' },
        },
      },
    ]);

    const ledgerMap = new Map<string, number>(
      ledgerAggregates.map((item) => [item._id.toString(), item.totalExp])
    );

    const users = await UserModel.find({}, { _id: 1, email: 1, totalExp: 1, totalExpCached: 1 });

    for (const user of users) {
      const computed = ledgerMap.get(user._id.toString()) ?? 0;
      const cached = user.totalExpCached ?? user.totalExp ?? 0;

      if (computed !== cached) {
        const discrepancy = cached - computed;
        mismatches.push({
          userId: user._id.toString(),
          email: user.email,
          cachedValue: cached,
          computedValue: computed,
          discrepancy,
        });

        if (fix) {
          await UserModel.updateOne(
            { _id: user._id },
            { $set: { totalExp: computed, totalExpCached: computed } }
          );
          logger.warn(`[ConsistencyChecker] Repaired EXP discrepancy for user ${user._id}: ${cached} -> ${computed}`);
        }
      }
    }

    return mismatches;
  }

  /**
   * Compare users.corpCoinBalanceCached against SUM(corpCoinTransactions.amount).
   */
  public async checkCorpCoinLedgers(fix = false): Promise<LedgerMismatch[]> {
    const mismatches: LedgerMismatch[] = [];

    // Aggregate total CorpCoin per user directly from ledger
    const ledgerAggregates = await CorpCoinTransactionModel.aggregate<{
      _id: Types.ObjectId;
      totalBalance: number;
    }>([
      {
        $group: {
          _id: '$userId',
          totalBalance: { $sum: '$amount' },
        },
      },
    ]);

    const ledgerMap = new Map<string, number>(
      ledgerAggregates.map((item) => [item._id.toString(), item.totalBalance])
    );

    const users = await UserModel.find({}, { _id: 1, email: 1, corpCoinBalance: 1, corpCoinBalanceCached: 1 });

    for (const user of users) {
      const computed = ledgerMap.get(user._id.toString()) ?? 0;
      const cached = user.corpCoinBalanceCached ?? user.corpCoinBalance ?? 0;

      if (computed !== cached) {
        const discrepancy = cached - computed;
        mismatches.push({
          userId: user._id.toString(),
          email: user.email,
          cachedValue: cached,
          computedValue: computed,
          discrepancy,
        });

        if (fix) {
          await UserModel.updateOne(
            { _id: user._id },
            { $set: { corpCoinBalance: computed, corpCoinBalanceCached: computed } }
          );
          logger.warn(`[ConsistencyChecker] Repaired CorpCoin discrepancy for user ${user._id}: ${cached} -> ${computed}`);
        }
      }
    }

    return mismatches;
  }

  /**
   * Audit all foreign keys for missing parent documents.
   */
  public async checkOrphanRecords(fix = false): Promise<Record<string, OrphanReport>> {
    const reports: Record<string, OrphanReport> = {};

    // Get all valid User IDs
    const userDocs = await UserModel.find({}, { _id: 1 });
    const validUserIds = new Set(userDocs.map((u) => u._id.toString()));

    // Get all valid Company IDs
    const companyDocs = await CompanyModel.find({}, { _id: 1 });
    const validCompanyIds = new Set(companyDocs.map((c) => c._id.toString()));

    // Get all valid Job IDs
    const jobDocs = await CompanyJobModel.find({}, { _id: 1 });
    const validJobIds = new Set(jobDocs.map((j) => j._id.toString()));

    // 1. Profiles without valid User
    reports.profiles = await this.auditCollectionForOrphans(
      ProfileModel,
      'profiles',
      (doc) => !doc.userId || !validUserIds.has(doc.userId.toString()),
      fix
    );

    // 2. CompanyEmployees without valid User or Company
    reports.companyEmployees = await this.auditCollectionForOrphans(
      CompanyEmployeeModel,
      'companyEmployees',
      (doc) =>
        !doc.userId ||
        !validUserIds.has(doc.userId.toString()) ||
        !doc.companyId ||
        !validCompanyIds.has(doc.companyId.toString()),
      fix
    );

    // 3. Applications without valid User, Company, or Job
    reports.applications = await this.auditCollectionForOrphans(
      ApplicationModel,
      'applications',
      (doc) =>
        !doc.userId ||
        !validUserIds.has(doc.userId.toString()) ||
        !doc.companyId ||
        !validCompanyIds.has(doc.companyId.toString()) ||
        !doc.jobId ||
        !validJobIds.has(doc.jobId.toString()),
      fix
    );

    // 4. EmployeeTasks without valid User or Company
    reports.employeeTasks = await this.auditCollectionForOrphans(
      EmployeeTaskModel,
      'employeeTasks',
      (doc) =>
        !doc.userId ||
        !validUserIds.has(doc.userId.toString()) ||
        !doc.companyId ||
        !validCompanyIds.has(doc.companyId.toString()),
      fix
    );

    // 5. Warnings without valid User or Company
    reports.warnings = await this.auditCollectionForOrphans(
      WarningModel,
      'warnings',
      (doc) =>
        !doc.userId ||
        !validUserIds.has(doc.userId.toString()) ||
        !doc.companyId ||
        !validCompanyIds.has(doc.companyId.toString()),
      fix
    );

    // 6. CompanyBots without valid Company
    reports.companyBots = await this.auditCollectionForOrphans(
      CompanyBotModel,
      'companyBots',
      (doc) => !doc.companyId || !validCompanyIds.has(doc.companyId.toString()),
      fix
    );

    // 7. CompanyJobs without valid Company
    reports.companyJobs = await this.auditCollectionForOrphans(
      CompanyJobModel,
      'companyJobs',
      (doc) => !doc.companyId || !validCompanyIds.has(doc.companyId.toString()),
      fix
    );

    // 8. ResumeFiles without valid User
    reports.resumeFiles = await this.auditCollectionForOrphans(
      ResumeFile,
      'resumeFiles',
      (doc) => !doc.userId || !validUserIds.has(doc.userId.toString()),
      fix
    );

    // 9. ResumeAnalyses without valid User
    reports.resumeAnalyses = await this.auditCollectionForOrphans(
      ResumeAnalysis,
      'resumeAnalyses',
      (doc) => !doc.userId || !validUserIds.has(doc.userId.toString()),
      fix
    );

    // 10. Founders without valid User
    reports.founders = await this.auditCollectionForOrphans(
      FounderModel,
      'founders',
      (doc) => !doc.userId || !validUserIds.has(doc.userId.toString()),
      fix
    );

    // 11. Notifications without valid User
    reports.notifications = await this.auditCollectionForOrphans(
      NotificationModel,
      'notifications',
      (doc) => !doc.userId || !validUserIds.has(doc.userId.toString()),
      fix
    );

    return reports;
  }

  private async auditCollectionForOrphans(
    model: { find: (query: Record<string, unknown>) => unknown; deleteMany?: (query: Record<string, unknown>) => unknown },
    collectionName: string,
    isOrphan: (doc: RelationalDoc) => boolean,
    fix = false
  ): Promise<OrphanReport> {
    const rawDocs = await (model.find({}) as Promise<unknown[]>);
    const docs = rawDocs as RelationalDoc[];
    const orphanIds: string[] = [];

    for (const doc of docs) {
      if (isOrphan(doc)) {
        orphanIds.push(doc._id.toString());
      }
    }

    if (fix && orphanIds.length > 0 && model.deleteMany) {
      await model.deleteMany({ _id: { $in: orphanIds.map((id) => new Types.ObjectId(id)) } });
      logger.warn(`[ConsistencyChecker] Removed ${orphanIds.length} orphan records from ${collectionName}`);
    }

    return {
      collection: collectionName,
      count: orphanIds.length,
      sampleIds: orphanIds.slice(0, 10),
    };
  }
}

export const consistencyChecker = new ConsistencyChecker();
