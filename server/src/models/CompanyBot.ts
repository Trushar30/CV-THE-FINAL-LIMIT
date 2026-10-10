import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  type CompanyBotTier,
  COMPANY_BOT_TIERS,
  type CompanyBotType,
  COMPANY_BOT_TYPES,
} from '../types/enums.js';

export interface ICompanyBot {
  companyId: Types.ObjectId;
  botType: CompanyBotType;
  tier: CompanyBotTier;
  purchaseCost: number;
  isActive: boolean;
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyBotDocument extends ICompanyBot, Document {
  _id: Types.ObjectId;
}

/**
 * CompanyBot Model (Spec Section 26 Collection 9)
 *
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * This model references an abstract botType ('HIRING_BOT' | 'TASK_BOT' | 'EVALUATION_BOT').
 * It NEVER stores, configures, or couples to an underlying AI provider (e.g. Gemini, OpenAI, Groq).
 * Provider resolution is entirely delegated to the centralized AI Gateway and Provider Router.
 */
const CompanyBotSchema = new Schema<ICompanyBotDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    botType: {
      type: String,
      enum: COMPANY_BOT_TYPES,
      required: true,
      index: true,
    },
    tier: {
      type: String,
      enum: COMPANY_BOT_TIERS,
      required: true,
      default: 'BASIC',
    },
    purchaseCost: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    purchasedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'companyBots',
    timestamps: true,
  }
);

// Unique compound index: A company can only own at most one active bot instance per bot type
CompanyBotSchema.index({ companyId: 1, botType: 1 }, { unique: true });

export const CompanyBotModel =
  (mongoose.models.CompanyBot as mongoose.Model<ICompanyBotDocument>) ||
  mongoose.model<ICompanyBotDocument>('CompanyBot', CompanyBotSchema);
