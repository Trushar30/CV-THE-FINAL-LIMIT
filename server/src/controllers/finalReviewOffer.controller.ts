import { Request, Response, NextFunction } from 'express';
import { finalReviewOfferService } from '../services/career/finalReviewOffer.service.js';
import { AppError } from '../utils/errors.js';
import type { NegotiateOfferBody, DeclineOfferBody } from '../schemas/offer.schema.js';

export class FinalReviewOfferController {
  /**
   * POST /api/applications/:id/final-review
   * Aggregates prior stage scores, generates AI summary, and either advances to OFFER or REJECTED.
   */
  public async executeFinalReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;

      const result = await finalReviewOfferService.executeFinalReview(applicationId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/applications/:id/offer
   * View the employment offer details for an application.
   */
  public async getOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;

      const offer = await finalReviewOfferService.getOffer(applicationId, userId);

      res.status(200).json({
        success: true,
        data: {
          offer,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/applications/:id/offer/negotiate
   * Submits a candidate negotiation turn.
   */
  public async negotiateOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;
      const { message, requestedSalary } = req.body as NegotiateOfferBody;

      const result = await finalReviewOfferService.negotiateOffer(
        applicationId,
        userId,
        message,
        requestedSalary
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/applications/:id/offer/accept
   * Accepts an employment offer atomically.
   */
  public async acceptOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;

      const result = await finalReviewOfferService.acceptOffer(applicationId, userId);

      res.status(200).json({
        success: true,
        data: {
          application: result.application,
          employee: result.employee,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/applications/:id/offer/decline
   * Declines an employment offer.
   */
  public async declineOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;
      const { reason } = (req.body || {}) as DeclineOfferBody;

      const result = await finalReviewOfferService.declineOffer(applicationId, userId, reason);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const finalReviewOfferController = new FinalReviewOfferController();
