import { z } from 'zod';

/**
 * Zod validation schemas for PlatformConfig
 * Derived strictly from docs/CORPVERSE_SPECIFICATION.md Section 30.
 * Zero magic numbers allowed in business logic; all values originate here.
 */

export const salaryBandSchema = z.object({
  level: z.number().int().min(1).max(10),
  title: z.string(),
  minSalary: z.number().min(0),
  maxSalary: z.number().min(0),
  defaultSalary: z.number().min(0),
});

export const DEFAULT_SALARY_BANDS = [
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
];

export const careerConfigSchema = z.object({
  founderUnlockExp: z
    .number()
    .int('founderUnlockExp must be an integer')
    .min(1, 'founderUnlockExp must be at least 1')
    .default(12000),
  maxLevel: z
    .number()
    .int('maxLevel must be an integer')
    .min(1, 'maxLevel must be at least 1')
    .max(100, 'maxLevel cannot exceed 100')
    .default(10),
  salaryBands: z.array(salaryBandSchema).default(DEFAULT_SALARY_BANDS),
});

export const employeeConfigSchema = z.object({
  primaryTasksPerDay: z
    .number()
    .int('primaryTasksPerDay must be an integer')
    .min(1, 'primaryTasksPerDay must be at least 1')
    .max(20, 'primaryTasksPerDay cannot exceed 20')
    .default(1),
  bonusTasksPerDay: z
    .number()
    .int('bonusTasksPerDay must be an integer')
    .min(0, 'bonusTasksPerDay cannot be negative')
    .max(20, 'bonusTasksPerDay cannot exceed 20')
    .default(1),
  warningThreshold: z
    .number()
    .int('warningThreshold must be an integer')
    .min(1, 'warningThreshold must be at least 1')
    .max(20, 'warningThreshold cannot exceed 20')
    .default(4),
  warningExpirationDays: z
    .number()
    .int('warningExpirationDays must be an integer')
    .min(1, 'warningExpirationDays must be at least 1')
    .max(365, 'warningExpirationDays cannot exceed 365')
    .default(30),
  minimumPromotionScore: z
    .number()
    .min(0, 'minimumPromotionScore must be at least 0')
    .max(100, 'minimumPromotionScore cannot exceed 100')
    .default(70),
});

export const applicationsConfigSchema = z.object({
  maxActive: z
    .number()
    .int('maxActive must be an integer')
    .min(1, 'maxActive must be at least 1')
    .max(50, 'maxActive cannot exceed 50')
    .default(5),
});

export const founderConfigSchema = z.object({
  starterCorpCoin: z
    .number()
    .int('starterCorpCoin must be an integer')
    .min(0, 'starterCorpCoin cannot be negative')
    .default(1000),
  companyCreationCost: z
    .number()
    .int('companyCreationCost must be an integer')
    .min(0, 'companyCreationCost cannot be negative')
    .default(100),
  maxActiveCompanies: z
    .number()
    .int('maxActiveCompanies must be an integer')
    .min(1, 'maxActiveCompanies must be at least 1')
    .max(10, 'maxActiveCompanies cannot exceed 10')
    .default(1),
});

export const companyConfigSchema = z.object({
  maxEmployees: z
    .number()
    .int('maxEmployees must be an integer')
    .min(1, 'maxEmployees must be at least 1')
    .max(1000, 'maxEmployees cannot exceed 1000')
    .default(20),
  bankruptcyThreshold: z
    .number()
    .int('bankruptcyThreshold must be an integer')
    .max(0, 'bankruptcyThreshold must be less than or equal to 0')
    .min(-100000, 'bankruptcyThreshold cannot be less than -100,000')
    .default(-1000),
});

