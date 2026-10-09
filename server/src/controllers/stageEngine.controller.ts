import { Request, Response, NextFunction } from 'express';
import { stageEngineService } from '../services/career/stageEngine.service.js';
import { AppError } from '../utils/errors.js';
import type { PostAnswerInput } from '../schemas/stageChat.schema.js';

export class StageEngineController {
  /**
   * GET /api/applications/:id/stage
   * GET /api/applications/:id/interview
   * Get current chat stage session, active question, and dialogue history.
   */
  public async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;

      const session = await stageEngineService.getOrInitStageSession(applicationId, userId);

      res.status(200).json({
        success: true,
        data: {
          interview: session.interview,
          currentQuestion: session.currentQuestion,
          previousAnswers: session.previousAnswers,
          isCompleted: session.isCompleted,
          isWaitingAI: session.isWaitingAI,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/applications/:id/stage/messages
   * POST /api/applications/:id/interview/messages
   * Submit candidate answer for the current question in the stage session.
   */
  public async submitMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.user._id.toString();
      const applicationId = req.params.id as string;
      const body = req.body as PostAnswerInput;

      const result = await stageEngineService.submitAnswer(
        applicationId,
        userId,
        body.answer,
        body.questionSequence
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const stageEngineController = new StageEngineController();
