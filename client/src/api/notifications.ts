import { apiClient } from './client';

export type NotificationType =
  | 'STAGE_ADVANCED'
  | 'APPLICATION_REJECTED'
  | 'OFFER_RECEIVED'
  | 'HIRED'
  | 'APPLICATION_EXPIRED'
  | 'TASK_ASSIGNED'
  | 'TASK_EVALUATED'
  | 'WARNING_ISSUED'
  | 'WARNING_EXPIRING_SOON'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'TERMINATION'
  | 'FOUNDER_UNLOCKED'
  | 'COMPANY_BANKRUPT'
  | 'DAILY_SCENARIO_READY'
  | 'LOW_BALANCE_WARNING'
  | 'AI_RESULT_READY'
  | 'SYSTEM_ANNOUNCEMENT';

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
   * Get unread notification count.
   */
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return apiClient.get<{ unreadCount: number }>('/notifications/unread-count');
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
