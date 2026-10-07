import argon2, { argon2id, type HashOptions } from 'argon2';

/**
 * Argon2id password hashing and verification options
 * Adhering to OWASP recommendations and CorpVerse Specification Section 32
 */
const ARGON2ID_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
};

/**
 * Hash a plain text password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

/**
 * Verify a plain text password against an Argon2id hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
