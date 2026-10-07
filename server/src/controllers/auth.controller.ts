import { Request, Response, NextFunction, CookieOptions } from 'express';
import { authService } from '../services/auth/auth.service.js';
import {
  RegisterInput,
  VerifyEmailInput,
  ResendVerificationInput,
  LoginInput,
} from '../schemas/auth.schema.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export function getRefreshTokenCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    expires: expiresAt,
    path: '/',
  };
}

export function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  };
}

export class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as RegisterInput;
      const result = await authService.register(input);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body as VerifyEmailInput;
      const result = await authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/resend-verification
   */
  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body as ResendVerificationInput;
      const result = await authService.resendVerification(email);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as LoginInput;
      const result = await authService.login(input);

      // Set httpOnly refresh cookie
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.rawRefreshToken,
        getRefreshTokenCookieOptions(result.refreshTokenExpiresAt)
      );

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = (req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken) as
        string | undefined;

      if (!rawRefreshToken) {
        throw AppError.unauthorized('Refresh token cookie or payload is required');
      }

      const result = await authService.refresh(rawRefreshToken);

      // Rotate httpOnly refresh cookie
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.newRawRefreshToken,
        getRefreshTokenCookieOptions(result.newExpiresAt)
      );

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = (req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken) as
        string | undefined;

      await authService.logout(rawRefreshToken);

      // Clear refresh cookie
      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const user = await authService.getCurrentUser(req.user._id.toString());

      res.status(200).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
