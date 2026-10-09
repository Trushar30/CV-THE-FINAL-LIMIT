import mongoose, { Document, Schema, Types } from 'mongoose';
import { type EmploymentReviewDecision, EMPLOYMENT_REVIEW_DECISIONS } from '../types/enums.js';

export interface IEmploymentReview {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  activeWarningCount: number;
  decision: EmploymentReviewDecision;
  reason: string;
  aiRecommendation?: string;
  demotionId?: Types.ObjectId;
  reviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmploymentReviewDocument extends IEmploymentReview, Document {
  _id: Types.ObjectId;
}

const EmploymentReviewSchema = new Schema<IEmploymentReviewDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyEmployee',
      required: true,
      index: true,
    },
    activeWarningCount: {
      type: Number,
      required: true,
      min: 0,
    },
    decision: {
      type: String,
      enum: EMPLOYMENT_REVIEW_DECISIONS,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000,
    },
    aiRecommendation: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
    demotionId: {
      type: Schema.Types.ObjectId,
      ref: 'Demotion',
      required: false,
    },
    reviewedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'employmentReviews',
  }
);

EmploymentReviewSchema.index({ userId: 1, reviewedAt: -1 });
EmploymentReviewSchema.index({ companyId: 1, reviewedAt: -1 });

export const EmploymentReviewModel = mongoose.model<IEmploymentReviewDocument>(
  'EmploymentReview',
  EmploymentReviewSchema
);
