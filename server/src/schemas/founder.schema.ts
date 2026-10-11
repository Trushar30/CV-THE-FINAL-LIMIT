import { z } from 'zod';
import { CAREER_DOMAINS } from '../types/enums.js';

export const unlockFounderBodySchema = z.object({
  confirm: z
    .boolean({
      required_error: 'Explicit confirmation (confirm: true) is required to unlock Founder Mode',
      invalid_type_error: 'Confirm flag must be a boolean',
    })
    .refine((val) => val === true, {
      message: 'Explicit confirmation (confirm: true) is required to unlock Founder Mode',
    }),
});

export type UnlockFounderBody = z.infer<typeof unlockFounderBodySchema>;

export const createFounderCompanySchema = z
  .object({
    name: z
      .string({
        required_error: 'Company name is required',
      })
      .trim()
      .min(2, 'Company name must be at least 2 characters')
      .max(100, 'Company name cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(2000, 'Company description cannot exceed 2000 characters')
      .optional()
      .or(z.literal(''))
      .transform((val) => {
        if (!val || val.trim().length === 0) {
          return 'Corporate engineering enterprise delivering innovative technical solutions.';
        }
        return val.trim();
      }),
    domain: z.enum(CAREER_DOMAINS as [string, ...string[]]).optional(),
    domainsHired: z
      .array(z.enum(CAREER_DOMAINS as [string, ...string[]]), {
        invalid_type_error: 'domainsHired must be an array of valid career domains',
      })
      .min(1, 'Company must specify at least one hired career domain')
      .optional(),
  })
  .transform((data) => {
    const domains =
      data.domainsHired && data.domainsHired.length > 0
        ? data.domainsHired
        : data.domain
          ? [data.domain]
          : ['SOFTWARE_ENGINEERING'];
    return {
      name: data.name,
      description:
        data.description && data.description.length >= 5
          ? data.description
          : 'Corporate engineering enterprise delivering innovative technical solutions.',
      domainsHired: domains as (typeof CAREER_DOMAINS)[number][],
    };
  });

export type CreateFounderCompanyInput = z.infer<typeof createFounderCompanySchema>;

const RAW_BOT_TYPES = [
  'HIRING_BOT',
  'TASK_BOT',
  'EVALUATION_BOT',
  'HIRING',
  'TASK',
  'EVALUATION',
  'ADVANCED_HIRING_BOT',
  'ADVANCED_TASK_BOT',
  'ADVANCED_EVALUATION_BOT',
  'ADVANCED_HIRING',
  'ADVANCED_TASK',
  'ADVANCED_EVALUATION',
] as const;

export const purchaseBotSchema = z.object({
  botType: z
    .enum(RAW_BOT_TYPES, {
      errorMap: () => ({
        message:
          'Invalid botType. Permitted bot types: HIRING_BOT, TASK_BOT, EVALUATION_BOT (or HIRING, TASK, EVALUATION)',
      }),
    })
    .transform((val) => {
      // Normalize aliases
      if (val === 'HIRING' || val === 'HIRING_BOT') return 'HIRING_BOT';
      if (val === 'TASK' || val === 'TASK_BOT') return 'TASK_BOT';
      if (val === 'EVALUATION' || val === 'EVALUATION_BOT') return 'EVALUATION_BOT';
      return val;
    }),
  tier: z.enum(['BASIC', 'ADVANCED']).default('BASIC'),
});

export type PurchaseBotInput = z.infer<typeof purchaseBotSchema>;

export const createFounderJobSchema = z
  .object({
    title: z
      .string({ required_error: 'Job title is required' })
      .trim()
      .min(2, 'Job title must be at least 2 characters')
      .max(120, 'Job title cannot exceed 120 characters'),
    description: z
      .string()
      .trim()
      .max(5000, 'Job description cannot exceed 5000 characters')
      .optional()
      .or(z.literal(''))
      .transform((val) => {
        if (!val || val.trim().length === 0) {
          return 'Join our autonomous engineering team to solve challenging domain problems and drive platform innovation.';
        }
        return val.trim();
      }),
    domain: z.enum(CAREER_DOMAINS as [string, ...string[]], {
      required_error: 'Job domain is required',
      invalid_type_error: 'Invalid career domain',
    }),
    seniorityLevel: z.number().int().min(1).max(10).optional(),
    targetLevel: z.number().int().min(1).max(10).optional(),
    minLevel: z.number().int().min(1).max(10).optional(),
    maxLevel: z.number().int().min(1).max(10).optional(),
    requiredSkills: z
      .array(z.string().trim().min(1))
      .min(1, 'At least one required skill must be specified')
      .default(['TypeScript']),
    openings: z.number().int().min(1).max(20).default(1),
  })
  .transform((data) => {
    const level = data.seniorityLevel ?? data.targetLevel ?? data.minLevel ?? 1;
    const minLvl = data.minLevel ?? level;
    const maxLvl = data.maxLevel ?? Math.min(10, Math.max(minLvl, level + 2));
    const desc =
      data.description && data.description.length >= 5
        ? data.description
        : 'Join our autonomous engineering team to solve challenging domain problems and drive platform innovation.';

    return {
      title: data.title,
      description: desc,
      domain: data.domain,
      seniorityLevel: level,
      targetLevel: level,
      minLevel: minLvl,
      maxLevel: maxLvl,
      requiredSkills: data.requiredSkills,
      openings: data.openings,
    };
  });

export type CreateFounderJobInput = z.infer<typeof createFounderJobSchema>;

export const listFounderApplicationsQuerySchema = z.object({
  jobId: z.string().optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListFounderApplicationsQuery = z.infer<typeof listFounderApplicationsQuerySchema>;
