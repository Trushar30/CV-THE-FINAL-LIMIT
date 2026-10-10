import { Request, Response, NextFunction } from 'express';
import {
  AnalyticsService,
  analyticsService as defaultAnalyticsService,
} from '../services/admin/analytics.service.js';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService = defaultAnalyticsService) {}

  /**
   * GET /api/admin/analytics/users
   */
  public async getUserAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getUserAnalytics(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/applications
   */
  public async getApplicationAnalytics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await this.analyticsService.getApplicationAnalytics(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/tasks
   */
  public async getTaskAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getTaskAnalytics(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/economy
   */
  public async getEconomyAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getEconomyAnalytics(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/companies
   */
  public async getCompanyAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getCompanyAnalytics(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/ai
   */
  public async getAiAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getAiAnalytics(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/audit-logs
   */
  public async getAuditLogsViewer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getAuditLogsViewer(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/ai-logs
   */
  public async getAiLogsViewer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getAiLogsViewer(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/analytics/ai-queue
   */
  public async getAiQueueViewer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.analyticsService.getAiQueueViewer(req.query as never);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
