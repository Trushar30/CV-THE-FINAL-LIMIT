import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_profile';

describe('Profile Setup & Career Domain Integration Suite (TASK P2.3)', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await ProfileModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await UserModel.collection.deleteMany({});
    await ProfileModel.collection.deleteMany({});
  });

  async function createVerifiedCandidate(overrides: Partial<Record<string, unknown>> = {}) {
    const passwordHash = await hashPassword('ValidPass123!');
    return UserModel.create({
      email: 'candidate@corpverse.dev',
      passwordHash,
      careerRole: 'NONE',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'EMAIL_VERIFIED',
      failedLoginAttempts: 0,
      totalExp: 0,
      corpCoinBalance: 0,
      founderStarterCoinGranted: false,
      ...overrides,
    });
  }

  describe('GET /api/profile/domains - Career Domains Discovery', () => {
    it('returns supported career domains with descriptions and recommended skills', async () => {
      const response = await request(app).get('/api/profile/domains');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.domains).toHaveLength(3);

      const domainIds = response.body.data.domains.map((d: { id: string }) => d.id);
      expect(domainIds).toContain('SOFTWARE_ENGINEERING');
      expect(domainIds).toContain('CLOUD_ENGINEERING');
      expect(domainIds).toContain('AI_ENGINEERING');
    });
  });

  describe('POST /api/profile/setup - Profile Creation & Role Transition', () => {
    it('creates profile and authoritatively transitions user to JOB_SEEKER and PROFILE_COMPLETED', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const setupPayload = {
        displayName: 'Elena Rostova',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript', 'Node.js', 'MongoDB', 'System Design'],
        bio: 'Passionate backend architect specializing in distributed microservices.',
        githubUrl: 'https://github.com/erostova',
        linkedinUrl: 'https://linkedin.com/in/erostova',
      };

      const response = await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(setupPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.displayName).toBe('Elena Rostova');
      expect(response.body.data.profile.domain).toBe('SOFTWARE_ENGINEERING');
      expect(response.body.data.profile.skills).toEqual(
        expect.arrayContaining(['TypeScript', 'Node.js'])
      );
      expect(response.body.data.user.careerRole).toBe('JOB_SEEKER');
      expect(response.body.data.user.onboardingStep).toBe('PROFILE_COMPLETED');

      // Verify authoritative database state
      const updatedUser = await UserModel.findById(user._id);
      expect(updatedUser?.careerRole).toBe('JOB_SEEKER');
      expect(updatedUser?.onboardingStep).toBe('PROFILE_COMPLETED');

      const profileInDb = await ProfileModel.findOne({ userId: user._id });
      expect(profileInDb).toBeDefined();
      expect(profileInDb?.displayName).toBe('Elena Rostova');
    });

    it('rejects duplicate profile setup with 409 Conflict', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const setupPayload = {
        displayName: 'Marcus Vance',
        domain: 'CLOUD_ENGINEERING',
        skills: ['Terraform', 'Kubernetes', 'AWS'],
      };

      // First setup succeeds
      const firstRes = await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(setupPayload);
      expect(firstRes.status).toBe(201);

      // Second setup must fail with 409
      const secondRes = await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(setupPayload);

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(secondRes.body.error.message).toContain('already been configured');
    });

    it('rejects setup payload with invalid domain with 400 Validation Error', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Test User',
          domain: 'GAME_DEVELOPMENT', // Invalid domain
          skills: ['Unity', 'C#'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects setup payload with empty skills array with 400 Validation Error', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Test User',
          domain: 'AI_ENGINEERING',
          skills: [], // Must have at least 1 skill
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects setup request with 401 if unauthenticated', async () => {
      const response = await request(app)
        .post('/api/profile/setup')
        .send({
          displayName: 'Test User',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['TypeScript'],
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/profile/me & PUT /api/profile/me', () => {
    it('retrieves profile when established', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      // Create profile via service or API
      await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Aria Thorne',
          domain: 'AI_ENGINEERING',
          skills: ['Python', 'PyTorch', 'Vector DBs'],
        });

      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.profile.displayName).toBe('Aria Thorne');
      expect(response.body.data.profile.domain).toBe('AI_ENGINEERING');
      expect(response.body.data.user.careerRole).toBe('JOB_SEEKER');
    });

    it('returns 404 when profile has not been created yet', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('updates editable fields via PUT /api/profile/me', async () => {
      const user = await createVerifiedCandidate();
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'David Kim',
          domain: 'CLOUD_ENGINEERING',
          skills: ['Docker'],
        });

      const updateResponse = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'David S. Kim',
          skills: ['Docker', 'Kubernetes', 'CI/CD'],
          bio: 'DevOps & Infrastructure Lead',
          githubUrl: 'https://github.com/davidkim-cloud',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.profile.displayName).toBe('David S. Kim');
      expect(updateResponse.body.data.profile.skills).toEqual(
        expect.arrayContaining(['Kubernetes', 'CI/CD'])
      );
      expect(updateResponse.body.data.profile.bio).toBe('DevOps & Infrastructure Lead');
    });
  });

  describe('Account Status Restrictions on Profile Endpoints', () => {
    it('rejects profile setup with 403 if user account is SUSPENDED', async () => {
      const user = await createVerifiedCandidate({ status: 'SUSPENDED', isSuspended: true });
      const accessToken = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        careerRole: user.careerRole,
        platformRole: user.platformRole,
      });

      const response = await request(app)
        .post('/api/profile/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          displayName: 'Suspended Candidate',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['Java'],
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('suspended');
    });
  });
});
