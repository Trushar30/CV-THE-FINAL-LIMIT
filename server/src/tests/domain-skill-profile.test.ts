import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, IUserDocument } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { DomainModel } from '../models/Domain.js';
import { SkillModel } from '../models/Skill.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { domainService } from '../services/domain/domain.service.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_domain_skill_profile';

describe('Domains, Skills, and Profile Onboarding Suite (TASK P4.1)', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.collection.deleteMany({});
      await ProfileModel.collection.deleteMany({});
      await DomainModel.collection.deleteMany({});
      await SkillModel.collection.deleteMany({});
      await AuditLogModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await UserModel.collection.deleteMany({});
    await ProfileModel.collection.deleteMany({});
    await DomainModel.collection.deleteMany({});
    await SkillModel.collection.deleteMany({});
    await AuditLogModel.collection.deleteMany({});

    // Seed defaults for clean test environment
    await domainService.seedDefaultDomains();
    await domainService.seedDefaultSkills();
  });

  async function createCandidate(
    overrides: Partial<Record<string, unknown>> = {}
  ): Promise<IUserDocument> {
    const passwordHash = await hashPassword('ValidPass123!');
    return UserModel.create({
      email: `candidate_${Date.now()}_${Math.random().toString(36).substring(7)}@corpverse.dev`,
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

  async function createAdmin(): Promise<IUserDocument> {
    const passwordHash = await hashPassword('AdminPass123!');
    return UserModel.create({
      email: `admin_${Date.now()}@corpverse.dev`,
      passwordHash,
      careerRole: 'NONE',
      platformRole: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExp: 0,
      corpCoinBalance: 0,
      founderStarterCoinGranted: false,
    });
  }

  function getAuthHeader(user: IUserDocument): { Authorization: string } {
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      careerRole: user.careerRole,
      platformRole: user.platformRole,
    });
    return { Authorization: `Bearer ${token}` };
  }

  describe('1. Domains & Skills Collections and Seeding', () => {
    it('seeds exactly the 3 v1 domains idempotently', async () => {
      const domains = await DomainModel.find({}).sort({ code: 1 });
      expect(domains).toHaveLength(3);

      const codes = domains.map((d) => d.code);
      expect(codes).toEqual(['AI_ENGINEERING', 'CLOUD_ENGINEERING', 'SOFTWARE_ENGINEERING']);

      // Running seed again shouldn't duplicate documents
      await domainService.seedDefaultDomains();
      const countAfter = await DomainModel.countDocuments();
      expect(countAfter).toBe(3);
    });

    it('GET /api/domains returns active domains to candidates/public', async () => {
      const res = await request(app).get('/api/domains');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.domains).toHaveLength(3);

      const resV1 = await request(app).get('/api/v1/domains');
      expect(resV1.status).toBe(200);
      expect(resV1.body.data.domains).toHaveLength(3);
    });

    it('GET /api/skills returns catalog and filters by ?domainCode', async () => {
      const resAll = await request(app).get('/api/skills');
      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(resAll.body.data.skills.length).toBeGreaterThan(10);

      const resFiltered = await request(app).get('/api/skills?domainCode=AI_ENGINEERING');
      expect(resFiltered.status).toBe(200);
      expect(resFiltered.body.data.skills.length).toBeGreaterThan(0);
      for (const skill of resFiltered.body.data.skills) {
        expect(skill.domainCode).toBe('AI_ENGINEERING');
      }
    });
  });

  describe('2. Admin CRUD for Domains (Protected & Audited)', () => {
    it('rejects non-admin or unauthenticated requests with 401/403', async () => {
      const candidate = await createCandidate();

      const unauthRes = await request(app).post('/api/admin/domains').send({
        code: 'SECURITY_ENGINEERING',
        name: 'Security Engineering',
        description: 'Cybersecurity and cloud defense.',
        reason: 'Adding security domain',
      });
      expect(unauthRes.status).toBe(401);

      const candidateRes = await request(app)
        .post('/api/admin/domains')
        .set(getAuthHeader(candidate))
        .send({
          code: 'SECURITY_ENGINEERING',
          name: 'Security Engineering',
          description: 'Cybersecurity and cloud defense.',
          reason: 'Adding security domain',
        });
      expect(candidateRes.status).toBe(403);
    });

    it('admin creates a new domain and records an audit log', async () => {
      const admin = await createAdmin();

      const res = await request(app).post('/api/admin/domains').set(getAuthHeader(admin)).send({
        code: 'DATA_ENGINEERING',
        name: 'Data Engineering',
        description: 'Data warehousing, pipelines, and distributed lakehouse engines.',
        reason: 'Expanding platform curriculum with Data Engineering',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.domain.code).toBe('DATA_ENGINEERING');

      // Verify domain exists in database
      const domainDoc = await DomainModel.findOne({ code: 'DATA_ENGINEERING' });
      expect(domainDoc).toBeDefined();

      // Verify immutable audit log was created
      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_CREATE_DOMAIN',
        targetId: domainDoc?._id,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorRole).toBe('ADMIN');
      expect(auditLog?.reason).toContain('Expanding platform curriculum');
    });

    it('rejects duplicate domain code with 409 Conflict', async () => {
      const admin = await createAdmin();

      const res = await request(app).post('/api/admin/domains').set(getAuthHeader(admin)).send({
        code: 'SOFTWARE_ENGINEERING',
        name: 'Duplicate Domain',
        description: 'Some description',
        reason: 'Test duplicate rejection',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('admin updates domain and records an audit log', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch('/api/admin/domains/SOFTWARE_ENGINEERING')
        .set(getAuthHeader(admin))
        .send({
          name: 'Software & Systems Engineering',
          description: 'Updated description for systems engineering.',
          reason: 'Refining software engineering description',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.domain.name).toBe('Software & Systems Engineering');

      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_UPDATE_DOMAIN',
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.reason).toContain('Refining software engineering');
    });

    it('admin deactivates domain with audit reason', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .delete('/api/admin/domains/AI_ENGINEERING')
        .set(getAuthHeader(admin))
        .send({
          reason: 'Temporarily taking AI domain offline for maintenance',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.domain.isActive).toBe(false);

      const dbDoc = await DomainModel.findOne({ code: 'AI_ENGINEERING' });
      expect(dbDoc?.isActive).toBe(false);
    });
  });

  describe('3. Profile Model & Case-Insensitive Display Name Uniqueness', () => {
    it('enforces case-insensitive uniqueness on displayName', async () => {
      const user1 = await createCandidate();
      const user2 = await createCandidate();

      // User 1 creates profile with "Katherine Johnson"
      const res1 = await request(app)
        .post('/api/profile/setup')
        .set(getAuthHeader(user1))
        .send({
          displayName: 'Katherine Johnson',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['Python', 'System Design'],
        });
      expect(res1.status).toBe(201);

      // User 2 tries "katherine johnson" (all lowercase) -> 409 Conflict
      const resLower = await request(app)
        .post('/api/profile/setup')
        .set(getAuthHeader(user2))
        .send({
          displayName: 'katherine johnson',
          domain: 'AI_ENGINEERING',
          skills: ['PyTorch'],
        });
      expect(resLower.status).toBe(409);
      expect(resLower.body.error.code).toBe('BUSINESS_RULE_VIOLATION');

      // User 2 tries "KATHERINE JOHNSON" (all uppercase) -> 409 Conflict
      const resUpper = await request(app)
        .post('/api/profile/setup')
        .set(getAuthHeader(user2))
        .send({
          displayName: 'KATHERINE JOHNSON',
          domain: 'AI_ENGINEERING',
          skills: ['PyTorch'],
        });
      expect(resUpper.status).toBe(409);

      // User 1 updating their own profile with the same name succeeds
      const resSelf = await request(app).put('/api/profile/me').set(getAuthHeader(user1)).send({
        displayName: 'Katherine Johnson',
        bio: 'Orbital mechanics & software pioneer',
      });
      expect(resSelf.status).toBe(200);
    });

    it('verifies profiles model is separate from users collection', async () => {
      const candidate = await createCandidate();

      await request(app)
        .post('/api/profile/setup')
        .set(getAuthHeader(candidate))
        .send({
          displayName: 'Grace Hopper',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['Compilers', 'COBOL'],
        });

      const userDoc = await UserModel.findById(candidate._id);
      const profileDoc = await ProfileModel.findOne({ userId: candidate._id });

      expect(userDoc).toBeDefined();
      expect(profileDoc).toBeDefined();
      expect(profileDoc?.userId.toString()).toBe(userDoc?._id.toString());
      // Assert collections are distinct
      expect(UserModel.collection.collectionName).toBe('users');
      expect(ProfileModel.collection.collectionName).toBe('profiles');
    });
  });

  describe('4. Step-by-Step Onboarding Pipeline Tracking', () => {
    it('advances through each step: EMAIL_VERIFIED > NAME > DOMAIN > SKILLS > RESUME > REVIEW > COMPLETE', async () => {
      const candidate = await createCandidate();
      expect(candidate.onboardingStep).toBe('EMAIL_VERIFIED');
      expect(candidate.careerRole).toBe('NONE');

      const authHeader = getAuthHeader(candidate);

      // Step 1: NAME
      const nameRes = await request(app).patch('/api/profile/step').set(authHeader).send({
        step: 'NAME',
        displayName: 'Linus Torvalds',
      });
      expect(nameRes.status).toBe(200);
      expect(nameRes.body.data.user.onboardingStep).toBe('NAME');
      expect(nameRes.body.data.user.careerRole).toBe('NONE'); // Role must remain NONE!

      // Step 2: DOMAIN
      const domainRes = await request(app).patch('/api/profile/step').set(authHeader).send({
        step: 'DOMAIN',
        domain: 'CLOUD_ENGINEERING',
      });
      expect(domainRes.status).toBe(200);
      expect(domainRes.body.data.user.onboardingStep).toBe('DOMAIN');
      expect(domainRes.body.data.user.careerRole).toBe('NONE');

      // Step 3: SKILLS
      const skillsRes = await request(app)
        .patch('/api/profile/step')
        .set(authHeader)
        .send({
          step: 'SKILLS',
          skills: ['Linux', 'Git', 'C', 'Kernel Development'],
        });
      expect(skillsRes.status).toBe(200);
      expect(skillsRes.body.data.user.onboardingStep).toBe('SKILLS');
      expect(skillsRes.body.data.user.careerRole).toBe('NONE');

      // Step 4: RESUME (optional attachment)
      const resumeRes = await request(app).patch('/api/profile/step').set(authHeader).send({
        step: 'RESUME',
      });
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.user.onboardingStep).toBe('RESUME');
      expect(resumeRes.body.data.user.careerRole).toBe('NONE');

      // Step 5: REVIEW (optional links/bio)
      const reviewRes = await request(app).patch('/api/profile/step').set(authHeader).send({
        step: 'REVIEW',
        bio: 'Creator of Linux and Git',
        githubUrl: 'https://github.com/torvalds',
      });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.user.onboardingStep).toBe('REVIEW');
      expect(reviewRes.body.data.user.careerRole).toBe('NONE');

      // Step 6: COMPLETE
      const completeRes = await request(app).patch('/api/profile/step').set(authHeader).send({
        step: 'COMPLETE',
      });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.user.onboardingStep).toBe('COMPLETE');
      expect(completeRes.body.data.user.careerRole).toBe('JOB_SEEKER'); // Authoritatively set to JOB_SEEKER!

      // Verify in DB
      const dbUser = await UserModel.findById(candidate._id);
      expect(dbUser?.careerRole).toBe('JOB_SEEKER');
      expect(dbUser?.onboardingStep).toBe('COMPLETE');
    });

    it('rejects completing onboarding if mandatory fields are missing', async () => {
      const candidate = await createCandidate();
      const authHeader = getAuthHeader(candidate);

      // Candidate tries to call COMPLETE immediately without setting name/domain/skills
      const res = await request(app).post('/api/profile/complete-onboarding').set(authHeader);

      expect(res.status).toBe(404); // Profile not created yet
    });
  });

  describe('5. Mandatory vs Optional Field Enforcement', () => {
    it('completes onboarding without any optional fields (bio, links, projects, certs)', async () => {
      const candidate = await createCandidate();
      const authHeader = getAuthHeader(candidate);

      // Only mandatory fields: displayName, domain, skills
      const res = await request(app)
        .post('/api/profile/setup')
        .set(authHeader)
        .send({
          displayName: 'Minimalist Coder',
          domain: 'AI_ENGINEERING',
          skills: ['PyTorch'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.careerRole).toBe('JOB_SEEKER');
      expect(res.body.data.profile.bio).toBeUndefined();
      expect(res.body.data.profile.githubUrl).toBeUndefined();
      expect(res.body.data.profile.projects).toEqual([]);
    });

    it('rejects setup when mandatory field domain or skills is missing', async () => {
      const candidate = await createCandidate();
      const authHeader = getAuthHeader(candidate);

      // Missing domain
      const resMissingDomain = await request(app)
        .post('/api/profile/setup')
        .set(authHeader)
        .send({
          displayName: 'Valid Name',
          skills: ['TypeScript'],
        });
      expect(resMissingDomain.status).toBe(400);

      // Empty skills array
      const resEmptySkills = await request(app).post('/api/profile/setup').set(authHeader).send({
        displayName: 'Valid Name',
        domain: 'SOFTWARE_ENGINEERING',
        skills: [],
      });
      expect(resEmptySkills.status).toBe(400);
    });
  });

  describe('6. Security & Invariant: careerRole cannot be set by any client request', () => {
    it('ignores client attempts to pass careerRole in POST /api/profile/setup', async () => {
      const candidate = await createCandidate();
      const authHeader = getAuthHeader(candidate);

      // Client maliciously attempts to grant itself FOUNDER or EMPLOYEE
      const res = await request(app)
        .post('/api/profile/setup')
        .set(authHeader)
        .send({
          displayName: 'Hacker Candidate',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['Exploits'],
          careerRole: 'FOUNDER', // Malicious client injection
        });

      expect(res.status).toBe(201);
      // Backend must authoritatively set JOB_SEEKER, never honoring 'FOUNDER'
      expect(res.body.data.user.careerRole).toBe('JOB_SEEKER');

      const dbUser = await UserModel.findById(candidate._id);
      expect(dbUser?.careerRole).toBe('JOB_SEEKER');
    });

    it('ignores client attempts to tamper with careerRole in PUT /api/profile/me', async () => {
      const candidate = await createCandidate();
      const authHeader = getAuthHeader(candidate);

      await request(app)
        .post('/api/profile/setup')
        .set(authHeader)
        .send({
          displayName: 'Standard Seeker',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['TypeScript'],
        });

      // Seeker attempts to promote itself to EMPLOYEE or ADMIN via profile update
      const res = await request(app).put('/api/profile/me').set(authHeader).send({
        bio: 'Legit update',
        careerRole: 'EMPLOYEE',
        platformRole: 'ADMIN',
      });

      expect(res.status).toBe(200);

      const dbUser = await UserModel.findById(candidate._id);
      expect(dbUser?.careerRole).toBe('JOB_SEEKER');
      expect(dbUser?.platformRole).toBe('NONE');
    });

    it('ignores client attempts to alter careerRole in PATCH /api/profile/step', async () => {
      const candidate = await createCandidate();
      const authHeader = getAuthHeader(candidate);

      const res = await request(app).patch('/api/profile/step').set(authHeader).send({
        step: 'NAME',
        displayName: 'Sneaky User',
        careerRole: 'FOUNDER',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.careerRole).toBe('NONE');

      const dbUser = await UserModel.findById(candidate._id);
      expect(dbUser?.careerRole).toBe('NONE');
    });
  });
});
