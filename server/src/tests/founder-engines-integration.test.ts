import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { FounderService } from '../services/founder/founder.service.js';
import { ApplicationService } from '../services/career/application.service.js';
import { FinalReviewOfferService } from '../services/career/finalReviewOffer.service.js';
import { DailyTaskService } from '../services/employee/dailyTask.service.js';
import { TaskEvaluationService } from '../services/employee/taskEvaluation.service.js';
import { LevelService } from '../services/economy/level.service.js';

import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../models/CompanyJob.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { ApplicationModel, type IApplicationDocument } from '../models/Application.js';
import { ProfileModel, type IProfileDocument } from '../models/Profile.js';
import { ResumeAnalysisModel, type IResumeAnalysisDocument } from '../models/ResumeAnalysis.js';
import { EmployeeTaskModel, type IEmployeeTaskDocument } from '../models/EmployeeTask.js';
import { TaskSubmissionModel, type ITaskSubmissionDocument } from '../models/TaskSubmission.js';
import { PerformanceRecordModel, type IPerformanceRecordDocument } from '../models/PerformanceRecord.js';
import { EvaluationModel, type IEvaluationDocument } from '../models/Evaluation.js';
import { FeedbackModel } from '../models/Feedback.js';
import { type INotificationDocument } from '../models/Notification.js';

import { ConfigService, configService } from '../services/config/config.service.js';
import { CorpCoinService } from '../services/economy/corpCoin.service.js';
import { NotificationService, notificationService } from '../services/notification/notification.service.js';
import { AIGateway, AIWorker } from '../ai/index.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';

