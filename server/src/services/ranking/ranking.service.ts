import { UserModel } from '../../models/User.js';
import { ProfileModel } from '../../models/Profile.js';
import { CompanyModel, ICompanyDocument } from '../../models/Company.js';
import { CompanyFinancialsModel } from '../../models/CompanyFinancials.js';
import { FounderModel } from '../../models/Founder.js';
import { PerformanceRecordModel } from '../../models/PerformanceRecord.js';
import {
  LeaderboardModel,
  ILeaderboardRankingItem,
} from '../../models/Leaderboard.js';
import { levelForExp } from '../economy/expEngine.js';
import {
  type CareerDomain,
  type LeaderboardCategory,
  type LeaderboardPeriod,
  LEADERBOARD_CATEGORIES,
} from '../../types/enums.js';
import { logger } from '../../utils/logger.js';

export interface GetLeaderboardOptions {
  category: LeaderboardCategory;
  period?: LeaderboardPeriod;
  page?: number;
  limit?: number;
  domain?: CareerDomain;
  forceRefresh?: boolean;
}

export interface PaginatedLeaderboardResult {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  rankings: ILeaderboardRankingItem[];
  totalEntries: number;
  page: number;
  limit: number;
  totalPages: number;
  calculatedAt: Date;
}

export class RankingService {
  /**
   * Retrieves a paginated leaderboard snapshot for the specified category and period.
   * If no cached snapshot exists or forceRefresh is true, computes and persists a fresh snapshot.
   */
  public async getLeaderboard(
    options: GetLeaderboardOptions
  ): Promise<PaginatedLeaderboardResult> {
    const {
      category,
      period = 'ALL_TIME',
      page = 1,
      limit = 20,
      domain,
      forceRefresh = false,
    } = options;

    let snapshot: {
      category: LeaderboardCategory;
      period: LeaderboardPeriod;
      rankings: ILeaderboardRankingItem[];
      totalEntries: number;
      calculatedAt: Date;
    } | null = await LeaderboardModel.findOne({ category, period }).lean();

    if (!snapshot || forceRefresh) {
      snapshot = await this.refreshLeaderboard(category, period);
    }

    let items: ILeaderboardRankingItem[] = snapshot?.rankings ? [...snapshot.rankings] : [];

    // Optional domain filtering
    if (domain) {
      items = items.filter((item) => item.domain === domain);
      // Re-index ranks for filtered subset
      items = items.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
    }

    const totalEntries = items.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);
    const totalPages = Math.max(1, Math.ceil(totalEntries / limit));