export const botsConfigSchema = z.object({
  hiring: z
    .number()
    .int('hiring bot cost must be an integer')
    .min(0, 'hiring bot cost cannot be negative')
    .default(250),
  task: z
    .number()
    .int('task bot cost must be an integer')
    .min(0, 'task bot cost cannot be negative')
    .default(250),
  evaluation: z
    .number()
    .int('evaluation bot cost must be an integer')
    .min(0, 'evaluation bot cost cannot be negative')
    .default(250),
  advancedHiring: z
    .number()
    .int('advancedHiring bot cost must be an integer')
    .min(0, 'advancedHiring bot cost cannot be negative')
    .default(400),
  advancedTask: z
    .number()
    .int('advancedTask bot cost must be an integer')
    .min(0, 'advancedTask bot cost cannot be negative')
    .default(400),
  advancedEvaluation: z
    .number()
    .int('advancedEvaluation bot cost must be an integer')
    .min(0, 'advancedEvaluation bot cost cannot be negative')
    .default(400),
});

export const atsConfigSchema = z
  .object({
    passingScore: z
      .number()
      .min(0, 'passingScore must be at least 0')
      .max(100, 'passingScore cannot exceed 100')
      .default(70),
    domainWeight: z
      .number()
      .min(0, 'domainWeight must be at least 0')
      .max(100, 'domainWeight cannot exceed 100')
      .default(40),
    skillWeight: z
      .number()
      .min(0, 'skillWeight must be at least 0')
      .max(100, 'skillWeight cannot exceed 100')
      .default(35),
    experienceWeight: z
      .number()
      .min(0, 'experienceWeight must be at least 0')
      .max(100, 'experienceWeight cannot exceed 100')
      .default(15),
    formattingWeight: z
      .number()
      .min(0, 'formattingWeight must be at least 0')
      .max(100, 'formattingWeight cannot exceed 100')
      .default(10),
  })
  .refine(
    (val) =>
      val.domainWeight + val.skillWeight + val.experienceWeight + val.formattingWeight === 100,
    {
      message:
        'ATS component weights (domain, skill, experience, formatting) must sum exactly to 100',
      path: ['weightsSum'],
    }
  );

export const aiPoolConfigSchema = z.object({
  providerPriority: z
    .array(z.enum(['gemini', 'openai', 'groq']))
    .min(1, 'providerPriority must include at least one provider')
    .default(['gemini', 'openai', 'groq']),
  geminiModel: z
    .string()
    .min(1, 'geminiModel must be a non-empty string')
    .default('configured-demo-gemini-model'),
  openaiModel: z
    .string()
    .min(1, 'openaiModel must be a non-empty string')
    .default('configured-demo-openai-model'),
  groqModel: z
    .string()
    .min(1, 'groqModel must be a non-empty string')
    .default('configured-demo-groq-model'),
});

export const aiConfigSchema = z.object({
  retryPerProvider: z
    .number()
    .int('retryPerProvider must be an integer')
    .min(1, 'retryPerProvider must be at least 1')
    .max(10, 'retryPerProvider cannot exceed 10')
    .default(3),
  timeoutMs: z
    .number()
    .int('timeoutMs must be an integer')
    .min(1000, 'timeoutMs must be at least 1000ms')
    .max(300000, 'timeoutMs cannot exceed 300,000ms')
    .default(30000),
  demoPool: aiPoolConfigSchema.default({
    providerPriority: ['gemini', 'openai', 'groq'],
    geminiModel: 'configured-demo-gemini-model',
    openaiModel: 'configured-demo-openai-model',
    groqModel: 'configured-demo-groq-model',
  }),
  pipelinePool: aiPoolConfigSchema.default({
    providerPriority: ['gemini', 'openai', 'groq'],
    geminiModel: 'configured-pipeline-gemini-model',
    openaiModel: 'configured-pipeline-openai-model',
    groqModel: 'configured-pipeline-groq-model',
  }),
});

