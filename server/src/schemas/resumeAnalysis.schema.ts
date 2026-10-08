import { z } from 'zod';
import { CAREER_DOMAINS, type CareerDomain } from '../types/enums.js';

export const contactInfoSchema = z.object({
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  github: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

export const educationItemSchema = z.object({
  institution: z.string(),
  degree: z.string().optional().nullable(),
  fieldOfStudy: z.string().optional().nullable(),
  graduationYear: z.union([z.string(), z.number()]).optional().nullable(),
});

export const experienceItemSchema = z.object({
  company: z.string(),
  role: z.string(),
  duration: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  highlights: z.array(z.string()).optional().default([]),
});

export const projectItemSchema = z.object({
  title: z.string(),
  description: z.string().optional().nullable(),
  techStack: z.array(z.string()).optional().default([]),
  link: z.string().optional().nullable(),
});

export const certificationItemSchema = z.object({
  name: z.string(),
  issuer: z.string().optional().nullable(),
  year: z.union([z.string(), z.number()]).optional().nullable(),
});

/**
 * Strict canonical Zod schema for structured AI resume extraction.
 * Every field must be strictly validated before persisting to the database.
 */
export const resumeAnalysisOutputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact: contactInfoSchema.default({}),
  skills: z.array(z.string()).default([]),
  education: z.array(educationItemSchema).default([]),
  experience: z.array(experienceItemSchema).default([]),
  projects: z.array(projectItemSchema).default([]),
  certifications: z.array(certificationItemSchema).default([]),
  summary: z.string().default(''),
  domainClassification: z
    .enum(CAREER_DOMAINS as [CareerDomain, ...CareerDomain[]])
    .default('SOFTWARE_ENGINEERING'),
  yearsOfExperience: z.number().min(0).default(0),
});

export type ResumeAnalysisOutput = z.infer<typeof resumeAnalysisOutputSchema>;

/**
 * JSON Schema descriptor for AIGateway output validation.
 */
export const resumeAnalysisJsonSchema: Record<string, unknown> = {
  type: 'object',
  required: [
    'name',
    'skills',
    'education',
    'experience',
    'projects',
    'certifications',
    'summary',
    'domainClassification',
    'yearsOfExperience',
  ],
  properties: {
    name: { type: 'string' },
    contact: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        phone: { type: 'string' },
        location: { type: 'string' },
        linkedin: { type: 'string' },
        github: { type: 'string' },
        website: { type: 'string' },
      },
    },
    skills: {
      type: 'array',
      items: { type: 'string' },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        required: ['institution'],
        properties: {
          institution: { type: 'string' },
          degree: { type: 'string' },
          fieldOfStudy: { type: 'string' },
        },
      },
    },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        required: ['company', 'role'],
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          duration: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          issuer: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
    domainClassification: { type: 'string' },
    yearsOfExperience: { type: 'number' },
  },
};
