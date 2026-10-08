import mongoose, { Document, Schema, Types } from 'mongoose';
import { type CareerDomain, CAREER_DOMAINS, type JobStatus, JOB_STATUSES } from '../types/enums.js';

export interface ICompanyJob {
  companyId: Types.ObjectId;
  title: string;
  description: string;
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  targetLevel?: number;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyJobDocument extends ICompanyJob, Document {
  _id: Types.ObjectId;
}

const CompanyJobSchema = new Schema<ICompanyJobDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    domain: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
      index: true,
    },
    minLevel: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 10,
    },
    maxLevel: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
      max: 10,
    },
    targetLevel: {
      type: Number,
      required: false,
      min: 1,
      max: 10,
    },
    requiredSkills: {
      type: [String],
      required: true,
      default: [],
    },
    openings: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      required: true,
      default: 'OPEN',
      index: true,
    },
    isOpen: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    collection: 'companyJobs',
    timestamps: true,
  }
);

// Compound indexes for optimal queries
CompanyJobSchema.index({ companyId: 1, status: 1 });
CompanyJobSchema.index({ domain: 1, status: 1 });
CompanyJobSchema.index({ domain: 1, minLevel: 1, maxLevel: 1 });

// Pre-save synchronization hook: ensure isOpen mirrors status correctly
CompanyJobSchema.pre('save', function (next) {
  this.isOpen = this.status === 'OPEN';
  if (!this.targetLevel) {
    this.targetLevel = this.minLevel;
  }
  next();
});

export const CompanyJobModel =
  (mongoose.models.CompanyJob as mongoose.Model<ICompanyJobDocument>) ||
  mongoose.model<ICompanyJobDocument>('CompanyJob', CompanyJobSchema);
