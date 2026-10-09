import { apiClient } from './client';

export type NotificationType =
  | 'STAGE_ADVANCED'
  | 'APPLICATION_REJECTED'
  | 'OFFER_RECEIVED'
  | 'HIRED'
  | 'APPLICATION_EXPIRED'
  | 'WARNING_ISSUED'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'TERMINATION'
  | 'SYSTEM';

export interface NotificationItem {
  _id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface ListNotificationsParams {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}

export const notificationsApi = {
  /**
   * List notifications for the authenticated user.
   */
  async getNotifications(params?: ListNotificationsParams): Promise<NotificationsResponse> {
    return apiClient.get<NotificationsResponse>('/notifications', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Mark a single notification as read.
   */
  async markRead(id: string): Promise<{ notification: NotificationItem }> {
    return apiClient.patch<{ notification: NotificationItem }>(`/notifications/${id}/read`);
  },

  /**
   * Mark all unread notifications as read.
   */
  async markAllRead(): Promise<{ modifiedCount: number }> {
    return apiClient.patch<{ modifiedCount: number }>('/notifications/read-all');
  },
};
