import type { Request, Response } from 'express';
import { simulationService } from '../services/simulation/simulation.service.js';
import { submitDecisionSchema } from '../schemas/simulation.schema.js';
import { AppError } from '../utils/errors.js';

export class SimulationController {
  public async getDailyScenario(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    const dateKey = req.query.date ? String(req.query.date) : undefined;
    const scenario = await simulationService.getDailyScenario(req.user._id, dateKey);
    res.status(200).json({ scenario });
  }

  public async submitDecision(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    const validated = submitDecisionSchema.parse(req.body);
    const result = await simulationService.submitDecision(req.user._id, validated);
    res.status(200).json(result);
  }

  public async executeDailyTick(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    const dateKey = req.body?.date ? String(req.body.date) : undefined;
    const result = await simulationService.executeDailyTick(req.user._id, dateKey);
    res.status(200).json(result);
  }

  public async getFinancialHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const history = await simulationService.getFinancialHistory(req.user._id, limit);
    res.status(200).json({ history });
  }
}

export const simulationController = new SimulationController();
