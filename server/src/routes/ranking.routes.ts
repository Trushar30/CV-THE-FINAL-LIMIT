import { Router } from 'express';
import { rankingController } from '../controllers/ranking.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  getLeaderboardQuerySchema,
  refreshLeaderboardSchema,
} from '../schemas/ranking.schema.js';

export const rankingRouter = Router();

// Visible to all authenticated roles
rankingRouter.get(
  '/',
  authenticateJwt,
  validate({ query: getLeaderboardQuerySchema }),
  (req, res, next) => {
    rankingController.getLeaderboard(req, res).catch(next);
  }
);

// Manual or automated cache refresh endpoint
rankingRouter.post(
  '/refresh',
  authenticateJwt,
  validate({ body: refreshLeaderboardSchema }),
  (req, res, next) => {
    rankingController.refreshLeaderboards(req, res).catch(next);
  }
);
