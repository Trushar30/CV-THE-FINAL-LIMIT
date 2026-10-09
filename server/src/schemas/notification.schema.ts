import { z } from 'zod';
import { NOTIFICATION_TYPES, type NotificationType } from '../types/enums.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Invalid ObjectId format (must be 24-character hexadecimal)');

export const listNotificationsQuerySchema = z.object({
  isRead: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  type: z
    .enum(NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const notificationIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const createNotificationInputSchema = z.object({
  userId: objectIdSchema,
  type: z.enum(NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]]),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
  link: z.string().trim().max(500).optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
