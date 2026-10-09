import { describe, it, expect } from 'vitest';
import {
  platformConfigSchema,
  DEFAULT_PLATFORM_CONFIG,
  DEFAULT_LEVEL_TABLE,
  atsConfigSchema,
  employeeConfigSchema,
  careerConfigSchema,
  founderConfigSchema,
  companyConfigSchema,
  botsConfigSchema,
  aiConfigSchema,
  securityConfigSchema,
  applicationsConfigSchema,
} from '../config/platformConfig.schema.js';

describe('PlatformConfig Zod Schema & Sensible Limits', () => {
  it('should validate default configuration successfully', () => {
    const parsed = platformConfigSchema.parse(DEFAULT_PLATFORM_CONFIG);
    expect(parsed).toEqual(DEFAULT_PLATFORM_CONFIG);
    expect(parsed.version).toBe(1);
    expect(parsed.career.founderUnlockExp).toBe(12000);
    expect(parsed.career.maxLevel).toBe(10);
    expect(parsed.career.levelTable).toEqual(DEFAULT_LEVEL_TABLE);
    expect(parsed.career.levelTable.length).toBe(10);
    expect(parsed.employee.warningThreshold).toBe(4);
    expect(parsed.employee.warningExpirationDays).toBe(30);
    expect(parsed.employee.primaryTasksPerDay).toBe(1);
    expect(parsed.employee.bonusTasksPerDay).toBe(1);
    expect(parsed.employee.easyMaxExp).toBe(30);
    expect(parsed.employee.mediumMaxExp).toBe(60);
    expect(parsed.employee.hardMaxExp).toBe(100);
    expect(parsed.employee.minimumPromotionScore).toBe(70);
    expect(parsed.applications.maxActive).toBe(5);
    expect(parsed.founder.starterCorpCoin).toBe(1000);
    expect(parsed.founder.companyCreationCost).toBe(100);
    expect(parsed.founder.maxActiveCompanies).toBe(1);
    expect(parsed.company.maxEmployees).toBe(20);
    expect(parsed.company.bankruptcyThreshold).toBe(-1000);
    expect(parsed.bots.hiring).toBe(250);
    expect(parsed.bots.task).toBe(250);
    expect(parsed.bots.evaluation).toBe(250);
    expect(parsed.bots.advancedHiring).toBe(400);
    expect(parsed.bots.advancedTask).toBe(400);
    expect(parsed.bots.advancedEvaluation).toBe(400);
    expect(parsed.ats.passingScore).toBe(70);
    expect(parsed.ats.domainWeight).toBe(40);
    expect(parsed.ats.skillWeight).toBe(35);
    expect(parsed.ats.experienceWeight).toBe(15);
    expect(parsed.ats.formattingWeight).toBe(10);
    expect(parsed.ai.retryPerProvider).toBe(3);
    expect(parsed.ai.timeoutMs).toBe(30000);
    expect(parsed.security.accessTokenMinutes).toBe(15);
    expect(parsed.security.refreshTokenDays).toBe(7);
    expect(parsed.security.maxLoginAttempts).toBe(5);
    expect(parsed.security.lockoutMinutes).toBe(15);
    expect(parsed.security.resumeMaxSizeBytes).toBe(10485760);
  });

  describe('Career Schema Limits', () => {
    it('should reject founderUnlockExp < 1', () => {
      expect(() => careerConfigSchema.parse({ founderUnlockExp: 0, maxLevel: 10 })).toThrow();
    });

    it('should reject maxLevel < 1 or > 100', () => {
      expect(() => careerConfigSchema.parse({ founderUnlockExp: 12000, maxLevel: 0 })).toThrow();
      expect(() => careerConfigSchema.parse({ founderUnlockExp: 12000, maxLevel: 101 })).toThrow();
    });

    it('should reject invalid levelTable entries', () => {
      expect(() =>
        careerConfigSchema.parse({
          founderUnlockExp: 12000,
          maxLevel: 10,
          levelTable: [{ level: 0, title: 'Invalid', minExp: 0 }],
        })
      ).toThrow();

      expect(() =>
        careerConfigSchema.parse({
          founderUnlockExp: 12000,
          maxLevel: 10,
          levelTable: [{ level: 1, title: '', minExp: 0 }],
        })
      ).toThrow();

      expect(() =>
        careerConfigSchema.parse({
          founderUnlockExp: 12000,
          maxLevel: 10,
          levelTable: [{ level: 1, title: 'Intern', minExp: -50 }],
        })
      ).toThrow();
    });
  });

  describe('Employee Schema Limits', () => {
    it('should reject warningThreshold < 1', () => {
      expect(() =>
        employeeConfigSchema.parse({
          primaryTasksPerDay: 1,
          bonusTasksPerDay: 1,
          warningThreshold: 0,
          warningExpirationDays: 30,
          minimumPromotionScore: 70,
        })
      ).toThrow();
    });

    it('should reject warningExpirationDays < 1', () => {
      expect(() =>
        employeeConfigSchema.parse({
          primaryTasksPerDay: 1,
          bonusTasksPerDay: 1,
          warningThreshold: 4,
          warningExpirationDays: 0,
          minimumPromotionScore: 70,
        })
      ).toThrow();
    });

    it('should reject primaryTasksPerDay < 1', () => {
      expect(() =>
        employeeConfigSchema.parse({
          primaryTasksPerDay: 0,
          bonusTasksPerDay: 1,
          warningThreshold: 4,
          warningExpirationDays: 30,
          minimumPromotionScore: 70,
        })
      ).toThrow();
    });

    it('should reject bonusTasksPerDay < 0', () => {
      expect(() =>
        employeeConfigSchema.parse({
          primaryTasksPerDay: 1,
          bonusTasksPerDay: -1,
          warningThreshold: 4,
          warningExpirationDays: 30,
          minimumPromotionScore: 70,
        })
      ).toThrow();
    });

    it('should reject minimumPromotionScore < 0 or > 100', () => {
      expect(() =>
        employeeConfigSchema.parse({
          primaryTasksPerDay: 1,
          bonusTasksPerDay: 1,
          warningThreshold: 4,
          warningExpirationDays: 30,
          minimumPromotionScore: -5,
        })
      ).toThrow();
      expect(() =>
        employeeConfigSchema.parse({
          primaryTasksPerDay: 1,
          bonusTasksPerDay: 1,
          warningThreshold: 4,
          warningExpirationDays: 30,
          minimumPromotionScore: 105,
        })
      ).toThrow();
    });
  });

  describe('Applications Schema Limits', () => {
    it('should reject maxActive < 1', () => {
      expect(() => applicationsConfigSchema.parse({ maxActive: 0 })).toThrow();
    });
  });

  describe('Founder & Company Limits', () => {
    it('should reject negative starterCorpCoin or companyCreationCost', () => {
      expect(() =>
        founderConfigSchema.parse({
          starterCorpCoin: -10,
          companyCreationCost: 100,
          maxActiveCompanies: 1,
        })
      ).toThrow();

      expect(() =>
        founderConfigSchema.parse({
          starterCorpCoin: 1000,
          companyCreationCost: -50,
          maxActiveCompanies: 1,
        })
      ).toThrow();
    });

    it('should reject maxEmployees < 1', () => {
      expect(() =>
        companyConfigSchema.parse({
          maxEmployees: 0,
          bankruptcyThreshold: -1000,
        })
      ).toThrow();
    });

    it('should reject bankruptcyThreshold > 0', () => {
      expect(() =>
        companyConfigSchema.parse({
          maxEmployees: 20,
          bankruptcyThreshold: 10,
        })
      ).toThrow();
    });
  });

  describe('Bot Shop Limits', () => {
    it('should reject negative bot prices', () => {
      expect(() =>
        botsConfigSchema.parse({
          hiring: -100,
          task: 250,
          evaluation: 250,
          advancedHiring: 400,
          advancedTask: 400,
          advancedEvaluation: 400,
        })
      ).toThrow();
    });
  });

  describe('ATS Evaluation Weights & Sum to 100 Refinement', () => {
    it('should reject when ATS weights do not sum to 100', () => {
      expect(() =>
        atsConfigSchema.parse({
          passingScore: 70,
          domainWeight: 40,
          skillWeight: 35,
          experienceWeight: 15,
          formattingWeight: 20, // Sum = 110
        })
      ).toThrow(/sum exactly to 100/);
    });

    it('should accept valid ATS weights summing to 100', () => {
      const valid = atsConfigSchema.parse({
        passingScore: 70,
        domainWeight: 40,
        skillWeight: 30,
        experienceWeight: 20,
        formattingWeight: 10,
      });
      expect(
        valid.domainWeight + valid.skillWeight + valid.experienceWeight + valid.formattingWeight
      ).toBe(100);
    });
  });

  describe('AI Gateway Config Limits', () => {
    it('should reject retryPerProvider < 1 or > 10', () => {
      expect(() =>
        aiConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.ai,
          retryPerProvider: 0,
        })
      ).toThrow();

      expect(() =>
        aiConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.ai,
          retryPerProvider: 11,
        })
      ).toThrow();
    });

    it('should reject timeoutMs < 1000', () => {
      expect(() =>
        aiConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.ai,
          timeoutMs: 500,
        })
      ).toThrow();
    });

    it('should reject empty provider priority list', () => {
      expect(() =>
        aiConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.ai,
          demoPool: {
            ...DEFAULT_PLATFORM_CONFIG.ai.demoPool,
            providerPriority: [],
          },
        })
      ).toThrow();
    });

    it('should accept groq provider and reject obsolete grok code', () => {
      const valid = aiConfigSchema.parse({
        ...DEFAULT_PLATFORM_CONFIG.ai,
        demoPool: {
          providerPriority: ['groq', 'gemini'],
          geminiModel: 'gemini-1.5-pro',
          openaiModel: 'gpt-4o',
          groqModel: 'llama-3.3-70b-versatile',
        },
      });
      expect(valid.demoPool.providerPriority).toEqual(['groq', 'gemini']);
      expect(valid.demoPool.groqModel).toBe('llama-3.3-70b-versatile');

      expect(() =>
        aiConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.ai,
          demoPool: {
            // @ts-expect-error obsolete provider
            providerPriority: ['grok'],
            geminiModel: 'm1',
            openaiModel: 'm2',
            groqModel: 'm3',
          },
        })
      ).toThrow();
    });
  });

  describe('Security Configuration Limits', () => {
    it('should reject maxLoginAttempts < 1', () => {
      expect(() =>
        securityConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.security,
          maxLoginAttempts: 0,
        })
      ).toThrow();
    });

    it('should reject resumeMaxSizeBytes < 1024', () => {
      expect(() =>
        securityConfigSchema.parse({
          ...DEFAULT_PLATFORM_CONFIG.security,
          resumeMaxSizeBytes: 500,
        })
      ).toThrow();
    });
  });
});