describe('Founder Companies Engine Connection & End-to-End Integration (TASK P8.3)', () => {
  let founderService: FounderService;
  let applicationService: ApplicationService;
  let finalReviewOfferService: FinalReviewOfferService;
  let dailyTaskService: DailyTaskService;
  let taskEvaluationService: TaskEvaluationService;
  let levelService: LevelService;

  let mockConfigService: ConfigService;
  let mockCorpCoinService: CorpCoinService;
  let mockNotificationService: NotificationService;
  let mockAIGateway: AIGateway;
  let mockAIWorker: AIWorker;

  const founderUserId = new Types.ObjectId();
  const foreignFounderId = new Types.ObjectId();
  const jobSeekerUserId = new Types.ObjectId();
  const founderCompanyId = new Types.ObjectId();
  const foreignCompanyId = new Types.ObjectId();
  const jobId = new Types.ObjectId();
  const resumeAnalysisId = new Types.ObjectId();

  const createMockUser = (overrides?: Partial<IUserDocument>): IUserDocument => {
    return {
      _id: new Types.ObjectId(),
      email: 'test@corpverse.io',
      totalExp: 0,
      totalExpCached: 0,
      corpCoinBalance: 0,
      corpCoinBalanceCached: 0,
      careerRole: 'JOB_SEEKER',
      platformRole: 'NONE',
      status: 'ACTIVE',
      emailVerified: true,
      onboardingStep: 'COMPLETE',
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as IUserDocument;
  };

  const createMockCompany = (overrides?: Partial<ICompanyDocument>): ICompanyDocument => {
    return {
      _id: founderCompanyId,
      name: 'NeuralForge Dynamics',
      description: 'Distributed AI systems enterprise',
      type: 'FOUNDER',
      isPlatformCompany: false,
      ownerId: founderUserId,
      domainsHired: ['SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING'],
      status: 'ACTIVE',
      ratings: { overall: 50, culture: 50, workLife: 50, technicalExcellence: 50 },
      companyRating: 50,
      financialHealth: 0,
      employeeCount: 0,
      maxEmployees: 20,
      isOpenForHiring: true,
      aiProviderPool: 'PIPELINE',
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyDocument;
  };

  const createMockJob = (overrides?: Partial<ICompanyJobDocument>): ICompanyJobDocument => {
    return {
      _id: jobId,
      companyId: founderCompanyId,
      title: 'Backend Systems Engineer',
      description: 'Design highly scalable asynchronous distributed services.',
      domain: 'SOFTWARE_ENGINEERING',
      minLevel: 1,
      maxLevel: 5,
      targetLevel: 2,
      requiredSkills: ['Node.js', 'TypeScript', 'MongoDB'],
      openings: 2,
      status: 'OPEN',
      isOpen: true,
      save: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as unknown as ICompanyJobDocument;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
      getApplicationsConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.applications),
      getFinalReviewSettings: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG.finalReview),
      getStageSettings: vi.fn().mockResolvedValue({
        questionCount: 1,
        difficulty: 'EASY',
        passingScore: 70,
        demoQuestionCount: 1,
        demoDifficulty: 'EASY',
      }),
    } as unknown as ConfigService;

    mockCorpCoinService = {
      credit: vi.fn(),
      debit: vi.fn().mockResolvedValue({ success: true, balanceAfter: 150 }),
      getBalance: vi.fn().mockResolvedValue(1000),
    } as unknown as CorpCoinService;

    mockNotificationService = {
      create: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    } as unknown as NotificationService;

    mockAIGateway = {
      execute: vi.fn(),
      submit: vi.fn().mockResolvedValue(new Types.ObjectId().toString()),
    } as unknown as AIGateway;

    mockAIWorker = {
      registerValidator: vi.fn(),
      registerHandler: vi.fn(),
      registerStateChangeHandler: vi.fn(),
    } as unknown as AIWorker;

    founderService = new FounderService(
      mockConfigService,
      mockCorpCoinService,
      mockNotificationService
    );

    // Bypass transaction session in standalone test mode
    vi.spyOn(
      founderService as unknown as { withTransaction: (work: (s: null) => Promise<unknown>) => Promise<unknown> },
      'withTransaction'
    ).mockImplementation(async (work) => await work(null));

    applicationService = new ApplicationService();

    finalReviewOfferService = new FinalReviewOfferService(mockAIGateway, mockAIWorker);
    vi.spyOn(
      finalReviewOfferService as unknown as { runWithTransaction: (work: (s: null) => Promise<unknown>) => Promise<unknown> },
      'runWithTransaction'
    ).mockImplementation(async (work) => await work(null));

    levelService = new LevelService(mockConfigService);
    dailyTaskService = new DailyTaskService(mockAIGateway, mockAIWorker, mockConfigService);
    taskEvaluationService = new TaskEvaluationService(mockAIGateway, mockAIWorker, levelService, mockNotificationService);

    vi.spyOn(configService, 'getApplicationsConfig').mockResolvedValue(DEFAULT_PLATFORM_CONFIG.applications);
    vi.spyOn(configService, 'getConfig').mockResolvedValue(DEFAULT_PLATFORM_CONFIG);
    vi.spyOn(notificationService, 'create').mockResolvedValue({ _id: new Types.ObjectId() } as unknown as INotificationDocument);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Founder Job Requisitions Management & Security Guards
  // =========================================================================
  describe('1. Founder Job Requisition Controls', () => {
    it('blocks creating job openings when company is not open for hiring (isOpenForHiring=false)', async () => {
      const closedCompany = createMockCompany({ isOpenForHiring: false });
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(closedCompany);

      await expect(
        founderService.createJob(founderUserId, {
          title: 'Staff Software Architect',
          description: 'Lead high-scale engineering pipelines',
          domain: 'SOFTWARE_ENGINEERING',
          minLevel: 1,
          maxLevel: 5,
          requiredSkills: ['Go', 'Kubernetes'],
          openings: 1,
        })
      ).rejects.toThrow(
        /Company must acquire all three basic bots \(Hiring, Task, Evaluation\) and be open for hiring/
      );
    });

    it('blocks creating job openings for domains not hired by the company', async () => {
      const company = createMockCompany({ domainsHired: ['SOFTWARE_ENGINEERING'] });
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);

      await expect(
        founderService.createJob(founderUserId, {
          title: 'AI Prompt Specialist',
          description: 'Train transformer language models',
          domain: 'AI_ENGINEERING',
          minLevel: 1,
          maxLevel: 5,
          requiredSkills: ['PyTorch'],
          openings: 1,
        })
      ).rejects.toThrow(/is not in company's hired domains/);
    });

    it('blocks creating job openings when company has reached max employee capacity (20)', async () => {
      const fullCompany = createMockCompany({ employeeCount: 20, maxEmployees: 20 });
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(fullCompany);

      await expect(
        founderService.createJob(founderUserId, {
          title: 'Cloud Systems Architect',
          description: 'Build fault-tolerant cloud networks',
          domain: 'CLOUD_ENGINEERING',
          minLevel: 1,
          maxLevel: 5,
          requiredSkills: ['Terraform'],
          openings: 1,
        })
      ).rejects.toThrow(/Company has reached maximum employee capacity \(20\)/);
    });

    it('successfully creates job opening when company is open for hiring and has capacity', async () => {
      const company = createMockCompany({ isOpenForHiring: true, employeeCount: 5 });
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyJobModel.prototype, 'save').mockResolvedValue({} as unknown as ICompanyJobDocument);

      const job = await founderService.createJob(founderUserId, {
        title: 'Backend Systems Engineer',
        description: 'Design highly scalable asynchronous distributed services.',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 1,
        maxLevel: 5,
        requiredSkills: ['Node.js', 'TypeScript', 'MongoDB'],
        openings: 2,
      });

      expect(job.title).toBe('Backend Systems Engineer');
      expect(job.companyId.toString()).toBe(founderCompanyId.toString());
      expect(job.isOpen).toBe(true);
      expect(job.status).toBe('OPEN');
    });

    it('allows founder to close their own job opening', async () => {
      const company = createMockCompany();
      const job = createMockJob({ companyId: founderCompanyId, status: 'OPEN', isOpen: true });

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(job);
      vi.spyOn(job, 'save').mockResolvedValue(job as unknown as ICompanyJobDocument);

      const closedJob = await founderService.closeJob(founderUserId, jobId);

      expect(closedJob.status).toBe('CLOSED');
      expect(closedJob.isOpen).toBe(false);
    });

    it('blocks foreign founder from closing another company job with 403 Forbidden', async () => {
      const foreignCompany = createMockCompany({ _id: foreignCompanyId, ownerId: foreignFounderId });
      const targetJob = createMockJob({ companyId: founderCompanyId }); // Belongs to founderCompanyId

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(foreignCompany);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(targetJob);

      await expect(founderService.closeJob(foreignFounderId, jobId)).rejects.toThrow(
        'Founder cannot modify job requisitions belonging to another company.'
      );
    });
  });

  // =========================================================================
  // 2. Cross-Company Isolation & Read-Only Outcomes
  // =========================================================================
  describe('2. Applicant Privacy & Evaluation Outcome Immutability', () => {
    it('blocks founder from viewing applicants of another company with 403 Forbidden', async () => {
      const foreignCompany = createMockCompany({ _id: foreignCompanyId, ownerId: foreignFounderId });
      const jobAtAnotherCompany = createMockJob({ companyId: founderCompanyId });

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(foreignCompany);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(jobAtAnotherCompany);

      await expect(
        founderService.getApplications(foreignFounderId, { jobId: jobId.toString() })
      ).rejects.toThrow('Founder cannot access applicant data belonging to another company.');
    });

    it('blocks founder from viewing single application details belonging to another company with 403 Forbidden', async () => {
      const foreignCompany = createMockCompany({ _id: foreignCompanyId, ownerId: foreignFounderId });
      const applicationAtAnotherCompany = {
        _id: new Types.ObjectId(),
        companyId: founderCompanyId, // Belongs to founderCompanyId
      } as unknown as IApplicationDocument;

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(foreignCompany);
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(applicationAtAnotherCompany);

      await expect(
        founderService.getApplicationById(foreignFounderId, applicationAtAnotherCompany._id)
      ).rejects.toThrow('Founder cannot access applicant data belonging to another company.');
    });

    it('returns application details and evaluations as strictly read-only view', async () => {
      const company = createMockCompany();
      const app = {
        _id: new Types.ObjectId(),
        companyId: founderCompanyId,
        currentStage: 'FINAL_REVIEW',
        status: 'ACTIVE',
      } as unknown as IApplicationDocument;

      const mockEvaluations = [
        {
          _id: new Types.ObjectId(),
          stage: 'ATS_SCREENING',
          score: 85,
        },
      ];

      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue(company);
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);
      vi.spyOn(EvaluationModel, 'find').mockResolvedValue(mockEvaluations as unknown as IEvaluationDocument[]);
      vi.spyOn(FeedbackModel, 'find').mockResolvedValue([]);

      const result = await founderService.getApplicationById(founderUserId, app._id);

      expect(result.application._id.toString()).toBe(app._id.toString());
      expect(result.evaluations).toHaveLength(1);
      expect(result.evaluations[0].score).toBe(85);
    });
  });

  // =========================================================================
  // 3. Complete End-to-End Integration Flow
  // =========================================================================
  describe('3. End-to-End Engine Integration Lifecycle', () => {
    it('executes full journey: candidate hired into founder company, receives task via PIPELINE pool, and gets evaluated', async () => {
      // -----------------------------------------------------------------------
      // A. Setup State: Founder Company with 3 Basic Bots & Job Opening
      // -----------------------------------------------------------------------
      const companyDoc = createMockCompany({
        _id: founderCompanyId,
        ownerId: founderUserId,
        isOpenForHiring: true,
        employeeCount: 0,
        maxEmployees: 20,
      });

      const jobDoc = createMockJob({
        _id: jobId,
        companyId: founderCompanyId,
        domain: 'SOFTWARE_ENGINEERING',
        status: 'OPEN',
        isOpen: true,
      });

      const candidateUser = createMockUser({
        _id: jobSeekerUserId,
        email: 'talented-dev@corpverse.io',
        careerRole: 'JOB_SEEKER',
        totalExp: 500,
      });

      const candidateProfile = {
        _id: new Types.ObjectId(),
        userId: jobSeekerUserId,
        resumeAnalysisId,
      } as unknown as IProfileDocument;

      const candidateResume = {
        _id: resumeAnalysisId,
        status: 'COMPLETED',
        resumeId: new Types.ObjectId(),
        domainClassification: 'SOFTWARE_ENGINEERING',
        parsedSkills: ['Node.js', 'TypeScript', 'MongoDB'],
        yearsOfExperience: 3,
        extractedSummary: 'Experienced full stack TypeScript engineer',
      } as unknown as IResumeAnalysisDocument;

      // -----------------------------------------------------------------------
      // B. Job Seeker Applies to Founder Company
      // -----------------------------------------------------------------------
      vi.spyOn(UserModel, 'findById').mockResolvedValue(candidateUser);
      vi.spyOn(ProfileModel, 'findOne').mockResolvedValue(candidateProfile);
      vi.spyOn(ResumeAnalysisModel, 'findById').mockResolvedValue(candidateResume);
      vi.spyOn(ApplicationModel, 'countDocuments').mockResolvedValue(0); // 0 active applications
      vi.spyOn(ApplicationModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue(jobDoc);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(companyDoc);

      const savedAppDoc = {
        _id: new Types.ObjectId(),
        userId: jobSeekerUserId,
        companyId: founderCompanyId,
        jobId,
        mode: 'PRODUCTION',
        currentStage: 'APPLIED',
        status: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel.prototype, 'save').mockImplementation(async function () {
        return savedAppDoc;
      });

      const application = await applicationService.applyForJob(jobSeekerUserId, {
        jobId,
      });

      expect(application).toBeDefined();
      expect(application.companyId.toString()).toBe(founderCompanyId.toString());

      // -----------------------------------------------------------------------
      // C. Hiring Engine: Offer Extended and Accepted into Founder Company
      // -----------------------------------------------------------------------
      const offerApplicationDoc = {
        _id: application._id,
        userId: jobSeekerUserId,
        companyId: founderCompanyId,
        jobId,
        mode: 'PRODUCTION',
        currentStage: 'OFFER',
        status: 'ACTIVE',
        resumeAnalysisSnapshot: {
          domainClassification: 'SOFTWARE_ENGINEERING',
        },
        offer: {
          level: 2,
          positionTitle: 'Junior Software Engineer',
          salarySimulated: 70000,
          status: 'PENDING',
          roundsRemaining: 3,
        },
        stageHistory: [
          {
            stage: 'OFFER',
            enteredAt: new Date(),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IApplicationDocument;

      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(offerApplicationDoc);
      vi.spyOn(CompanyModel, 'findOneAndUpdate').mockResolvedValue({
        ...companyDoc,
        employeeCount: 1,
      } as unknown as ICompanyDocument);

      const createdEmployeeDoc = {
        _id: new Types.ObjectId(),
        userId: jobSeekerUserId,
        companyId: founderCompanyId,
        domain: 'SOFTWARE_ENGINEERING',
        level: 2,
        jobTitle: 'Junior Software Engineer',
        status: 'ACTIVE',
        salarySimulated: 70000,
      } as unknown as ICompanyEmployeeDocument;

      vi.spyOn(CompanyEmployeeModel, 'create').mockResolvedValue([createdEmployeeDoc] as unknown as ICompanyEmployeeDocument[]);
      vi.spyOn(UserModel, 'updateOne').mockResolvedValue({ acknowledged: true, modifiedCount: 1, upsertedCount: 0, matchedCount: 1, upsertedId: null });
      vi.spyOn(ApplicationModel, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 0, upsertedCount: 0, matchedCount: 0, upsertedId: null });

      const acceptResult = await finalReviewOfferService.acceptOffer(
        offerApplicationDoc._id,
        jobSeekerUserId
      );

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.employee).toBeDefined();
      expect(acceptResult.employee?.companyId.toString()).toBe(founderCompanyId.toString());

      // -----------------------------------------------------------------------
      // D. Founder Reviews Roster: Sees Newly Hired Employee
      // -----------------------------------------------------------------------
      vi.spyOn(CompanyModel, 'findOne').mockResolvedValue({
        ...companyDoc,
        employeeCount: 1,
      } as unknown as ICompanyDocument);

      vi.spyOn(CompanyEmployeeModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([createdEmployeeDoc]),
      } as unknown as ReturnType<typeof CompanyEmployeeModel.find>);

      const rosterResult = await founderService.getEmployees(founderUserId);

      expect(rosterResult.currentCount).toBe(1);
      expect(rosterResult.maxEmployees).toBe(20);
      expect(rosterResult.remainingCapacity).toBe(19);
      expect(rosterResult.employees).toHaveLength(1);
      expect(rosterResult.employees[0].userId.toString()).toBe(jobSeekerUserId.toString());

      // -----------------------------------------------------------------------
      // E. Employee Requests Daily Task (Generated via PIPELINE Pool)
      // -----------------------------------------------------------------------
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(createdEmployeeDoc);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(companyDoc);
      vi.spyOn(EmployeeTaskModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]), // No tasks yet today
      } as unknown as ReturnType<typeof EmployeeTaskModel.find>);

      const generatedTaskAI = {
        title: 'Optimize Database Query Indexes',
        scenario: 'High latency detected on active queries during production traffic spikes.',
        requirements: ['Analyze compound index utilization', 'Rewrite query projection'],
        difficulty: 'EASY' as const,
        evaluationCriteria: ['Index Design', 'Query Performance'],
      };

      const evaluationAI = {
        score: 95,
        strengths: ['Accurate compound indexing analysis'],
        weaknesses: ['Add explain plan metrics to verify cost reduction'],
        feedback: 'Superb query optimization work adhering to best practices.',
        criteriaScores: [
          { criterion: 'Index Design', score: 96, comment: 'Optimal compound key ordering' },
          { criterion: 'Query Performance', score: 94, comment: 'Latency drop verified' },
        ],
      };

      vi.spyOn(mockAIGateway, 'execute').mockImplementation(async (request) => {
        if (request.taskType === 'TASK_GENERATION') {
          return { success: true, structuredData: generatedTaskAI };
        }
        if (request.taskType === 'TASK_EVALUATION') {
          return { success: true, structuredData: evaluationAI };
        }
        return { success: true, structuredData: {} };
      });

      const mockCreatedTask = {
        _id: new Types.ObjectId(),
        employeeId: createdEmployeeDoc._id,
        userId: jobSeekerUserId,
        companyId: founderCompanyId,
        title: generatedTaskAI.title,
        description: generatedTaskAI.scenario,
        kind: 'PRIMARY',
        domain: 'SOFTWARE_ENGINEERING',
        level: 2,
        difficulty: 'EASY',
        maxExp: 30,
        status: 'ASSIGNED',
        dueAt: new Date(Date.now() + 86400000),
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IEmployeeTaskDocument;

      vi.spyOn(EmployeeTaskModel, 'create').mockResolvedValue(mockCreatedTask as unknown as IEmployeeTaskDocument);

      const tasks = await dailyTaskService.getOrCreateDailyTasks({
        userId: jobSeekerUserId,
      });

      expect(tasks).toBeDefined();
      expect(mockAIGateway.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'TASK_GENERATION',
        }),
        expect.objectContaining({
          pool: 'PIPELINE', // Mandatory PIPELINE pool enforcement!
        })
      );

      // -----------------------------------------------------------------------
      // F. Employee Submits Work and Evaluation Bot Evaluates via PIPELINE Pool
      // -----------------------------------------------------------------------
      const submissionDoc = {
        _id: new Types.ObjectId(),
        taskId: mockCreatedTask._id,
        userId: jobSeekerUserId,
        content: 'Implemented compound index on { companyId: 1, status: 1 } and pruned redundant projections.',
        submittedAt: new Date(),
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ITaskSubmissionDocument;

      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockCreatedTask);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(createdEmployeeDoc);
      vi.spyOn(TaskSubmissionModel, 'create').mockResolvedValue(submissionDoc as unknown as ITaskSubmissionDocument);

      const submissionResult = await taskEvaluationService.submitTask({
        taskId: mockCreatedTask._id,
        userId: jobSeekerUserId,
        content: submissionDoc.content,
      });

      expect(submissionResult).toBeDefined();
      expect(submissionResult.submission).toBeDefined();

      vi.spyOn(TaskSubmissionModel, 'findById').mockResolvedValue(submissionDoc);
      vi.spyOn(PerformanceRecordModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(companyDoc);

      vi.spyOn(levelService, 'awardTaskExp').mockResolvedValue({
        awardedExp: 29, // Clamped from 95% of 30 maxExp
        newTotalExp: 529,
        leveledUp: false,
        currentLevel: 2,
      });

      const mockPerformanceRecord = {
        _id: new Types.ObjectId(),
        taskSubmissionId: submissionDoc._id,
        taskId: mockCreatedTask._id,
        userId: jobSeekerUserId,
        companyId: founderCompanyId,
        aiScore: 95,
        scoreBand: 'EXCELLENT',
        awardedExp: 29,
        feedback: evaluationAI.feedback,
        strengths: evaluationAI.strengths,
        weaknesses: evaluationAI.weaknesses,
        criteriaScores: evaluationAI.criteriaScores,
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IPerformanceRecordDocument;

      vi.spyOn(PerformanceRecordModel, 'create').mockResolvedValue(mockPerformanceRecord as unknown as IPerformanceRecordDocument);

      const performanceRecord = await taskEvaluationService.evaluateSubmission({
        submissionId: submissionDoc._id,
      });

      expect(performanceRecord).toBeDefined();
      expect(performanceRecord.aiScore).toBe(95);
      expect(performanceRecord.scoreBand).toBe('EXCELLENT');
      expect(performanceRecord.awardedExp).toBe(29);

      // Verify AI Gateway was invoked via PIPELINE pool for task evaluation
      expect(mockAIGateway.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'TASK_EVALUATION',
        }),
        expect.objectContaining({
          pool: 'PIPELINE', // Mandatory PIPELINE pool enforcement!
        })
      );
    });
  });
});
