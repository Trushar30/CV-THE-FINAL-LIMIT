import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type CareerDomain,
  CAREER_DOMAINS,
  type CompanyEmployeeStatus,
  COMPANY_EMPLOYEE_STATUSES,
} from '../types/enums.js';

export interface IEmployeeHistoryEntry {
  status: CompanyEmployeeStatus;
  level?: number;
  positionTitle?: string;
  reason?: string;
  changedAt: Date;
}

export interface ICompanyEmployee {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  domain: CareerDomain;
  level: number;
  positionTitle: string;
  jobTitle?: string;
  status: CompanyEmployeeStatus;
  salarySimulated?: number;
  history: IEmployeeHistoryEntry[];
  startedAt: Date;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyEmployeeDocument extends ICompanyEmployee, Document {
  _id: Types.ObjectId;
}

const EmployeeHistoryEntrySchema = new Schema<IEmployeeHistoryEntry>(
  {
    status: {
      type: String,
      enum: COMPANY_EMPLOYEE_STATUSES,
      required: true,
    },
    level: {
      type: Number,
      required: false,
      min: 1,
      max: 10,
    },
    positionTitle: {
      type: String,
      required: false,
      trim: true,
    },
    reason: {
      type: String,
      required: false,
      trim: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const CompanyEmployeeSchema = new Schema<ICompanyEmployeeDocument>(
  {
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
      index: true,
    },
    domain: {
      type: String,
      enum: CAREER_DOMAINS,
      required: true,
    },
    level: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 10,
    },
    positionTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    jobTitle: {
      type: String,
      required: false,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: COMPANY_EMPLOYEE_STATUSES,
      required: true,
      default: 'ACTIVE',
      index: true,
    },
    salarySimulated: {
      type: Number,
      required: false,
      default: 0,
    },
    history: {
      type: [EmployeeHistoryEntrySchema],
      required: true,
      default: [],
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      required: false,
      default: null,
    },
  },
  {
    collection: 'companyEmployees',
    timestamps: true,
  }
);

// Indexes
CompanyEmployeeSchema.index({ companyId: 1, status: 1 });
CompanyEmployeeSchema.index({ userId: 1, status: 1 });

// Ensure positionTitle and jobTitle stay in sync
CompanyEmployeeSchema.pre('save', function (next) {
  if (this.positionTitle && !this.jobTitle) {
    this.jobTitle = this.positionTitle;
  } else if (this.jobTitle && !this.positionTitle) {
    this.positionTitle = this.jobTitle;
  }
  next();
});

export const CompanyEmployeeModel =
  (mongoose.models.CompanyEmployee as mongoose.Model<ICompanyEmployeeDocument>) ||
  mongoose.model<ICompanyEmployeeDocument>('CompanyEmployee', CompanyEmployeeSchema);
