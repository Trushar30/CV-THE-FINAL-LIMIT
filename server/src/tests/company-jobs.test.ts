import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { companyService } from '../services/company/company.service.js';
import { configService } from '../services/config/config.service.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_company_jobs';

describe('Companies and Jobs Architecture Suite (TASK P5.1)', () => {
  const app = createApp();

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
    await configService.seedDefaultsIfMissing();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await CompanyModel.collection.deleteMany({});
      await CompanyJobModel.collection.deleteMany({});
      await CompanyEmployeeModel.collection.deleteMany({});
      await UserModel.collection.deleteMany({});
      await AuditLogModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await CompanyModel.collection.deleteMany({});
    await CompanyJobModel.collection.deleteMany({});
    await CompanyEmployeeModel.collection.deleteMany({});
    await UserModel.collection.deleteMany({});
    await AuditLogModel.collection.deleteMany({});
  });

  async function createTestUser(overrides: Partial<Record<string, unknown>> = {}): Promise<{
    user: IUserDocument;
    token: string;
  }> {
    const passwordHash = await hashPassword('TestPass123!');
    const user = await UserModel.create({
      email: `user_${Date.now()}_${Math.random().toString(36).substring(7)}@corpverse.dev`,
      passwordHash,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExp: 0,
      corpCoinBalance: 0,
      founderStarterCoinGranted: false,
      ...overrides,
    });
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      platformRole: user.platformRole,
      careerRole: user.careerRole,
    });
    return { user, token };
  }

  async function createAdminUser(): Promise<{ user: IUserDocument; token: string }> {
    return createTestUser({
      careerRole: 'NONE',
      platformRole: 'ADMIN',
    });
  }

  describe('1. Mongoose Models & Validation Invariants', () => {
    it('creates a Company with valid fields and default PLATFORM type', async () => {
      const company = await CompanyModel.create({
        name: 'Apex Robotics',
        description: 'Advanced autonomous enterprise systems.',
        domainsHired: ['SOFTWARE_ENGINEERING', 'AI_ENGINEERING'],
        ratings: { overall: 80, culture: 85, workLife: 75, technicalExcellence: 80 },
        financialHealth: 5000,
        maxEmployees: 20,
      });

      expect(company._id).toBeDefined();
      expect(company.name).toBe('Apex Robotics');
      expect(company.type).toBe('PLATFORM');
      expect(company.isPlatformCompany).toBe(true);
      expect(company.ownerId).toBeNull();
      expect(company.status).toBe('ACTIVE');
      expect(company.employeeCount).toBe(0);
      expect(company.companyRating).toBe(80);
      expect(company.aiProviderPool).toBe('PIPELINE');
    });

    it('enforces unique company names', async () => {
      await CompanyModel.create({
        name: 'Unique Corp',
        description: 'First instance of Unique Corp.',
        domainsHired: ['SOFTWARE_ENGINEERING'],
      });

      await expect(
        CompanyModel.create({
          name: 'Unique Corp',
          description: 'Duplicate instance of Unique Corp.',
          domainsHired: ['CLOUD_ENGINEERING'],
        })
      ).rejects.toThrow();
    });

    it('creates a CompanyJob with level range and synchronizes isOpen', async () => {
      const company = await CompanyModel.create({
        name: 'Test Tech',
        description: 'Testing jobs creation.',
        domainsHired: ['SOFTWARE_ENGINEERING'],
      });

      const job = await CompanyJobModel.create({
        companyId: company._id,
        title: 'Junior Backend Engineer',
        description: 'Maintain REST API endpoints.',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 1,
        maxLevel: 3,
        requiredSkills: ['TypeScript', 'Node.js'],
        openings: 2,
        status: 'OPEN',
      });

      expect(job._id).toBeDefined();
      expect(job.companyId.toString()).toBe(company._id.toString());
      expect(job.isOpen).toBe(true);
      expect(job.minLevel).toBe(1);
      expect(job.maxLevel).toBe(3);
      expect(job.openings).toBe(2);
    });

    it('creates a CompanyEmployee with level, positionTitle, and history entry', async () => {
      const { user } = await createTestUser();
      const company = await CompanyModel.create({
        name: 'Staffed Systems',
        description: 'Employing engineers.',
        domainsHired: ['CLOUD_ENGINEERING'],
      });

      const employee = await CompanyEmployeeModel.create({
        userId: user._id,
        companyId: company._id,
        domain: 'CLOUD_ENGINEERING',
        level: 3,
        positionTitle: 'Junior+ Cloud Engineer',
        status: 'ACTIVE',
        history: [
          {
            status: 'ACTIVE',
            level: 3,
            positionTitle: 'Junior+ Cloud Engineer',
            reason: 'Hired after passing interviews',
            changedAt: new Date(),
          },
        ],
      });

      expect(employee._id).toBeDefined();
      expect(employee.userId.toString()).toBe(user._id.toString());
      expect(employee.positionTitle).toBe('Junior+ Cloud Engineer');
      expect(employee.jobTitle).toBe('Junior+ Cloud Engineer');
      expect(employee.status).toBe('ACTIVE');
      expect(employee.history).toHaveLength(1);
    });
  });

  describe('2. Platform Companies Seeding (D13)', () => {
    it('seeds exactly 3 PLATFORM companies with jobs across all hired domains', async () => {
      await companyService.seedPlatformCompanies();

      const platformCompanies = await CompanyModel.find({ type: 'PLATFORM' });
      expect(platformCompanies).toHaveLength(3);

      const names = platformCompanies.map((c) => c.name);
      expect(names).toContain('Nexus Enterprise Systems');
      expect(names).toContain('CloudScale Infrastructure');
      expect(names).toContain('Synthetix AI Labs');

      for (const comp of platformCompanies) {
        expect(comp.isPlatformCompany).toBe(true);
        expect(comp.ownerId).toBeNull();
        expect(comp.status).toBe('ACTIVE');
        expect(comp.aiProviderPool).toBe('PIPELINE');

        // Check that each hired domain has at least one job
        for (const domain of comp.domainsHired) {
          const job = await CompanyJobModel.findOne({
            companyId: comp._id,
            domain,
            status: 'OPEN',
          });
          expect(job).not.toBeNull();
          expect(job!.title).toBeDefined();
          expect(job!.requiredSkills.length).toBeGreaterThan(0);
        }
      }
    });

    it('is completely idempotent when run multiple times', async () => {
      await companyService.seedPlatformCompanies();
      const firstCountCompanies = await CompanyModel.countDocuments();
      const firstCountJobs = await CompanyJobModel.countDocuments();

      // Run seeding a second time
      await companyService.seedPlatformCompanies();
      const secondCountCompanies = await CompanyModel.countDocuments();
      const secondCountJobs = await CompanyJobModel.countDocuments();

      expect(secondCountCompanies).toBe(firstCountCompanies);
      expect(secondCountJobs).toBe(firstCountJobs);
      expect(secondCountCompanies).toBe(3);
    });
  });

  describe('3. Public and Job Seeker Read Endpoints', () => {
    beforeEach(async () => {
      await companyService.seedPlatformCompanies();
    });

    it('GET /api/companies lists active companies with openJobCount', async () => {
      const res = await request(app).get('/api/companies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBe(3);

      for (const comp of res.body.data) {
        expect(comp.openJobCount).toBeGreaterThanOrEqual(1);
        expect(comp.name).toBeDefined();
      }
    });

    it('GET /api/companies filters by domain', async () => {
      const res = await request(app).get('/api/companies?domain=AI_ENGINEERING');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // All 3 seeded companies hire for AI_ENGINEERING
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/companies searches by name keyword', async () => {
      const res = await request(app).get('/api/companies?search=Nexus');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Nexus Enterprise Systems');
    });

    it('GET /api/companies/:id returns company details along with active openJobs', async () => {
      const company = await CompanyModel.findOne({ name: 'Nexus Enterprise Systems' });
      expect(company).not.toBeNull();

      const res = await request(app).get(`/api/companies/${company!._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company.name).toBe('Nexus Enterprise Systems');
      expect(Array.isArray(res.body.data.openJobs)).toBe(true);
      expect(res.body.data.openJobs.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/companies/:id returns 404 for nonexistent ID', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const res = await request(app).get(`/api/companies/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/companies/:id returns 400 for invalid ObjectId format', async () => {
      const res = await request(app).get('/api/companies/invalid-id-format');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/jobs lists all open jobs with populated companyId', async () => {
      const res = await request(app).get('/api/jobs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(9);
      expect(res.body.data[0].companyId).toBeDefined();
      expect(res.body.data[0].companyId.name).toBeDefined();
    });

    it('GET /api/jobs filters by domain', async () => {
      const res = await request(app).get('/api/jobs?domain=CLOUD_ENGINEERING');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const job of res.body.data) {
        expect(job.domain).toBe('CLOUD_ENGINEERING');
      }
    });

    it('GET /api/jobs filters by level range', async () => {
      // Find jobs suitable for level 4 (where minLevel <= 4 and maxLevel >= 4)
      const res = await request(app).get('/api/jobs?minLevel=4&maxLevel=4');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const job of res.body.data) {
        expect(job.minLevel).toBeLessThanOrEqual(4);
        expect(job.maxLevel).toBeGreaterThanOrEqual(4);
      }
    });

    it('GET /api/jobs searches by keyword in title or required skills', async () => {
      const res = await request(app).get('/api/jobs?search=Kubernetes');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/jobs/:id returns single job details with populated company', async () => {
      const job = await CompanyJobModel.findOne();
      expect(job).not.toBeNull();

      const res = await request(app).get(`/api/jobs/${job!._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(job!._id.toString());
      expect(res.body.data.companyId.name).toBeDefined();
    });

    it('GET /api/jobs/:id returns 404 for nonexistent job ID', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const res = await request(app).get(`/api/jobs/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Admin Mutation Routes & RBAC Protection', () => {
    it('rejects regular candidate from calling POST /api/admin/companies with 403', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/admin/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Unauthorized Corp',
          description: 'Hacker trying to create company.',
          domainsHired: ['SOFTWARE_ENGINEERING'],
          reason: 'Test attack',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows ADMIN to create a company and records audit log', async () => {
      const { user: admin, token: adminToken } = await createAdminUser();

      const res = await request(app)
        .post('/api/admin/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Quantum Hyperdrive Inc',
          description: 'Pioneering quantum microkernel systems.',
          type: 'PLATFORM',
          domainsHired: ['SOFTWARE_ENGINEERING', 'AI_ENGINEERING'],
          ratings: { overall: 89, culture: 90, workLife: 85, technicalExcellence: 92 },
          maxEmployees: 25,
          financialHealth: 15000,
          reason: 'Initial platform test seed company',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Quantum Hyperdrive Inc');
      expect(res.body.data.type).toBe('PLATFORM');
      expect(res.body.data.maxEmployees).toBe(25);

      // Verify audit log record
      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_CREATE_COMPANY',
        targetId: res.body.data._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.actorId.toString()).toBe(admin._id.toString());
      expect(auditLog!.reason).toBe('Initial platform test seed company');
    });

    it('allows ADMIN to update a company and records audit log', async () => {
      const { user: admin, token: adminToken } = await createAdminUser();
      const company = await CompanyModel.create({
        name: 'Alpha Systems',
        description: 'Old description.',
        domainsHired: ['CLOUD_ENGINEERING'],
        maxEmployees: 20,
      });

      const res = await request(app)
        .patch(`/api/admin/companies/${company._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated modern description.',
          companyRating: 95,
          reason: 'Quarterly review adjustment',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated modern description.');
      expect(res.body.data.companyRating).toBe(95);

      // Verify audit log
      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_UPDATE_COMPANY',
        targetId: company._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.actorId.toString()).toBe(admin._id.toString());
      expect(auditLog!.reason).toBe('Quarterly review adjustment');
    });

    it('allows ADMIN to create a job and records audit log', async () => {
      const { user: admin, token: adminToken } = await createAdminUser();
      const company = await CompanyModel.create({
        name: 'Beta Cloud Corp',
        description: 'Cloud provider.',
        domainsHired: ['CLOUD_ENGINEERING'],
      });

      const res = await request(app)
        .post('/api/admin/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          companyId: company._id.toString(),
          title: 'Infrastructure Reliability Engineer',
          description: 'Design robust multi-region mesh.',
          domain: 'CLOUD_ENGINEERING',
          minLevel: 3,
          maxLevel: 6,
          requiredSkills: ['Terraform', 'AWS', 'Kubernetes'],
          openings: 2,
          reason: 'Opening new team requisitions',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Infrastructure Reliability Engineer');
      expect(res.body.data.openings).toBe(2);

      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_CREATE_JOB',
        targetId: res.body.data._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.actorId.toString()).toBe(admin._id.toString());
      expect(auditLog!.reason).toBe('Opening new team requisitions');
    });

    it('allows ADMIN to update a job and records audit log', async () => {
      const { user: admin, token: adminToken } = await createAdminUser();
      const company = await CompanyModel.create({
        name: 'Gamma Solutions',
        description: 'Software solutions.',
        domainsHired: ['SOFTWARE_ENGINEERING'],
      });

      const job = await CompanyJobModel.create({
        companyId: company._id,
        title: 'Full Stack Engineer',
        description: 'Web development.',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 1,
        maxLevel: 3,
        requiredSkills: ['TypeScript'],
        openings: 1,
      });

      const res = await request(app)
        .patch(`/api/admin/jobs/${job._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Senior Full Stack Engineer',
          minLevel: 4,
          maxLevel: 7,
          openings: 3,
          reason: 'Seniority tier elevation',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Senior Full Stack Engineer');
      expect(res.body.data.openings).toBe(3);

      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_UPDATE_JOB',
        targetId: job._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.actorId.toString()).toBe(admin._id.toString());
      expect(auditLog!.reason).toBe('Seniority tier elevation');
    });

    it('allows ADMIN to delete (close) a job and records audit log', async () => {
      const { user: admin, token: adminToken } = await createAdminUser();
      const company = await CompanyModel.create({
        name: 'Delta AI',
        description: 'AI intelligence.',
        domainsHired: ['AI_ENGINEERING'],
      });

      const job = await CompanyJobModel.create({
        companyId: company._id,
        title: 'Prompt Engineer',
        description: 'LLM prompt construction.',
        domain: 'AI_ENGINEERING',
        minLevel: 1,
        maxLevel: 3,
        requiredSkills: ['Python'],
        status: 'OPEN',
        isOpen: true,
      });

      const res = await request(app)
        .delete(`/api/admin/jobs/${job._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Requisition fulfilled by internal transfer',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
      expect(res.body.data.isOpen).toBe(false);

      const updatedJob = await CompanyJobModel.findById(job._id);
      expect(updatedJob!.status).toBe('CLOSED');
      expect(updatedJob!.isOpen).toBe(false);

      const auditLog = await AuditLogModel.findOne({
        action: 'ADMIN_DELETE_JOB',
        targetId: job._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.actorId.toString()).toBe(admin._id.toString());
      expect(auditLog!.reason).toBe('Requisition fulfilled by internal transfer');
    });

    it('enforces mandatory audit reason on admin mutations (400 if missing)', async () => {
      const { token: adminToken } = await createAdminUser();

      const res = await request(app)
        .post('/api/admin/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Reason Corp',
          description: 'No reason provided in payload.',
          domainsHired: ['SOFTWARE_ENGINEERING'],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
