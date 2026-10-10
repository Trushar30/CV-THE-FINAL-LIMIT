import mongoose, { Document, Schema, Types } from 'mongoose';
import { type FounderStatus, FOUNDER_STATUSES } from '../types/enums.js';

export interface IFounder {
  userId: Types.ObjectId;
  companyId?: Types.ObjectId | null;
  unlockedAt: Date;
  status: FounderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFounderDocument extends IFounder, Document {
  _id: Types.ObjectId;
}

const FounderSchema = new Schema<IFounderDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      default: null,
      index: true,
    },
    unlockedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: FOUNDER_STATUSES,
      required: true,
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'founders',
  }
);

export const FounderModel =
  (mongoose.models.Founder as mongoose.Model<IFounderDocument>) ||
  mongoose.model<IFounderDocument>('Founder', FounderSchema);
