import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * Validates Origin / Referer headers on state-changing requests when credentials/cookies are processed.
 * Protects against cross-site request forgery (CSRF) on cookie-bearing endpoints.
 */
export function verifyCsrfOrigin(req: Request, _res: Response, next: NextFunction): void {
  // Safe HTTP read methods are exempt
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // During automated unit testing without browser origin headers, allow pass-through
  if (env.NODE_ENV === 'test') {
    return next();
  }

  // If request uses Bearer token in Authorization header, it is immune to cookie CSRF
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  const originHeader = req.headers.origin || req.headers.referer;
  if (!originHeader) {
    // If no origin or referer provided on non-browser / API client request, proceed
    return next();
  }

  const allowedOrigins = [
    env.CLIENT_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];

  const isAllowed = allowedOrigins.some((allowed) => {
    try {
      const allowedUrl = new URL(allowed);
      const requestUrl = new URL(originHeader);
      return allowedUrl.origin === requestUrl.origin;
    } catch {
      return originHeader.startsWith(allowed);
    }
  });

  if (!isAllowed) {
    return next(
      AppError.forbidden('Cross-Site Request Forgery (CSRF) validation failed: untrusted origin.')
    );
  }

  next();
}
