import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type PerformanceBand,
  PERFORMANCE_BANDS,
} from '../types/enums.js';

export interface ICriterionScore {
  criterion: string;
  score: number;
  comment?: string;
}

export interface IPerformanceRecord {
  taskSubmissionId: Types.ObjectId;
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  aiScore: number;
  scoreBand: PerformanceBand;
  awardedExp: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  criteriaScores: ICriterionScore[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPerformanceRecordDocument extends IPerformanceRecord, Document {
  _id: Types.ObjectId;
}

const CriterionScoreSchema = new Schema<ICriterionScore>(
  {
    criterion: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    comment: { type: String, required: false, trim: true },
  },
  { _id: false }
);

const PerformanceRecordSchema = new Schema<IPerformanceRecordDocument>(
  {
    taskSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: 'TaskSubmission',
      required: true,
      unique: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'EmployeeTask',
      required: true,
      index: true,
    },
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
    aiScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    scoreBand: {
      type: String,
      enum: PERFORMANCE_BANDS,
      required: true,
    },
    awardedExp: {
      type: Number,
      required: true,
      min: 0,
    },
    feedback: {
      type: String,
      required: true,
      trim: true,
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
    criteriaScores: {
      type: [CriterionScoreSchema],
      required: true,
      default: [],
    },
  },
  {
    collection: 'performanceRecords',
    timestamps: true,
  }
);

// Secondary Indexes
PerformanceRecordSchema.index({ userId: 1, createdAt: -1 });
PerformanceRecordSchema.index({ companyId: 1, createdAt: -1 });

export const PerformanceRecordModel =
  (mongoose.models.PerformanceRecord as mongoose.Model<IPerformanceRecordDocument>) ||
  mongoose.model<IPerformanceRecordDocument>('PerformanceRecord', PerformanceRecordSchema);
