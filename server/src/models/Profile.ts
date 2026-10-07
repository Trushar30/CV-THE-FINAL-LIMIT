import mongoose, { Document, Schema, Types } from 'mongoose';
import { CAREER_DOMAINS, type CareerDomain } from '../types/enums.js';

export interface IProject {
  title: string;
  description: string;
  techStack: string[];
  link?: string;
}

export interface ICertification {
  name: string;
  issuer: string;
  issueDate?: string;
  credentialId?: string;
}

export interface IProfile {
  userId: Types.ObjectId;
  displayName: string;
  domain: CareerDomain;
  skills: string[];
  resumeId?: Types.ObjectId;
  resumeAnalysisId?: Types.ObjectId;
  bio?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  projects?: IProject[];
  certifications?: ICertification[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfileDocument extends IProfile, Document {
  _id: Types.ObjectId;
}

const ProjectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    techStack: [{ type: String, trim: true }],
    link: { type: String, trim: true },
  },
  { _id: false }
);

const CertificationSchema = new Schema<ICertification>(
  {
    name: { type: String, required: true, trim: true },
    issuer: { type: String, required: true, trim: true },
    issueDate: { type: String, trim: true },
    credentialId: { type: String, trim: true },
  },
  { _id: false }
);

const ProfileSchema = new Schema<IProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
      index: true,
    },
    skills: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: false,
    },
    resumeAnalysisId: {
      type: Schema.Types.ObjectId,
      ref: 'ResumeAnalysis',
      required: false,
    },
    bio: {
      type: String,
      trim: true,
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    portfolioUrl: {
      type: String,
      trim: true,
    },
    projects: {
      type: [ProjectSchema],
      default: [],
    },
    certifications: {
      type: [CertificationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'profiles',
  }
);

export const ProfileModel =
  (mongoose.models.Profile as mongoose.Model<IProfileDocument>) ||
  mongoose.model<IProfileDocument>('Profile', ProfileSchema);
