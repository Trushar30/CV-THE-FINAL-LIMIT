import mongoose, { Document, Schema, Types } from 'mongoose';
import { DEFAULT_PLATFORM_CONFIG, PlatformConfig } from '../config/platformConfig.schema.js';

export interface IPlatformConfigDocument extends Document {
  version: number;
  config: PlatformConfig;
  isActive: boolean;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const careerSubSchema = new Schema(
  {
    founderUnlockExp: { type: Number, required: true, default: 12000 },
    maxLevel: { type: Number, required: true, default: 10 },
  },
  { _id: false }
);

const employeeSubSchema = new Schema(
  {
    primaryTasksPerDay: { type: Number, required: true, default: 1 },
    bonusTasksPerDay: { type: Number, required: true, default: 1 },
    warningThreshold: { type: Number, required: true, default: 4 },
    warningExpirationDays: { type: Number, required: true, default: 30 },
    minimumPromotionScore: { type: Number, required: true, default: 70 },
  },
  { _id: false }
);

const applicationsSubSchema = new Schema(
  {
    maxActive: { type: Number, required: true, default: 5 },
  },
  { _id: false }
);

const founderSubSchema = new Schema(
  {
    starterCorpCoin: { type: Number, required: true, default: 1000 },
    companyCreationCost: { type: Number, required: true, default: 100 },
    maxActiveCompanies: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const companySubSchema = new Schema(
  {
    maxEmployees: { type: Number, required: true, default: 20 },
    bankruptcyThreshold: { type: Number, required: true, default: -1000 },
  },
  { _id: false }
);

const botsSubSchema = new Schema(
  {
    hiring: { type: Number, required: true, default: 250 },
    task: { type: Number, required: true, default: 250 },
    evaluation: { type: Number, required: true, default: 250 },
    advancedHiring: { type: Number, required: true, default: 400 },
    advancedTask: { type: Number, required: true, default: 400 },
    advancedEvaluation: { type: Number, required: true, default: 400 },
  },
  { _id: false }
);

const atsSubSchema = new Schema(
  {
    passingScore: { type: Number, required: true, default: 70 },
    domainWeight: { type: Number, required: true, default: 40 },
    skillWeight: { type: Number, required: true, default: 35 },
    experienceWeight: { type: Number, required: true, default: 15 },
    formattingWeight: { type: Number, required: true, default: 10 },
  },
  { _id: false }
);

const aiPoolSubSchema = new Schema(
  {
    providerPriority: {
      type: [String],
      required: true,
      default: ['gemini', 'openai', 'groq'],
    },
    geminiModel: { type: String, required: true, default: 'configured-demo-gemini-model' },
    openaiModel: { type: String, required: true, default: 'configured-demo-openai-model' },
    groqModel: { type: String, required: true, default: 'configured-demo-groq-model' },
  },
  { _id: false }
);

const aiSubSchema = new Schema(
  {
    retryPerProvider: { type: Number, required: true, default: 3 },
    timeoutMs: { type: Number, required: true, default: 30000 },
    demoPool: { type: aiPoolSubSchema, required: true },
    pipelinePool: { type: aiPoolSubSchema, required: true },
  },
  { _id: false }
);

const securitySubSchema = new Schema(
  {
    accessTokenMinutes: { type: Number, required: true, default: 15 },
    refreshTokenDays: { type: Number, required: true, default: 7 },
    maxLoginAttempts: { type: Number, required: true, default: 5 },
    lockoutMinutes: { type: Number, required: true, default: 15 },
    resumeMaxSizeBytes: { type: Number, required: true, default: 10485760 },
  },
  { _id: false }
);

const fullConfigSubSchema = new Schema(
  {
    version: { type: Number, required: true, default: 1 },
    career: { type: careerSubSchema, required: true },
    employee: { type: employeeSubSchema, required: true },
    applications: { type: applicationsSubSchema, required: true },
    founder: { type: founderSubSchema, required: true },
    company: { type: companySubSchema, required: true },
    bots: { type: botsSubSchema, required: true },
    ats: { type: atsSubSchema, required: true },
    ai: { type: aiSubSchema, required: true },
    security: { type: securitySubSchema, required: true },
  },
  { _id: false }
);

export const platformConfigMongoSchema = new Schema<IPlatformConfigDocument>(
  {
    version: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    config: {
      type: fullConfigSubSchema,
      required: true,
      default: () => ({ ...DEFAULT_PLATFORM_CONFIG }),
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'platformConfigs',
    timestamps: false,
    versionKey: false,
  }
);

// Enforce single active document invariant in MongoDB via partial unique index
platformConfigMongoSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const PlatformConfigModel = mongoose.model<IPlatformConfigDocument>(
  'PlatformConfig',
  platformConfigMongoSchema,
  'platformConfigs'
);
