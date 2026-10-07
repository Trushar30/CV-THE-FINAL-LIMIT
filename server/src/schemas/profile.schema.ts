import { z } from 'zod';
import { CAREER_DOMAINS, type CareerDomain } from '../types/enums.js';

const urlSchema = z
  .string()
  .trim()
  .url({ message: 'Must be a valid URL' })
  .max(250, { message: 'URL cannot exceed 250 characters' })
  .or(z.literal(''));

export const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Project title is required' })
    .max(100, { message: 'Project title cannot exceed 100 characters' }),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Project description is required' })
    .max(1000, { message: 'Project description cannot exceed 1000 characters' }),
  techStack: z
    .array(z.string().trim().min(1).max(40))
    .max(20, { message: 'Cannot exceed 20 tech stack items' })
    .default([]),
  link: urlSchema.optional(),
});

export const certificationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Certification name is required' })
    .max(100, { message: 'Certification name cannot exceed 100 characters' }),
  issuer: z
    .string()
    .trim()
    .min(1, { message: 'Issuer name is required' })
    .max(100, { message: 'Issuer name cannot exceed 100 characters' }),
  issueDate: z.string().trim().max(30).optional(),
  credentialId: z.string().trim().max(100).optional(),
});

export const profileSetupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { message: 'Display name must be at least 2 characters long' })
    .max(50, { message: 'Display name cannot exceed 50 characters' }),
  domain: z.enum(CAREER_DOMAINS as [CareerDomain, ...CareerDomain[]], {
    errorMap: () => ({
      message: 'Domain must be SOFTWARE_ENGINEERING, CLOUD_ENGINEERING, or AI_ENGINEERING',
    }),
  }),
  skills: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: 'Skill cannot be empty' })
        .max(40, { message: 'Skill cannot exceed 40 characters' })
    )
    .min(1, { message: 'At least one technical skill is required' })
    .max(50, { message: 'Maximum 50 skills allowed' }),
  bio: z.string().trim().max(500, { message: 'Bio cannot exceed 500 characters' }).optional(),
  githubUrl: urlSchema.optional(),
  linkedinUrl: urlSchema.optional(),
  portfolioUrl: urlSchema.optional(),
  projects: z.array(projectSchema).max(20).default([]).optional(),
  certifications: z.array(certificationSchema).max(20).default([]).optional(),
});

export const profileUpdateSchema = profileSetupSchema
  .partial()
  .omit({ domain: true })
  .extend({
    skills: z
      .array(
        z
          .string()
          .trim()
          .min(1, { message: 'Skill cannot be empty' })
          .max(40, { message: 'Skill cannot exceed 40 characters' })
      )
      .min(1, { message: 'At least one technical skill is required' })
      .max(50, { message: 'Maximum 50 skills allowed' })
      .optional(),
  });

export type ProfileSetupInput = z.infer<typeof profileSetupSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
