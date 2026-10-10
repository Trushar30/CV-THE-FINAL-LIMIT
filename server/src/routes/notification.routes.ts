import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from '../schemas/notification.schema.js';

export function createNotificationRoutes(): Router {
  const router = Router();

  // GET /api/notifications - List current user's notifications
  router.get(
    '/',
    authenticateJwt,
    validate({ query: listNotificationsQuerySchema }),
    notificationController.list.bind(notificationController)
  );

  // GET /api/notifications/unread-count - Get unread notification count
  router.get(
    '/unread-count',
    authenticateJwt,
    notificationController.getUnreadCount.bind(notificationController)
  );

  // PATCH /api/notifications/read-all - Mark all notifications as read
  router.patch(
    '/read-all',
    authenticateJwt,
    notificationController.markAllRead.bind(notificationController)
  );

  // PATCH /api/notifications/:id/read - Mark specific notification as read
  router.patch(
    '/:id/read',
    authenticateJwt,
    validate({ params: notificationIdParamsSchema }),
    notificationController.markRead.bind(notificationController)
  );

  return router;
}

export const notificationRouter = createNotificationRoutes();
