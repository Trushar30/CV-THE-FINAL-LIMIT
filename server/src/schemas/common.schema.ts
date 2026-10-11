import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Standard URL parameter schema validating a 24-character hexadecimal MongoDB ObjectId
 */
export const objectIdParamSchema = z.object({
  id: z
    .string({ required_error: 'ID parameter is required' })
    .trim()
    .regex(objectIdRegex, 'Must be a valid 24-character hexadecimal ObjectId'),
});

export type ObjectIdParam = z.infer<typeof objectIdParamSchema>;

export const listSkillsQuerySchema = z.object({
  domainCode: z.string().trim().max(50).optional(),
});

export type ListSkillsQuery = z.infer<typeof listSkillsQuerySchema>;

/**
 * Standard reusable pagination query schema with safety bounds
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

