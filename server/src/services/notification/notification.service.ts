import { Types } from 'mongoose';
import { NotificationModel, type INotificationDocument } from '../../models/Notification.js';
import { type NotificationType } from '../../types/enums.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface CreateNotificationParams {
  userId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export interface ListNotificationsOptions {
  isRead?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
}

export class NotificationService {
  /**
   * Creates an in-app notification record for a user.
   */
  public async create(params: CreateNotificationParams): Promise<INotificationDocument> {
    const userObjectId =
      typeof params.userId === 'string' ? new Types.ObjectId(params.userId) : params.userId;

    const notification = await NotificationModel.create({
      userId: userObjectId,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      link: params.link?.trim() || undefined,
      isRead: false,
      createdAt: new Date(),
    });

    logger.info('[NotificationService] Created notification', {
      notificationId: notification._id.toString(),
      userId: userObjectId.toString(),
      type: params.type,
    });

    return notification;
  }

  /**
   * Lists notifications for a user, sorted descending by creation time.
   */
  public async list(
    userId: Types.ObjectId | string,
    options?: ListNotificationsOptions
  ): Promise<{
    notifications: INotificationDocument[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const userObjectId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const filter: Record<string, unknown> = { userId: userObjectId };
    if (typeof options?.isRead === 'boolean') {
      filter.isRead = options.isRead;
    }
    if (options?.type) {
      filter.type = options.type;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({ userId: userObjectId, isRead: false }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
    };
  }

  /**
   * Marks a specific notification as read, strictly enforcing owner authorization.
   */
  public async markRead(
    notificationId: Types.ObjectId | string,
    userId: Types.ObjectId | string
  ): Promise<INotificationDocument> {
    const notifObjectId =
      typeof notificationId === 'string' ? new Types.ObjectId(notificationId) : notificationId;
    const userObjectId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const notification = await NotificationModel.findById(notifObjectId);
    if (!notification) {
      throw AppError.notFound('Notification not found.');
    }

    if (!notification.userId.equals(userObjectId)) {
      throw AppError.forbidden('You do not have permission to view or modify this notification.');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    logger.debug('[NotificationService] Marked notification as read', {
      notificationId: notifObjectId.toString(),
      userId: userObjectId.toString(),
    });

    return notification;
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  public async markAllRead(userId: Types.ObjectId | string): Promise<{ modifiedCount: number }> {
    const userObjectId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const result = await NotificationModel.updateMany(
      { userId: userObjectId, isRead: false },
      { $set: { isRead: true } }
    );

    logger.info('[NotificationService] Marked all notifications as read', {
      userId: userObjectId.toString(),
      modifiedCount: result.modifiedCount,
    });

    return { modifiedCount: result.modifiedCount };
  }
}

export const notificationService = new NotificationService();
