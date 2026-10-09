import mongoose, { Document, Schema, Types } from 'mongoose';
import { DEFAULT_PLATFORM_CONFIG, PlatformConfig } from '../config/platformConfig.schema.js';

export interface IPlatformConfigDocument extends Document {
  version: number;
  config: PlatformConfig;
  isActive: boolean;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const salaryBandSubSchema = new Schema(
  {
    level: { type: Number, required: true },
    title: { type: String, required: true },
    minSalary: { type: Number, required: true },
    maxSalary: { type: Number, required: true },
    defaultSalary: { type: Number, required: true },
  },
  { _id: false }
);

const careerSubSchema = new Schema(
  {
    founderUnlockExp: { type: Number, required: true, default: 12000 },
    maxLevel: { type: Number, required: true, default: 10 },
    salaryBands: {
      type: [salaryBandSubSchema],
      required: true,
      default: () => [
        { level: 1, title: 'Intern', minSalary: 45000, maxSalary: 60000, defaultSalary: 50000 },
        { level: 2, title: 'Junior', minSalary: 60000, maxSalary: 80000, defaultSalary: 70000 },
        { level: 3, title: 'Junior+', minSalary: 80000, maxSalary: 100000, defaultSalary: 90000 },
        { level: 4, title: 'Associate', minSalary: 100000, maxSalary: 125000, defaultSalary: 110000 },
        { level: 5, title: 'Mid', minSalary: 125000, maxSalary: 155000, defaultSalary: 140000 },
        { level: 6, title: 'Mid+', minSalary: 155000, maxSalary: 190000, defaultSalary: 170000 },
        { level: 7, title: 'Senior', minSalary: 190000, maxSalary: 230000, defaultSalary: 210000 },
        { level: 8, title: 'Senior+', minSalary: 230000, maxSalary: 280000, defaultSalary: 250000 },
        { level: 9, title: 'Lead', minSalary: 280000, maxSalary: 340000, defaultSalary: 300000 },
        { level: 10, title: 'Principal', minSalary: 340000, maxSalary: 420000, defaultSalary: 380000 },
      ],
    },
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

const stageSettingSubSchema = new Schema(
  {
    questionCount: { type: Number, required: true, default: 3 },
    difficulty: { type: String, required: true, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'MEDIUM' },
    passingScore: { type: Number, required: true, default: 70 },
    demoQuestionCount: { type: Number, required: true, default: 1 },
    demoDifficulty: { type: String, required: true, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'EASY' },
  },
  { _id: false }
);

const finalReviewSubSchema = new Schema(
  {
    atsWeight: { type: Number, required: true, default: 15 },
    screeningWeight: { type: Number, required: true, default: 20 },
    assessmentWeight: { type: Number, required: true, default: 30 },
    interviewWeight: { type: Number, required: true, default: 35 },
    passingScore: { type: Number, required: true, default: 70 },
  },
  { _id: false }
);

const offerSubSchema = new Schema(
  {
    maxNegotiationRounds: { type: Number, required: true, default: 3 },
    demoMaxNegotiationRounds: { type: Number, required: true, default: 1 },
    declineStatus: { type: String, required: true, enum: ['WITHDRAWN', 'REJECTED'], default: 'WITHDRAWN' },
  },
  { _id: false }
);

const stagesSubSchema = new Schema(
  {
    screening: {
      type: stageSettingSubSchema,
      required: true,
      default: () => ({ questionCount: 3, difficulty: 'MEDIUM', passingScore: 70, demoQuestionCount: 1, demoDifficulty: 'EASY' }),
    },
    assessment: {
      type: stageSettingSubSchema,
      required: true,
      default: () => ({ questionCount: 3, difficulty: 'HARD', passingScore: 70, demoQuestionCount: 1, demoDifficulty: 'EASY' }),
    },
    interview: {
      type: stageSettingSubSchema,
      required: true,
      default: () => ({ questionCount: 5, difficulty: 'HARD', passingScore: 75, demoQuestionCount: 1, demoDifficulty: 'EASY' }),
    },
    finalReview: {
      type: finalReviewSubSchema,
      required: true,
      default: () => ({
        atsWeight: 15,
        screeningWeight: 20,
        assessmentWeight: 30,
        interviewWeight: 35,
        passingScore: 70,
      }),
    },
    offer: {
      type: offerSubSchema,
      required: true,
      default: () => ({
        maxNegotiationRounds: 3,
        demoMaxNegotiationRounds: 1,
        declineStatus: 'WITHDRAWN',
      }),
    },
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
    stages: {
      type: stagesSubSchema,
      required: true,
      default: () => ({
        screening: { questionCount: 3, difficulty: 'MEDIUM', passingScore: 70, demoQuestionCount: 1, demoDifficulty: 'EASY' },
        assessment: { questionCount: 3, difficulty: 'HARD', passingScore: 70, demoQuestionCount: 1, demoDifficulty: 'EASY' },
        interview: { questionCount: 5, difficulty: 'HARD', passingScore: 75, demoQuestionCount: 1, demoDifficulty: 'EASY' },
        finalReview: { atsWeight: 15, screeningWeight: 20, assessmentWeight: 30, interviewWeight: 35, passingScore: 70 },
        offer: { maxNegotiationRounds: 3, demoMaxNegotiationRounds: 1, declineStatus: 'WITHDRAWN' },
      }),
    },
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
