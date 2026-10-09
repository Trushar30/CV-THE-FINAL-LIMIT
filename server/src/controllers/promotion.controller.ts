import { Request, Response, NextFunction } from 'express';
import { PromotionService, promotionService as defaultPromotionService } from '../services/employee/promotion.service.js';
import { AppError } from '../utils/errors.js';

export class PromotionController {
  constructor(private readonly promotionService: PromotionService = defaultPromotionService) {}

  public getPromotionProgress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        throw AppError.unauthorized('Authentication required');
      }

      const progress = await this.promotionService.getPromotionProgress(userId);

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const promotionController = new PromotionController();

