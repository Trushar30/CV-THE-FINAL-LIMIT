import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAIResponseLogDocument extends Document {
  _id: Types.ObjectId;
  requestId: Types.ObjectId;
  jobId?: Types.ObjectId | null;
  providerCode: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  success: boolean;
  errorCode?: string | null;
  createdAt: Date;
}

export const aiResponseLogSchema = new Schema<IAIResponseLogDocument>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'AIRequestLog',
      required: true,
      unique: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'AIJob',
      default: null,
    },
    providerCode: {
      type: String,
      required: true,
    },
    latencyMs: {
      type: Number,
      required: true,
      min: 0,
    },
    inputTokens: {
      type: Number,
      required: true,
      min: 0,
    },
    outputTokens: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTokens: {
      type: Number,
      required: true,
      min: 0,
    },
    success: {
      type: Boolean,
      required: true,
    },
    errorCode: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'aiResponses',
    timestamps: false,
  }
);

export const AIResponseLogModel = mongoose.model<IAIResponseLogDocument>(
  'AIResponseLog',
  aiResponseLogSchema
);
