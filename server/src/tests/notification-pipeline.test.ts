import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { NotificationModel } from '../models/Notification.js';
import { notificationService } from '../services/notification/notification.service.js';
import {
  ApplicationModel,
  type IStageHistoryEntry,
  type IApplicationOffer,
} from '../models/Application.js';
import { FeedbackModel } from '../models/Feedback.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../models/CompanyJob.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { InterviewModel } from '../models/Interview.js';
import { AnswerModel } from '../models/Answer.js';
import { EvaluationModel } from '../models/Evaluation.js';
import { atsScreeningService } from '../services/career/atsScreening.service.js';
import { finalReviewOfferService } from '../services/career/finalReviewOffer.service.js';
import { applicationService } from '../services/career/application.service.js';
import { hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import type {
  ApplicationMode,
  ApplicationStage,
  ApplicationStatus,
} from '../types/enums.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_notifications';

describe('Notification System & Hiring Events Integration (TASK P6.5)', () => {
  const app = createApp();

  let candidate1: IUserDocument;
  let candidate2: IUserDocument;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await NotificationModel.collection.deleteMany({});
      await ApplicationModel.collection.deleteMany({});
      await FeedbackModel.collection.deleteMany({});
      await UserModel.collection.deleteMany({});
      await CompanyModel.collection.deleteMany({});
      await CompanyJobModel.collection.deleteMany({});
      await CompanyEmployeeModel.collection.deleteMany({});
      await InterviewModel.collection.deleteMany({});
      await AnswerModel.collection.deleteMany({});
      await EvaluationModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    await NotificationModel.collection.deleteMany({});
    await ApplicationModel.collection.deleteMany({});
    await FeedbackModel.collection.deleteMany({});
    await UserModel.collection.deleteMany({});
    await CompanyModel.collection.deleteMany({});
    await CompanyJobModel.collection.deleteMany({});
    await CompanyEmployeeModel.collection.deleteMany({});
    await InterviewModel.collection.deleteMany({});
    await AnswerModel.collection.deleteMany({});
    await EvaluationModel.collection.deleteMany({});

    const passwordHash = await hashPassword('ValidPass123!');

    candidate1 = await UserModel.create({
      email: `candidate1_${Date.now()}@corpverse.dev`,
      passwordHash,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExpCached: 0,
      corpCoinBalanceCached: 0,
    });

    candidate2 = await UserModel.create({
      email: `candidate2_${Date.now()}@corpverse.dev`,
      passwordHash,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      isEmailVerified: true,
      onboardingStep: 'COMPLETE',
      failedLoginAttempts: 0,
      totalExpCached: 0,
      corpCoinBalanceCached: 0,
    });

    token1 = signAccessToken({
      userId: candidate1._id.toString(),
      email: candidate1.email,
      careerRole: candidate1.careerRole,
      platformRole: candidate1.platformRole,
    });

    token2 = signAccessToken({
      userId: candidate2._id.toString(),
      email: candidate2.email,
      careerRole: candidate2.careerRole,
      platformRole: candidate2.platformRole,
    });
  });

  function createApplicationFixture(
    data: {
      userId: Types.ObjectId;
      jobId: Types.ObjectId;
      companyId: Types.ObjectId;
      status?: ApplicationStatus;
      currentStage?: ApplicationStage;
      mode?: ApplicationMode;
      atsScore?: number;
      stageHistory?: IStageHistoryEntry[];
      offer?: IApplicationOffer;
      createdAt?: Date;
      updatedAt?: Date;
    }
  ) {
    const resumeAnalysisId = new Types.ObjectId();
    const resumeId = new Types.ObjectId();
    return ApplicationModel.create({
      userId: data.userId,
      jobId: data.jobId,
      companyId: data.companyId,
      status: data.status ?? 'ACTIVE',
      currentStage: data.currentStage ?? 'APPLIED',
      mode: data.mode ?? 'PRODUCTION',
      atsScore: data.atsScore,
      stageHistory: data.stageHistory ?? [
        { stage: data.currentStage ?? 'APPLIED', enteredAt: new Date() },
      ],
      offer: data.offer,
      resumeAnalysisId,
      resumeAnalysisSnapshot: {
        resumeAnalysisId,
        resumeId,
        domainClassification: 'SOFTWARE_ENGINEERING',
        parsedSkills: ['Node.js', 'TypeScript'],
        yearsOfExperience: 2,
        snapshotAt: new Date(),
      },
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  describe('1. NotificationService Unit Tests', () => {
    it('creates a notification with isRead: false by default', async () => {
      const notif = await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: 'Stage Advanced',
        message: 'Your application has advanced to Screening.',
        link: '/applications/123',
      });

      expect(notif._id).toBeDefined();
      expect(notif.userId.toString()).toBe(candidate1._id.toString());
      expect(notif.type).toBe('STAGE_ADVANCED');
      expect(notif.title).toBe('Stage Advanced');
      expect(notif.message).toBe('Your application has advanced to Screening.');
      expect(notif.link).toBe('/applications/123');
      expect(notif.isRead).toBe(false);
      expect(notif.createdAt).toBeInstanceOf(Date);
    });

    it('lists notifications for a user sorted by createdAt descending with unread count', async () => {
      const notif1 = await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: 'Notif 1',
        message: 'Message 1',
      });

      const notif2 = await notificationService.create({
        userId: candidate1._id,
        type: 'OFFER_RECEIVED',
        title: 'Notif 2',
        message: 'Message 2',
      });
      notif2.createdAt = new Date(Date.now() + 1000);
      await notif2.save();

      // Another user's notification
      await notificationService.create({
        userId: candidate2._id,
        type: 'HIRED',
        title: 'Notif Other',
        message: 'Other user message',
      });

      const res = await notificationService.list(candidate1._id);
      expect(res.total).toBe(2);
      expect(res.unreadCount).toBe(2);
      expect(res.notifications).toHaveLength(2);
      expect(res.notifications[0]._id.toString()).toBe(notif2._id.toString());
      expect(res.notifications[1]._id.toString()).toBe(notif1._id.toString());
    });

    it('marks a notification as read and throws 403 when accessed by another user', async () => {
      const notif = await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: 'Test',
        message: 'Test message',
      });

      // Candidate 2 cannot mark candidate 1's notification as read
      await expect(notificationService.markRead(notif._id, candidate2._id)).rejects.toThrow(
        /permission/i
      );

      // Candidate 1 can mark as read
      const updated = await notificationService.markRead(notif._id, candidate1._id);
      expect(updated.isRead).toBe(true);

      const listAfter = await notificationService.list(candidate1._id);
      expect(listAfter.unreadCount).toBe(0);
    });

    it('marks all unread notifications as read for a specific user', async () => {
      await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: '1',
        message: '1',
      });
      await notificationService.create({
        userId: candidate1._id,
        type: 'OFFER_RECEIVED',
        title: '2',
        message: '2',
      });
      await notificationService.create({
        userId: candidate2._id,
        type: 'HIRED',
        title: '3',
        message: '3',
      });

      const result = await notificationService.markAllRead(candidate1._id);
      expect(result.modifiedCount).toBe(2);

      const list1 = await notificationService.list(candidate1._id);
      expect(list1.unreadCount).toBe(0);

      // Candidate 2 unread count remains 1
      const list2 = await notificationService.list(candidate2._id);
      expect(list2.unreadCount).toBe(1);
    });
  });

  describe('2. Notification Endpoints (GET /api/notifications, PATCH /:id/read, PATCH /read-all)', () => {
    it('requires authentication for notification endpoints', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('GET /api/notifications returns user notifications with unread count', async () => {
      await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: 'Candidate 1 Alert',
        message: 'Details',
      });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.unreadCount).toBe(1);
      expect(res.body.data.total).toBe(1);
    });

    it('PATCH /api/notifications/:id/read marks notification as read', async () => {
      const notif = await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: 'To Read',
        message: 'Please read',
      });

      const res = await request(app)
        .patch(`/api/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notification.isRead).toBe(true);

      // Verify forbidden for another user
      const forbiddenRes = await request(app)
        .patch(`/api/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${token2}`);

      expect(forbiddenRes.status).toBe(403);
    });

    it('PATCH /api/notifications/read-all marks all notifications as read', async () => {
      await notificationService.create({
        userId: candidate1._id,
        type: 'STAGE_ADVANCED',
        title: 'A',
        message: 'A',
      });
      await notificationService.create({
        userId: candidate1._id,
        type: 'OFFER_RECEIVED',
        title: 'B',
        message: 'B',
      });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.modifiedCount).toBe(2);
    });
  });

  describe('3. Feedback Detail Endpoint (GET /api/applications/:id/feedback)', () => {
    let company: ICompanyDocument;
    let job: ICompanyJobDocument;

    beforeEach(async () => {
      company = await CompanyModel.create({
        name: 'Tech Corp',
        description: 'Tech Company',
        domain: 'SOFTWARE_ENGINEERING',
        domainsHired: ['SOFTWARE_ENGINEERING'],
        type: 'PLATFORM',
        status: 'ACTIVE',
        employeeCount: 5,
        maxEmployees: 20,
      });

      job = await CompanyJobModel.create({
        companyId: company._id,
        title: 'Full Stack Engineer',
        description: 'Full stack development role',
        domain: 'SOFTWARE_ENGINEERING',
        status: 'OPEN',
        targetLevel: 2,
        minLevel: 1,
        maxLevel: 3,
        openings: 2,
        requiredSkills: ['TypeScript', 'Node.js'],
      });
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/applications/${new Types.ObjectId()}/feedback`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent application', async () => {
      const res = await request(app)
        .get(`/api/applications/${new Types.ObjectId()}/feedback`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 403 when candidate attempts to view another candidate application feedback', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'REJECTED',
        currentStage: 'ATS_SCREENING',
        mode: 'PRODUCTION',
      });

      const res = await request(app)
        .get(`/api/applications/${appDoc._id}/feedback`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('returns 400 if application is not in REJECTED status', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'ACTIVE',
        currentStage: 'SCREENING',
        mode: 'PRODUCTION',
      });

      const res = await request(app)
        .get(`/api/applications/${appDoc._id}/feedback`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/rejected/i);
    });

    it('returns 200 with stored feedback for the owner of a rejected application', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'REJECTED',
        currentStage: 'ATS_SCREENING',
        mode: 'PRODUCTION',
      });

      await FeedbackModel.create({
        applicationId: appDoc._id,
        userId: candidate1._id,
        rejectionStage: 'ATS_SCREENING',
        strengths: ['Solid JavaScript proficiency', 'Clean API patterns'],
        weaknesses: ['Missing Docker orchestration experience'],
        actionableSuggestions: ['Add Kubernetes containerization project'],
        createdAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/applications/${appDoc._id}/feedback`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.feedback).toBeDefined();
      expect(res.body.data.feedback.rejectionStage).toBe('ATS_SCREENING');
      expect(res.body.data.feedback.strengths).toContain('Solid JavaScript proficiency');
      expect(res.body.data.feedback.weaknesses).toContain('Missing Docker orchestration experience');
      expect(res.body.data.feedback.actionableSuggestions).toContain('Add Kubernetes containerization project');
    });
  });

  describe('4. Hiring Events Notification Triggers', () => {
    let company: ICompanyDocument;
    let job: ICompanyJobDocument;

    beforeEach(async () => {
      company = await CompanyModel.create({
        name: 'Nexus Corp',
        description: 'Nexus Simulation',
        domain: 'SOFTWARE_ENGINEERING',
        domainsHired: ['SOFTWARE_ENGINEERING'],
        type: 'PLATFORM',
        status: 'ACTIVE',
        employeeCount: 3,
        maxEmployees: 20,
      });

      job = await CompanyJobModel.create({
        companyId: company._id,
        title: 'Backend Engineer',
        description: 'Backend distributed systems role',
        domain: 'SOFTWARE_ENGINEERING',
        status: 'OPEN',
        targetLevel: 2,
        minLevel: 1,
        maxLevel: 3,
        openings: 5,
        requiredSkills: ['Node.js'],
      });
    });

    it('Event 1: stage advanced trigger in ATS screening pass', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'ACTIVE',
        currentStage: 'ATS_SCREENING',
        mode: 'PRODUCTION',
      });

      // Call applyAtsEvaluation on atsScreeningService with passing score
      await atsScreeningService.applyAtsEvaluation(appDoc, {
        matchScore: 85,
        matchedSkills: ['Node.js'],
        missingSkills: [],
        strengths: ['Great backend skills'],
        weaknesses: [],
        improvementSuggestions: [],
        recommendation: 'PASS',
      });

      const notifs = await NotificationModel.find({ userId: candidate1._id });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('STAGE_ADVANCED');
      expect(notifs[0].title).toBe('Stage Advanced');
      expect(notifs[0].message).toMatch(/Screening/i);
      expect(notifs[0].link).toBe(`/applications/${appDoc._id}`);
    });

    it('Event 2: rejected with feedback link trigger in ATS screening failure', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'ACTIVE',
        currentStage: 'ATS_SCREENING',
        mode: 'PRODUCTION',
      });

      // Call applyAtsEvaluation on atsScreeningService with failing score
      await atsScreeningService.applyAtsEvaluation(appDoc, {
        matchScore: 40,
        matchedSkills: [],
        missingSkills: ['Node.js'],
        strengths: [],
        weaknesses: ['Lacks required skills'],
        improvementSuggestions: ['Learn Node.js'],
        recommendation: 'FAIL',
      });

      const notifs = await NotificationModel.find({ userId: candidate1._id });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('APPLICATION_REJECTED');
      expect(notifs[0].link).toBe(`/applications/${appDoc._id}/feedback`);
    });

    it('Event 3: offer received trigger on final review pass', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'ACTIVE',
        currentStage: 'FINAL_REVIEW',
        mode: 'PRODUCTION',
        atsScore: 90,
        stageHistory: [
          { stage: 'ATS_SCREENING', enteredAt: new Date(), exitedAt: new Date(), result: 'PASSED' },
          { stage: 'SCREENING', enteredAt: new Date(), exitedAt: new Date(), result: 'PASSED' },
          { stage: 'ASSESSMENT', enteredAt: new Date(), exitedAt: new Date(), result: 'PASSED' },
          { stage: 'INTERVIEW', enteredAt: new Date(), exitedAt: new Date(), result: 'PASSED' },
        ],
      });

      // Create evaluations for earlier stages
      await EvaluationModel.create([
        { applicationId: appDoc._id, stage: 'SCREENING', score: 85, summary: 'Passed screening', createdAt: new Date() },
        { applicationId: appDoc._id, stage: 'ASSESSMENT', score: 85, summary: 'Passed assessment', createdAt: new Date() },
        { applicationId: appDoc._id, stage: 'INTERVIEW', score: 85, summary: 'Passed interview', createdAt: new Date() },
      ]);

      const result = await finalReviewOfferService.executeFinalReview(
        appDoc._id.toString(),
        candidate1._id.toString()
      );
      expect(result.passed).toBe(true);

      const notifs = await NotificationModel.find({ userId: candidate1._id, type: 'OFFER_RECEIVED' });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toMatch(/Offer Received/i);
      expect(notifs[0].link).toBe(`/applications/${appDoc._id}/offer`);
    });

    it('Event 4: hired trigger when candidate accepts employment offer', async () => {
      const appDoc = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'ACTIVE',
        currentStage: 'OFFER',
        mode: 'PRODUCTION',
        offer: {
          positionTitle: 'Backend Engineer',
          level: 2,
          salarySimulated: 75000,
          salaryMin: 60000,
          salaryMax: 90000,
          negotiationRoundsLeft: 3,
          maxNegotiationRounds: 3,
          status: 'OFFERED',
          offeredAt: new Date(),
        },
      });

      const acceptRes = await finalReviewOfferService.acceptOffer(
        appDoc._id.toString(),
        candidate1._id.toString()
      );
      expect(acceptRes.success).toBe(true);

      const notifs = await NotificationModel.find({ userId: candidate1._id, type: 'HIRED' });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toMatch(/Welcome Aboard/i);
      expect(notifs[0].message).toContain('Nexus Corp');
      expect(notifs[0].link).toBe('/employee');
    });

    it('Event 5: application expired trigger when stale applications are swept', async () => {
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      const staleApp = await createApplicationFixture({
        userId: candidate1._id,
        jobId: job._id,
        companyId: company._id,
        status: 'ACTIVE',
        currentStage: 'SCREENING',
        mode: 'PRODUCTION',
        createdAt: thirtyFiveDaysAgo,
        updatedAt: thirtyFiveDaysAgo,
      });

      // Force updatedAt to 35 days ago in MongoDB (bypassing Mongoose timestamp auto-update)
      await ApplicationModel.collection.updateOne(
        { _id: staleApp._id },
        { $set: { updatedAt: thirtyFiveDaysAgo } }
      );

      const expiryResult = await applicationService.expireStaleApplications(30);
      expect(expiryResult.expiredCount).toBe(1);

      const notifs = await NotificationModel.find({
        userId: candidate1._id,
        type: 'APPLICATION_EXPIRED',
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe('Application Expired');
      expect(notifs[0].link).toBe(`/applications/${staleApp._id}`);
    });
  });
});
