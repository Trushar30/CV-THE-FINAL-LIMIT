import { Request, Response, NextFunction } from 'express';
import { applicationService } from '../services/career/application.service.js';
import { atsScreeningService } from '../services/career/atsScreening.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ApplyJobInput, ListApplicationsQuery } from '../schemas/application.schema.js';

export class ApplicationController {
  /**
   * POST /api/applications
   * Submit an application for an open position and trigger ATS screening.
   */
  public async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const body = req.body as ApplyJobInput;

      const application = await applicationService.applyForJob(userId, body);

      // Auto-enqueue ATS screening per Spec Section 7 and Decision Q2
      let screenedApp = application;
      try {
        const atsResult = await atsScreeningService.enqueueAtsScreening(
          application._id,
          req.user._id,
          req.user.platformRole
        );
        screenedApp = atsResult.application;
      } catch (err) {
        logger.warn('[ApplicationController] Failed to auto-enqueue ATS screening on apply', {
          applicationId: application._id.toString(),
          error: (err as Error).message,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          application: screenedApp,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/applications/:id/withdraw
   * Voluntarily withdraw an active application.
   */
  public async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;
      const reason = req.body?.reason as string | undefined;

      const application = await applicationService.withdrawApplication(
        userId,
        applicationId,
        reason
      );

      res.status(200).json({
        success: true,
        data: {
          application,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/applications
   * List the authenticated user's job applications.
   * Auto-heals any active applications currently stuck in APPLIED stage by enqueuing ATS screening.
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const query = (req.query || {}) as unknown as ListApplicationsQuery;

      const result = await applicationService.getApplications(userId, query);

      // Auto-recover any active application that was created in APPLIED stage
      for (const app of result.applications) {
        if (app.status === 'ACTIVE' && app.currentStage === 'APPLIED') {
          try {
            await atsScreeningService.enqueueAtsScreening(
              app._id,
              req.user._id,
              req.user.platformRole
            );
            app.currentStage = 'ATS_SCREENING';
          } catch (e) {
            logger.warn('[ApplicationController] Auto-recovery enqueue for stuck APPLIED application failed', {
              appId: app._id.toString(),
              error: (e as Error).message,
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/applications/:id
   * Get application details by ID, including evaluations and feedback per Spec Section 27.4.
   */
  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;

      const application = await applicationService.getApplicationById(applicationId, userId);

      // Auto-recover if active and in APPLIED stage
      if (application.status === 'ACTIVE' && application.currentStage === 'APPLIED') {
        try {
          await atsScreeningService.enqueueAtsScreening(
            application._id,
            req.user._id,
            req.user.platformRole
          );
          application.currentStage = 'ATS_SCREENING';
        } catch {
          // Graceful fallback
        }
      }

      const { evaluations, feedback } = await atsScreeningService.getEvaluationAndFeedback(applicationId);

      res.status(200).json({
        success: true,
        data: {
          application,
          evaluations,
          ...(feedback ? { feedback } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/applications/:id/ats-screen
   * Enqueue ATS screening AI job for an application.
   */
  public async atsScreen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const applicationId = req.params.id as string;
      const result = await atsScreeningService.enqueueAtsScreening(
        applicationId,
        req.user._id,
        req.user.platformRole
      );

      res.status(202).json({
        success: true,
        data: {
          jobId: result.jobId,
          application: result.application,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/applications/:id/feedback
   * Returns stored feedback for a rejected application (owner only) per Spec Section 27.4.
   */
  public async getFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const applicationId = req.params.id as string;
      const feedback = await applicationService.getApplicationFeedback(applicationId, req.user._id);

      res.status(200).json({
        success: true,
        data: {
          feedback,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const applicationController = new ApplicationController();
