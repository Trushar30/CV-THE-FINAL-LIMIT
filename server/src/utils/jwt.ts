import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { CareerRole, PlatformRole } from '../types/enums.js';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  careerRole: CareerRole;
  platformRole: PlatformRole;
  iat?: number;
  exp?: number;
}

/**
 * Sign a short-lived access JWT
 */
export function signAccessToken(
  payload: {
    userId: string;
    email: string;
    careerRole: CareerRole;
    platformRole: PlatformRole;
  },
  expiresInMinutes: number = 15
): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${expiresInMinutes}m`,
  });
}

/**
 * Verify and decode an access JWT
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}
