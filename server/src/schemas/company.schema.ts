import { z } from 'zod';
import {
  type CareerDomain,
  CAREER_DOMAINS,
  type CompanyStatus,
  COMPANY_STATUSES,
  type CompanyType,
  COMPANY_TYPES,
  type JobStatus,
  JOB_STATUSES,
} from '../types/enums.js';

const careerDomainsTuple = CAREER_DOMAINS as unknown as [CareerDomain, ...CareerDomain[]];
const companyStatusesTuple = COMPANY_STATUSES as unknown as [CompanyStatus, ...CompanyStatus[]];
const companyTypesTuple = COMPANY_TYPES as unknown as [CompanyType, ...CompanyType[]];
const jobStatusesTuple = JOB_STATUSES as unknown as [JobStatus, ...JobStatus[]];

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdValidator = z
  .string()
  .regex(objectIdRegex, 'Must be a valid 24-character hexadecimal ObjectId');

export const listCompaniesQuerySchema = z.object({
  domain: z.enum(careerDomainsTuple).optional(),
  status: z.enum(companyStatusesTuple).optional(),
  type: z.enum(companyTypesTuple).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCompaniesQueryInput = z.infer<typeof listCompaniesQuerySchema>;

export const listJobsQuerySchema = z.object({
  domain: z.enum(careerDomainsTuple).optional(),
  companyId: objectIdValidator.optional(),
  minLevel: z.coerce.number().int().min(1).max(10).optional(),
  maxLevel: z.coerce.number().int().min(1).max(10).optional(),
  status: z.enum(jobStatusesTuple).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListJobsQueryInput = z.infer<typeof listJobsQuerySchema>;

export const companyRatingsSchema = z.object({
  overall: z.number().min(0).max(100).default(50),
  culture: z.number().min(0).max(100).optional(),
  workLife: z.number().min(0).max(100).optional(),
  technicalExcellence: z.number().min(0).max(100).optional(),
});

export const adminCreateCompanySchema = z.object({
  name: z.string().trim().min(2, 'Name must have at least 2 characters').max(100),
  description: z.string().trim().min(10, 'Description must have at least 10 characters').max(2000),
  type: z.enum(companyTypesTuple).default('PLATFORM'),
  domainsHired: z.array(z.enum(careerDomainsTuple)).min(1, 'At least one domain must be specified'),
  companyRating: z.number().min(0).max(100).optional(),
  ratings: companyRatingsSchema.optional(),
  maxEmployees: z.number().int().min(1).max(1000).optional(),
  financialHealth: z.number().optional(),
  reason: z.string().trim().min(3, 'Audit reason must be at least 3 characters').max(500),
});

export type AdminCreateCompanyInput = z.infer<typeof adminCreateCompanySchema>;

export const adminUpdateCompanySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    status: z.enum(companyStatusesTuple).optional(),
    domainsHired: z.array(z.enum(careerDomainsTuple)).min(1).optional(),
    companyRating: z.number().min(0).max(100).optional(),
    ratings: companyRatingsSchema.optional(),
    maxEmployees: z.number().int().min(1).max(1000).optional(),
    financialHealth: z.number().optional(),
    reason: z.string().trim().min(3, 'Audit reason must be at least 3 characters').max(500),
  })
  .refine(
    (data) => {
      const keys = Object.keys(data).filter((k) => k !== 'reason');
      return keys.length > 0;
    },
    { message: 'At least one field to update must be provided along with reason' }
  );

export type AdminUpdateCompanyInput = z.infer<typeof adminUpdateCompanySchema>;

export const adminCreateJobSchema = z
  .object({
    companyId: objectIdValidator,
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().min(10).max(5000),
    domain: z.enum(careerDomainsTuple),
    minLevel: z.number().int().min(1).max(10).default(1),
    maxLevel: z.number().int().min(1).max(10).default(10),
    requiredSkills: z.array(z.string().trim().min(1)).min(1, 'At least one skill is required'),
    openings: z.number().int().min(1).default(1),
    status: z.enum(jobStatusesTuple).default('OPEN'),
    reason: z.string().trim().min(3, 'Audit reason must be at least 3 characters').max(500),
  })
  .refine((data) => data.minLevel <= data.maxLevel, {
    message: 'minLevel cannot be greater than maxLevel',
    path: ['maxLevel'],
  });

export type AdminCreateJobInput = z.infer<typeof adminCreateJobSchema>;

export const adminUpdateJobSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    domain: z.enum(careerDomainsTuple).optional(),
    minLevel: z.number().int().min(1).max(10).optional(),
    maxLevel: z.number().int().min(1).max(10).optional(),
    requiredSkills: z.array(z.string().trim().min(1)).min(1).optional(),
    openings: z.number().int().min(1).optional(),
    status: z.enum(jobStatusesTuple).optional(),
    reason: z.string().trim().min(3, 'Audit reason must be at least 3 characters').max(500),
  })
  .refine(
    (data) => {
      const keys = Object.keys(data).filter((k) => k !== 'reason');
      return keys.length > 0;
    },
    { message: 'At least one field to update must be provided along with reason' }
  )
  .refine(
    (data) => {
      if (data.minLevel !== undefined && data.maxLevel !== undefined) {
        return data.minLevel <= data.maxLevel;
      }
      return true;
    },
    {
      message: 'minLevel cannot be greater than maxLevel',
      path: ['maxLevel'],
    }
  );

export type AdminUpdateJobInput = z.infer<typeof adminUpdateJobSchema>;

export const adminDeleteJobSchema = z.object({
  reason: z.string().trim().min(3, 'Audit reason must be at least 3 characters').max(500),
});

export type AdminDeleteJobInput = z.infer<typeof adminDeleteJobSchema>;
