import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import {
  atsScreeningOutputSchema,
  type AtsScreeningOutput,
} from '../schemas/atsScreening.schema.js';
import {
  AtsScreeningService,
  ATS_SCREENING_SYSTEM_PROMPT,
} from '../services/career/atsScreening.service.js';
import { ApplicationModel, type IApplicationDocument } from '../models/Application.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../models/CompanyJob.js';
import { ProfileModel, type IProfileDocument } from '../models/Profile.js';
import { ResumeAnalysisModel, type IResumeAnalysisDocument } from '../models/ResumeAnalysis.js';
import { EvaluationModel, type IEvaluationDocument } from '../models/Evaluation.js';
import { FeedbackModel, type IFeedbackDocument } from '../models/Feedback.js';
import { configService } from '../services/config/config.service.js';
import { notificationService } from '../services/notification/notification.service.js';
import type { INotificationDocument } from '../models/Notification.js';
import { AIGateway, AIWorker } from '../ai/index.js';
import type { IAIJobDocument } from '../models/AIJob.js';
import type { ApplicationStage, ApplicationStatus } from '../types/enums.js';

describe('ATS Screening Evaluation Engine & AI Integration (TASK P6.2)', () => {
  let atsService: AtsScreeningService;
  let mockAIGateway: AIGateway;
  let mockAIWorker: AIWorker;

  const mockUserId = new Types.ObjectId();
  const mockJobId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockAppId = new Types.ObjectId();
  const mockResumeAnalysisId = new Types.ObjectId();
  const mockResumeId = new Types.ObjectId();

  const validPassingAiOutput: AtsScreeningOutput = {
    matchScore: 82,
    matchedSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
    missingSkills: ['Kubernetes'],
    strengths: [
      '3+ years of documented full-stack experience with TypeScript and Node.js microservices',
      'Solid project track record designing REST APIs and distributed caching',
    ],
    weaknesses: [
      'Limited demonstrable enterprise experience with Kubernetes orchestration',
    ],
    improvementSuggestions: [
      'Complete hands-on container orchestration projects deploying Kubernetes clusters',
    ],
    recommendation: 'PASS',
  };

  const validFailingAiOutput: AtsScreeningOutput = {
    matchScore: 54,
    matchedSkills: ['JavaScript'],
    missingSkills: ['TypeScript', 'Kubernetes', 'Cloud Infrastructure', 'CI/CD'],
    strengths: [
      'Fundamental familiarity with JavaScript syntax and client-side web development',
    ],
    weaknesses: [
      'Lacks required backend TypeScript experience specified in job requisition',
      'No documented experience with cloud container deployment',
    ],
    improvementSuggestions: [
      'Build end-to-end backend microservices with TypeScript and containerize with Docker',
      'Contribute to open source projects demonstrating cloud architecture expertise',
    ],
    recommendation: 'FAIL',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    const generatedJobId = new Types.ObjectId().toString();
    mockAIGateway = {
      submit: vi.fn().mockResolvedValue(generatedJobId),
    } as unknown as AIGateway;

    mockAIWorker = {
      registerValidator: vi.fn(),
      registerHandler: vi.fn(),
      registerStateChangeHandler: vi.fn(),
    } as unknown as AIWorker;

    atsService = new AtsScreeningService(mockAIGateway, mockAIWorker);

    // Mock PlatformConfig ats configuration (passingScore = 70)
    vi.spyOn(configService, 'getAtsConfig').mockResolvedValue({
      passingScore: 70,
      domainWeight: 40,
      skillWeight: 35,
      experienceWeight: 15,
      formattingWeight: 10,
    });

    // Default DB models mock
    vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
      _id: mockJobId,
      title: 'Senior Backend Engineer',
      description: 'Build high-scale distributed backend systems with TypeScript.',
      domain: 'SOFTWARE_ENGINEERING',
      minLevel: 5,
      maxLevel: 8,
      requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    } as unknown as ICompanyJobDocument);

    vi.spyOn(ProfileModel, 'findOne').mockResolvedValue({
      userId: mockUserId,
      displayName: 'Jane Candidate',
      skills: ['TypeScript', 'Node.js'],
    } as unknown as IProfileDocument);

    vi.spyOn(notificationService, 'create').mockResolvedValue({} as unknown as INotificationDocument);

    vi.spyOn(ResumeAnalysisModel, 'findById').mockResolvedValue({
      _id: mockResumeAnalysisId,
      parsedSkills: ['TypeScript', 'Node.js'],
      yearsOfExperience: 4,
      domainClassification: 'SOFTWARE_ENGINEERING',
      extractedSummary: 'Experienced backend specialist.',
    } as unknown as IResumeAnalysisDocument);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock Application document
  function createMockApplication(
    stage: ApplicationStage = 'ATS_SCREENING',
    status: ApplicationStatus = 'ACTIVE'
  ): IApplicationDocument {
    return {
      _id: mockAppId,
      userId: mockUserId,
      jobId: mockJobId,
      companyId: mockCompanyId,
      mode: 'PRODUCTION',
      currentStage: stage,
      status: status,
      resumeAnalysisId: mockResumeAnalysisId,
      resumeAnalysisSnapshot: {
        resumeAnalysisId: mockResumeAnalysisId,
        resumeId: mockResumeId,
        domainClassification: 'SOFTWARE_ENGINEERING',
        parsedSkills: ['TypeScript', 'Node.js', 'React'],
        yearsOfExperience: 3,
        name: 'Jane Candidate',
        extractedSummary: 'Full-stack engineer with React/Node expertise.',
        education: [{ institution: 'Tech University', degree: 'BS Computer Science' }],
        workHistory: [{ company: 'Acme Corp', role: 'Software Engineer' }],
        projects: [{ title: 'CorpVerse System', techStack: ['TypeScript'] }],
        certifications: [{ name: 'AWS Solutions Architect' }],
        snapshotAt: new Date(),
      },
      stageHistory: [
        { stage: 'APPLIED', enteredAt: new Date(Date.now() - 60000), exitedAt: new Date(), result: 'ADVANCED_TO_ATS' },
        { stage: 'ATS_SCREENING', enteredAt: new Date() },
      ],
      save: vi.fn().mockResolvedValue(this),
    } as unknown as IApplicationDocument;
  }

  // ---------------------------------------------------------------------------
  // 1. Strict Output Schema Validation
  // ---------------------------------------------------------------------------
  describe('1. Strict Output Schema Validation (atsScreeningOutputSchema)', () => {
    it('should validate valid passing AI structured output', () => {
      const parsed = atsScreeningOutputSchema.safeParse(validPassingAiOutput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.matchScore).toBe(82);
        expect(parsed.data.recommendation).toBe('PASS');
        expect(parsed.data.matchedSkills).toContain('TypeScript');
      }
    });

    it('should validate valid failing AI structured output', () => {
      const parsed = atsScreeningOutputSchema.safeParse(validFailingAiOutput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.matchScore).toBe(54);
        expect(parsed.data.recommendation).toBe('FAIL');
        expect(parsed.data.missingSkills).toContain('TypeScript');
      }
    });

    it('should reject output when matchScore is negative', () => {
      const invalid = { ...validPassingAiOutput, matchScore: -1 };
      const parsed = atsScreeningOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should reject output when matchScore exceeds 100', () => {
      const invalid = { ...validPassingAiOutput, matchScore: 105 };
      const parsed = atsScreeningOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should reject output with empty strengths array', () => {
      const invalid = { ...validPassingAiOutput, strengths: [] };
      const parsed = atsScreeningOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should reject output with empty improvement suggestions array', () => {
      const invalid = { ...validPassingAiOutput, improvementSuggestions: [] };
      const parsed = atsScreeningOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should reject invalid recommendation enum values', () => {
      const invalid = { ...validPassingAiOutput, recommendation: 'MAYBE' };
      const parsed = atsScreeningOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should reject output missing required fields', () => {
      const { matchScore: _matchScore, ...incomplete } = validPassingAiOutput;
      const parsed = atsScreeningOutputSchema.safeParse(incomplete);
      expect(parsed.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Authoritative Backend Pass Threshold & State Transitions
  // ---------------------------------------------------------------------------
  describe('2. Authoritative Backend Decision & State Transitions', () => {
    it('should advance application to SCREENING on passing score (score >= 70)', async () => {
      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
        applicationId: app._id,
        stage: 'ATS_SCREENING',
        score: 82,
        summary: 'Candidate passed',
      } as unknown as IEvaluationDocument);
      const feedbackSpy = vi.spyOn(FeedbackModel, 'create');

      const result = await atsService.applyAtsEvaluation(app, validPassingAiOutput);

      expect(result.passed).toBe(true);
      expect(app.currentStage).toBe('SCREENING');
      expect(app.status).toBe('ACTIVE');
      expect(app.atsScore).toBe(82);
      expect(feedbackSpy).not.toHaveBeenCalled();
      expect(app.save).toHaveBeenCalled();
    });

    it('should reject application and persist feedback on failing score (score < 70)', async () => {
      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
        applicationId: app._id,
        stage: 'ATS_SCREENING',
        score: 54,
        summary: 'Candidate failed',
      } as unknown as IEvaluationDocument);

      const feedbackCreateSpy = vi.spyOn(FeedbackModel, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
        applicationId: app._id,
        userId: app.userId,
        rejectionStage: 'ATS_SCREENING',
        strengths: validFailingAiOutput.strengths,
        weaknesses: validFailingAiOutput.weaknesses,
        actionableSuggestions: validFailingAiOutput.improvementSuggestions,
      } as unknown as IFeedbackDocument);

      const result = await atsService.applyAtsEvaluation(app, validFailingAiOutput);

      expect(result.passed).toBe(false);
      expect(app.status).toBe('REJECTED');
      expect(app.atsScore).toBe(54);
      expect(app.rejectionReason).toContain('70');
      expect(feedbackCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: app._id,
          userId: app.userId,
          rejectionStage: 'ATS_SCREENING',
          strengths: validFailingAiOutput.strengths,
          weaknesses: validFailingAiOutput.weaknesses,
          actionableSuggestions: validFailingAiOutput.improvementSuggestions,
        })
      );
      expect(app.save).toHaveBeenCalled();
    });

    it('should authoritatively REJECT when AI recommends PASS but score is below 70 threshold', async () => {
      // AI erroneously recommends PASS with score 64
      const rogueAiPass: AtsScreeningOutput = {
        ...validPassingAiOutput,
        matchScore: 64,
        recommendation: 'PASS',
      };

      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as unknown as IEvaluationDocument);
      vi.spyOn(FeedbackModel, 'create').mockResolvedValue({} as unknown as IFeedbackDocument);

      const result = await atsService.applyAtsEvaluation(app, rogueAiPass);

      // Backend decision overrides AI recommendation
      expect(result.passed).toBe(false);
      expect(app.status).toBe('REJECTED');
      expect(app.atsScore).toBe(64);
    });

    it('should authoritatively PASS when AI recommends FAIL but score is above 70 threshold', async () => {
      // AI erroneously recommends FAIL with score 78
      const rogueAiFail: AtsScreeningOutput = {
        ...validFailingAiOutput,
        matchScore: 78,
        recommendation: 'FAIL',
      };

      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as unknown as IEvaluationDocument);

      const result = await atsService.applyAtsEvaluation(app, rogueAiFail);

      // Backend decision overrides AI recommendation
      expect(result.passed).toBe(true);
      expect(app.currentStage).toBe('SCREENING');
      expect(app.status).toBe('ACTIVE');
      expect(app.atsScore).toBe(78);
    });

    it('should clamp non-integer and boundary scores to valid integer range [0, 100]', async () => {
      const fractionalScoreOutput: AtsScreeningOutput = {
        ...validPassingAiOutput,
        matchScore: 84.7,
      };

      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as unknown as IEvaluationDocument);

      const result = await atsService.applyAtsEvaluation(app, fractionalScoreOutput);

      expect(result.passed).toBe(true);
      expect(app.atsScore).toBe(85); // Math.round(84.7) = 85
    });
  });

  // ---------------------------------------------------------------------------
  // 3. AI Job Enqueuing & Grounded Context
  // ---------------------------------------------------------------------------
  describe('3. AI Job Submission & Context Grounding', () => {
    it('should advance APPLIED application to ATS_SCREENING and enqueue ATS_SCREEN task', async () => {
      const app = createMockApplication('APPLIED', 'ACTIVE');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
        _id: mockJobId,
        title: 'Senior Backend Engineer',
        description: 'Build high-scale distributed backend systems with TypeScript.',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 5,
        maxLevel: 8,
        requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
      } as unknown as ICompanyJobDocument);

      vi.spyOn(ProfileModel, 'findOne').mockResolvedValue({
        userId: mockUserId,
        displayName: 'Jane Candidate',
        skills: ['TypeScript', 'Node.js'],
      } as unknown as IProfileDocument);

      vi.spyOn(ResumeAnalysisModel, 'findById').mockResolvedValue({
        _id: mockResumeAnalysisId,
        parsedSkills: ['TypeScript', 'Node.js'],
        yearsOfExperience: 4,
        domainClassification: 'SOFTWARE_ENGINEERING',
        extractedSummary: 'Experienced backend specialist.',
      } as unknown as IResumeAnalysisDocument);

      const enqueued = await atsService.enqueueAtsScreening(mockAppId);

      expect(enqueued.jobId).toBeDefined();
      expect(typeof enqueued.jobId).toBe('string');
      expect(app.currentStage).toBe('ATS_SCREENING');
      expect(mockAIGateway.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'ATS_SCREEN',
          systemInstruction: ATS_SCREENING_SYSTEM_PROMPT,
        }),
        expect.objectContaining({
          pool: 'PIPELINE',
          requestorReference: app._id.toString(),
        })
      );
      expect(app.aiJobId).toBeDefined();
    });

    it('should route to DEMO pool when application mode is DEMO', async () => {
      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      app.mode = 'DEMO';
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
        _id: mockJobId,
        title: 'Demo Engineer',
        description: 'Demo',
        domain: 'SOFTWARE_ENGINEERING',
        minLevel: 1,
        maxLevel: 5,
        requiredSkills: ['React'],
      } as unknown as ICompanyJobDocument);

      await atsService.enqueueAtsScreening(mockAppId);

      expect(mockAIGateway.submit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pool: 'DEMO' })
      );
    });

    it('should throw if application is in a terminal or non-active status', async () => {
      const app = createMockApplication('APPLIED', 'WITHDRAWN');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      await expect(atsService.enqueueAtsScreening(mockAppId)).rejects.toThrow(
        /non-active status/
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Provider Downtime & Queue Resilience
  // ---------------------------------------------------------------------------
  describe('4. Provider Downtime & Queue Resilience', () => {
    it('should keep application in ATS_SCREENING stage when job transitions to WAITING_FOR_PROVIDER', async () => {
      const app = createMockApplication('ATS_SCREENING', 'ACTIVE');
      vi.spyOn(ApplicationModel, 'findOne').mockResolvedValue(app);

      const mockJobWaiting = {
        _id: new Types.ObjectId(),
        status: 'WAITING_FOR_PROVIDER',
        requestorReference: app._id.toString(),
      } as unknown as IAIJobDocument;

      await atsService.handleJobStateChange(mockJobWaiting);

      // Application remains in queue untouched
      expect(app.currentStage).toBe('ATS_SCREENING');
      expect(app.status).toBe('ACTIVE');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Worker Hook Registration
  // ---------------------------------------------------------------------------
  describe('5. Worker Hook Registration', () => {
    it('should register validator, completion handler, and stateChange handler on worker', () => {
      expect(mockAIWorker.registerValidator).toHaveBeenCalledWith('ATS_SCREEN', expect.any(Function));
      expect(mockAIWorker.registerHandler).toHaveBeenCalledWith('ATS_SCREEN', expect.any(Function));
      expect(mockAIWorker.registerStateChangeHandler).toHaveBeenCalledWith('ATS_SCREEN', expect.any(Function));
    });
  });
});
