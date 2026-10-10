import { FilterQuery, Types } from 'mongoose';
import { UserModel } from '../../models/User.js';
import { ProfileModel } from '../../models/Profile.js';
import { ApplicationModel } from '../../models/Application.js';
import { FeedbackModel } from '../../models/Feedback.js';
import { EmployeeTaskModel } from '../../models/EmployeeTask.js';
import { TaskSubmissionModel } from '../../models/TaskSubmission.js';
import { PerformanceRecordModel } from '../../models/PerformanceRecord.js';
import { ExpTransactionModel } from '../../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../../models/CorpCoinTransaction.js';
import { CompanyModel } from '../../models/Company.js';
import { CompanyEmployeeModel } from '../../models/CompanyEmployee.js';
import { CompanyFinancialsModel } from '../../models/CompanyFinancials.js';
import { AIRequestLogModel, IAIRequestLogDocument } from '../../models/AIRequestLog.js';
import { AIResponseLogModel } from '../../models/AIResponseLog.js';
import { AIJobModel, IAIJobDocument } from '../../models/AIJob.js';
import { AuditLogModel, IAuditLogDocument } from '../../models/AuditLog.js';
import {
  BoundedDateRangeInput,
  resolveDateRange,
  AuditLogsViewerQueryInput,
  AiLogsViewerQueryInput,
  AiQueueViewerQueryInput,
} from '../../schemas/analytics.schema.js';

export class AnalyticsService {
  /**
   * 1. User Analytics: Counts by role/domain and registration trends over bounded date ranges.
   */
  public async getUserAnalytics(query?: BoundedDateRangeInput) {
    const { startDate, endDate } = resolveDateRange(query);

    const [totalUsers, activeUsers, suspendedUsers, byRole, byPlatformRole, byDomain, registrationTrends] =
      await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({ status: 'ACTIVE' }),
        UserModel.countDocuments({ status: 'SUSPENDED' }),
        UserModel.aggregate([{ $group: { _id: '$careerRole', count: { $sum: 1 } } }]),
        UserModel.aggregate([{ $group: { _id: '$platformRole', count: { $sum: 1 } } }]),
        ProfileModel.aggregate([
          { $match: { domain: { $ne: null } } },
          { $group: { _id: '$domain', count: { $sum: 1 } } },
        ]),
        UserModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    return {
      totals: {
        totalUsers,
        activeUsers,
        suspendedUsers,
      },
      byRole: byRole.map((r) => ({ role: r._id, count: r.count })),
      byPlatformRole: byPlatformRole.map((r) => ({ role: r._id, count: r.count })),
      byDomain: byDomain.map((d) => ({ domain: d._id, count: d.count })),
      registrationTrends: registrationTrends.map((t) => ({ date: t._id, count: t.count })),
      dateRange: { startDate, endDate },
    };
  }

