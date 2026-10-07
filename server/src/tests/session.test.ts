import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { hashPassword } from '../utils/password.js';
import { verifyAccessToken, signAccessToken } from '../utils/jwt.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_sessions';

describe('Login & Session Management Integration Suite (TASK P2.2)', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await RefreshTokenModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await UserModel.collection.deleteMany({});
    await RefreshTokenModel.collection.deleteMany({});
  });

  // Helper to create a verified active test user
  async function createTestUser(overrides: Partial<Record<string, unknown>> = {}) {
    const passwordHash = await hashPassword('ValidPass123!');
    return UserModel.create({
      email: 'alex.chen@corpverse.dev',
      passwordHash,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'EMAIL_VERIFIED',
      failedLoginAttempts: 0,
      totalExp: 1000,
      corpCoinBalance: 500,
      founderStarterCoinGranted: false,
      ...overrides,
    });
  }

  describe('POST /api/auth/login - Authentication & Credentials', () => {
    it('authenticates verified user, returns access token, and sets httpOnly refresh cookie', async () => {
      await createTestUser();

      const response = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'ValidPass123!',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('alex.chen@corpverse.dev');
      expect(response.body.data.user.careerRole).toBe('JOB_SEEKER');
      expect(response.body.data.user.totalExp).toBe(1000);
      expect(response.body.data.accessToken).toBeDefined();

      // Verify JWT payload
      const payload = verifyAccessToken(response.body.data.accessToken);
      expect(payload.email).toBe('alex.chen@corpverse.dev');

      // Verify httpOnly cookie
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('returns generic 401 error message for non-existent email (anti-enumeration)', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@corpverse.dev',
        password: 'ValidPass123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('returns generic 401 error message for incorrect password', async () => {
      await createTestUser();

      const response = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'WrongPassword999!',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('Account Lockout & Brute-Force Protection', () => {
    it('locks account after 5 failed login attempts and rejects with 423 ACCOUNT_LOCKED', async () => {
      const user = await createTestUser();

      // Submit 4 incorrect passwords
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'BadPassword1!' });
        expect(res.status).toBe(401);
      }

      const updatedUserBefore5th = await UserModel.findById(user._id);
      expect(updatedUserBefore5th?.failedLoginAttempts).toBe(4);
      expect(updatedUserBefore5th?.lockUntil).toBeNull();

      // 5th failed attempt triggers lockout
      const fifthRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'BadPassword1!' });
      expect(fifthRes.status).toBe(401);

      const lockedUser = await UserModel.findById(user._id);
      expect(lockedUser?.failedLoginAttempts).toBe(5);
      expect(lockedUser?.lockUntil).not.toBeNull();
      expect(new Date(lockedUser!.lockUntil!).getTime()).toBeGreaterThan(Date.now());

      // 6th attempt while locked returns 423 even with valid credentials
      const lockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'ValidPass123!' });

      expect(lockedRes.status).toBe(423);
      expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(lockedRes.body.error.message).toContain('Account is temporarily locked');
    });

    it('resets failedLoginAttempts counter on successful login', async () => {
      const user = await createTestUser();

      // Submit 2 failed logins
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'WrongPassword!' });
      }

      let checkUser = await UserModel.findById(user._id);
      expect(checkUser?.failedLoginAttempts).toBe(2);

      // Now login with correct password
      const successRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'ValidPass123!' });

      expect(successRes.status).toBe(200);

      checkUser = await UserModel.findById(user._id);
      expect(checkUser?.failedLoginAttempts).toBe(0);
      expect(checkUser?.lockUntil).toBeNull();
    });
  });

  describe('Account Status Checks: SUSPENDED & Unverified Accounts', () => {
    it('rejects SUSPENDED user from logging in with 403 Forbidden', async () => {
      await createTestUser({ status: 'SUSPENDED', isSuspended: true });

      const response = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'ValidPass123!',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('suspended');
    });

    it('rejects unverified user from logging in with 403 Forbidden', async () => {
      await createTestUser({ emailVerified: false, isEmailVerified: false });

      const response = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'ValidPass123!',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('verify your email');
    });
  });

  describe('POST /api/auth/refresh - Token Rotation & Replay/Reuse Detection', () => {
    it('rotates refresh token and issues fresh access token', async () => {
      await createTestUser();

      // Login to obtain initial refresh token cookie
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'ValidPass123!',
      });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();

      const initialCookieValue = refreshCookie!.split(';')[0];

      // Request token refresh
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [initialCookieValue]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      // Verify that a new refresh cookie is returned
      const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
      const newRefreshCookie = newCookies.find((c) => c.startsWith('refreshToken='));
      expect(newRefreshCookie).toBeDefined();
      const newCookieValue = newRefreshCookie!.split(';')[0];
      expect(newCookieValue).not.toBe(initialCookieValue);

      // Verify that the initial token document is marked isRevoked: true in DB
      const allTokens = await RefreshTokenModel.find({});
      expect(allTokens).toHaveLength(2);
      const revokedOldToken = allTokens.find((t) => t.isRevoked === true);
      const activeNewToken = allTokens.find((t) => t.isRevoked === false);
      expect(revokedOldToken).toBeDefined();
      expect(activeNewToken).toBeDefined();
      expect(revokedOldToken?.family).toBe(activeNewToken?.family);
    });

    it('detects refresh token reuse and revokes the entire token family', async () => {
      await createTestUser();

      // 1. Initial Login
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'ValidPass123!',
      });

      const initialCookieValue = (loginRes.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('refreshToken='))!
        .split(';')[0];

      // 2. Legitimate Refresh (rotates token)
      const refreshRes1 = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [initialCookieValue]);

      expect(refreshRes1.status).toBe(200);

      const rotatedCookieValue = (refreshRes1.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('refreshToken='))!
        .split(';')[0];

      // 3. Attacker reuses the old revoked initialCookieValue
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [initialCookieValue]);

      // Replay attempt must be rejected
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.message).toContain('Compromised or reused');

      // 4. Verify all tokens in the family have been invalidated
      const familyTokens = await RefreshTokenModel.find({});
      expect(familyTokens.length).toBeGreaterThan(0);
      for (const token of familyTokens) {
        expect(token.isRevoked).toBe(true);
      }

      // 5. Even the legitimate rotated token is now blocked because family was killed
      const blockedRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [rotatedCookieValue]);

      expect(blockedRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout - Session Termination', () => {
    it('revokes refresh token and clears cookie upon logout', async () => {
      await createTestUser();

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'alex.chen@corpverse.dev',
        password: 'ValidPass123!',
      });

      const refreshCookie = (loginRes.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('refreshToken='))!
        .split(';')[0];

      const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', [refreshCookie]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify cookie is expired/cleared
      const logoutCookies = logoutRes.headers['set-cookie'] as unknown as string[];
      expect(logoutCookies).toBeDefined();
      const clearedCookie = logoutCookies.find((c) => c.startsWith('refreshToken='));
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);

      // Attempting to refresh with the logged out cookie should fail
      const subsequentRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(subsequentRefresh.status).toBe(401);
    });
  });

  describe('GET /api/auth/me & authenticateJwt Middleware', () => {
    it('returns current user profile for valid access token', async () => {
      const user = await createTestUser();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe('alex.chen@corpverse.dev');
      expect(response.body.data.user.careerRole).toBe('JOB_SEEKER');
    });

    it('rejects request with 401 if Authorization header is missing', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Authentication token is required');
    });

    it('rejects request with 401 if token is invalid or malformed', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid or expired');
    });

    it('rejects request with 403 if authenticated user becomes SUSPENDED', async () => {
      const user = await createTestUser({ status: 'SUSPENDED', isSuspended: true });
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('suspended');
    });

    it('rejects request with 403 if authenticated user email is unverified', async () => {
      const user = await createTestUser({ emailVerified: false, isEmailVerified: false });
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('verify your email');
    });
  });
});
