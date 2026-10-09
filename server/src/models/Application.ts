import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type ApplicationMode,
  APPLICATION_MODES,
  type ApplicationStage,
  APPLICATION_STAGES,
  type ApplicationStatus,
  APPLICATION_STATUSES,
  type CareerDomain,
  CAREER_DOMAINS,
} from '../types/enums.js';

export interface IStageHistoryEntry {
  stage: ApplicationStage;
  enteredAt: Date;
  exitedAt?: Date;
  result?: string;
}

export interface IResumeAnalysisSnapshot {
  resumeAnalysisId: Types.ObjectId;
  resumeId: Types.ObjectId;
  domainClassification: CareerDomain;
  parsedSkills: string[];
  yearsOfExperience: number;
  extractedSummary?: string;
  name?: string;
  education?: Array<{
    institution: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
    graduationYear?: string | number | null;
  }>;
  workHistory?: Array<{
    company: string;
    role: string;
    duration?: string | null;
    description?: string | null;
    highlights?: string[];
  }>;
  projects?: Array<{
    title: string;
    description?: string | null;
    techStack?: string[];
    link?: string | null;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string | null;
    year?: string | number | null;
  }>;
  snapshotAt: Date;
}

export interface IFinalReviewStageBreakdown {
  atsScore: number;
  atsWeight: number;
  screeningScore: number;
  screeningWeight: number;
  assessmentScore: number;
  assessmentWeight: number;
  interviewScore: number;
  interviewWeight: number;
  finalScore: number;
  passingScore: number;
  isPassing: boolean;
  summary: string;
  recommendations: string[];
  evaluatedAt: Date;
}

export interface IOfferNegotiationEntry {
  round: number;
  candidateMessage: string;
  requestedSalary?: number;
  aiResponse: string;
  counterOfferSalary?: number;
  timestamp: Date;
}

export interface IApplicationOffer {
  positionTitle: string;
  level: number;
  salarySimulated: number;
  salaryMin: number;
  salaryMax: number;
  negotiationRoundsLeft: number;
  maxNegotiationRounds: number;
  negotiationHistory: IOfferNegotiationEntry[];
  status: 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  offeredAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
}

