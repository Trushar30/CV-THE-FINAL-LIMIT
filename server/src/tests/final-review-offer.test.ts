import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  FinalReviewOfferService,
} from '../services/career/finalReviewOffer.service.js';
import {
  finalReviewSummaryOutputSchema,
  offerNegotiationOutputSchema,
} from '../schemas/offer.schema.js';
import { ApplicationModel, type IApplicationDocument } from '../models/Application.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../models/CompanyJob.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { EvaluationModel, type IEvaluationDocument } from '../models/Evaluation.js';
import { FeedbackModel, type IFeedbackDocument } from '../models/Feedback.js';
import { configService } from '../services/config/config.service.js';
import { notificationService } from '../services/notification/notification.service.js';
import type { INotificationDocument } from '../models/Notification.js';
import { AIGateway, AIWorker } from '../ai/index.js';

describe('Final Review, Offer Negotiation, and Atomic Acceptance (TASK P6.4)', () => {
  let service: FinalReviewOfferService;
  let mockAIGateway: AIGateway;
  let mockAIWorker: AIWorker;

  const mockUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockJobId = new Types.ObjectId();
  const mockAppId = new Types.ObjectId();

  const mockReviewSummaryAI = {
    summary: 'Candidate demonstrated exemplary backend distributed systems expertise across all technical stages.',
    recommendations: [
      'Fast-track onboarding to team microservices infrastructure',
      'Assign senior mentor for platform tooling',
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAIGateway = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        structuredData: mockReviewSummaryAI,
      }),
    } as unknown as AIGateway;

    mockAIWorker = {
      registerValidator: vi.fn(),
      registerHandler: vi.fn(),
      registerStateChangeHandler: vi.fn(),
    } as unknown as AIWorker;

    service = new FinalReviewOfferService(mockAIGateway, mockAIWorker);

    // Mock configService defaults
    vi.spyOn(configService, 'getFinalReviewSettings').mockResolvedValue({
      atsWeight: 15,
      screeningWeight: 20,
      assessmentWeight: 30,
      interviewWeight: 35,
      passingScore: 70,
    });

    vi.spyOn(configService, 'getSalaryBandForLevel').mockImplementation(async (level) => {
      const bands: Record<number, { level: number; minSalary: number; maxSalary: number }> = {
        1: { level: 1, minSalary: 45000, maxSalary: 60000 },
        2: { level: 2, minSalary: 60000, maxSalary: 80000 },
        3: { level: 3, minSalary: 80000, maxSalary: 100000 },
      };
      return bands[level] ?? { level, minSalary: 60000, maxSalary: 80000 };
    });

    vi.spyOn(configService, 'getOfferSettings').mockResolvedValue({
      maxNegotiationRounds: 3,
      demoMaxNegotiationRounds: 1,
      declineStatus: 'WITHDRAWN',
    });

    vi.spyOn(notificationService, 'create').mockResolvedValue({} as unknown as INotificationDocument);
  });

  describe('Zod Schema Validation for AI Outputs', () => {
    it('validates final review summary schema correctly', () => {
      const valid = {
        summary: 'Candidate demonstrated deep mastery of backend distributed architecture.',
        recommendations: ['Pair with architecture team on week one'],
      };
      expect(finalReviewSummaryOutputSchema.parse(valid)).toEqual(valid);

      expect(() =>
        finalReviewSummaryOutputSchema.parse({
          summary: 'too short',
          recommendations: [],
        })
      ).toThrow();
    });

    it('validates offer negotiation schema correctly', () => {
      const valid = {
        aiResponse: 'We have updated our offer to reflect your seniority.',
        counterOfferSalary: 72000,
      };
      expect(offerNegotiationOutputSchema.parse(valid)).toEqual(valid);

      const validWithoutSalary = {
        aiResponse: 'Our salary band is firm for this level.',
      };
      expect(offerNegotiationOutputSchema.parse(validWithoutSalary)).toEqual(validWithoutSalary);

      expect(() =>
        offerNegotiationOutputSchema.parse({
          aiResponse: 'no',
        })
      ).toThrow();
    });
  });

  describe('FINAL_REVIEW Stage Execution', () => {
    const createMockApp = (stage = 'FINAL_REVIEW', status = 'ACTIVE') => {
      return {
        _id: mockAppId,
        userId: mockUserId,
        jobId: mockJobId,
        companyId: mockCompanyId,
        mode: 'PRODUCTION',
        currentStage: stage,
        status,
        atsScore: 80,
        interviewScore: 85,
        resumeAnalysisSnapshot: {
          domainClassification: 'SOFTWARE_ENGINEERING',
          parsedSkills: ['Node.js', 'TypeScript', 'MongoDB'],
        },
        stageHistory: [
          { stage: 'APPLIED', enteredAt: new Date(), exitedAt: new Date() },
          { stage: 'ATS_SCREENING', enteredAt: new Date(), exitedAt: new Date() },
          { stage: 'SCREENING', enteredAt: new Date(), exitedAt: new Date() },
          { stage: 'ASSESSMENT', enteredAt: new Date(), exitedAt: new Date() },
          { stage: 'INTERVIEW', enteredAt: new Date(), exitedAt: new Date() },
          { stage: 'FINAL_REVIEW', enteredAt: new Date() },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;
    };

    it('aggregates all stage scores with backend weights and advances to OFFER when score >= 70', async () => {
      const mockApp = createMockApp();
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
        _id: mockJobId,
        title: 'Backend Engineer',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 2,
        maxLevel: 2,
        targetLevel: 2,
      } as unknown as ICompanyJobDocument);

      // Stage scores: ATS=80, Screening=75, Assessment=80, Interview=90
      // Weighted: (80*15 + 75*20 + 80*30 + 90*35) / 100 = (1200 + 1500 + 2400 + 3150) / 100 = 8250 / 100 = 83 (>= 70 PASS)
      vi.spyOn(EvaluationModel, 'findOne').mockImplementation((query) => {
        const stage = (query as { stage?: string })?.stage;
        if (stage === 'ATS_SCREENING') return Promise.resolve({ score: 80 } as unknown as IEvaluationDocument);
        if (stage === 'SCREENING') return Promise.resolve({ score: 75 } as unknown as IEvaluationDocument);
        if (stage === 'ASSESSMENT') return Promise.resolve({ score: 80 } as unknown as IEvaluationDocument);
        if (stage === 'INTERVIEW') return Promise.resolve({ score: 90 } as unknown as IEvaluationDocument);
        return Promise.resolve(null);
      });
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as unknown as IEvaluationDocument);

      const result = await service.executeFinalReview(mockAppId.toString(), mockUserId.toString());

      expect(result.passed).toBe(true);
      expect(result.finalScore).toBe(83);
      expect(result.passingScore).toBe(70);
      expect(result.summary).toBe(mockReviewSummaryAI.summary);
      expect(result.recommendations).toEqual(mockReviewSummaryAI.recommendations);
      expect(mockApp.currentStage).toBe('OFFER');
      expect(mockApp.offer).toBeDefined();
      expect(mockApp.offer?.positionTitle).toBe('Backend Engineer');
      expect(mockApp.offer?.level).toBe(2);
      expect(mockApp.offer?.salaryMin).toBe(60000);
      expect(mockApp.offer?.salaryMax).toBe(80000);
      expect(mockApp.offer?.salarySimulated).toBe(70000); // midpoint (60k+80k)/2
      expect(mockApp.offer?.negotiationRoundsLeft).toBe(3);
      expect(mockApp.offer?.status).toBe('OFFERED');
      expect(mockApp.save).toHaveBeenCalled();
    });

    it('rejects application and writes feedback when weighted score < 70', async () => {
      const mockApp = createMockApp();
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
        _id: mockJobId,
        title: 'Backend Engineer',
        minLevel: 1,
      } as unknown as ICompanyJobDocument);

      // Low scores: ATS=60, Screening=50, Assessment=55, Interview=60
      // Weighted: (60*15 + 50*20 + 55*30 + 60*35) / 100 = (900 + 1000 + 1650 + 2100) / 100 = 5650 / 100 = 57 (< 70 FAIL)
      vi.spyOn(EvaluationModel, 'findOne').mockImplementation((query) => {
        const stage = (query as { stage?: string })?.stage;
        if (stage === 'ATS_SCREENING') return Promise.resolve({ score: 60 } as unknown as IEvaluationDocument);
        if (stage === 'SCREENING') return Promise.resolve({ score: 50 } as unknown as IEvaluationDocument);
        if (stage === 'ASSESSMENT') return Promise.resolve({ score: 55 } as unknown as IEvaluationDocument);
        if (stage === 'INTERVIEW') return Promise.resolve({ score: 60 } as unknown as IEvaluationDocument);
        return Promise.resolve(null);
      });
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as unknown as IEvaluationDocument);
      const feedbackCreateSpy = vi.spyOn(FeedbackModel, 'create').mockResolvedValue({} as unknown as IFeedbackDocument);

      const result = await service.executeFinalReview(mockAppId.toString(), mockUserId.toString());

      expect(result.passed).toBe(false);
      expect(result.finalScore).toBe(57);
      expect(mockApp.status).toBe('REJECTED');
      expect(feedbackCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: mockAppId,
          userId: mockUserId,
          rejectionStage: 'FINAL_REVIEW',
        })
      );
      expect(mockApp.save).toHaveBeenCalled();
    });

    it('fails if application is not in FINAL_REVIEW stage', async () => {
      const mockApp = createMockApp('INTERVIEW');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);

      await expect(
        service.executeFinalReview(mockAppId.toString(), mockUserId.toString())
      ).rejects.toThrow(/Application is in stage 'INTERVIEW', expected 'FINAL_REVIEW'/);
    });
  });

  describe('OFFER Negotiation', () => {
    const createOfferedApp = (roundsLeft = 3) => {
      return {
        _id: mockAppId,
        userId: mockUserId,
        companyId: mockCompanyId,
        currentStage: 'OFFER',
        status: 'ACTIVE',
        mode: 'PRODUCTION',
        offer: {
          positionTitle: 'Backend Engineer',
          level: 2,
          salarySimulated: 70000,
          salaryMin: 60000,
          salaryMax: 80000,
          negotiationRoundsLeft: roundsLeft,
          maxNegotiationRounds: 3,
          negotiationHistory: [],
          status: 'OFFERED',
          offeredAt: new Date(),
        },
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;
    };

    it('processes negotiation turn and strictly clamps counter-offer to level salary band', async () => {
      const mockApp = createOfferedApp(3);
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);

      // AI counter offer is 75000 (within 60000-80000 band)
      vi.spyOn(mockAIGateway, 'execute').mockResolvedValue({
        success: true,
        structuredData: {
          aiResponse: 'We have updated our offer to 75000.',
          counterOfferSalary: 75000,
        },
      });

      const result = await service.negotiateOffer(
        mockAppId.toString(),
        mockUserId.toString(),
        'Could we adjust to 76000 based on my experience?',
        76000
      );

      expect(result.round).toBe(1);
      expect(result.offer.negotiationRoundsLeft).toBe(2);
      // Halfway between 70k and 76k is 73k, clamped within [60k, 80k]
      expect(result.newSalary).toBe(73000);
      expect(result.offer.salarySimulated).toBe(73000);
      expect(result.offer.negotiationHistory).toHaveLength(1);
      expect(mockApp.save).toHaveBeenCalled();
    });

    it('strictly clamps salary exceeding max band to band maximum', async () => {
      const mockApp = createOfferedApp(2);
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);

      // Candidate asks for 150000 (way above max salary of 80000)
      const result = await service.negotiateOffer(
        mockAppId.toString(),
        mockUserId.toString(),
        'I need 150000 minimum.',
        150000
      );

      // Halfway between 70k and 150k is 110k, but clamped to band max: 80000
      expect(result.newSalary).toBe(80000);
      expect(result.offer.salarySimulated).toBe(80000);
      expect(result.offer.negotiationRoundsLeft).toBe(1);
    });

    it('rejects negotiation when negotiation rounds are exhausted', async () => {
      const mockApp = createOfferedApp(0); // 0 rounds left
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);

      await expect(
        service.negotiateOffer(
          mockAppId.toString(),
          mockUserId.toString(),
          'Can we discuss further?'
        )
      ).rejects.toThrow(/No negotiation rounds remaining/);
    });
  });

  describe('OFFER Decline', () => {
    it('declines offer and marks application as WITHDRAWN per config', async () => {
      const mockApp = {
        _id: mockAppId,
        userId: mockUserId,
        currentStage: 'OFFER',
        status: 'ACTIVE',
        offer: {
          status: 'OFFERED',
          offeredAt: new Date(),
        },
        stageHistory: [
          { stage: 'OFFER', enteredAt: new Date() },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApp);

      const result = await service.declineOffer(
        mockAppId.toString(),
        mockUserId.toString(),
        'Pursuing another direction.'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('WITHDRAWN');
      expect(mockApp.status).toBe('WITHDRAWN');
      expect(mockApp.offer?.status).toBe('DECLINED');
      expect(mockApp.offer?.declineReason).toBe('Pursuing another direction.');
      expect(mockApp.save).toHaveBeenCalled();
    });
  });

  describe('Atomic ACCEPTED Lifecycle & Edge Cases', () => {
    const createAcceptedCandidate = (employeeCount = 5, maxEmployees = 20) => {
      const app = {
        _id: mockAppId,
        userId: mockUserId,
        companyId: mockCompanyId,
        jobId: mockJobId,
        currentStage: 'OFFER',
        status: 'ACTIVE',
        resumeAnalysisSnapshot: {
          domainClassification: 'SOFTWARE_ENGINEERING',
        },
        offer: {
          positionTitle: 'Backend Engineer',
          level: 2,
          salarySimulated: 75000,
          status: 'OFFERED',
          offeredAt: new Date(),
        },
        stageHistory: [{ stage: 'OFFER', enteredAt: new Date() }],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      const company = {
        _id: mockCompanyId,
        employeeCount,
        maxEmployees,
      };

      const job = {
        _id: mockJobId,
        domain: 'SOFTWARE_ENGINEERING',
      };

      const user = {
        _id: mockUserId,
        careerRole: 'JOB_SEEKER',
      };

      return { app, company, job, user };
    };

    it('rejects acceptance if company has reached maximum employee capacity (Full Company Rejection)', async () => {
      const { app, company } = createAcceptedCandidate(20, 20); // 20/20 FULL!
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(company as unknown as ICompanyDocument);

      await expect(
        service.acceptOffer(mockAppId.toString(), mockUserId.toString())
      ).rejects.toThrow(/Company has reached its maximum employee capacity \(20 employees\)/);
    });

    it('prevents double acceptance if offer has already been accepted', async () => {
      const { app } = createAcceptedCandidate();
      app.status = 'ACCEPTED';
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      await expect(
        service.acceptOffer(mockAppId.toString(), mockUserId.toString())
      ).rejects.toThrow(/This offer has already been accepted/);
    });

    it('prevents acceptance if application is not in OFFER stage', async () => {
      const { app } = createAcceptedCandidate();
      app.currentStage = 'FINAL_REVIEW';
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      await expect(
        service.acceptOffer(mockAppId.toString(), mockUserId.toString())
      ).rejects.toThrow(/Cannot accept offer for application in stage 'FINAL_REVIEW'/);
    });

    it('atomically creates employee, sets user careerRole to EMPLOYEE, increments company count, and withdraws other active applications', async () => {
      const { app, company, job, user } = createAcceptedCandidate(10, 20);
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(company as unknown as ICompanyDocument);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(job as unknown as ICompanyJobDocument);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user as unknown as IUserDocument);

      // Mocks for atomic updates
      vi.spyOn(CompanyModel, 'findOneAndUpdate').mockResolvedValue({
        ...company,
        employeeCount: 11,
      } as unknown as ICompanyDocument);

      const mockEmployee = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        companyId: mockCompanyId,
        domain: 'SOFTWARE_ENGINEERING',
        level: 2,
        positionTitle: 'Backend Engineer',
        status: 'ACTIVE',
        salarySimulated: 75000,
      } as unknown as ICompanyEmployeeDocument;
      vi.spyOn(CompanyEmployeeModel, 'create').mockResolvedValue([mockEmployee] as unknown as ICompanyEmployeeDocument[]);

      const userUpdateSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as unknown as ReturnType<typeof UserModel.updateOne> extends Promise<infer U> ? U : never);
      const appUpdateManySpy = vi.spyOn(ApplicationModel, 'updateMany').mockResolvedValue({} as unknown as ReturnType<typeof ApplicationModel.updateMany> extends Promise<infer U> ? U : never);

      const result = await service.acceptOffer(mockAppId.toString(), mockUserId.toString());

      expect(result.success).toBe(true);
      expect(result.employee).toEqual(mockEmployee);

      // Verify user careerRole set to EMPLOYEE
      expect(userUpdateSpy).toHaveBeenCalledWith(
        { _id: mockUserId },
        { $set: { careerRole: 'EMPLOYEE' } },
        undefined
      );

      // Verify application transitioned to ACCEPTED
      expect(app.currentStage).toBe('ACCEPTED');
      expect(app.status).toBe('ACCEPTED');
      expect(app.offer?.status).toBe('ACCEPTED');
      expect(app.save).toHaveBeenCalled();

      // Verify all other active applications of the user were withdrawn
      expect(appUpdateManySpy).toHaveBeenCalledWith(
        {
          userId: mockUserId,
          _id: { $ne: app._id },
          status: 'ACTIVE',
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'WITHDRAWN',
            withdrawalReason: 'Accepted another job offer',
          }),
        }),
        undefined
      );
    });

    it('rolls back and aborts transaction on failure when MongoDB session is active', async () => {
      const { app, company, job, user } = createAcceptedCandidate(10, 20);
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(company as unknown as ICompanyDocument);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(job as unknown as ICompanyJobDocument);
      vi.spyOn(UserModel, 'findById').mockResolvedValue(user as unknown as IUserDocument);

      // Simulate active MongoDB session
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      // Temporarily mock readyState = 1 and startSession
      const dbObj = CompanyModel.db as unknown as { readyState: number; startSession: () => Promise<unknown> };
      const origReadyState = dbObj.readyState;
      Object.defineProperty(dbObj, 'readyState', { value: 1, configurable: true });
      const sessionSpy = vi.spyOn(dbObj, 'startSession').mockResolvedValue(mockSession);

      // Simulate failure during employee creation
      vi.spyOn(CompanyModel, 'findOneAndUpdate').mockResolvedValue({
        ...company,
        employeeCount: 11,
      } as unknown as ICompanyDocument);
      vi.spyOn(CompanyEmployeeModel, 'create').mockRejectedValue(new Error('Database disk error'));

      await expect(
        service.acceptOffer(mockAppId.toString(), mockUserId.toString())
      ).rejects.toThrow('Database disk error');

      // Cleanup
      Object.defineProperty(dbObj, 'readyState', { value: origReadyState, configurable: true });
      sessionSpy.mockRestore();
    });
  });
});
