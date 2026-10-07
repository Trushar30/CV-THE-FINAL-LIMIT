/**
 * AES-256-GCM Cryptographic Key Vault
 *
 * Implements authenticated encryption for runtime provider API keys.
 * Master key is sourced from environment (AI_KEY_VAULT_SECRET).
 * Raw keys are NEVER returned in API responses or written to logs.
 */

import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derive a 32-byte buffer key from a secret string using SHA-256
 */
function deriveKey(secret?: string): Buffer {
  const masterSecret = secret || env.AI_KEY_VAULT_SECRET || env.JWT_ACCESS_SECRET;
  return crypto.createHash('sha256').update(masterSecret).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: "ivHex:authTagHex:ciphertextHex"
 */
export function encryptSecret(plaintext: string, masterKeySecret?: string): string {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  const key = deriveKey(masterKeySecret);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Input format: "ivHex:authTagHex:ciphertextHex"
 */
export function decryptSecret(encryptedPayload: string, masterKeySecret?: string): string {
  if (!encryptedPayload) {
    throw new Error('Encrypted payload cannot be empty');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = deriveKey(masterKeySecret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Mask an API key for safe display (only last 4 characters visible)
 * Examples:
 *   "sk-ant-api03-12345678" -> "sk-••••••••5678"
 *   "AIzaSyD12345678"       -> "••••••••5678"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    return '••••••••';
  }

  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) {
    return '••••••••';
  }

  const last4 = trimmed.slice(-4);
  if (trimmed.startsWith('sk-')) {
    return `sk-••••••••${last4}`;
  }

  return `••••••••${last4}`;
}
