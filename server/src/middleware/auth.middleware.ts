import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/errors.js';

/**
 * Authentication middleware that verifies the Bearer JWT access token,
 * loads the active user from MongoDB, and enforces:
 * 1. User account exists.
 * 2. User status is not SUSPENDED (403 Forbidden).
 * 3. User email is verified (403 Forbidden).
 * Attaches the loaded user document to req.user.
 */
export async function authenticateJwt(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication token is required'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(AppError.unauthorized('Authentication token is required'));
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.userId);

    if (!user) {
      return next(AppError.unauthorized('User account no longer exists'));
    }

    if (user.status === 'SUSPENDED' || user.isSuspended) {
      return next(AppError.forbidden('Your account has been suspended'));
    }

    if (!user.emailVerified && !user.isEmailVerified) {
      return next(AppError.forbidden('Please verify your email address to continue'));
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(AppError.unauthorized('Invalid or expired authentication token'));
  }
}

/**
 * Middleware enforcing that the authenticated user possesses one of the allowed platform roles.
 */
export function requirePlatformRole(...allowedRoles: Array<'NONE' | 'ADMIN' | 'AI_MANAGER'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.platformRole)) {
      return next(
        AppError.forbidden(`Access denied. Required platform role: ${allowedRoles.join(' or ')}`)
      );
    }

    next();
  };
}

/**
 * Middleware enforcing that the authenticated user possesses one of the allowed career roles.
 */
export function requireCareerRole(
  ...allowedRoles: Array<'NONE' | 'JOB_SEEKER' | 'EMPLOYEE' | 'FOUNDER'>
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.careerRole)) {
      return next(
        AppError.forbidden(`Access denied. Required career role: ${allowedRoles.join(' or ')}`)
      );
    }

    next();
  };
}
