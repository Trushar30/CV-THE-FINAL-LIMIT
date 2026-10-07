import { z } from 'zod';

/**
 * Password strength rules adhering to CorpVerse Spec Section 4 & 32:
 * - Minimum 8 characters, maximum 128 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special symbol
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,128}$/;

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    passwordRegex,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email must not exceed 255 characters'),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Verification token is required')
    .max(256, 'Invalid verification token length'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email must not exceed 255 characters'),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email must not exceed 255 characters'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