export interface IApplication {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  companyId: Types.ObjectId;
  mode: ApplicationMode;
  currentStage: ApplicationStage;
  status: ApplicationStatus;
  resumeAnalysisId: Types.ObjectId;
  resumeAnalysisSnapshot: IResumeAnalysisSnapshot;
  stageHistory: IStageHistoryEntry[];
  aiJobId?: Types.ObjectId;
  atsScore?: number;
  atsBreakdown?: {
    domainRelevance?: number;
    skillMatch?: number;
    experience?: number;
    clarity?: number;
  };
  atsFeedback?: string;
  interviewScore?: number;
  finalReview?: IFinalReviewStageBreakdown;
  offer?: IApplicationOffer;
  rejectionReason?: string;
  withdrawalReason?: string;
  expiryReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApplicationDocument extends IApplication, Document {
  _id: Types.ObjectId;
}

const StageHistorySchema = new Schema<IStageHistoryEntry>(
  {
    stage: {
      type: String,
      enum: APPLICATION_STAGES,
      required: true,
    },
    enteredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    exitedAt: {
      type: Date,
      required: false,
    },
    result: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { _id: false }
);

const ResumeAnalysisSnapshotSchema = new Schema<IResumeAnalysisSnapshot>(
  {
    resumeAnalysisId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeAnalysis',
      required: true,
    },
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeFile',
      required: true,
    },
    domainClassification: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
    },
    parsedSkills: {
      type: [String],
      required: true,
      default: [],
    },
    yearsOfExperience: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    extractedSummary: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: false,
    },
    education: {
      type: [
        {
          institution: { type: String, required: true },
          degree: { type: String, required: false },
          fieldOfStudy: { type: String, required: false },
          graduationYear: { type: Schema.Types.Mixed, required: false },
        },
      ],
      required: false,
      default: [],
    },
    workHistory: {
      type: [
        {
          company: { type: String, required: true },
          role: { type: String, required: true },
          duration: { type: String, required: false },
          description: { type: String, required: false },
          highlights: { type: [String], required: false },
        },
      ],
      required: false,
      default: [],
    },
    projects: {
      type: [
        {
          title: { type: String, required: true },
          description: { type: String, required: false },
          techStack: { type: [String], required: false },
          link: { type: String, required: false },
        },
      ],
      required: false,
      default: [],
    },
    certifications: {
      type: [
        {
          name: { type: String, required: true },
          issuer: { type: String, required: false },
          year: { type: Schema.Types.Mixed, required: false },
        },
      ],
      required: false,
      default: [],
    },
    snapshotAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const FinalReviewBreakdownSchema = new Schema<IFinalReviewStageBreakdown>(
  {
    atsScore: { type: Number, required: true },
    atsWeight: { type: Number, required: true },
    screeningScore: { type: Number, required: true },
    screeningWeight: { type: Number, required: true },
    assessmentScore: { type: Number, required: true },
    assessmentWeight: { type: Number, required: true },
    interviewScore: { type: Number, required: true },
    interviewWeight: { type: Number, required: true },
    finalScore: { type: Number, required: true },
    passingScore: { type: Number, required: true },
    isPassing: { type: Boolean, required: true },
    summary: { type: String, required: true, maxlength: 5000 },
    recommendations: { type: [String], required: true, default: [] },
    evaluatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const OfferNegotiationEntrySchema = new Schema<IOfferNegotiationEntry>(
  {
    round: { type: Number, required: true },
    candidateMessage: { type: String, required: true, maxlength: 1000 },
    requestedSalary: { type: Number, required: false },
    aiResponse: { type: String, required: true, maxlength: 2000 },
    counterOfferSalary: { type: Number, required: false },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const ApplicationOfferSchema = new Schema<IApplicationOffer>(
  {
    positionTitle: { type: String, required: true },
    level: { type: Number, required: true },
    salarySimulated: { type: Number, required: true },
    salaryMin: { type: Number, required: true },
    salaryMax: { type: Number, required: true },
    negotiationRoundsLeft: { type: Number, required: true },
    maxNegotiationRounds: { type: Number, required: true },
    negotiationHistory: { type: [OfferNegotiationEntrySchema], required: true, default: [] },
    status: {
      type: String,
      enum: ['OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      required: true,
      default: 'OFFERED',
    },
    offeredAt: { type: Date, required: true, default: Date.now },
    acceptedAt: { type: Date, required: false },
    declinedAt: { type: Date, required: false },
    declineReason: { type: String, required: false, maxlength: 500 },
  },
  { _id: false }
);

const ApplicationSchema = new Schema<IApplicationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyJob',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: APPLICATION_MODES,
      required: true,
      default: 'PRODUCTION',
    },
    currentStage: {
      type: String,
      enum: APPLICATION_STAGES,
      required: true,
      default: 'APPLIED',
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      required: true,
      default: 'ACTIVE',
    },
    resumeAnalysisId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeAnalysis',
      required: true,
    },
    resumeAnalysisSnapshot: {
      type: ResumeAnalysisSnapshotSchema,
      required: true,
    },
    stageHistory: {
      type: [StageHistorySchema],
      required: true,
      default: () => [
        {
          stage: 'APPLIED',
          enteredAt: new Date(),
        },
      ],
    },
    aiJobId: {
      type: Schema.Types.ObjectId,
      ref: 'AIJob',
      required: false,
    },
    atsScore: {
      type: Number,
      min: 0,
      max: 100,
      required: false,
    },
    atsBreakdown: {
      type: {
        domainRelevance: { type: Number, min: 0, max: 100 },
        skillMatch: { type: Number, min: 0, max: 100 },
        experience: { type: Number, min: 0, max: 100 },
        clarity: { type: Number, min: 0, max: 100 },
      },
      required: false,
      _id: false,
    },
    atsFeedback: {
      type: String,
      required: false,
      maxlength: 5000,
    },
    interviewScore: {
      type: Number,
      min: 0,
      max: 100,
      required: false,
    },
    finalReview: {
      type: FinalReviewBreakdownSchema,
      required: false,
    },
    offer: {
      type: ApplicationOfferSchema,
      required: false,
    },
    rejectionReason: {
      type: String,
      required: false,
      maxlength: 1000,
    },
    withdrawalReason: {
      type: String,
      required: false,
      maxlength: 1000,
    },
    expiryReason: {
      type: String,
      required: false,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    collection: 'applications',
  }
);

// Compound indexes per Spec Section 26.11 and Section 20 Architecture
ApplicationSchema.index({ userId: 1, status: 1 });
ApplicationSchema.index({ userId: 1, jobId: 1, status: 1 });
ApplicationSchema.index({ companyId: 1, currentStage: 1 });
ApplicationSchema.index({ jobId: 1, status: 1 });

export const ApplicationModel =
  (mongoose.models.Application as mongoose.Model<IApplicationDocument>) ||
  mongoose.model<IApplicationDocument>('Application', ApplicationSchema);
