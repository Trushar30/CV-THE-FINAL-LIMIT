import mongoose, { Document, Schema, Types } from 'mongoose';
import { type ScenarioOptionId, SCENARIO_OPTION_IDS } from '../types/enums.js';
import type { IScenarioModifier } from './CompanyScenario.js';

export interface ICompanyDecision {
  companyId: Types.ObjectId;
  founderId: Types.ObjectId;
  scenarioId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  chosenOptionId: ScenarioOptionId;
  modifierTemplateId: string;
  calculatedDelta: IScenarioModifier;
  rationale?: string;
  createdAt: Date;
}

export interface ICompanyDecisionDocument extends ICompanyDecision, Document {
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

const CompanyDecisionSchema = new Schema<ICompanyDecisionDocument>(
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
    scenarioId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyScenario',
      required: true,
      unique: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    chosenOptionId: {
      type: String,
      enum: SCENARIO_OPTION_IDS,
      required: true,
    },
    modifierTemplateId: {
      type: String,
      required: true,
      trim: true,
    },
    calculatedDelta: {
      type: ScenarioModifierSchema,
      required: true,
    },
    rationale: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    collection: 'companyDecisions',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

CompanyDecisionSchema.index({ companyId: 1, date: 1 });

export const CompanyDecisionModel =
  (mongoose.models.CompanyDecision as mongoose.Model<ICompanyDecisionDocument>) ||
  mongoose.model<ICompanyDecisionDocument>('CompanyDecision', CompanyDecisionSchema);