    return {
      category,
      period,
      rankings: paginatedItems,
      totalEntries,
      page,
      limit,
      totalPages,
      calculatedAt: snapshot?.calculatedAt || new Date(),
    };
  }

  /**
   * Recomputes a single category leaderboard snapshot and saves it to the database.
   */
  public async refreshLeaderboard(
    category: LeaderboardCategory,
    period: LeaderboardPeriod = 'ALL_TIME'
  ): Promise<{
    category: LeaderboardCategory;
    period: LeaderboardPeriod;
    rankings: ILeaderboardRankingItem[];
    totalEntries: number;
    calculatedAt: Date;
  }> {
    const rankings = await this.computeRankingsForCategory(category, period);

    const doc = await LeaderboardModel.findOneAndUpdate(
      { category, period },
      {
        category,
        period,
        rankings,
        totalEntries: rankings.length,
        calculatedAt: new Date(),
      },
      { upsert: true, new: true }
    ).lean();

    logger.info(`[RankingService] Leaderboard snapshot refreshed for ${category}:${period} (${rankings.length} entries)`);

    return {
      category: doc?.category || category,
      period: doc?.period || period,
      rankings: doc?.rankings || rankings,
      totalEntries: doc?.totalEntries || rankings.length,
      calculatedAt: doc?.calculatedAt || new Date(),
    };
  }

  /**
   * Refreshes all 12 leaderboard categories in batch.
   */
  public async refreshAllLeaderboards(
    period: LeaderboardPeriod = 'ALL_TIME'
  ): Promise<void> {
    for (const category of LEADERBOARD_CATEGORIES) {
      try {
        await this.refreshLeaderboard(category, period);
      } catch (err: unknown) {
        logger.error(`[RankingService] Failed to refresh leaderboard for ${category}:`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    logger.info(`[RankingService] All leaderboards refreshed successfully for period: ${period}`);
  }

  /**
   * Pure deterministic calculation for a category from stored backend values only.
   * Excludes suspended users, bankrupt companies, and demo entities per spec section 22.
   */
  private async computeRankingsForCategory(
    category: LeaderboardCategory,
    _period: LeaderboardPeriod
  ): Promise<ILeaderboardRankingItem[]> {
    switch (category) {
      case 'USER_EXP':
        return this.computeUserExpLeaderboard();
      case 'USER_LEVEL':
        return this.computeUserLevelLeaderboard();
      case 'USER_CORPCOIN':
        return this.computeUserCorpCoinLeaderboard();
      case 'USER_PERFORMANCE':
        return this.computeUserPerformanceLeaderboard();
      case 'USER_FOUNDER':
        return this.computeUserFounderLeaderboard();
      case 'COMPANY_PROFIT':
        return this.computeCompanyProfitLeaderboard();
      case 'COMPANY_REVENUE':
        return this.computeCompanyRevenueLeaderboard();
      case 'COMPANY_WORKFORCE':
        return this.computeCompanyWorkforceLeaderboard();
      case 'COMPANY_RETENTION':
        return this.computeCompanyRetentionLeaderboard();
      case 'COMPANY_RATING':
        return this.computeCompanyRatingLeaderboard();
      case 'COMPANY_GROWTH':
        return this.computeCompanyGrowthLeaderboard();
      case 'COMPANY_LOSS_MAKING':
        return this.computeCompanyLossMakingLeaderboard();
      default:
        throw new Error(`Unsupported leaderboard category: ${category}`);
    }
  }

  // =========================================================================
  // USER LEADERBOARDS
  // =========================================================================

  private async computeUserExpLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const users = await UserModel.find({
      status: { $ne: 'SUSPENDED' },
      isSuspended: { $ne: true },
      careerRole: { $ne: 'NONE' },
    })
      .sort({ totalExp: -1, createdAt: 1 })
      .lean();

    const profiles = await ProfileModel.find({
      userId: { $in: users.map((u) => u._id) },
    }).lean();

    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    return users.map((user, idx) => {
      const profile = profileMap.get(user._id.toString());
      const level = levelForExp(user.totalExp || 0);
      return {
        rank: idx + 1,
        entityId: user._id.toString(),
        name: profile?.displayName || 'Anonymous Engineer',
        score: user.totalExp || 0,
        domain: profile?.domain,
        careerRole: user.careerRole,
        secondaryMetric: `Level ${level}`,
        details: {
          totalExp: user.totalExp || 0,
          level,
          corpCoinBalance: user.corpCoinBalance || 0,
        },
      };
    });
  }

  private async computeUserLevelLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const users = await UserModel.find({
      status: { $ne: 'SUSPENDED' },
      isSuspended: { $ne: true },
      careerRole: { $ne: 'NONE' },
    })
      .sort({ totalExp: -1, createdAt: 1 })
      .lean();

    const profiles = await ProfileModel.find({
      userId: { $in: users.map((u) => u._id) },
    }).lean();

    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const items = users.map((user) => {
      const profile = profileMap.get(user._id.toString());
      const level = levelForExp(user.totalExp || 0);
      return {
        entityId: user._id.toString(),
        name: profile?.displayName || 'Anonymous Engineer',
        score: level,
        domain: profile?.domain,
        careerRole: user.careerRole,
        secondaryMetric: `${user.totalExp || 0} EXP`,
        details: {
          level,
          totalExp: user.totalExp || 0,
        },
      };
    });

    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const expA = (a.details?.totalExp as number) || 0;
      const expB = (b.details?.totalExp as number) || 0;
      return expB - expA;
    });

    return items.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  private async computeUserCorpCoinLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const users = await UserModel.find({
      status: { $ne: 'SUSPENDED' },
      isSuspended: { $ne: true },
      careerRole: { $ne: 'NONE' },
    })
      .sort({ corpCoinBalance: -1, totalExp: -1, createdAt: 1 })
      .lean();

    const profiles = await ProfileModel.find({
      userId: { $in: users.map((u) => u._id) },
    }).lean();

    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    return users.map((user, idx) => {
      const profile = profileMap.get(user._id.toString());
      return {
        rank: idx + 1,
        entityId: user._id.toString(),
        name: profile?.displayName || 'Anonymous Engineer',
        score: user.corpCoinBalance || 0,
        domain: profile?.domain,
        careerRole: user.careerRole,
        secondaryMetric: `${user.corpCoinBalance || 0} CC`,
        details: {
          corpCoinBalance: user.corpCoinBalance || 0,
          totalExp: user.totalExp || 0,
        },
      };
    });
  }

  private async computeUserPerformanceLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const records = await PerformanceRecordModel.aggregate([
      {
        $match: {
          aiScore: { $gte: 0 },
        },
      },
      {
        $group: {
          _id: '$userId',
          averageScore: { $avg: '$aiScore' },
          tasksCount: { $sum: 1 },
          totalAwardedExp: { $sum: '$awardedExp' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $match: {
          'user.status': { $ne: 'SUSPENDED' },
          'user.isSuspended': { $ne: true },
          'user.careerRole': { $ne: 'NONE' },
        },
      },
      {
        $sort: {
          averageScore: -1,
          tasksCount: -1,
          _id: 1,
        },
      },
    ]);

    const userIds = records.map((r) => r._id);
    const profiles = await ProfileModel.find({ userId: { $in: userIds } }).lean();
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    return records.map((rec, idx) => {
      const profile = profileMap.get(rec._id.toString());
      const roundedScore = Math.round(rec.averageScore * 10) / 10;
      return {
        rank: idx + 1,
        entityId: rec._id.toString(),
        name: profile?.displayName || 'Anonymous Engineer',
        score: roundedScore,
        domain: profile?.domain,
        careerRole: rec.user.careerRole,
        secondaryMetric: `${rec.tasksCount} task${rec.tasksCount === 1 ? '' : 's'} (${roundedScore}/100)`,
        details: {
          averageScore: roundedScore,
          tasksCount: rec.tasksCount,
          totalAwardedExp: rec.totalAwardedExp,
        },
      };
    });
  }

  private async computeUserFounderLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const founders = await FounderModel.find({
      status: 'ACTIVE',
      companyId: { $ne: null },
    }).lean();

    if (founders.length === 0) return [];

    const founderUserIds = founders.map((f) => f.userId);
    const companyIds = founders.map((f) => f.companyId).filter(Boolean);

    const [users, companies, profiles] = await Promise.all([
      UserModel.find({
        _id: { $in: founderUserIds },
        status: { $ne: 'SUSPENDED' },
        isSuspended: { $ne: true },
      }).lean(),
      CompanyModel.find({
        _id: { $in: companyIds },
        status: { $ne: 'BANKRUPT' },
        aiProviderPool: { $ne: 'DEMO' },
      }).lean(),
      ProfileModel.find({
        userId: { $in: founderUserIds },
      }).lean(),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const items: ILeaderboardRankingItem[] = [];

    for (const founder of founders) {
      const user = userMap.get(founder.userId.toString());
      if (!user) continue;

      const company = founder.companyId ? companyMap.get(founder.companyId.toString()) : null;
      if (!company) continue;

      const profile = profileMap.get(founder.userId.toString());
      items.push({
        rank: 0,
        entityId: founder.userId.toString(),
        name: profile?.displayName || `${company.name} Founder`,
        score: company.cumulativeProfit,
        domain: profile?.domain || company.domainsHired?.[0],
        careerRole: 'FOUNDER',
        secondaryMetric: `${company.name} (${company.cumulativeProfit} CC Profit, Health: ${company.financialHealth})`,
        details: {
          companyId: company._id.toString(),
          companyName: company.name,
          cumulativeProfit: company.cumulativeProfit,
          financialHealth: company.financialHealth,
          companyRating: company.companyRating,
        },
      });
    }

    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const rA = (a.details?.companyRating as number) || 0;
      const rB = (b.details?.companyRating as number) || 0;
      if (rB !== rA) return rB - rA;
      const hA = (a.details?.financialHealth as number) || 0;
      const hB = (b.details?.financialHealth as number) || 0;
      return hB - hA;
    });

    return items.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  // =========================================================================
  // COMPANY LEADERBOARDS
  // =========================================================================

  private getActiveCompanyBaseFilter() {
    return {
      status: { $nin: ['BANKRUPT', 'SUSPENDED'] },
      aiProviderPool: { $ne: 'DEMO' },
    };
  }

  private mapCompanyItem(
    company: ICompanyDocument,
    score: number,
    secondaryMetric: string,
    details: Record<string, unknown> = {}
  ): ILeaderboardRankingItem {
    return {
      rank: 0,
      entityId: company._id.toString(),
      name: company.name,
      score,
      domain: company.domainsHired?.[0],
      isPlatformCompany: company.isPlatformCompany,
      companyRating: company.companyRating,
      secondaryMetric,
      details: {
        financialHealth: company.financialHealth,
        cumulativeProfit: company.cumulativeProfit,
        cumulativeRevenue: company.cumulativeRevenue,
        employeeCount: company.employeeCount,
        retentionRate: company.retentionRate,
        operatingDays: company.operatingDays,
        isPlatformCompany: company.isPlatformCompany,
        ...details,
      },
    };
  }

  private async computeCompanyProfitLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter())
      .sort({ cumulativeProfit: -1, companyRating: -1, createdAt: 1 })
      .lean();

    return companies.map((c, idx) => ({
      ...this.mapCompanyItem(
        c as unknown as ICompanyDocument,
        c.cumulativeProfit,
        `${c.cumulativeProfit} CC Net Profit`
      ),
      rank: idx + 1,
    }));
  }

  private async computeCompanyRevenueLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter())
      .sort({ cumulativeRevenue: -1, cumulativeProfit: -1, createdAt: 1 })
      .lean();

    return companies.map((c, idx) => ({
      ...this.mapCompanyItem(
        c as unknown as ICompanyDocument,
        c.cumulativeRevenue,
        `${c.cumulativeRevenue} CC Revenue`
      ),
      rank: idx + 1,
    }));
  }

  private async computeCompanyWorkforceLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter())
      .sort({ employeeCount: -1, retentionRate: -1, createdAt: 1 })
      .lean();

    return companies.map((c, idx) => ({
      ...this.mapCompanyItem(
        c as unknown as ICompanyDocument,
        c.employeeCount,
        `${c.employeeCount} / ${c.maxEmployees} Engineers`
      ),
      rank: idx + 1,
    }));
  }

  private async computeCompanyRetentionLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter())
      .sort({ retentionRate: -1, employeeCount: -1, createdAt: 1 })
      .lean();

    return companies.map((c, idx) => ({
      ...this.mapCompanyItem(
        c as unknown as ICompanyDocument,
        c.retentionRate,
        `${c.retentionRate}% Retention`
      ),
      rank: idx + 1,
    }));
  }

  private async computeCompanyRatingLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter())
      .sort({ companyRating: -1, cumulativeProfit: -1, createdAt: 1 })
      .lean();

    return companies.map((c, idx) => ({
      ...this.mapCompanyItem(
        c as unknown as ICompanyDocument,
        c.companyRating,
        `${c.companyRating}/100 Rating`
      ),
      rank: idx + 1,
    }));
  }

  private async computeCompanyGrowthLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter()).lean();

    const items = await Promise.all(
      companies.map(async (company) => {
        const recentFinancials = await CompanyFinancialsModel.find({ companyId: company._id })
          .sort({ recordedAt: -1 })
          .limit(7)
          .lean();

        let growthScore = 0;
        if (recentFinancials.length >= 2) {
          const newest = recentFinancials[0];
          const oldest = recentFinancials[recentFinancials.length - 1];
          const deltaRevenue = (newest?.revenue ?? 0) - (oldest?.revenue ?? 0);
          const deltaEmployees = (newest?.employeeCount ?? 0) - (oldest?.employeeCount ?? 0);
          growthScore = Math.max(0, deltaRevenue + deltaEmployees * 20);
        } else {
          const days = Math.max(company.operatingDays || 1, 1);
          growthScore = Math.round(
            (company.cumulativeRevenue / days) + (company.employeeCount * 15)
          );
        }

        return {
          ...this.mapCompanyItem(
            company as unknown as ICompanyDocument,
            growthScore,
            `+${growthScore} Growth Index`,
            { growthScore }
          ),
        };
      })
    );

    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const revA = (a.details?.cumulativeRevenue as number) || 0;
      const revB = (b.details?.cumulativeRevenue as number) || 0;
      return revB - revA;
    });

    return items.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  private async computeCompanyLossMakingLeaderboard(): Promise<ILeaderboardRankingItem[]> {
    const companies = await CompanyModel.find(this.getActiveCompanyBaseFilter())
      .sort({ cumulativeProfit: 1, financialHealth: 1, createdAt: 1 })
      .lean();

    return companies.map((c, idx) => ({
      ...this.mapCompanyItem(
        c as unknown as ICompanyDocument,
        c.cumulativeProfit,
        `${c.cumulativeProfit} CC Profit (Health: ${c.financialHealth})`
      ),
      rank: idx + 1,
    }));
  }
}

export const rankingService = new RankingService();
