import { Request, Response, NextFunction } from 'express';
import {
  DemoHiringService,
  defaultDemoHiringService,
} from '../services/admin/demoHiring.service.js';

export class DemoHiringController {
  constructor(private readonly demoHiringService: DemoHiringService = defaultDemoHiringService) {}

  /**
   * POST /api/admin/demo/hiring
   * Creates a new demo hiring session
   */
  public async createDemoSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!._id;
      const result = await this.demoHiringService.createDemoSession(adminUserId, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/demo/hiring
   * Lists all demo hiring sessions
   */
  public async listDemoSessions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await this.demoHiringService.listDemoSessions();
      res.status(200).json({
        success: true,
        data: {
          sessions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/demo/hiring/:sessionId
   * Inspects complete demo session state, evaluations, and AI telemetry
   */
  public async getDemoSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const result = await this.demoHiringService.getDemoSession(sessionId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/demo/hiring/:sessionId/step
   * Advances the demo hiring session by one step/stage
   */
  public async stepDemoSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const result = await this.demoHiringService.stepDemoSession(sessionId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/demo/hiring/:sessionId/answer
   * Submits an answer to the current chat question
   */
  public async submitDemoAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const { answer } = req.body;
      const result = await this.demoHiringService.submitDemoAnswer(sessionId, answer);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/demo/hiring/:sessionId/simulate
   * Simulates the full hiring lifecycle end-to-end for the demo session
   */
  public async simulateDemoSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const result = await this.demoHiringService.simulateDemoSession(sessionId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/admin/demo/hiring/:sessionId
   * Cleans up all data generated for a specific demo session
   */
  public async cleanupDemoSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const adminUserId = req.user!._id;
      const result = await this.demoHiringService.cleanupDemoSession(
        sessionId,
        adminUserId,
        req.body?.reason
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/admin/demo/hiring
   * Cleans up ALL demo data system-wide
   */
  public async cleanupAllDemoData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!._id;
      const result = await this.demoHiringService.cleanupAllDemoData(adminUserId, req.body?.reason);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const demoHiringController = new DemoHiringController();