export const securityConfigSchema = z.object({
  accessTokenMinutes: z
    .number()
    .int('accessTokenMinutes must be an integer')
    .min(1, 'accessTokenMinutes must be at least 1')
    .max(1440, 'accessTokenMinutes cannot exceed 1440 (24 hours)')
    .default(15),
  refreshTokenDays: z
    .number()
    .int('refreshTokenDays must be an integer')
    .min(1, 'refreshTokenDays must be at least 1')
    .max(90, 'refreshTokenDays cannot exceed 90 days')
    .default(7),
  maxLoginAttempts: z
    .number()
    .int('maxLoginAttempts must be an integer')
    .min(1, 'maxLoginAttempts must be at least 1')
    .max(20, 'maxLoginAttempts cannot exceed 20')
    .default(5),
  lockoutMinutes: z
    .number()
    .int('lockoutMinutes must be an integer')
    .min(1, 'lockoutMinutes must be at least 1')
    .max(1440, 'lockoutMinutes cannot exceed 1440 (24 hours)')
    .default(15),
  resumeMaxSizeBytes: z
    .number()
    .int('resumeMaxSizeBytes must be an integer')
    .min(1024, 'resumeMaxSizeBytes must be at least 1 KB')
    .max(52428800, 'resumeMaxSizeBytes cannot exceed 50 MB')
    .default(10485760), // 10 MB
});

export const stageSettingsSchema = z.object({
  questionCount: z
    .number()
    .int('questionCount must be an integer')
    .min(1, 'questionCount must be at least 1')
    .max(20, 'questionCount cannot exceed 20')
    .default(3),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  passingScore: z
    .number()
    .min(0, 'passingScore must be at least 0')
    .max(100, 'passingScore cannot exceed 100')
    .default(70),
  demoQuestionCount: z
    .number()
    .int('demoQuestionCount must be an integer')
    .min(1, 'demoQuestionCount must be at least 1')
    .max(10, 'demoQuestionCount cannot exceed 10')
    .default(1),
  demoDifficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
});

export const finalReviewWeightsSchema = z.object({
  atsWeight: z.number().min(0).max(100).default(15),
  screeningWeight: z.number().min(0).max(100).default(20),
  assessmentWeight: z.number().min(0).max(100).default(30),
  interviewWeight: z.number().min(0).max(100).default(35),
  passingScore: z.number().min(0).max(100).default(70),
});

export const offerSettingsSchema = z.object({
  maxNegotiationRounds: z.number().int().min(1).max(10).default(3),
  demoMaxNegotiationRounds: z.number().int().min(1).max(10).default(1),
  declineStatus: z.enum(['WITHDRAWN', 'REJECTED']).default('WITHDRAWN'),
});

export const stagesConfigSchema = z.object({
  screening: stageSettingsSchema.default({
    questionCount: 3,
    difficulty: 'MEDIUM',
    passingScore: 70,
    demoQuestionCount: 1,
    demoDifficulty: 'EASY',
  }),
  assessment: stageSettingsSchema.default({
    questionCount: 3,
    difficulty: 'HARD',
    passingScore: 70,
    demoQuestionCount: 1,
    demoDifficulty: 'EASY',
  }),
  interview: stageSettingsSchema.default({
    questionCount: 5,
    difficulty: 'HARD',
    passingScore: 75,
    demoQuestionCount: 1,
    demoDifficulty: 'EASY',
  }),
  finalReview: finalReviewWeightsSchema.default({
    atsWeight: 15,
    screeningWeight: 20,
    assessmentWeight: 30,
    interviewWeight: 35,
    passingScore: 70,
  }),
  offer: offerSettingsSchema.default({
    maxNegotiationRounds: 3,
    demoMaxNegotiationRounds: 1,
    declineStatus: 'WITHDRAWN',
  }),
});

/**
 * Root canonical PlatformConfig schema matching Specification Section 30
 */
export const platformConfigSchema = z.object({
  version: z
    .number()
    .int('version must be an integer')
    .min(1, 'version must be at least 1')
    .default(1),
  career: careerConfigSchema,
  employee: employeeConfigSchema,
  applications: applicationsConfigSchema,
  founder: founderConfigSchema,
  company: companyConfigSchema,
  bots: botsConfigSchema,
  ats: atsConfigSchema,
  stages: stagesConfigSchema.default({}),
  ai: aiConfigSchema,
  security: securityConfigSchema,
});

/**
 * Infer TypeScript types from Zod schemas
 */
