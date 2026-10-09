import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPromotion {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  previousLevel: number;
  newLevel: number;
  previousPositionTitle?: string;
  newPositionTitle: string;
  previousSalarySimulated?: number;
  newSalarySimulated?: number;
  totalExpSnapshot: number;
  reason: string;
  aiRecommendation?: string;
  promotedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPromotionDocument extends IPromotion, Document {
  _id: Types.ObjectId;
}

const PromotionSchema = new Schema<IPromotionDocument>(
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
    previousLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 9,
    },
    newLevel: {
      type: Number,
      required: true,
      min: 2,
      max: 10,
    },
    previousPositionTitle: {
      type: String,
      required: false,
      trim: true,
    },
    newPositionTitle: {
      type: String,
      required: true,
      trim: true,
    },
    previousSalarySimulated: {
      type: Number,
      required: false,
      min: 0,
    },
    newSalarySimulated: {
      type: Number,
      required: false,
      min: 0,
    },
    totalExpSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    aiRecommendation: {
      type: String,
      required: false,
      trim: true,
    },
    promotedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'promotions',
  }
);

PromotionSchema.index({ userId: 1, promotedAt: -1 });
PromotionSchema.index({ companyId: 1, promotedAt: -1 });

export const PromotionModel = mongoose.model<IPromotionDocument>('Promotion', PromotionSchema);
