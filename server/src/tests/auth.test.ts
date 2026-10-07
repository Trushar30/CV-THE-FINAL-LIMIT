import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { EmailVerificationTokenModel } from '../models/EmailVerificationToken.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateVerificationToken, hashToken } from '../utils/token.js';
import { ConsoleEmailService } from '../services/email/consoleEmail.service.js';
import { SmtpEmailService } from '../services/email/smtpEmail.service.js';
import { AuthService } from '../services/auth/auth.service.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_auth';

describe('Authentication & Email Verification Integration Suite (TASK P2.1)', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await EmailVerificationTokenModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await UserModel.collection.deleteMany({});
    await EmailVerificationTokenModel.collection.deleteMany({});
  });

  describe('Argon2id Password Hashing Utility', () => {
    it('should hash passwords using Argon2id algorithm ($argon2id$)', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('should verify matching plain text password against hash', async () => {
      const password = 'StrongPassword456$';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password against hash', async () => {
      const password = 'StrongPassword456$';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('should safely return false when verifying invalid or empty inputs', async () => {
      expect(await verifyPassword('', '')).toBe(false);
      expect(await verifyPassword('password', 'not-a-hash')).toBe(false);
    });

    it('should throw an error if attempting to hash empty or non-string input', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });
  });

  describe('Token Generation and Hashing Utility', () => {
    it('should generate a 64-char hex random token and corresponding SHA-256 hash', () => {
      const { rawToken, tokenHash } = generateVerificationToken();

      expect(rawToken).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      expect(hashToken(rawToken)).toBe(tokenHash);
    });

    it('should compute consistent SHA-256 hashes for identical inputs', () => {
      const token = 'test-token-value-12345';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('Email Service Implementations', () => {
    it('ConsoleEmailService should log and record dispatched emails in-memory', async () => {
      const consoleService = new ConsoleEmailService();
      await consoleService.sendVerificationEmail({
        to: 'candidate@corpverse.io',
        token: 'sample-token-123',
        verificationUrl: 'http://localhost:5173/verify-email?token=sample-token-123',
      });

      const sent = consoleService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('candidate@corpverse.io');
      expect(sent[0].token).toBe('sample-token-123');

      consoleService.clear();
      expect(consoleService.getSentEmails()).toHaveLength(0);
    });

    it('SmtpEmailService should instantiate cleanly with default or custom configuration', () => {
      const smtpService = new SmtpEmailService({
        host: 'smtp.mailtrap.io',
        port: 2525,
        user: 'user123',
        pass: 'pass123',
      });
      expect(smtpService).toBeDefined();
    });
  });

  describe('POST /api/auth/register (and /api/v1/auth/register)', () => {
    it('should register a new user successfully on the happy path', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'newuser@corpverse.io',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data.email).toBe('newuser@corpverse.io');
      expect(res.body.data.devVerificationUrl).toBeDefined();

      // Verify user document in MongoDB
      const user = await UserModel.findOne({ email: 'newuser@corpverse.io' });
      expect(user).toBeDefined();
      expect(user!.careerRole).toBe('NONE'); // default NONE before profile setup per spec
      expect(user!.platformRole).toBe('NONE');
      expect(user!.status).toBe('ACTIVE');
      expect(user!.emailVerified).toBe(false);
      expect(user!.onboardingStep).toBe('REGISTERED');
      expect(user!.failedLoginAttempts).toBe(0);
      expect(user!.totalExp).toBe(0);
      expect(user!.corpCoinBalance).toBe(0);

      // Verify password was hashed with Argon2id
      expect(user!.passwordHash.startsWith('$argon2id$')).toBe(true);
      const isPasswordCorrect = await verifyPassword('ValidPassword123!', user!.passwordHash);
      expect(isPasswordCorrect).toBe(true);

      // Verify token document was created
      const tokenDoc = await EmailVerificationTokenModel.findOne({ userId: user!._id });
      expect(tokenDoc).toBeDefined();
      expect(tokenDoc!.usedAt).toBeNull();
      expect(tokenDoc!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should work identically through /api/v1/auth/register route alias', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'aliasuser@corpverse.io',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('aliasuser@corpverse.io');
    });

    it('should reject weak passwords lacking required characters (Spec Section 4 & 32)', async () => {
      const weakPasswords = [
        { pwd: 'short1!', reason: 'Too short (<8 chars)' },
        { pwd: 'lowercaseonly1!', reason: 'Missing uppercase' },
        { pwd: 'UPPERCASEONLY1!', reason: 'Missing lowercase' },
        { pwd: 'NoNumbersHere!', reason: 'Missing number' },
        { pwd: 'NoSpecialChars123', reason: 'Missing special character' },
      ];

      for (const item of weakPasswords) {
        const res = await request(app).post('/api/auth/register').send({
          email: 'test@corpverse.io',
          password: item.pwd,
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject invalid email formats', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'not-a-valid-email',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should NEVER reveal email already exists on duplicate registration (Anti-Enumeration)', async () => {
      // 1. Initial registration
      const firstRes = await request(app).post('/api/auth/register').send({
        email: 'duplicate@corpverse.io',
        password: 'OriginalPassword123!',
      });

      expect(firstRes.status).toBe(201);
      const originalUser = await UserModel.findOne({ email: 'duplicate@corpverse.io' });
      expect(originalUser).toBeDefined();
      const originalHash = originalUser!.passwordHash;

      // 2. Duplicate registration attempt with a different password
      const secondRes = await request(app).post('/api/auth/register').send({
        email: 'duplicate@corpverse.io',
        password: 'DifferentPassword123!',
      });

      // Must NOT return 409 conflict and must NOT leak account existence
      expect(secondRes.status).toBe(201);
      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.data.message).toBe(
        'Registration initiated. Please check your email to verify your account.'
      );
      // Dev verification URL must NOT be exposed for duplicate registration to prevent token hijacking
      expect(secondRes.body.data.devVerificationUrl).toBeUndefined();

      // Only 1 user should exist in the database
      const userCount = await UserModel.countDocuments({ email: 'duplicate@corpverse.io' });
      expect(userCount).toBe(1);

      // Original password hash must remain untouched
      const reloadedUser = await UserModel.findOne({ email: 'duplicate@corpverse.io' });
      expect(reloadedUser!.passwordHash).toBe(originalHash);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token and advance onboardingStep', async () => {
      // Register user
      const customEmailService = new ConsoleEmailService();
      const authServiceCustom = new AuthService(customEmailService);

      const regResult = await authServiceCustom.register({
        email: 'verify-happy@corpverse.io',
        password: 'ValidPassword123!',
      });

      const rawToken = regResult.rawToken!;
      expect(rawToken).toBeDefined();

      // Call verify endpoint
      const res = await request(app).post('/api/auth/verify-email').send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('verify-happy@corpverse.io');
      expect(res.body.data.onboardingStep).toBe('EMAIL_VERIFIED');

      // Check DB
      const user = await UserModel.findOne({ email: 'verify-happy@corpverse.io' });
      expect(user!.emailVerified).toBe(true);
      expect(user!.isEmailVerified).toBe(true);
      expect(user!.onboardingStep).toBe('EMAIL_VERIFIED');

      // Check token document is marked used
      const tokenDoc = await EmailVerificationTokenModel.findOne({
        tokenHash: hashToken(rawToken),
      });
      expect(tokenDoc!.usedAt).toBeInstanceOf(Date);
    });

    it('should reject reused tokens', async () => {
      // Register user
      const customEmailService = new ConsoleEmailService();
      const authServiceCustom = new AuthService(customEmailService);

      const regResult = await authServiceCustom.register({
        email: 'verify-reused@corpverse.io',
        password: 'ValidPassword123!',
      });

      const rawToken = regResult.rawToken!;

      // First verification succeeds
      const firstRes = await request(app).post('/api/auth/verify-email').send({ token: rawToken });
      expect(firstRes.status).toBe(200);

      // Second verification attempt with same token fails
      const secondRes = await request(app).post('/api/auth/verify-email').send({ token: rawToken });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.message).toContain('already been used');
    });

    it('should reject expired tokens', async () => {
      // Create user
      const user = await UserModel.create({
        email: 'expired@corpverse.io',
        passwordHash: 'dummy_hash',
        careerRole: 'NONE',
        platformRole: 'NONE',
        status: 'ACTIVE',
        emailVerified: false,
        onboardingStep: 'REGISTERED',
      });

      // Create expired token (expired 2 hours ago)
      const { rawToken, tokenHash } = generateVerificationToken();
      await EmailVerificationTokenModel.create({
        userId: user._id,
        email: user.email,
        tokenHash,
        expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });

      // Attempt to verify with expired token
      const res = await request(app).post('/api/auth/verify-email').send({ token: rawToken });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('expired');

      // User must still be unverified
      const reloadedUser = await UserModel.findById(user._id);
      expect(reloadedUser!.emailVerified).toBe(false);
    });

    it('should reject invalid or non-existent tokens', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'completely_fabricated_token_value_xyz' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid or expired');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification token for an unverified user', async () => {
      const customEmailService = new ConsoleEmailService();
      const authServiceCustom = new AuthService(customEmailService);

      await authServiceCustom.register({
        email: 'resend-test@corpverse.io',
        password: 'ValidPassword123!',
      });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'resend-test@corpverse.io' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify a new token document exists
      const tokens = await EmailVerificationTokenModel.find({ email: 'resend-test@corpverse.io' });
      expect(tokens.length).toBeGreaterThanOrEqual(2);
    });

    it('should NEVER reveal whether an email exists when resending (Anti-Enumeration)', async () => {
      // 1. Non-existent email
      const nonExistentRes = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@corpverse.io' });

      expect(nonExistentRes.status).toBe(200);
      expect(nonExistentRes.body.success).toBe(true);
      expect(nonExistentRes.body.message).toContain(
        'If an unverified account exists for this email, a verification link has been sent'
      );

      // 2. Already verified email
      const verifiedUser = await UserModel.create({
        email: 'alreadyverified@corpverse.io',
        passwordHash: 'dummy_hash',
        careerRole: 'NONE',
        platformRole: 'NONE',
        status: 'ACTIVE',
        emailVerified: true,
        onboardingStep: 'EMAIL_VERIFIED',
      });

      const verifiedRes = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: verifiedUser.email });

      expect(verifiedRes.status).toBe(200);
      expect(verifiedRes.body.success).toBe(true);
      expect(verifiedRes.body.message).toBe(nonExistentRes.body.message);

      // No new token created for already verified user
      const tokenCount = await EmailVerificationTokenModel.countDocuments({
        email: verifiedUser.email,
      });
      expect(tokenCount).toBe(0);
    });
  });
});
