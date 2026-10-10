import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type CompanyScenarioStatus,
  COMPANY_SCENARIO_STATUSES,
  type ScenarioCategory,
  SCENARIO_CATEGORIES,
  type ScenarioOptionId,
  SCENARIO_OPTION_IDS,
} from '../types/enums.js';

export interface IScenarioModifier {
  revenueModifier: number; // Bounds: [-50, +150]
  expenseModifier: number; // Bounds: [-30, +100]
  immediateCost: number; // Bounds: [0, 200]
  satisfactionDelta: number; // Bounds: [-15, +15]
  reputationDelta: number; // Bounds: [-10, +10]
  productivityDelta: number; // Bounds: [-0.15, +0.15]
}

export interface IScenarioOption {
  optionId: ScenarioOptionId;
  title: string;
  description: string;
  expectedOutcome: string;
  modifierTemplateId: string;
  modifiers: IScenarioModifier;
}

export interface ICompanyScenario {
  companyId: Types.ObjectId;
  founderId: Types.ObjectId;
  date: string; // YYYY-MM-DD (UTC dayKey)
  scenarioPrompt: string;
  category: ScenarioCategory;
  options: IScenarioOption[];
  status: CompanyScenarioStatus;
  chosenOptionId?: ScenarioOptionId | null;
  calculatedDelta?: IScenarioModifier | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyScenarioDocument extends ICompanyScenario, Document {
  _id: Types.ObjectId;
}

const ScenarioModifierSchema = new Schema<IScenarioModifier>(
  {
    revenueModifier: { type: Number, required: true, default: 0 },
    expenseModifier: { type: Number, required: true, default: 0 },
    immediateCost: { type: Number, required: true, default: 0, min: 0 },
    satisfactionDelta: { type: Number, required: true, default: 0 },
    reputationDelta: { type: Number, required: true, default: 0 },
    productivityDelta: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const ScenarioOptionSchema = new Schema<IScenarioOption>(
  {
    optionId: {
      type: String,
      enum: SCENARIO_OPTION_IDS,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    expectedOutcome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    modifierTemplateId: {
      type: String,
      required: true,
      trim: true,
    },
    modifiers: {
      type: ScenarioModifierSchema,
      required: true,
    },
  },
  { _id: false }
);

const CompanyScenarioSchema = new Schema<ICompanyScenarioDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    founderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    scenarioPrompt: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: SCENARIO_CATEGORIES,
      required: true,
      default: 'ENGINEERING',
      index: true,
    },
    options: {
      type: [ScenarioOptionSchema],
      required: true,
      validate: {
        validator: (opts: IScenarioOption[]) => Array.isArray(opts) && opts.length >= 2 && opts.length <= 4,
        message: 'Scenario must provide between 2 and 4 options',
      },
    },
    status: {
      type: String,
      enum: COMPANY_SCENARIO_STATUSES,
      required: true,
      default: 'ACTIVE',
      index: true,
    },
    chosenOptionId: {
      type: String,
      enum: SCENARIO_OPTION_IDS,
      default: null,
    },
    calculatedDelta: {
      type: ScenarioModifierSchema,
      default: null,
    },
  },
  {
    collection: 'companyScenarios',
    timestamps: true,
  }
);

// Unique compound index: exactly 1 scenario per company per calendar date (UTC)
CompanyScenarioSchema.index({ companyId: 1, date: 1 }, { unique: true });

export const CompanyScenarioModel =
  (mongoose.models.CompanyScenario as mongoose.Model<ICompanyScenarioDocument>) ||
  mongoose.model<ICompanyScenarioDocument>('CompanyScenario', CompanyScenarioSchema);
