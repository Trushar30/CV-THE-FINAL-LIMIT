import { Request, Response, NextFunction } from 'express';
import {
  NotificationService,
  notificationService,
} from '../services/notification/notification.service.js';
import { AppError } from '../utils/errors.js';
import type { ListNotificationsQuery } from '../schemas/notification.schema.js';

export class NotificationController {
  constructor(
    private readonly service: NotificationService = notificationService
  ) {}

  /**
   * GET /api/notifications
   * List notifications for the authenticated user per Spec Section 27.8.
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const query = req.query as unknown as ListNotificationsQuery;
      const result = await this.service.list(req.user._id, {
        isRead: query.isRead,
        type: query.type,
        page: query.page,
        limit: query.limit,
      });

      res.status(200).json({
        success: true,
        data: {
          notifications: result.notifications,
          unreadCount: result.unreadCount,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read (owner only) per Spec Section 27.8.
   */
  public async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const notificationId = req.params.id as string;
      const notification = await this.service.markRead(notificationId, req.user._id);

      res.status(200).json({
        success: true,
        data: {
          notification,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Mark all unread notifications as read for current user.
   */
  public async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const result = await this.service.markAllRead(req.user._id);

      res.status(200).json({
        success: true,
        data: {
          modifiedCount: result.modifiedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Return unread notification count for current user.
   */
  public async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const unreadCount = await this.service.getUnreadCount(req.user._id);

      res.status(200).json({
        success: true,
        data: {
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
