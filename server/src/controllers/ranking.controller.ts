import { Request, Response } from 'express';
import { rankingService as defaultRankingService, RankingService } from '../services/ranking/ranking.service.js';
import {
  type GetLeaderboardQuery,
  type RefreshLeaderboardInput,
} from '../schemas/ranking.schema.js';

export class RankingController {
  constructor(private readonly rankingService: RankingService = defaultRankingService) {}

  public async getLeaderboard(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as GetLeaderboardQuery;

    const result = await this.rankingService.getLeaderboard({
      category: query.category,
      period: query.period,
      page: query.page,
      limit: query.limit,
      domain: query.domain,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  public async refreshLeaderboards(req: Request, res: Response): Promise<void> {
    const body = (req.body || {}) as RefreshLeaderboardInput;

    if (body.category) {
      const refreshed = await this.rankingService.refreshLeaderboard(
        body.category,
        body.period || 'ALL_TIME'
      );
      res.status(200).json({
        success: true,
        data: refreshed,
      });
      return;
    }

    await this.rankingService.refreshAllLeaderboards(body.period || 'ALL_TIME');

    res.status(200).json({
      success: true,
      message: 'All leaderboard categories refreshed successfully',
    });
  }
}

export const rankingController = new RankingController();
