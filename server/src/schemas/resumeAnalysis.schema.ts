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
  additionalProperties: false,
  required: [
    'name',
    'contact',
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
      additionalProperties: false,
      required: ['email', 'phone', 'location', 'linkedin', 'github', 'website'],
      properties: {
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        location: { type: ['string', 'null'] },
        linkedin: { type: ['string', 'null'] },
        github: { type: ['string', 'null'] },
        website: { type: ['string', 'null'] },
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
        additionalProperties: false,
        required: ['institution', 'degree', 'fieldOfStudy', 'graduationYear'],
        properties: {
          institution: { type: 'string' },
          degree: { type: ['string', 'null'] },
          fieldOfStudy: { type: ['string', 'null'] },
          graduationYear: { type: ['string', 'null'] },
        },
      },
    },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['company', 'role', 'duration', 'description', 'highlights'],
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          duration: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          highlights: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'techStack', 'link'],
        properties: {
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          techStack: {
            type: 'array',
            items: { type: 'string' },
          },
          link: { type: ['string', 'null'] },
        },
      },
    },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'issuer', 'year'],
        properties: {
          name: { type: 'string' },
          issuer: { type: ['string', 'null'] },
          year: { type: ['string', 'null'] },
        },
      },
    },
    summary: { type: 'string' },
    domainClassification: {
      type: 'string',
      enum: ['SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING', 'AI_ENGINEERING'],
    },
    yearsOfExperience: { type: 'number' },
  },
};
