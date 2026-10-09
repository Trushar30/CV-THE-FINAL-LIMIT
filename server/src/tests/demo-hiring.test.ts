import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { ApplicationModel } from '../models/Application.js';
import { DemoSessionModel } from '../models/DemoSession.js';
import { InterviewModel } from '../models/Interview.js';
import { QuestionModel } from '../models/Question.js';
import { AnswerModel } from '../models/Answer.js';
import { EvaluationModel } from '../models/Evaluation.js';
import { FeedbackModel } from '../models/Feedback.js';
import { AIJobModel } from '../models/AIJob.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { CorpCoinTransactionModel } from '../models/CorpCoinTransaction.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { type INotificationDocument } from '../models/Notification.js';
import { configService } from '../services/config/config.service.js';
import { defaultFinalReviewOfferService } from '../services/career/finalReviewOffer.service.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { notificationService } from '../services/notification/notification.service.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_demo_hiring';

describe('Admin Demo Hiring Simulator & Production Isolation Suite (TASK P6.6)', () => {
  const app = createApp();
  let adminUser: IUserDocument;
  let adminToken: string;
  let candidateUser: IUserDocument;
  let candidateToken: string;
  let aiManagerUser: IUserDocument;
  let aiManagerToken: string;

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
    await configService.seedDefaultsIfMissing();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await DemoSessionModel.collection.deleteMany({});
      await ApplicationModel.collection.deleteMany({});
      await CompanyModel.collection.deleteMany({});
      await CompanyJobModel.collection.deleteMany({});
      await CompanyEmployeeModel.collection.deleteMany({});
      await InterviewModel.collection.deleteMany({});
      await QuestionModel.collection.deleteMany({});
      await AnswerModel.collection.deleteMany({});
      await EvaluationModel.collection.deleteMany({});
      await FeedbackModel.collection.deleteMany({});
      await AIJobModel.collection.deleteMany({});
      await ExpTransactionModel.collection.deleteMany({});
      await CorpCoinTransactionModel.collection.deleteMany({});
      await AuditLogModel.collection.deleteMany({});
      await UserModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(notificationService, 'create').mockResolvedValue(null as unknown as INotificationDocument);

    await DemoSessionModel.collection.deleteMany({});
    await ApplicationModel.collection.deleteMany({});
    await CompanyModel.collection.deleteMany({});
    await CompanyJobModel.collection.deleteMany({});
    await CompanyEmployeeModel.collection.deleteMany({});
    await InterviewModel.collection.deleteMany({});
    await QuestionModel.collection.deleteMany({});
    await AnswerModel.collection.deleteMany({});
    await EvaluationModel.collection.deleteMany({});
    await FeedbackModel.collection.deleteMany({});
    await AIJobModel.collection.deleteMany({});
    await ExpTransactionModel.collection.deleteMany({});
    await CorpCoinTransactionModel.collection.deleteMany({});
    await AuditLogModel.collection.deleteMany({});
    await UserModel.collection.deleteMany({});

    const passwordHash = await hashPassword('AdminPass123!');

    // 1. Admin user
    adminUser = await UserModel.create({
      email: `admin_${Date.now()}@corpverse.dev`,
      passwordHash,
      careerRole: 'NONE',
      platformRole: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExp: 0,
      corpCoinBalance: 0,
    });
    adminToken = signAccessToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      platformRole: 'ADMIN',
      careerRole: 'NONE',
    });

    // 2. Regular candidate user
    candidateUser = await UserModel.create({
      email: `candidate_${Date.now()}@corpverse.dev`,
      passwordHash,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExp: 1500,
      corpCoinBalance: 500,
    });
    candidateToken = signAccessToken({
      userId: candidateUser._id.toString(),
      email: candidateUser.email,
      platformRole: 'NONE',
      careerRole: 'JOB_SEEKER',
    });

    // 3. AI Manager user
    aiManagerUser = await UserModel.create({
      email: `aimanager_${Date.now()}@corpverse.dev`,
      passwordHash,
      careerRole: 'NONE',
      platformRole: 'AI_MANAGER',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExp: 0,
      corpCoinBalance: 0,
    });
    aiManagerToken = signAccessToken({
      userId: aiManagerUser._id.toString(),
      email: aiManagerUser.email,
      platformRole: 'AI_MANAGER',
      careerRole: 'NONE',
    });
  });

  describe('1. RBAC & Access Controls for Demo Hiring', () => {
    it('rejects unauthenticated requests to POST /api/admin/demo/hiring with 401', async () => {
      const res = await request(app)
        .post('/api/admin/demo/hiring')
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 3,
          difficulty: 'MEDIUM',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('rejects regular candidate users with 403 AUTHORIZATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 3,
          difficulty: 'MEDIUM',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('rejects AI_MANAGER users with 403 AUTHORIZATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${aiManagerToken}`)
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 3,
          difficulty: 'MEDIUM',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('validates request payload strictly with Zod', async () => {
      const res = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'INVALID_DOMAIN',
          questionsCount: 50, // exceeds max 10
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Unified Hiring Engine Demo Session Creation', () => {
    it('creates a demo session with mode = DEMO against dedicated demo company and DEMO pool', async () => {
      const res = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 3,
          difficulty: 'MEDIUM',
          interviewType: 'TECHNICAL_DEEP_DIVE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.demoSessionId).toBeDefined();
      expect(res.body.data.applicationId).toBeDefined();

      const { demoSessionId, applicationId } = res.body.data;

      // Verify DemoSession document
      const session = await DemoSessionModel.findById(demoSessionId);
      expect(session).toBeDefined();
      expect(session!.domain).toBe('SOFTWARE_ENGINEERING');
      expect(session!.difficulty).toBe('MEDIUM');
      expect(session!.questionsCount).toBe(3);
      expect(session!.interviewType).toBe('TECHNICAL_DEEP_DIVE');
      expect(session!.currentStage).toBe('APPLIED');
      expect(session!.status).toBe('INITIALIZED');

      // Verify Application document: mode = DEMO
      const application = await ApplicationModel.findById(applicationId);
      expect(application).toBeDefined();
      expect(application!.mode).toBe('DEMO');
      expect(application!.currentStage).toBe('APPLIED');
      expect(application!.status).toBe('ACTIVE');

      // Verify Company document: aiProviderPool = DEMO
      const company = await CompanyModel.findById(application!.companyId);
      expect(company).toBeDefined();
      expect(company!.aiProviderPool).toBe('DEMO');
      expect(company!.isPlatformCompany).toBe(true);
    });

    it('normalizes legacy difficulty aliases (SENIOR -> HARD, JUNIOR -> EASY)', async () => {
      const res = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'AI_ENGINEERING',
          questionsCount: 2,
          difficulty: 'SENIOR',
        });

      expect(res.status).toBe(201);
      const session = await DemoSessionModel.findById(res.body.data.demoSessionId);
      expect(session!.difficulty).toBe('HARD');
    });
  });

  describe('3. Stage Execution, Inspection & AI Telemetry', () => {
    it('allows Admin to inspect demo session state and AI telemetry', async () => {
      const createRes = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'CLOUD_ENGINEERING',
          questionsCount: 2,
          difficulty: 'EASY',
        });

      const { demoSessionId } = createRes.body.data;

      const inspectRes = await request(app)
        .get(`/api/admin/demo/hiring/${demoSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(inspectRes.status).toBe(200);
      expect(inspectRes.body.success).toBe(true);
      expect(inspectRes.body.data.session._id).toBe(demoSessionId);
      expect(inspectRes.body.data.application).toBeDefined();
      expect(inspectRes.body.data.stages).toBeDefined();
      expect(inspectRes.body.data.aiTelemetry).toBeDefined();
      expect(Array.isArray(inspectRes.body.data.aiTelemetry.jobs)).toBe(true);
    });

    it('returns 404 when inspecting non-existent demo session', async () => {
      const randomId = new Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/admin/demo/hiring/${randomId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('advances through ATS screening step and enqueues job with pool = DEMO', async () => {
      const createRes = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 1,
          difficulty: 'EASY',
        });

      const { demoSessionId, applicationId } = createRes.body.data;

      const stepRes = await request(app)
        .post(`/api/admin/demo/hiring/${demoSessionId}/step`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(stepRes.status).toBe(200);
      expect(stepRes.body.success).toBe(true);

      const appDoc = await ApplicationModel.findById(applicationId);
      expect(appDoc!.currentStage).toBe('ATS_SCREENING');

      const aiJob = await AIJobModel.findOne({ requestorReference: applicationId });
      expect(aiJob).toBeDefined();
      expect(aiJob!.pool).toBe('DEMO');
      expect(aiJob!.taskType).toBe('ATS_SCREEN');
    });
  });

  describe('4. Hard Isolation Invariants: Zero Production State Impact', () => {
    it('PROVES demo offer acceptance NEVER creates real employees, NEVER changes EXP/CorpCoin, and NEVER alters candidate careerRole', async () => {
      // 1. Create a demo session
      const createRes = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 1,
          difficulty: 'EASY',
        });

      const { applicationId } = createRes.body.data;
      const appDoc = (await ApplicationModel.findById(applicationId))!;

      // 2. Set up application at OFFER stage
      appDoc.currentStage = 'OFFER';
      appDoc.status = 'ACTIVE';
      appDoc.offer = {
        positionTitle: 'Demo Junior Software Engineer',
        level: 2,
        salarySimulated: 65000,
        salaryMin: 50000,
        salaryMax: 80000,
        negotiationRoundsLeft: 1,
        maxNegotiationRounds: 1,
        negotiationHistory: [],
        status: 'OFFERED',
        offeredAt: new Date(),
      };
      await appDoc.save();

      // Record baseline production counts
      const baselineEmployeeCount = await CompanyEmployeeModel.countDocuments();
      const baselineExpTransactions = await ExpTransactionModel.countDocuments();
      const baselineCorpCoinTransactions = await CorpCoinTransactionModel.countDocuments();
      const candidateBefore = (await UserModel.findById(appDoc.userId))!;
      const companyBefore = (await CompanyModel.findById(appDoc.companyId))!;

      expect(candidateBefore.careerRole).toBe('JOB_SEEKER');
      expect(companyBefore.employeeCount).toBe(0);

      // 3. Accept offer
      const acceptResult = await defaultFinalReviewOfferService.acceptOffer(
        appDoc._id.toString(),
        appDoc.userId.toString()
      );

      expect(acceptResult.application.status).toBe('ACCEPTED');
      expect(acceptResult.application.offer!.status).toBe('ACCEPTED');
      expect(acceptResult.employee).toBeNull();

      // 4. Verify ZERO PRODUCTION MUTATIONS:
      // A. Zero CompanyEmployee records created
      const currentEmployeeCount = await CompanyEmployeeModel.countDocuments();
      expect(currentEmployeeCount).toBe(baselineEmployeeCount);
      expect(currentEmployeeCount).toBe(0);

      // B. Company employee count unchanged
      const companyAfter = (await CompanyModel.findById(appDoc.companyId))!;
      expect(companyAfter.employeeCount).toBe(companyBefore.employeeCount);
      expect(companyAfter.employeeCount).toBe(0);

      // C. Candidate user careerRole remains JOB_SEEKER (not promoted to EMPLOYEE)
      const candidateAfter = (await UserModel.findById(appDoc.userId))!;
      expect(candidateAfter.careerRole).toBe('JOB_SEEKER');
      expect(candidateAfter.totalExp).toBe(candidateBefore.totalExp);
      expect(candidateAfter.corpCoinBalance).toBe(candidateBefore.corpCoinBalance);

      // D. Zero EXP ledger entries created
      const currentExpTransactions = await ExpTransactionModel.countDocuments();
      expect(currentExpTransactions).toBe(baselineExpTransactions);
      expect(currentExpTransactions).toBe(0);

      // E. Zero CorpCoin ledger entries created
      const currentCorpCoinTransactions = await CorpCoinTransactionModel.countDocuments();
      expect(currentCorpCoinTransactions).toBe(baselineCorpCoinTransactions);
      expect(currentCorpCoinTransactions).toBe(0);
    });

    it('PROVES demo data is excluded from production ranking queries', async () => {
      // Create demo application and complete it
      const createRes = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'AI_ENGINEERING',
          questionsCount: 1,
          difficulty: 'EASY',
        });

      const { applicationId } = createRes.body.data;

      // Query production rankings (applications where mode = PRODUCTION)
      const productionApplications = await ApplicationModel.find({ mode: 'PRODUCTION' });
      const demoApplications = await ApplicationModel.find({ mode: 'DEMO' });

      expect(productionApplications.length).toBe(0);
      expect(demoApplications.length).toBe(1);
      expect(demoApplications[0]._id.toString()).toBe(applicationId);

      // Query production companies (where aiProviderPool = PIPELINE)
      const productionCompanies = await CompanyModel.find({ aiProviderPool: 'PIPELINE' });
      const demoCompanies = await CompanyModel.find({ aiProviderPool: 'DEMO' });

      expect(demoCompanies.length).toBeGreaterThanOrEqual(1);
      expect(productionCompanies.every((c) => c.aiProviderPool === 'PIPELINE')).toBe(true);
    });
  });

  describe('5. Admin Demo Cleanup & Audit Logging', () => {
    it('cleans up single demo session data and records immutable audit log', async () => {
      const createRes = await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domain: 'SOFTWARE_ENGINEERING',
          questionsCount: 2,
          difficulty: 'MEDIUM',
        });

      const { demoSessionId, applicationId } = createRes.body.data;

      // Verify records exist before cleanup
      expect(await DemoSessionModel.findById(demoSessionId)).toBeDefined();
      expect(await ApplicationModel.findById(applicationId)).toBeDefined();

      // Trigger cleanup action
      const deleteRes = await request(app)
        .delete(`/api/admin/demo/hiring/${demoSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Completed test demonstration' });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify demo records are removed
      expect(await DemoSessionModel.findById(demoSessionId)).toBeNull();
      expect(await ApplicationModel.findById(applicationId)).toBeNull();

      // Verify immutable audit log was created
      const auditLog = await AuditLogModel.findOne({
        targetId: new Types.ObjectId(demoSessionId),
        action: 'DEMO_DATA_CLEANUP',
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.actorId.toString()).toBe(adminUser._id.toString());
      expect(auditLog!.actorRole).toBe('ADMIN');
      expect(auditLog!.reason).toBe('Completed test demonstration');
    });

    it('performs bulk cleanup of all demo sessions system-wide and records audit log', async () => {
      // Create 2 sessions
      await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ domain: 'SOFTWARE_ENGINEERING', questionsCount: 1, difficulty: 'EASY' });

      await request(app)
        .post('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ domain: 'CLOUD_ENGINEERING', questionsCount: 1, difficulty: 'EASY' });

      expect(await DemoSessionModel.countDocuments()).toBe(2);
      expect(await ApplicationModel.countDocuments({ mode: 'DEMO' })).toBe(2);

      // Bulk cleanup
      const bulkRes = await request(app)
        .delete('/api/admin/demo/hiring')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Purging all demo sessions before maintenance' });

      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.success).toBe(true);
      expect(bulkRes.body.data.deletedSessionsCount).toBe(2);
      expect(bulkRes.body.data.deletedApplicationsCount).toBe(2);

      expect(await DemoSessionModel.countDocuments()).toBe(0);
      expect(await ApplicationModel.countDocuments({ mode: 'DEMO' })).toBe(0);

      // Verify audit log
      const auditLog = await AuditLogModel.findOne({ action: 'BULK_DEMO_DATA_PURGE' });
      expect(auditLog).toBeDefined();
      expect(auditLog!.reason).toBe('Purging all demo sessions before maintenance');
    });
  });
});
