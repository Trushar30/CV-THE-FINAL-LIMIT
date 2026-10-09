import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDemotion {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  previousLevel: number;
  newLevel: number;
  previousPositionTitle?: string;
  newPositionTitle?: string;
  activeWarningCount: number;
  reason: string;
  demotedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDemotionDocument extends IDemotion, Document {
  _id: Types.ObjectId;
}

const DemotionSchema = new Schema<IDemotionDocument>(
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
      max: 10,
    },
    newLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    previousPositionTitle: {
      type: String,
      required: false,
      trim: true,
    },
    newPositionTitle: {
      type: String,
      required: false,
      trim: true,
    },
    activeWarningCount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000,
    },
    demotedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'demotions',
  }
);

DemotionSchema.index({ userId: 1, demotedAt: -1 });
DemotionSchema.index({ companyId: 1, demotedAt: -1 });

export const DemotionModel = mongoose.model<IDemotionDocument>('Demotion', DemotionSchema);
