import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * Rate limiter for resend verification endpoint
 * Max 5 attempts per 15 minutes per IP
 */
export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(
      AppError.rateLimitExceeded(
        'Too many verification resend attempts. Please wait before trying again.'
      )
    );
  },
});

/**
 * Rate limiter for registration endpoint
 * Max 20 registrations per 15 minutes per IP
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(AppError.rateLimitExceeded('Too many registration attempts. Please try again later.'));
  },
});

/**
 * Rate limiter for login endpoint
 * Stricter threshold (10 attempts per 15 minutes per IP) to mitigate brute-force attacks
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(AppError.rateLimitExceeded('Too many login attempts. Please wait before trying again.'));
  },
});

/**
 * Rate limiter for token refresh endpoint
 * 30 refresh requests per 15 minutes per IP
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(AppError.rateLimitExceeded('Too many token refresh requests. Please try again later.'));
  },
});

/**
 * Rate limiter for resume upload endpoint
 * 10 uploads per 15 minutes per IP
 */
export const resumeUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(
      AppError.rateLimitExceeded(
        'Too many resume upload attempts. Please wait before uploading again.'
      )
    );
  },
});

/**
 * Rate limiter for email verification endpoint
 * 15 verification attempts per 15 minutes per IP to prevent token enumeration/brute-force
 */
export const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(
      AppError.rateLimitExceeded(
        'Too many email verification attempts. Please wait before trying again.'
      )
    );
  },
});

/**
 * Rate limiter for public browsing endpoints (companies, jobs, domains, skills)
 * 120 queries per 15 minutes per IP to prevent scraping and denial-of-service
 */
export const publicQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req: Request, _res: Response, next) => {
    next(
      AppError.rateLimitExceeded(
        'Too many requests to public endpoints. Please wait before querying again.'
      )
    );
  },
});

