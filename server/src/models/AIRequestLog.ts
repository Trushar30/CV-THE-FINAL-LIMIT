import mongoose, { Document, Schema, Types } from 'mongoose';
import { AITaskType, AI_TASK_TYPES, AIPool, AI_POOLS } from '../ai/types.js';

export interface IAIRequestLogDocument extends Document {
  _id: Types.ObjectId;
  taskType: AITaskType;
  pool: AIPool;
  providerCode: string;
  modelId: string;
  jobId?: Types.ObjectId | null;
  promptSummary: string;
  createdAt: Date;
}

export const aiRequestLogSchema = new Schema<IAIRequestLogDocument>(
  {
    taskType: {
      type: String,
      enum: AI_TASK_TYPES,
      required: true,
      index: true,
    },
    pool: {
      type: String,
      enum: AI_POOLS,
      required: true,
    },
    providerCode: {
      type: String,
      required: true,
      index: true,
    },
    modelId: {
      type: String,
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'AIJob',
      default: null,
    },
    promptSummary: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'aiRequests',
    timestamps: false,
  }
);

aiRequestLogSchema.index({ createdAt: -1 });

export const AIRequestLogModel = mongoose.model<IAIRequestLogDocument>(
  'AIRequestLog',
  aiRequestLogSchema
);
