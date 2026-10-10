import { z } from 'zod';
import {
  CAREER_ROLES,
  PLATFORM_ROLES,
  USER_STATUSES,
  CAREER_DOMAINS,
  type CareerRole,
  type PlatformRole,
  type UserStatus,
  type CareerDomain,
} from '../types/enums.js';
import {
  founderConfigSchema,
  employeeConfigSchema,
  companyConfigSchema,
  applicationsConfigSchema,
  aiConfigSchema,
  careerConfigSchema,
  botsConfigSchema,
  atsConfigSchema,
  securityConfigSchema,
} from '../config/platformConfig.schema.js';

/**
 * Zod validation schemas for Admin Management APIs (TASK P9.3).
 * Spec Sections 22, 25, 29, 30, 43.
 */

// 1. User Management Schemas
export const adminQueryUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  careerRole: z.enum(CAREER_ROLES as [CareerRole, ...CareerRole[]]).optional(),
  platformRole: z.enum(PLATFORM_ROLES as [PlatformRole, ...PlatformRole[]]).optional(),
  status: z.enum(USER_STATUSES as [UserStatus, ...UserStatus[]]).optional(),
  isSuspended: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  emailVerified: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});

export type AdminQueryUsersInput = z.infer<typeof adminQueryUsersSchema>;

export const adminUserIdParamSchema = z.object({
  id: z.string().trim().min(1, 'User ID is required'),
});

export const adminUpdateUserSchema = z.object({
  careerRole: z.enum(CAREER_ROLES as [CareerRole, ...CareerRole[]]).optional(),
  platformRole: z.enum(PLATFORM_ROLES as [PlatformRole, ...PlatformRole[]]).optional(),
  status: z.enum(USER_STATUSES as [UserStatus, ...UserStatus[]]).optional(),
  isSuspended: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(50).optional(),
  domain: z.enum(CAREER_DOMAINS as [CareerDomain, ...CareerDomain[]]).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  bio: z.string().max(500).optional(),
  reason: z
    .string({ required_error: 'Audit reason is required' })
    .trim()
    .min(10, 'Audit reason must be at least 10 characters'),
});

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const adminUserActionReasonSchema = z.object({
  reason: z
    .string({ required_error: 'Audit reason is required' })
    .trim()
    .min(10, 'Audit reason must be at least 10 characters'),
});

export type AdminUserActionReasonInput = z.infer<typeof adminUserActionReasonSchema>;

// 2. Dangerous Operations Schemas (Confirmation + Mandatory Reason >= 10 chars)
export const adminDeleteUserSchema = z.object({
  confirmation: z.literal('CONFIRM_DELETE_USER', {
    errorMap: () => ({
      message: 'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_DELETE_USER".',
    }),
  }),
  reason: z
    .string({ required_error: 'Audit reason is required' })
    .trim()
    .min(10, 'Audit reason must be at least 10 characters'),
});

export type AdminDeleteUserInput = z.infer<typeof adminDeleteUserSchema>;

export const adminDeleteCompanySchema = z.object({
  confirmation: z.literal('CONFIRM_DELETE_COMPANY', {
    errorMap: () => ({
      message: 'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_DELETE_COMPANY".',
    }),
  }),
  reason: z
    .string({ required_error: 'Audit reason is required' })
    .trim()
    .min(10, 'Audit reason must be at least 10 characters'),
});

export type AdminDeleteCompanyInput = z.infer<typeof adminDeleteCompanySchema>;

export const adminResetEconomySchema = z.object({
  confirmation: z.literal('CONFIRM_RESET_ECONOMY', {
    errorMap: () => ({
      message: 'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_RESET_ECONOMY".',
    }),
  }),
  scope: z.enum(['ALL', 'USER']).default('ALL'),
  targetUserId: z.string().trim().optional(),
  reason: z
    .string({ required_error: 'Audit reason is required' })
    .trim()
    .min(10, 'Audit reason must be at least 10 characters'),
});

export type AdminResetEconomyInput = z.infer<typeof adminResetEconomySchema>;

// 3. PlatformConfig Section Schemas
export const CONFIG_SECTION_NAMES = [
  'founder',
  'employee',
  'company',
  'applications',
  'ai',
  'career',
  'bots',
  'ats',
  'security',
] as const;

export type ConfigSectionName = (typeof CONFIG_SECTION_NAMES)[number];

export const adminConfigSectionParamSchema = z.object({
  section: z.enum(CONFIG_SECTION_NAMES, {
    errorMap: () => ({
      message: `Invalid configuration section. Allowed sections: ${CONFIG_SECTION_NAMES.join(', ')}`,
    }),
  }),
});

export const adminUpdateConfigSectionBodySchema = z.object({
  data: z.record(z.unknown()),
  reason: z
    .string({ required_error: 'Audit reason is required' })
    .trim()
    .min(10, 'Audit reason must be at least 10 characters'),
});

export type AdminUpdateConfigSectionBodyInput = z.infer<typeof adminUpdateConfigSectionBodySchema>;

/**
 * Map of section name to corresponding section Zod schema
 */
export const CONFIG_SECTION_SCHEMAS: Record<ConfigSectionName, z.ZodTypeAny> = {
  founder: founderConfigSchema,
  employee: employeeConfigSchema,
  company: companyConfigSchema,
  applications: applicationsConfigSchema,
  ai: aiConfigSchema,
  career: careerConfigSchema,
  bots: botsConfigSchema,
  ats: atsConfigSchema,
  security: securityConfigSchema,
};
