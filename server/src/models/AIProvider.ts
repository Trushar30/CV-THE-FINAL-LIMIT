import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  AIProvider,
  AI_PROVIDERS,
  ProviderHealthState,
  PROVIDER_HEALTH_STATES,
} from '../types/enums.js';
import { AIPool, AI_POOLS } from '../ai/types.js';

export interface IAIProviderDocument extends Document {
  _id: Types.ObjectId;
  code: AIProvider;
  name: string;
  priority: number;
  pool: AIPool;
  status: ProviderHealthState;
  modelId?: string | null;
  encryptedApiKey?: string | null;
  maskedApiKey?: string | null;
  rateLimitRpm: number;
  dailyLimit?: number | null;
  dailyRequests: number;
  consecutiveFailures: number;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  lastFailureReason?: string | null;
  totalRequests: number;
  totalFailures: number;
  averageLatencyMs: number;
  lastCheckedAt?: Date | null;
  recoveryCheckAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const aiProviderSchema = new Schema<IAIProviderDocument>(
  {
    code: {
      type: String,
      enum: AI_PROVIDERS,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: Number,
      required: true,
      min: 1,
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
      enum: PROVIDER_HEALTH_STATES,
      required: true,
      default: 'HEALTHY',
      index: true,
    },
    modelId: {
      type: String,
      default: null,
    },
    encryptedApiKey: {
      type: String,
      select: false, // Never return in standard queries
      default: null,
    },
    maskedApiKey: {
      type: String,
      default: null,
    },
    rateLimitRpm: {
      type: Number,
      required: true,
      default: 60,
      min: 1,
    },
    dailyLimit: {
      type: Number,
      default: null,
    },
    dailyRequests: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    consecutiveFailures: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastSuccessAt: {
      type: Date,
      default: null,
    },
    lastFailureAt: {
      type: Date,
      default: null,
    },
    lastFailureReason: {
      type: String,
      default: null,
    },
    totalRequests: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalFailures: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    averageLatencyMs: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    recoveryCheckAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    collection: 'aiProviders',
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.encryptedApiKey;
        return ret;
      },
    },
  }
);

aiProviderSchema.index({ code: 1, pool: 1 }, { unique: true });
aiProviderSchema.index({ pool: 1, priority: 1 });

export const AIProviderModel = mongoose.model<IAIProviderDocument>('AIProvider', aiProviderSchema);
