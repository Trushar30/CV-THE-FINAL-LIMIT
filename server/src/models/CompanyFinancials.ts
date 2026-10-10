import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICompanyFinancials {
  companyId: Types.ObjectId;
  date: string; // YYYY-MM-DD (UTC dayKey)
  revenue: number;
  expenses: number;
  profit: number;
  financialHealth: number;
  employeeRetentionRate: number;
  employeeCount: number;
  employeeSatisfaction: number;
  companyRating: number;
  recordedAt: Date;
}

export interface ICompanyFinancialsDocument extends ICompanyFinancials, Document {
  _id: Types.ObjectId;
}

const CompanyFinancialsSchema = new Schema<ICompanyFinancialsDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    revenue: {
      type: Number,
      required: true,
    },
    expenses: {
      type: Number,
      required: true,
    },
    profit: {
      type: Number,
      required: true,
    },
    financialHealth: {
      type: Number,
      required: true,
    },
    employeeRetentionRate: {
      type: Number,
      required: true,
      default: 100,
    },
    employeeCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    employeeSatisfaction: {
      type: Number,
      required: true,
      default: 70,
      min: 0,
      max: 100,
    },
    companyRating: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
      max: 100,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'companyFinancials',
    timestamps: false,
  }
);

// Indexes per Spec Collection 26 & idempotent UTC dayKey lookups
CompanyFinancialsSchema.index({ companyId: 1, recordedAt: -1 });
CompanyFinancialsSchema.index({ companyId: 1, date: 1 }, { unique: true });

export const CompanyFinancialsModel =
  (mongoose.models.CompanyFinancials as mongoose.Model<ICompanyFinancialsDocument>) ||
  mongoose.model<ICompanyFinancialsDocument>('CompanyFinancials', CompanyFinancialsSchema);