  /**
   * 2. Application Analytics: Funnel by stage, status, and rejection reasons.
   */
  public async getApplicationAnalytics(query?: BoundedDateRangeInput) {
    const { startDate, endDate } = resolveDateRange(query);

    const [totalApplications, byStatus, byStage, rejectionReasons, topMissingSkills] =
      await Promise.all([
        ApplicationModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        ApplicationModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        ApplicationModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$currentStage', count: { $sum: 1 } } },
        ]),
        FeedbackModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$rejectionStage', count: { $sum: 1 } } },
        ]),
        FeedbackModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $unwind: '$weaknesses' },
          { $group: { _id: '$weaknesses', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    return {
      totalApplications,
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      byStage: byStage.map((s) => ({ stage: s._id, count: s.count })),
      rejectionReasons: rejectionReasons.map((r) => ({ stage: r._id, count: r.count })),
      topMissingSkills: topMissingSkills.map((s) => ({ skill: s._id, count: s.count })),
      dateRange: { startDate, endDate },
    };
  }

  /**
   * 3. Task Analytics: Total tasks, submission rate, and average evaluation scores.
   */
  public async getTaskAnalytics(query?: BoundedDateRangeInput) {
    const { startDate, endDate } = resolveDateRange(query);

    const [totalTasks, totalSubmissions, byDifficulty, scoreStats, byScoreBand, dailyScoreTrend] =
      await Promise.all([
        EmployeeTaskModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        TaskSubmissionModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        EmployeeTaskModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        ]),
        PerformanceRecordModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: null,
              avgScore: { $avg: '$score' },
              minScore: { $min: '$score' },
              maxScore: { $max: '$score' },
              totalEvaluations: { $sum: 1 },
            },
          },
        ]),
        PerformanceRecordModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$scoreBand', count: { $sum: 1 } } },
        ]),
        PerformanceRecordModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              avgScore: { $avg: '$score' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const submissionRate =
      totalTasks > 0 ? Number(((totalSubmissions / totalTasks) * 100).toFixed(1)) : 0;
    const avgScore = scoreStats[0]?.avgScore ? Number(scoreStats[0].avgScore.toFixed(1)) : 0;

    return {
      totalTasks,
      totalSubmissions,
      submissionRate,
      averageScore: avgScore,
      scoreStats: scoreStats[0] || null,
      byDifficulty: byDifficulty.map((d) => ({ difficulty: d._id, count: d.count })),
      byScoreBand: byScoreBand.map((b) => ({ band: b._id, count: b.count })),
      dailyScoreTrend: dailyScoreTrend.map((t) => ({
        date: t._id,
        avgScore: Number(t.avgScore.toFixed(1)),
        count: t.count,
      })),
      dateRange: { startDate, endDate },
    };
  }

  /**
   * 4. Economy Analytics: EXP and CorpCoin in circulation, ledger transaction volume.
   */
  public async getEconomyAnalytics(query?: BoundedDateRangeInput) {
    const { startDate, endDate } = resolveDateRange(query);

    const [expCirculation, coinCirculation, expTransactions, coinTransactions] = await Promise.all([
      UserModel.aggregate([
        { $group: { _id: null, totalExp: { $sum: '$totalExp' } } },
      ]),
      UserModel.aggregate([
        { $group: { _id: null, totalCorpCoin: { $sum: '$corpCoinBalance' } } },
      ]),
      ExpTransactionModel.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      CorpCoinTransactionModel.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    return {
      circulation: {
        totalExpCirculation: expCirculation[0]?.totalExp || 0,
        totalCorpCoinCirculation: coinCirculation[0]?.totalCorpCoin || 0,
      },
      expTransactions: expTransactions.map((t) => ({
        type: t._id,
        totalAmount: t.totalAmount,
        count: t.count,
      })),
      corpCoinTransactions: coinTransactions.map((t) => ({
        type: t._id,
        totalAmount: t.totalAmount,
        count: t.count,
      })),
      dateRange: { startDate, endDate },
    };
  }

  /**
   * 5. Company Analytics: Corporate entity counts, active workforce, and financial aggregates.
   */
  public async getCompanyAnalytics(query?: BoundedDateRangeInput) {
    const { startDate, endDate } = resolveDateRange(query);

    const [byStatus, totalEmployees, financialAggregates] = await Promise.all([
      CompanyModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      CompanyEmployeeModel.countDocuments({
        status: { $in: ['ACTIVE', 'PROBATION', 'UNDER_REVIEW'] },
      }),
      CompanyFinancialsModel.aggregate([
        { $match: { recordedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$dailyRevenue' },
            totalExpenses: { $sum: '$dailyExpenses' },
            totalProfit: { $sum: '$profit' },
            avgDailyRevenue: { $avg: '$dailyRevenue' },
            avgDailyExpenses: { $avg: '$dailyExpenses' },
            totalSimulationDaysRecorded: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      companiesByStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      totalActiveWorkforce: totalEmployees,
      financialOutcomes: financialAggregates[0] || {
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        avgDailyRevenue: 0,
        avgDailyExpenses: 0,
        totalSimulationDaysRecorded: 0,
      },
      dateRange: { startDate, endDate },
    };
  }

  /**
   * 6. AI Analytics: Request volume by provider/task, latency percentiles, error rates, queue depth.
   */
  public async getAiAnalytics(query?: BoundedDateRangeInput) {
    const { startDate, endDate } = resolveDateRange(query);

    const [byProvider, byTaskType, latencySummary, errorSummary, liveQueueDepth] =
      await Promise.all([
        AIRequestLogModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$providerCode', count: { $sum: 1 } } },
        ]),
        AIRequestLogModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$taskType', count: { $sum: 1 } } },
        ]),
        AIResponseLogModel.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: null,
              avgLatencyMs: { $avg: '$latencyMs' },
              minLatencyMs: { $min: '$latencyMs' },
              maxLatencyMs: { $max: '$latencyMs' },
              totalTokens: { $sum: '$totalTokens' },
              totalCalls: { $sum: 1 },
              successCalls: { $sum: { $cond: ['$success', 1, 0] } },
              failedCalls: { $sum: { $cond: ['$success', 0, 1] } },
            },
          },
        ]),
        AIResponseLogModel.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              success: false,
              errorCode: { $ne: null },
            },
          },
          { $group: { _id: '$errorCode', count: { $sum: 1 } } },
        ]),
        AIJobModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ]);

    const stats = latencySummary[0] || {
      avgLatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      totalTokens: 0,
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
    };

    const failureRate =
      stats.totalCalls > 0
        ? Number(((stats.failedCalls / stats.totalCalls) * 100).toFixed(1))
        : 0;

    return {
      requestsByProvider: byProvider.map((p) => ({ provider: p._id, count: p.count })),
      requestsByTaskType: byTaskType.map((t) => ({ taskType: t._id, count: t.count })),
      telemetry: {
        avgLatencyMs: Number(stats.avgLatencyMs.toFixed(1)),
        minLatencyMs: stats.minLatencyMs,
        maxLatencyMs: stats.maxLatencyMs,
        totalTokens: stats.totalTokens,
        totalCalls: stats.totalCalls,
        successCalls: stats.successCalls,
        failedCalls: stats.failedCalls,
        failureRate,
      },
      errorSummary: errorSummary.map((e) => ({ errorCode: e._id, count: e.count })),
      liveQueueDepth: liveQueueDepth.map((q) => ({ status: q._id, count: q.count })),
      dateRange: { startDate, endDate },
    };
  }

  /**
   * 7. Paginated Audit Logs Viewer.
   */
  public async getAuditLogsViewer(query: AuditLogsViewerQueryInput): Promise<{
    logs: IAuditLogDocument[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page, limit, actorId, actorRole, action, targetType, startDate, endDate } = query;
    const filter: FilterQuery<IAuditLogDocument> = {};

    if (actorId && Types.ObjectId.isValid(actorId)) {
      filter.actorId = new Types.ObjectId(actorId);
    }
    if (actorRole) filter.actorRole = actorRole;
    if (action) filter.action = action;
    if (targetType) filter.targetType = targetType;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditLogModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const logs = await AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      logs,
      pagination: { total, page, limit, totalPages },
    };
  }

  /**
   * 8. Paginated AI / System Logs Viewer.
   */
  public async getAiLogsViewer(query: AiLogsViewerQueryInput): Promise<{
    logs: IAIRequestLogDocument[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page, limit, providerCode, taskType, pool, startDate, endDate } = query;
    const filter: FilterQuery<IAIRequestLogDocument> = {};

    if (providerCode) filter.providerCode = providerCode;
    if (taskType) filter.taskType = taskType;
    if (pool) filter.pool = pool;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const total = await AIRequestLogModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const logs = await AIRequestLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      logs,
      pagination: { total, page, limit, totalPages },
    };
  }

  /**
   * 9. Paginated AI Background Queue Viewer.
   */
  public async getAiQueueViewer(query: AiQueueViewerQueryInput): Promise<{
    jobs: IAIJobDocument[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page, limit, status, pool, taskType } = query;
    const filter: FilterQuery<IAIJobDocument> = {};

    if (status) filter.status = status;
    if (pool) filter.pool = pool;
    if (taskType) filter.taskType = taskType;

    const total = await AIJobModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const jobs = await AIJobModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      jobs,
      pagination: { total, page, limit, totalPages },
    };
  }
}

export const analyticsService = new AnalyticsService();
