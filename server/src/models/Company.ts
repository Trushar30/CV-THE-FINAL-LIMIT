import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type CareerDomain,
  CAREER_DOMAINS,
  type CompanyStatus,
  COMPANY_STATUSES,
  type CompanyType,
  COMPANY_TYPES,
} from '../types/enums.js';

export interface ICompanyRatings {
  overall: number;
  culture?: number;
  workLife?: number;
  technicalExcellence?: number;
}

export interface ICompany {
  name: string;
  description: string;
  type: CompanyType;
  isPlatformCompany: boolean;
  ownerId?: Types.ObjectId | null;
  domainsHired: CareerDomain[];
  status: CompanyStatus;
  ratings: ICompanyRatings;
  companyRating: number;
  financialHealth: number;
  employeeCount: number;
  maxEmployees: number;
  aiProviderPool: 'PIPELINE' | 'DEMO';
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyDocument extends ICompany, Document {
  _id: Types.ObjectId;
}

const CompanyRatingsSchema = new Schema<ICompanyRatings>(
  {
    overall: { type: Number, required: true, default: 50, min: 0, max: 100 },
    culture: { type: Number, required: false, default: 50, min: 0, max: 100 },
    workLife: { type: Number, required: false, default: 50, min: 0, max: 100 },
    technicalExcellence: { type: Number, required: false, default: 50, min: 0, max: 100 },
  },
  { _id: false }
);

const CompanySchema = new Schema<ICompanyDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: COMPANY_TYPES,
      required: true,
      default: 'PLATFORM',
      index: true,
    },
    isPlatformCompany: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    domainsHired: {
      type: [String],
      enum: CAREER_DOMAINS,
      required: true,
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length > 0,
        message: 'A company must hire for at least one domain',
      },
      index: true,
    },
    status: {
      type: String,
      enum: COMPANY_STATUSES,
      required: true,
      default: 'ACTIVE',
      index: true,
    },
    ratings: {
      type: CompanyRatingsSchema,
      required: true,
      default: () => ({ overall: 50, culture: 50, workLife: 50, technicalExcellence: 50 }),
    },
    companyRating: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
      max: 100,
    },
    financialHealth: {
      type: Number,
      required: true,
      default: 0,
    },
    employeeCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maxEmployees: {
      type: Number,
      required: true,
      default: 20,
      min: 1,
    },
    aiProviderPool: {
      type: String,
      enum: ['PIPELINE', 'DEMO'],
      required: true,
      default: 'PIPELINE',
    },
  },
  {
    collection: 'companies',
    timestamps: true,
  }
);

// Pre-save synchronization hook: ensure isPlatformCompany and ratings mirror correctly
CompanySchema.pre('save', function (next) {
  if (this.type === 'PLATFORM') {
    this.isPlatformCompany = true;
    this.ownerId = null;
  } else if (this.type === 'FOUNDER') {
    this.isPlatformCompany = false;
  }

  if (this.isModified('companyRating') && !this.isModified('ratings.overall')) {
    if (!this.ratings) {
      this.ratings = { overall: this.companyRating };
    } else {
      this.ratings.overall = this.companyRating;
    }
  } else if (this.ratings?.overall !== undefined) {
    this.companyRating = this.ratings.overall;
  }

  next();
});

export const CompanyModel =
  (mongoose.models.Company as mongoose.Model<ICompanyDocument>) ||
  mongoose.model<ICompanyDocument>('Company', CompanySchema);
