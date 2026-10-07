import mongoose, { Document, Schema, Types } from 'mongoose';
import { AIJobStatus, AI_JOB_STATUSES, AIProvider, AI_PROVIDERS } from '../types/enums.js';
import { AITaskType, AI_TASK_TYPES, AIPool, AI_POOLS, AIRequest, AIResponse } from '../ai/types.js';

export interface IAIJobError {
  category?: string;
  message?: string;
  provider?: string;
  timestamp?: Date;
}

export interface IAIJobDocument extends Document {
  _id: Types.ObjectId;
  taskType: AITaskType;
  pool: AIPool;
  status: AIJobStatus;
  attempts: number;
  maxAttempts: number;
  attemptsPerProvider: Map<string, number>;
  currentProvider?: AIProvider | null;
  payload: AIRequest;
  result?: AIResponse | null;
  error?: IAIJobError | null;
  lockedUntil?: Date | null;
  lockedBy?: string | null;
  requestorReference?: string | null;
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const aiJobSchema = new Schema<IAIJobDocument>(
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
      default: 'PIPELINE',
      index: true,
    },
    status: {
      type: String,
      enum: AI_JOB_STATUSES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
    },
    attemptsPerProvider: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
    currentProvider: {
      type: String,
      enum: [...AI_PROVIDERS, null],
      default: null,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    result: {
      type: Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: {
        category: { type: String },
        message: { type: String },
        provider: { type: String },
        timestamp: { type: Date },
      },
      default: null,
      _id: false,
    },
    lockedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    requestorReference: {
      type: String,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },
  },
  {
    collection: 'aiJobs',
    timestamps: true,
  }
);

// Compound indexes for high-throughput worker querying
aiJobSchema.index({ status: 1, lockedUntil: 1 });
aiJobSchema.index({ pool: 1, status: 1, createdAt: 1 });
aiJobSchema.index({ createdAt: 1 });

export const AIJobModel = mongoose.model<IAIJobDocument>('AIJob', aiJobSchema);
