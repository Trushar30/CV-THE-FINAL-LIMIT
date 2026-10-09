import mongoose, { Document, Schema, Types } from 'mongoose';
import { type NotificationType, NOTIFICATION_TYPES } from '../types/enums.js';

export interface INotification {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: Date;
}

export interface INotificationDocument extends INotification, Document {
  _id: Types.ObjectId;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    link: {
      type: String,
      trim: true,
      default: undefined,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'notifications',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes matching Spec Section 26.36
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<INotificationDocument>) ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);
