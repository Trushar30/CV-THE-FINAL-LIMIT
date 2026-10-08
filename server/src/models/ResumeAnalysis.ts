import mongoose, { Document, Schema, Types } from 'mongoose';
import { CAREER_DOMAINS, type CareerDomain } from '../types/enums.js';

export type ResumeAnalysisStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SCANNED_UNREADABLE';

export interface IResumeAnalysis {
  resumeId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ResumeAnalysisStatus;
  aiJobId?: Types.ObjectId;
  name?: string;
  contact?: {
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedin?: string | null;
    github?: string | null;
    website?: string | null;
  };
  parsedSkills: string[];
  yearsOfExperience: number;
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
  extractedSummary?: string;
  domainClassification: CareerDomain;
  confidenceScore: number;
  rawAiOutput?: Record<string, unknown>;
  failureReason?: string;
  extractedText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IResumeAnalysisDocument extends IResumeAnalysis, Document {
  _id: Types.ObjectId;
}

const ResumeAnalysisSchema = new Schema<IResumeAnalysisDocument>(
  {
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SCANNED_UNREADABLE'],
      default: 'PENDING',
      index: true,
    },
    aiJobId: {
      type: Schema.Types.ObjectId,
      ref: 'AIJob',
      required: false,
    },
    name: {
      type: String,
      trim: true,
    },
    contact: {
      type: Schema.Types.Mixed,
      default: {},
    },
    parsedSkills: {
      type: [String],
      default: [],
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
    },
    education: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    workHistory: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    projects: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    certifications: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    extractedSummary: {
      type: String,
      trim: true,
    },
    domainClassification: {
      type: String,
      enum: CAREER_DOMAINS,
      default: 'SOFTWARE_ENGINEERING',
      index: true,
    },
    confidenceScore: {
      type: Number,
      default: 100,
    },
    rawAiOutput: {
      type: Schema.Types.Mixed,
    },
    failureReason: {
      type: String,
    },
    extractedText: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'resumeAnalyses',
  }
);

export const ResumeAnalysisModel = mongoose.model<IResumeAnalysisDocument>(
  'ResumeAnalysis',
  ResumeAnalysisSchema
);
export const ResumeAnalysis = ResumeAnalysisModel;
