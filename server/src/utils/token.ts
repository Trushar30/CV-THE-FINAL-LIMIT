import crypto from 'crypto';

export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
}

/**
 * Generate a cryptographically secure random token and its SHA-256 hash
 */
export function generateVerificationToken(byteLength: number = 32): GeneratedToken {
  const rawToken = crypto.randomBytes(byteLength).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hash a raw token with SHA-256 for secure database lookup
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
