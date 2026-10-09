import mongoose, { Document, Schema, Types } from 'mongoose';
import { type WarningStatus, WARNING_STATUSES } from '../types/enums.js';

export interface IWarning {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  employeeId?: Types.ObjectId;
  taskSubmissionId: Types.ObjectId;
  sourcePerformanceRecordId?: Types.ObjectId;
  status: WarningStatus;
  reason: string;
  issuedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWarningDocument extends IWarning, Document {
  _id: Types.ObjectId;
}

const WarningSchema = new Schema<IWarningDocument>(
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
      required: false,
      index: true,
    },
    taskSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: 'TaskSubmission',
      required: true,
      unique: true,
    },
    sourcePerformanceRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'PerformanceRecord',
      required: false,
    },
    status: {
      type: String,
      enum: WARNING_STATUSES,
      default: 'ACTIVE',
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
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'warnings',
  }
);

// Compound indexes for active decay queries and user company history
WarningSchema.index({ userId: 1, status: 1 });
WarningSchema.index({ userId: 1, companyId: 1, status: 1, expiresAt: 1 });

export const WarningModel = mongoose.model<IWarningDocument>('Warning', WarningSchema);
