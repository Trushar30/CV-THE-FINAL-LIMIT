import { z } from 'zod';

export const createDomainSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, { message: 'Domain code must be at least 2 characters long' })
    .max(50, { message: 'Domain code cannot exceed 50 characters' })
    .regex(/^[A-Z0-9_]+$/, {
      message: 'Domain code must contain only uppercase letters, numbers, and underscores',
    }),
  name: z
    .string()
    .trim()
    .min(2, { message: 'Domain name must be at least 2 characters long' })
    .max(100, { message: 'Domain name cannot exceed 100 characters' }),
  description: z
    .string()
    .trim()
    .min(5, { message: 'Domain description must be at least 5 characters long' })
    .max(500, { message: 'Domain description cannot exceed 500 characters' }),
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Audit reason must be at least 3 characters long' })
    .max(300, { message: 'Audit reason cannot exceed 300 characters' }),
});

export const updateDomainSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Domain name must be at least 2 characters long' })
    .max(100, { message: 'Domain name cannot exceed 100 characters' })
    .optional(),
  description: z
    .string()
    .trim()
    .min(5, { message: 'Domain description must be at least 5 characters long' })
    .max(500, { message: 'Domain description cannot exceed 500 characters' })
    .optional(),
  isActive: z.boolean().optional(),
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Audit reason must be at least 3 characters long' })
    .max(300, { message: 'Audit reason cannot exceed 300 characters' }),
});

export const deleteDomainSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Audit reason must be at least 3 characters long' })
    .max(300, { message: 'Audit reason cannot exceed 300 characters' }),
});

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
export type DeleteDomainInput = z.infer<typeof deleteDomainSchema>;
