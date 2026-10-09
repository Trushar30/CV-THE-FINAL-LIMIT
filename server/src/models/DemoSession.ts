import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type CareerDomain,
  CAREER_DOMAINS,
  type ApplicationStage,
  APPLICATION_STAGES,
} from '../types/enums.js';

export type DemoSessionStatus = 'INITIALIZED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CLEANED_UP';
export const DEMO_SESSION_STATUSES: readonly DemoSessionStatus[] = [
  'INITIALIZED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CLEANED_UP',
] as const;

export type DemoDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export const DEMO_DIFFICULTIES: readonly DemoDifficulty[] = ['EASY', 'MEDIUM', 'HARD'] as const;

export interface IDemoSession {
  createdBy: Types.ObjectId;
  applicationId: Types.ObjectId;
  companyId: Types.ObjectId;
  jobId: Types.ObjectId;
  candidateUserId: Types.ObjectId;
  domain: CareerDomain;
  difficulty: DemoDifficulty;
  questionsCount: number;
  interviewType: string;
  currentStage: ApplicationStage;
  status: DemoSessionStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDemoSessionDocument extends IDemoSession, Document {
  _id: Types.ObjectId;
}

const DemoSessionSchema = new Schema<IDemoSessionDocument>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyJob',
      required: true,
    },
    candidateUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    domain: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
    },
    difficulty: {
      type: String,
      enum: DEMO_DIFFICULTIES,
      required: true,
      default: 'EASY',
    },
    questionsCount: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 3,
    },
    interviewType: {
      type: String,
      required: true,
      default: 'TECHNICAL_DEEP_DIVE',
    },
    currentStage: {
      type: String,
      enum: APPLICATION_STAGES,
      required: true,
      default: 'APPLIED',
    },
    status: {
      type: String,
      enum: DEMO_SESSION_STATUSES,
      required: true,
      default: 'INITIALIZED',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
      default: () => ({}),
    },
  },
  {
    collection: 'demoSessions',
    timestamps: true,
  }
);

DemoSessionSchema.index({ createdBy: 1, createdAt: -1 });
DemoSessionSchema.index({ applicationId: 1, status: 1 });

export const DemoSessionModel = mongoose.model<IDemoSessionDocument>('DemoSession', DemoSessionSchema);