export type CareerConfig = z.infer<typeof careerConfigSchema>;
export type SalaryBandConfig = z.infer<typeof salaryBandSchema>;
export type EmployeeConfig = z.infer<typeof employeeConfigSchema>;
export type ApplicationsConfig = z.infer<typeof applicationsConfigSchema>;
export type FounderConfig = z.infer<typeof founderConfigSchema>;
export type CompanyConfig = z.infer<typeof companyConfigSchema>;
export type BotsConfig = z.infer<typeof botsConfigSchema>;
export type AtsConfig = z.infer<typeof atsConfigSchema>;
export type StageSettingsConfig = z.infer<typeof stageSettingsSchema>;
export type FinalReviewWeightsConfig = z.infer<typeof finalReviewWeightsSchema>;
export type OfferSettingsConfig = z.infer<typeof offerSettingsSchema>;
export type StagesConfig = z.infer<typeof stagesConfigSchema>;
export type AiPoolConfig = z.infer<typeof aiPoolConfigSchema>;
export type AiConfig = z.infer<typeof aiConfigSchema>;
export type SecurityConfig = z.infer<typeof securityConfigSchema>;
export type PlatformConfig = z.infer<typeof platformConfigSchema>;

/**
 * Spec Section 30 Default PlatformConfig instance
 */
export const DEFAULT_PLATFORM_CONFIG: Readonly<PlatformConfig> = Object.freeze({
  version: 1,
  career: {
    founderUnlockExp: 12000,
    maxLevel: 10,
    salaryBands: DEFAULT_SALARY_BANDS,
  },
  employee: {
    primaryTasksPerDay: 1,
    bonusTasksPerDay: 1,
    warningThreshold: 4,
    warningExpirationDays: 30,
    minimumPromotionScore: 70,
  },
  applications: {
    maxActive: 5,
  },
  founder: {
    starterCorpCoin: 1000,
    companyCreationCost: 100,
    maxActiveCompanies: 1,
  },
  company: {
    maxEmployees: 20,
    bankruptcyThreshold: -1000,
  },
  bots: {
    hiring: 250,
    task: 250,
    evaluation: 250,
    advancedHiring: 400,
    advancedTask: 400,
    advancedEvaluation: 400,
  },
  ats: {
    passingScore: 70,
    domainWeight: 40,
    skillWeight: 35,
    experienceWeight: 15,
    formattingWeight: 10,
  },
  stages: {
    screening: {
      questionCount: 3,
      difficulty: 'MEDIUM' as const,
      passingScore: 70,
      demoQuestionCount: 1,
      demoDifficulty: 'EASY' as const,
    },
    assessment: {
      questionCount: 3,
      difficulty: 'HARD' as const,
      passingScore: 70,
      demoQuestionCount: 1,
      demoDifficulty: 'EASY' as const,
    },
    interview: {
      questionCount: 5,
      difficulty: 'HARD' as const,
      passingScore: 75,
      demoQuestionCount: 1,
      demoDifficulty: 'EASY' as const,
    },
    finalReview: {
      atsWeight: 15,
      screeningWeight: 20,
      assessmentWeight: 30,
      interviewWeight: 35,
      passingScore: 70,
    },
    offer: {
      maxNegotiationRounds: 3,
      demoMaxNegotiationRounds: 1,
      declineStatus: 'WITHDRAWN' as const,
    },
  },
  ai: {
    retryPerProvider: 3,
    timeoutMs: 30000,
    demoPool: {
      providerPriority: ['gemini', 'openai', 'groq'] as ('gemini' | 'openai' | 'groq')[],
      geminiModel: 'configured-demo-gemini-model',
      openaiModel: 'configured-demo-openai-model',
      groqModel: 'configured-demo-groq-model',
    },
    pipelinePool: {
      providerPriority: ['gemini', 'openai', 'groq'] as ('gemini' | 'openai' | 'groq')[],
      geminiModel: 'configured-pipeline-gemini-model',
      openaiModel: 'configured-pipeline-openai-model',
      groqModel: 'configured-pipeline-groq-model',
    },
  },
  security: {
    accessTokenMinutes: 15,
    refreshTokenDays: 7,
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
    resumeMaxSizeBytes: 10485760,
  },
});
