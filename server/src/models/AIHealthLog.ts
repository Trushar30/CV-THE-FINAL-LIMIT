import mongoose, { Document, Schema, Types } from 'mongoose';
import { AIPool, AI_POOLS } from '../ai/types.js';

export interface IAIHealthLogDocument extends Document {
  _id: Types.ObjectId;
  providerCode: string;
  pool: AIPool;
  status: string;
  latencyMs: number;
  errorMessage?: string | null;
  timestamp: Date;
}

export const aiHealthLogSchema = new Schema<IAIHealthLogDocument>(
  {
    providerCode: {
      type: String,
      required: true,
      index: true,
    },
    pool: {
      type: String,
      enum: AI_POOLS,
      required: true,
      default: 'PIPELINE',
    },
    status: {
      type: String,
      required: true,
    },
    latencyMs: {
      type: Number,
      required: true,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'aiHealthLogs',
    timestamps: false,
  }
);

aiHealthLogSchema.index({ providerCode: 1, timestamp: -1 });

export const AIHealthLogModel = mongoose.model<IAIHealthLogDocument>(
  'AIHealthLog',
  aiHealthLogSchema
);
