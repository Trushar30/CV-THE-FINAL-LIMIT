import mongoose, { Document, Schema, Types } from 'mongoose';
import { type ApplicationStage, APPLICATION_STAGES } from '../types/enums.js';

export interface IFeedback {
  applicationId: Types.ObjectId;
  userId: Types.ObjectId;
  rejectionStage: ApplicationStage;
  strengths: string[];
  weaknesses: string[];
  actionableSuggestions: string[];
  createdAt: Date;
}

export interface IFeedbackDocument extends IFeedback, Document {
  _id: Types.ObjectId;
}

const FeedbackSchema = new Schema<IFeedbackDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rejectionStage: {
      type: String,
      enum: APPLICATION_STAGES,
      required: true,
    },
    strengths: {
      type: [String],
      required: true,
      default: [],
    },
    weaknesses: {
      type: [String],
      required: true,
      default: [],
    },
    actionableSuggestions: {
      type: [String],
      required: true,
      default: [],
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'feedbacks',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

FeedbackSchema.index({ applicationId: 1 });
FeedbackSchema.index({ userId: 1 });

export const FeedbackModel =
  (mongoose.models.Feedback as mongoose.Model<IFeedbackDocument>) ||
  mongoose.model<IFeedbackDocument>('Feedback', FeedbackSchema);
