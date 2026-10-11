import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Checks whether an object contains any keys starting with '$' or containing '.'
 */
function hasForbiddenKeys(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) {
    return obj.some((item) => hasForbiddenKeys(item));
  }
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      return true;
    }
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'object' && val !== null && hasForbiddenKeys(val)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively removes any object keys that start with '$' or contain '.'
 * to neutralize NoSQL injection attacks targeting MongoDB operators.
 */
function cleanObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = cleanObject(val);
  }
  return cleaned;
}

/**
 * Middleware that sanitizes req.body, req.query, and req.params against
 * MongoDB NoSQL injection operators ($gt, $ne, $where, dot notation, etc.).
 */
export function sanitizeNoSql(req: Request, _res: Response, next: NextFunction): void {
  const checkAndClean = (target: Record<string, unknown> | undefined) => {
    if (!target) return target;
    if (hasForbiddenKeys(target)) {
      logger.warn('[Security] Stripped NoSQL injection query operator from request input', {
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
      });
      return cleanObject(target) as Record<string, unknown>;
    }
    return target;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = checkAndClean(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = (checkAndClean(req.query as Record<string, unknown>) || {}) as unknown as typeof req.query;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = (checkAndClean(req.params as Record<string, unknown>) || {}) as unknown as typeof req.params;
  }

  next();
}
