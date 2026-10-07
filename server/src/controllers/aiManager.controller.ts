import { Request, Response, NextFunction } from 'express';
import { AIManagerService } from '../services/ai/aiManager.service.js';
import type { AIPool, AIProvider } from '../ai/types.js';
import { AppError } from '../utils/errors.js';

export class AIManagerController {
  constructor(private readonly aiManagerService: AIManagerService) {}

  listProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pool = req.query.pool as AIPool | undefined;
      const providers = await this.aiManagerService.listProviders(pool);
      res.status(200).json({
        success: true,
        data: { providers },
      });
    } catch (err) {
      next(err);
    }
  };

  createProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required'));
      }
      const provider = await this.aiManagerService.addProvider(req.body, req.user._id);
      res.status(201).json({
        success: true,
        message: 'Provider added successfully',
        data: { provider },
      });
    } catch (err) {
      next(err);
    }
  };

  updateProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required'));
      }
      const code = req.params.code as AIProvider;
      const pool = (req.query.pool as AIPool) || 'PIPELINE';
      const provider = await this.aiManagerService.updateProvider(
        code,
        pool,
        req.body,
        req.user._id
      );
      res.status(200).json({
        success: true,
        message: 'Provider updated successfully',
        data: { provider },
      });
    } catch (err) {
      next(err);
    }
  };

  enableProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required'));
      }
      const code = req.params.code as AIProvider;
      const pool = (req.query.pool as AIPool) || 'PIPELINE';
      const { reason } = req.body;
      const provider = await this.aiManagerService.enableProvider(code, pool, req.user._id, reason);
      res.status(200).json({
        success: true,
        message: `Provider '${code}' enabled`,
        data: { provider },
      });
    } catch (err) {
      next(err);
    }
  };

  disableProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required'));
      }
      const code = req.params.code as AIProvider;
      const pool = (req.query.pool as AIPool) || 'PIPELINE';
      const { reason } = req.body;
      const provider = await this.aiManagerService.disableProvider(
        code,
        pool,
        req.user._id,
        reason
      );
      res.status(200).json({
        success: true,
        message: `Provider '${code}' disabled`,
        data: { provider },
      });
    } catch (err) {
      next(err);
    }
  };

  removeProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required'));
      }
      const code = req.params.code as AIProvider;
      const pool = (req.query.pool as AIPool) || 'PIPELINE';
      const { reason } = req.body;
      const result = await this.aiManagerService.removeProvider(code, pool, req.user._id, reason);
      res.status(200).json({
        success: true,
        message: `Provider '${code}' removed`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  testProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required'));
      }
      const code = req.params.code as AIProvider;
      const pool = (req.query.pool as AIPool) || 'PIPELINE';
      const result = await this.aiManagerService.testProvider(code, pool);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getHealthAndUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pool = req.query.pool as AIPool | undefined;
      const result = await this.aiManagerService.getHealthAndUsage(pool);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
