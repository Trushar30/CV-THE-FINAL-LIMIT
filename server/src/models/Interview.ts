import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type ApplicationMode,
  APPLICATION_MODES,
  type CareerDomain,
  CAREER_DOMAINS,
} from '../types/enums.js';

export type ChatStage = 'SCREENING' | 'ASSESSMENT' | 'INTERVIEW';
export const CHAT_STAGES: readonly ChatStage[] = ['SCREENING', 'ASSESSMENT', 'INTERVIEW'] as const;

export type InterviewStatus = 'IN_PROGRESS' | 'WAITING_AI' | 'COMPLETED' | 'ABANDONED';
export const INTERVIEW_STATUSES: readonly InterviewStatus[] = [
  'IN_PROGRESS',
  'WAITING_AI',
  'COMPLETED',
  'ABANDONED',
] as const;

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export const QUESTION_DIFFICULTIES: readonly QuestionDifficulty[] = ['EASY', 'MEDIUM', 'HARD'] as const;

export interface IInterview {
  applicationId: Types.ObjectId;
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  domain: CareerDomain;
  stage: ChatStage;
  status: InterviewStatus;
  overallScore?: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  passingScore: number;
  difficulty: QuestionDifficulty;
  mode: ApplicationMode;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInterviewDocument extends IInterview, Document {
  _id: Types.ObjectId;
}

const InterviewSchema = new Schema<IInterviewDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
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
    },
    domain: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
    },
    stage: {
      type: String,
      enum: CHAT_STAGES,
      required: true,
      default: 'INTERVIEW',
    },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      required: true,
      default: 'IN_PROGRESS',
      index: true,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      required: false,
    },
    currentQuestionIndex: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    passingScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 70,
    },
    difficulty: {
      type: String,
      enum: QUESTION_DIFFICULTIES,
      required: true,
      default: 'MEDIUM',
    },
    mode: {
      type: String,
      enum: APPLICATION_MODES,
      required: true,
      default: 'PRODUCTION',
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      required: false,
    },
  },
  {
    collection: 'interviews',
    timestamps: true,
  }
);

// Compound unique index per application per chat stage
InterviewSchema.index({ applicationId: 1, stage: 1 }, { unique: true });

export const InterviewModel =
  (mongoose.models.Interview as mongoose.Model<IInterviewDocument>) ||
  mongoose.model<IInterviewDocument>('Interview', InterviewSchema);
