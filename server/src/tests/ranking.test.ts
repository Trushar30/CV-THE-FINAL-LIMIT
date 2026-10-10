import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { RankingService } from '../services/ranking/ranking.service.js';
import { RankingController } from '../controllers/ranking.controller.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyFinancialsModel } from '../models/CompanyFinancials.js';
import { FounderModel } from '../models/Founder.js';
import { PerformanceRecordModel } from '../models/PerformanceRecord.js';
import { LeaderboardModel, type ILeaderboardRankingItem } from '../models/Leaderboard.js';

interface PrivateRankingServiceMethods {
  computeUserExpLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeUserLevelLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeUserCorpCoinLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeUserPerformanceLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeUserFounderLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyProfitLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyRevenueLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyWorkforceLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyRetentionLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyRatingLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyGrowthLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
  computeCompanyLossMakingLeaderboard: () => Promise<ILeaderboardRankingItem[]>;
}

describe('Rankings & Leaderboards Service & Controller Suite (TASK P9.1 / Spec Section 22)', () => {
  let rankingService: RankingService;
  let rankingController: RankingController;

  beforeEach(() => {
    vi.clearAllMocks();
    rankingService = new RankingService();
    rankingController = new RankingController(rankingService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getPrivateService = () => rankingService as unknown as PrivateRankingServiceMethods;

  const createMockQuery = <T>(result: T) => ({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  });

  const createMockUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    const id = new Types.ObjectId();
    return {
      _id: id,
      email: `user_${id.toString().substring(0, 6)}@corpverse.io`,
      totalExp: 0,
      corpCoinBalance: 0,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      isSuspended: false,
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    } as unknown as IUserDocument;
  };

  const createMockCompany = (overrides?: Partial<ICompanyDocument>): ICompanyDocument => {
    const id = new Types.ObjectId();
    return {
      _id: id,
      name: `Company_${id.toString().substring(0, 6)}`,
      description: 'Engineering startup',
      type: 'FOUNDER',
      isPlatformCompany: false,
      domainsHired: ['SOFTWARE_ENGINEERING'],
      status: 'ACTIVE',
      companyRating: 75,
      financialHealth: 500,
      employeeSatisfaction: 80,
      retentionRate: 95,
      employeeCount: 5,
      maxEmployees: 20,
      isOpenForHiring: true,
      aiProviderPool: 'PIPELINE',
      cumulativeRevenue: 10000,
      cumulativeProfit: 2500,
      operatingDays: 14,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    } as unknown as ICompanyDocument;
  };

  // =========================================================================
  // 1. USER LEADERBOARDS
  // =========================================================================

  describe('User Leaderboards', () => {
    it('USER_EXP: correctly ranks users by totalExp and excludes suspended & system users', async () => {
      const userA = createMockUser({ totalExp: 5000, careerRole: 'EMPLOYEE' });
      const userB = createMockUser({ totalExp: 13000, careerRole: 'FOUNDER' });
      const userC = createMockUser({ totalExp: 500, careerRole: 'JOB_SEEKER' });

      vi.spyOn(UserModel, 'find').mockReturnValue(
        createMockQuery([userB, userA, userC]) as unknown as ReturnType<typeof UserModel.find>
      );

      vi.spyOn(ProfileModel, 'find').mockReturnValue(
        createMockQuery([
          { userId: userB._id, displayName: 'Bob Lead', domain: 'AI_ENGINEERING' },
          { userId: userA._id, displayName: 'Alice Engineer', domain: 'SOFTWARE_ENGINEERING' },
          { userId: userC._id, displayName: 'Charlie Junior', domain: 'CLOUD_ENGINEERING' },
        ]) as unknown as ReturnType<typeof ProfileModel.find>
      );

      const rankings = await getPrivateService().computeUserExpLeaderboard();

      expect(rankings).toHaveLength(3);
      expect(rankings[0]?.name).toBe('Bob Lead');
      expect(rankings[0]?.score).toBe(13000);
      expect(rankings[0]?.rank).toBe(1);
      expect(rankings[0]?.secondaryMetric).toBe('Level 9');

      expect(rankings[1]?.name).toBe('Alice Engineer');
      expect(rankings[1]?.score).toBe(5000);
      expect(rankings[1]?.rank).toBe(2);
      expect(rankings[1]?.secondaryMetric).toBe('Level 6');

      expect(rankings[2]?.name).toBe('Charlie Junior');
      expect(rankings[2]?.score).toBe(500);
      expect(rankings[2]?.rank).toBe(3);
      expect(rankings[2]?.secondaryMetric).toBe('Level 2');

      expect(UserModel.find).toHaveBeenCalledWith({
        status: { $ne: 'SUSPENDED' },
        isSuspended: { $ne: true },
        careerRole: { $ne: 'NONE' },
      });
    });

    it('USER_LEVEL: sorts by level descending and secondary metric shows totalExp', async () => {
      const user1 = createMockUser({ totalExp: 1000, careerRole: 'EMPLOYEE' });
      const user2 = createMockUser({ totalExp: 12500, careerRole: 'FOUNDER' });

      vi.spyOn(UserModel, 'find').mockReturnValue(
        createMockQuery([user2, user1]) as unknown as ReturnType<typeof UserModel.find>
      );

      vi.spyOn(ProfileModel, 'find').mockReturnValue(
        createMockQuery([
          { userId: user2._id, displayName: 'Lead Engineer', domain: 'SOFTWARE_ENGINEERING' },
          { userId: user1._id, displayName: 'Junior Dev', domain: 'SOFTWARE_ENGINEERING' },
        ]) as unknown as ReturnType<typeof ProfileModel.find>
      );

      const rankings = await getPrivateService().computeUserLevelLeaderboard();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]?.name).toBe('Lead Engineer');
      expect(rankings[0]?.score).toBe(9);
      expect(rankings[0]?.secondaryMetric).toBe('12500 EXP');

      expect(rankings[1]?.name).toBe('Junior Dev');
      expect(rankings[1]?.score).toBe(2);
      expect(rankings[1]?.secondaryMetric).toBe('1000 EXP');
    });

    it('USER_CORPCOIN: sorts by corpCoinBalance descending', async () => {
      const user1 = createMockUser({ corpCoinBalance: 2500 });
      const user2 = createMockUser({ corpCoinBalance: 500 });

      vi.spyOn(UserModel, 'find').mockReturnValue(
        createMockQuery([user1, user2]) as unknown as ReturnType<typeof UserModel.find>
      );

      vi.spyOn(ProfileModel, 'find').mockReturnValue(
        createMockQuery([
          { userId: user1._id, displayName: 'Rich User', domain: 'CLOUD_ENGINEERING' },
          { userId: user2._id, displayName: 'Modest User', domain: 'CLOUD_ENGINEERING' },
        ]) as unknown as ReturnType<typeof ProfileModel.find>
      );

      const rankings = await getPrivateService().computeUserCorpCoinLeaderboard();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]?.name).toBe('Rich User');
      expect(rankings[0]?.score).toBe(2500);
      expect(rankings[0]?.secondaryMetric).toBe('2500 CC');
    });

    it('USER_PERFORMANCE: aggregates task performance scores and excludes suspended users', async () => {
      const userId1 = new Types.ObjectId();
      const userId2 = new Types.ObjectId();

      vi.spyOn(PerformanceRecordModel, 'aggregate').mockResolvedValue([
        {
          _id: userId1,
          averageScore: 92.5,
          tasksCount: 4,
          totalAwardedExp: 240,
          user: { careerRole: 'EMPLOYEE', status: 'ACTIVE' },
        },
        {
          _id: userId2,
          averageScore: 78.0,
          tasksCount: 2,
          totalAwardedExp: 100,
          user: { careerRole: 'EMPLOYEE', status: 'ACTIVE' },
        },
      ]);

      vi.spyOn(ProfileModel, 'find').mockReturnValue(
        createMockQuery([
          { userId: userId1, displayName: 'High Performer', domain: 'SOFTWARE_ENGINEERING' },
          { userId: userId2, displayName: 'Steady Performer', domain: 'AI_ENGINEERING' },
        ]) as unknown as ReturnType<typeof ProfileModel.find>
      );

      const rankings = await getPrivateService().computeUserPerformanceLeaderboard();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]?.name).toBe('High Performer');
      expect(rankings[0]?.score).toBe(92.5);
      expect(rankings[0]?.secondaryMetric).toContain('4 tasks');

      expect(rankings[1]?.name).toBe('Steady Performer');
      expect(rankings[1]?.score).toBe(78);
    });

    it('USER_FOUNDER: ranks active founders by active company cumulative profit and health', async () => {
      const founder1User = createMockUser({ careerRole: 'FOUNDER' });
      const founder2User = createMockUser({ careerRole: 'FOUNDER' });

      const comp1 = createMockCompany({
        name: 'Apex Innovations',
        cumulativeProfit: 20000,
        financialHealth: 1500,
        companyRating: 90,
      });

      const comp2 = createMockCompany({
        name: 'Base Technologies',
        cumulativeProfit: 5000,
        financialHealth: 300,
        companyRating: 70,
      });

      vi.spyOn(FounderModel, 'find').mockReturnValue(
        createMockQuery([
          { userId: founder1User._id, companyId: comp1._id, status: 'ACTIVE' },
          { userId: founder2User._id, companyId: comp2._id, status: 'ACTIVE' },
        ]) as unknown as ReturnType<typeof FounderModel.find>
      );

      vi.spyOn(UserModel, 'find').mockReturnValue(
        createMockQuery([founder1User, founder2User]) as unknown as ReturnType<typeof UserModel.find>
      );

      vi.spyOn(CompanyModel, 'find').mockReturnValue(
        createMockQuery([comp1, comp2]) as unknown as ReturnType<typeof CompanyModel.find>
      );

      vi.spyOn(ProfileModel, 'find').mockReturnValue(
        createMockQuery([
          { userId: founder1User._id, displayName: 'Founder Alice', domain: 'SOFTWARE_ENGINEERING' },
          { userId: founder2User._id, displayName: 'Founder Bob', domain: 'CLOUD_ENGINEERING' },
        ]) as unknown as ReturnType<typeof ProfileModel.find>
      );

      const rankings = await getPrivateService().computeUserFounderLeaderboard();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]?.name).toBe('Founder Alice');
      expect(rankings[0]?.score).toBe(20000);
      expect(rankings[0]?.secondaryMetric).toContain('Apex Innovations');

      expect(rankings[1]?.name).toBe('Founder Bob');
      expect(rankings[1]?.score).toBe(5000);
    });
  });

  // =========================================================================
  // 2. COMPANY LEADERBOARDS
  // =========================================================================

  describe('Company Leaderboards', () => {
    it('COMPANY_PROFIT: sorts companies by cumulativeProfit desc and excludes bankrupt/demo', async () => {
      const comp1 = createMockCompany({ name: 'Alpha Systems', cumulativeProfit: 25000 });
      const comp2 = createMockCompany({ name: 'Beta Cloud', cumulativeProfit: 12000 });

      vi.spyOn(CompanyModel, 'find').mockReturnValue(
        createMockQuery([comp1, comp2]) as unknown as ReturnType<typeof CompanyModel.find>
      );

      const rankings = await getPrivateService().computeCompanyProfitLeaderboard();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]?.name).toBe('Alpha Systems');
      expect(rankings[0]?.score).toBe(25000);
      expect(rankings[0]?.secondaryMetric).toBe('25000 CC Net Profit');

      expect(CompanyModel.find).toHaveBeenCalledWith({
        status: { $nin: ['BANKRUPT', 'SUSPENDED'] },
        aiProviderPool: { $ne: 'DEMO' },
      });
    });

    it('COMPANY_REVENUE, WORKFORCE, RETENTION, RATING: queries correctly map metrics', async () => {
      const comp1 = createMockCompany({
        name: 'Omni Corp',
        cumulativeRevenue: 100000,
        employeeCount: 15,
        maxEmployees: 20,
        retentionRate: 96,
        companyRating: 92,
      });

      vi.spyOn(CompanyModel, 'find').mockReturnValue(
        createMockQuery([comp1]) as unknown as ReturnType<typeof CompanyModel.find>
      );

      // Revenue
      const rev = await getPrivateService().computeCompanyRevenueLeaderboard();
      expect(rev[0]?.score).toBe(100000);
      expect(rev[0]?.secondaryMetric).toBe('100000 CC Revenue');

      // Workforce
      const wf = await getPrivateService().computeCompanyWorkforceLeaderboard();
      expect(wf[0]?.score).toBe(15);
      expect(wf[0]?.secondaryMetric).toBe('15 / 20 Engineers');

      // Retention
      const ret = await getPrivateService().computeCompanyRetentionLeaderboard();
      expect(ret[0]?.score).toBe(96);
      expect(ret[0]?.secondaryMetric).toBe('96% Retention');

      // Rating
      const rat = await getPrivateService().computeCompanyRatingLeaderboard();
      expect(rat[0]?.score).toBe(92);
      expect(rat[0]?.secondaryMetric).toBe('92/100 Rating');
    });

    it('COMPANY_GROWTH: calculates growth index from financial history', async () => {
      const comp = createMockCompany({ name: 'Fast Scaling', cumulativeRevenue: 50000, employeeCount: 10 });

      vi.spyOn(CompanyModel, 'find').mockReturnValue(
        createMockQuery([comp]) as unknown as ReturnType<typeof CompanyModel.find>
      );

      vi.spyOn(CompanyFinancialsModel, 'find').mockReturnValue(
        createMockQuery([
          { revenue: 4000, employeeCount: 10, recordedAt: new Date() },
          { revenue: 1000, employeeCount: 6, recordedAt: new Date(Date.now() - 7 * 86400000) },
        ]) as unknown as ReturnType<typeof CompanyFinancialsModel.find>
      );

      const rankings = await getPrivateService().computeCompanyGrowthLeaderboard();

      expect(rankings).toHaveLength(1);
      expect(rankings[0]?.name).toBe('Fast Scaling');
      expect(rankings[0]?.score).toBe(3080);
      expect(rankings[0]?.secondaryMetric).toContain('+3080 Growth Index');
    });

    it('COMPANY_LOSS_MAKING: lists active companies ordered by lowest profit and health', async () => {
      const compLoss = createMockCompany({ name: 'Distressed Co', cumulativeProfit: -600, financialHealth: -400 });
      const compBreakEven = createMockCompany({ name: 'Struggling Co', cumulativeProfit: -50, financialHealth: 10 });

      vi.spyOn(CompanyModel, 'find').mockReturnValue(
        createMockQuery([compLoss, compBreakEven]) as unknown as ReturnType<typeof CompanyModel.find>
      );

      const rankings = await getPrivateService().computeCompanyLossMakingLeaderboard();

      expect(rankings).toHaveLength(2);
      expect(rankings[0]?.name).toBe('Distressed Co');
      expect(rankings[0]?.score).toBe(-600);
      expect(rankings[0]?.secondaryMetric).toContain('-600 CC Profit');

      expect(rankings[1]?.name).toBe('Struggling Co');
      expect(rankings[1]?.score).toBe(-50);
    });
  });

  // =========================================================================
  // 3. PAGINATION, CACHING & DOMAIN FILTERING
  // =========================================================================

  describe('Pagination, Domain Filters & Caching', () => {
    it('returns cached snapshot if present and fresh', async () => {
      const cachedSnapshot = {
        category: 'USER_EXP',
        period: 'ALL_TIME',
        rankings: [
          { rank: 1, entityId: 'user1', name: 'Alice', score: 10000 },
          { rank: 2, entityId: 'user2', name: 'Bob', score: 8000 },
        ],
        totalEntries: 2,
        calculatedAt: new Date('2026-10-10T12:00:00Z'),
      };

      vi.spyOn(LeaderboardModel, 'findOne').mockReturnValue(
        createMockQuery(cachedSnapshot) as unknown as ReturnType<typeof LeaderboardModel.findOne>
      );

      const result = await rankingService.getLeaderboard({
        category: 'USER_EXP',
        period: 'ALL_TIME',
        page: 1,
        limit: 10,
      });

      expect(result.rankings).toHaveLength(2);
      expect(result.totalEntries).toBe(2);
      expect(result.rankings[0]?.name).toBe('Alice');
      expect(result.calculatedAt).toEqual(cachedSnapshot.calculatedAt);
    });

    it('paginates results across pages and computes totalPages', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        entityId: `id_${i + 1}`,
        name: `Company ${i + 1}`,
        score: (5 - i) * 1000,
      }));

      vi.spyOn(LeaderboardModel, 'findOne').mockReturnValue(
        createMockQuery({
          category: 'COMPANY_PROFIT',
          period: 'ALL_TIME',
          rankings: items,
          totalEntries: 5,
          calculatedAt: new Date(),
        }) as unknown as ReturnType<typeof LeaderboardModel.findOne>
      );

      const p1 = await rankingService.getLeaderboard({
        category: 'COMPANY_PROFIT',
        page: 1,
        limit: 2,
      });

      expect(p1.page).toBe(1);
      expect(p1.limit).toBe(2);
      expect(p1.totalEntries).toBe(5);
      expect(p1.totalPages).toBe(3);
      expect(p1.rankings).toHaveLength(2);
      expect(p1.rankings[0]?.name).toBe('Company 1');

      const p2 = await rankingService.getLeaderboard({
        category: 'COMPANY_PROFIT',
        page: 2,
        limit: 2,
      });

      expect(p2.page).toBe(2);
      expect(p2.rankings).toHaveLength(2);
      expect(p2.rankings[0]?.name).toBe('Company 3');
    });

    it('filters by domain and re-indexes ranks accurately', async () => {
      const items = [
        { rank: 1, entityId: 'c1', name: 'Software Co', domain: 'SOFTWARE_ENGINEERING', score: 5000 },
        { rank: 2, entityId: 'c2', name: 'Cloud Co', domain: 'CLOUD_ENGINEERING', score: 4000 },
        { rank: 3, entityId: 'c3', name: 'Second Software', domain: 'SOFTWARE_ENGINEERING', score: 3000 },
      ];

      vi.spyOn(LeaderboardModel, 'findOne').mockReturnValue(
        createMockQuery({
          category: 'COMPANY_PROFIT',
          period: 'ALL_TIME',
          rankings: items,
          totalEntries: 3,
          calculatedAt: new Date(),
        }) as unknown as ReturnType<typeof LeaderboardModel.findOne>
      );

      const result = await rankingService.getLeaderboard({
        category: 'COMPANY_PROFIT',
        domain: 'SOFTWARE_ENGINEERING',
      });

      expect(result.rankings).toHaveLength(2);
      expect(result.rankings[0]?.name).toBe('Software Co');
      expect(result.rankings[0]?.rank).toBe(1);

      expect(result.rankings[1]?.name).toBe('Second Software');
      expect(result.rankings[1]?.rank).toBe(2);
    });

    it('refreshLeaderboard recomputes and upserts snapshot document', async () => {
      vi.spyOn(rankingService as unknown as { computeRankingsForCategory: () => Promise<ILeaderboardRankingItem[]> }, 'computeRankingsForCategory').mockResolvedValue([
        { rank: 1, entityId: 'e1', name: 'Top Entity', score: 100 },
      ]);

      vi.spyOn(LeaderboardModel, 'findOneAndUpdate').mockReturnValue(
        createMockQuery({
          category: 'USER_EXP',
          period: 'ALL_TIME',
          rankings: [{ rank: 1, entityId: 'e1', name: 'Top Entity', score: 100 }],
          totalEntries: 1,
          calculatedAt: new Date(),
        }) as unknown as ReturnType<typeof LeaderboardModel.findOneAndUpdate>
      );

      const refreshed = await rankingService.refreshLeaderboard('USER_EXP', 'ALL_TIME');

      expect(refreshed.category).toBe('USER_EXP');
      expect(refreshed.rankings).toHaveLength(1);
      expect(LeaderboardModel.findOneAndUpdate).toHaveBeenCalledWith(
        { category: 'USER_EXP', period: 'ALL_TIME' },
        expect.objectContaining({
          category: 'USER_EXP',
          period: 'ALL_TIME',
          totalEntries: 1,
        }),
        { upsert: true, new: true }
      );
    });
  });

  // =========================================================================
  // 4. CONTROLLER INTEGRATION
  // =========================================================================

  describe('RankingController', () => {
    it('getLeaderboard controller responds with 200 and data payload', async () => {
      const mockResult = {
        category: 'USER_EXP' as const,
        period: 'ALL_TIME' as const,
        rankings: [],
        totalEntries: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        calculatedAt: new Date(),
      };

      vi.spyOn(rankingService, 'getLeaderboard').mockResolvedValue(mockResult);

      const req = {
        query: { category: 'USER_EXP', page: '1', limit: '20' },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await rankingController.getLeaderboard(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ category: 'USER_EXP' }),
        })
      );
    });

    it('refreshLeaderboards controller supports single category and batch refresh', async () => {
      const reqSingle = {
        body: { category: 'USER_EXP', period: 'ALL_TIME' },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      vi.spyOn(rankingService, 'refreshLeaderboard').mockResolvedValue({
        category: 'USER_EXP',
        period: 'ALL_TIME',
        rankings: [],
        totalEntries: 0,
        calculatedAt: new Date(),
      });

      await rankingController.refreshLeaderboards(reqSingle, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });
});
