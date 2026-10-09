import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import {
  StageEngineService,
} from '../services/career/stageEngine.service.js';
import {
  stageQuestionOutputSchema,
  stageAnswerEvaluationOutputSchema,
  stageRejectionFeedbackOutputSchema,
  type StageQuestionOutput,
  type StageAnswerEvaluationOutput,
  type StageRejectionFeedbackOutput,
} from '../schemas/stageChat.schema.js';
import { ApplicationModel, type IApplicationDocument } from '../models/Application.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../models/CompanyJob.js';
import { ProfileModel, type IProfileDocument } from '../models/Profile.js';
import { ResumeAnalysisModel, type IResumeAnalysisDocument } from '../models/ResumeAnalysis.js';
import { InterviewModel, type IInterviewDocument } from '../models/Interview.js';
import { QuestionModel, type IQuestionDocument } from '../models/Question.js';
import { AnswerModel, type IAnswerDocument } from '../models/Answer.js';
import { EvaluationModel, type IEvaluationDocument } from '../models/Evaluation.js';
import { FeedbackModel, type IFeedbackDocument } from '../models/Feedback.js';
import { configService } from '../services/config/config.service.js';
import { notificationService } from '../services/notification/notification.service.js';
import type { INotificationDocument } from '../models/Notification.js';
import { AIGateway, AIWorker } from '../ai/index.js';
import type { ApplicationStage, ApplicationStatus } from '../types/enums.js';

describe('Chat-Based Stages Engine: SCREENING, ASSESSMENT, INTERVIEW (TASK P6.3)', () => {
  let stageEngine: StageEngineService;
  let mockAIGateway: AIGateway;
  let mockAIWorker: AIWorker;

  const mockUserId = new Types.ObjectId();
  const mockJobId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockAppId = new Types.ObjectId();
  const mockInterviewId = new Types.ObjectId();
  const mockQuestionId1 = new Types.ObjectId();
  const mockQuestionId2 = new Types.ObjectId();

  const mockQuestionOutput: StageQuestionOutput = {
    question: 'How do you design an event-driven queue consumer in Node.js with idempotency?',
    type: 'ARCHITECTURE',
    difficulty: 'HARD',
    expectedPoints: [
      'Idempotency key check against datastore before processing',
      'Atomic acknowledgment or transaction isolation',
      'Dead-letter queue handling for malformed messages',
    ],
  };

  const mockAnswerEvaluationPass: StageAnswerEvaluationOutput = {
    score: 85,
    strengths: ['Clear explanation of deduplication keys and distributed locking'],
    weaknesses: ['Did not address backpressure mechanics in consumer stream'],
    notes: 'Well-structured architectural solution demonstrating solid distributed systems grasp.',
  };

  const mockAnswerEvaluationFail: StageAnswerEvaluationOutput = {
    score: 45,
    strengths: ['Identified basic try/catch error handling in message handler'],
    weaknesses: ['No mention of idempotency keys or distributed message duplicate risks'],
    notes: 'Incomplete response failing to cover key reliability invariants.',
  };

  const mockRejectionFeedback: StageRejectionFeedbackOutput = {
    whatToImprove: [
      'Deepen knowledge of distributed consensus and duplicate message deduplication.',
    ],
    whatToAdd: [
      'Add microservices portfolio projects demonstrating message broker integrations.',
    ],
    skillsToWorkOn: ['Apache Kafka / RabbitMQ', 'Idempotent Consumer Pattern', 'Distributed Locking'],
    summary: 'Candidate demonstrates basic Node.js skills but fell short on enterprise distributed architecture requirements.',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAIGateway = {
      submit: vi.fn().mockResolvedValue(new Types.ObjectId().toString()),
      execute: vi.fn().mockResolvedValue({
        success: true,
        structuredData: mockQuestionOutput,
      }),
    } as unknown as AIGateway;

    mockAIWorker = {
      registerValidator: vi.fn(),
      registerHandler: vi.fn(),
      registerStateChangeHandler: vi.fn(),
    } as unknown as AIWorker;

    stageEngine = new StageEngineService(mockAIGateway, mockAIWorker);

    // Mock platform stages config
    vi.spyOn(configService, 'getStageSettings').mockImplementation(async (stage) => {
      switch (stage) {
        case 'SCREENING':
          return {
            questionCount: 3,
            difficulty: 'MEDIUM',
            passingScore: 70,
            demoQuestionCount: 1,
            demoDifficulty: 'EASY',
          };
        case 'ASSESSMENT':
          return {
            questionCount: 3,
            difficulty: 'HARD',
            passingScore: 70,
            demoQuestionCount: 1,
            demoDifficulty: 'EASY',
          };
        case 'INTERVIEW':
          return {
            questionCount: 5,
            difficulty: 'HARD',
            passingScore: 75,
            demoQuestionCount: 1,
            demoDifficulty: 'EASY',
          };
        default:
          return {
            questionCount: 3,
            difficulty: 'MEDIUM',
            passingScore: 70,
            demoQuestionCount: 1,
            demoDifficulty: 'EASY',
          };
      }
    });

    // Default DB model mocks
    vi.spyOn(CompanyJobModel, 'findById').mockResolvedValue({
      _id: mockJobId,
      title: 'Senior Backend Engineer',
      domain: 'SOFTWARE_ENGINEERING',
      requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    } as unknown as ICompanyJobDocument);

    vi.spyOn(ProfileModel, 'findOne').mockResolvedValue({
      userId: mockUserId,
      displayName: 'Jane Dev',
      skills: ['TypeScript', 'Node.js', 'Redis'],
    } as unknown as IProfileDocument);

    vi.spyOn(notificationService, 'create').mockResolvedValue({} as unknown as INotificationDocument);

    vi.spyOn(ResumeAnalysisModel, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(),
      parsedSkills: ['TypeScript', 'Node.js'],
      yearsOfExperience: 4,
      extractedSummary: 'Full-stack software architect.',
    } as unknown as IResumeAnalysisDocument);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockApp(stage: ApplicationStage = 'SCREENING', mode: 'PRODUCTION' | 'DEMO' = 'PRODUCTION'): IApplicationDocument {
    return {
      _id: mockAppId,
      userId: mockUserId,
      jobId: mockJobId,
      companyId: mockCompanyId,
      mode,
      currentStage: stage,
      status: 'ACTIVE' as ApplicationStatus,
      resumeAnalysisSnapshot: {
        domainClassification: 'SOFTWARE_ENGINEERING',
        parsedSkills: ['TypeScript', 'Node.js'],
        extractedSummary: 'Full-stack software architect.',
        name: 'Jane Dev',
        snapshotAt: new Date(),
      },
      stageHistory: [
        { stage: 'APPLIED', enteredAt: new Date() },
        { stage: 'ATS_SCREENING', enteredAt: new Date() },
        { stage, enteredAt: new Date() },
      ],
      save: vi.fn().mockResolvedValue(this),
    } as unknown as IApplicationDocument;
  }

  function createMockInterview(
    stage: 'SCREENING' | 'ASSESSMENT' | 'INTERVIEW' = 'SCREENING',
    status: 'IN_PROGRESS' | 'COMPLETED' | 'WAITING_AI' = 'IN_PROGRESS',
    totalQuestions: number = 3
  ): IInterviewDocument {
    return {
      _id: mockInterviewId,
      applicationId: mockAppId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      stage,
      status,
      currentQuestionIndex: 0,
      totalQuestions,
      passingScore: 70,
      difficulty: 'MEDIUM',
      mode: 'PRODUCTION',
      startedAt: new Date(),
      save: vi.fn().mockResolvedValue(this),
    } as unknown as IInterviewDocument;
  }

  // ---------------------------------------------------------------------------
  // 1. Schema Validation
  // ---------------------------------------------------------------------------
  describe('1. Schema Validation for Questions, Answer Evaluations, and Feedback', () => {
    it('should validate stageQuestionOutputSchema with expected fields', () => {
      const parsed = stageQuestionOutputSchema.safeParse(mockQuestionOutput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.type).toBe('ARCHITECTURE');
        expect(parsed.data.difficulty).toBe('HARD');
        expect(parsed.data.expectedPoints).toHaveLength(3);
      }
    });

    it('should reject questions with empty expectedPoints array', () => {
      const invalid = { ...mockQuestionOutput, expectedPoints: [] };
      const parsed = stageQuestionOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should validate stageAnswerEvaluationOutputSchema', () => {
      const parsed = stageAnswerEvaluationOutputSchema.safeParse(mockAnswerEvaluationPass);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.score).toBe(85);
        expect(parsed.data.strengths.length).toBeGreaterThan(0);
      }
    });

    it('should reject answer evaluations with score out of 0-100 range', () => {
      const invalid = { ...mockAnswerEvaluationPass, score: 120 };
      const parsed = stageAnswerEvaluationOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should validate stageRejectionFeedbackOutputSchema', () => {
      const parsed = stageRejectionFeedbackOutputSchema.safeParse(mockRejectionFeedback);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.whatToImprove.length).toBeGreaterThan(0);
        expect(parsed.data.skillsToWorkOn).toContain('Apache Kafka / RabbitMQ');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Token Budget History Trimming
  // ---------------------------------------------------------------------------
  describe('2. Token Budget and History Trimming', () => {
    it('should preserve conversation history when within character budget', () => {
      const history = [
        { role: 'assistant' as const, content: 'Tell me about Node.js event loop.' },
        { role: 'user' as const, content: 'The event loop has timers, poll, and check phases.' },
      ];

      const trimmed = stageEngine.trimHistory(history);
      expect(trimmed).toHaveLength(2);
      expect(trimmed[0].content).toContain('event loop');
    });

    it('should trim older turns when conversation history exceeds budget', () => {
      const veryLongTurn = 'X'.repeat(5000);
      const history = [
        { role: 'assistant' as const, content: `Old Q: ${veryLongTurn}` },
        { role: 'user' as const, content: `Old A: ${veryLongTurn}` },
        { role: 'assistant' as const, content: 'Recent Q: What is microservices?' },
        { role: 'user' as const, content: 'Recent A: Small independent services.' },
      ];

      const trimmed = stageEngine.trimHistory(history);
      expect(trimmed.length).toBeLessThan(history.length);
      // Ensures the most recent turn remains preserved
      expect(trimmed[trimmed.length - 1].content).toContain('Recent A');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Stage Session Initialization & Mode Agnosticism
  // ---------------------------------------------------------------------------
  describe('3. Stage Session Initialization & Configuration', () => {
    it('should initialize SCREENING session with 3 questions and MEDIUM difficulty in PRODUCTION', async () => {
      const app = createMockApp('SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(null);

      const createdInterview = createMockInterview('SCREENING', 'IN_PROGRESS', 3);
      vi.spyOn(InterviewModel, 'create').mockResolvedValue(createdInterview);
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as unknown as never);
      vi.spyOn(AnswerModel, 'find').mockResolvedValue([]);

      const mockQuestionDoc = {
        _id: mockQuestionId1,
        sequenceNumber: 1,
        content: mockQuestionOutput.question,
      } as IQuestionDocument;
      vi.spyOn(stageEngine, 'generateNextQuestion').mockResolvedValue(mockQuestionDoc);

      const session = await stageEngine.getOrInitStageSession(mockAppId, mockUserId);

      expect(session.interview).toBeDefined();
      expect(session.currentQuestion).toBeDefined();
      expect(session.currentQuestion?.sequenceNumber).toBe(1);
      expect(InterviewModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'SCREENING',
          totalQuestions: 3,
          difficulty: 'MEDIUM',
          mode: 'PRODUCTION',
        })
      );
    });

    it('should initialize DEMO session with 1 question and EASY difficulty when application mode is DEMO', async () => {
      const app = createMockApp('SCREENING', 'DEMO');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(null);

      const createdDemoInterview = createMockInterview('SCREENING', 'IN_PROGRESS', 1);
      createdDemoInterview.mode = 'DEMO';
      createdDemoInterview.difficulty = 'EASY';
      createdDemoInterview.totalQuestions = 1;

      vi.spyOn(InterviewModel, 'create').mockResolvedValue(createdDemoInterview);
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as unknown as never);
      vi.spyOn(AnswerModel, 'find').mockResolvedValue([]);
      vi.spyOn(stageEngine, 'generateNextQuestion').mockResolvedValue({
        _id: mockQuestionId1,
        sequenceNumber: 1,
        content: 'Demo question',
      } as IQuestionDocument);

      await stageEngine.getOrInitStageSession(mockAppId, mockUserId);

      expect(InterviewModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'SCREENING',
          totalQuestions: 1,
          difficulty: 'EASY',
          mode: 'DEMO',
        })
      );
    });

    it('should reject access if application is not in a chat-based stage (e.g. APPLIED or ATS_SCREENING)', async () => {
      const app = createMockApp('ATS_SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      await expect(stageEngine.getOrInitStageSession(mockAppId, mockUserId)).rejects.toThrow(
        /not a chat-based stage/
      );
    });

    it('should forbid access if requesting user is not the application owner', async () => {
      const app = createMockApp('SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const otherUserId = new Types.ObjectId();
      await expect(stageEngine.getOrInitStageSession(mockAppId, otherUserId)).rejects.toThrow(
        /permission to access/
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Turn-by-Turn Q&A, Guard Enforcement & Progression
  // ---------------------------------------------------------------------------
  describe('4. Turn-by-Turn Q&A and Progression Invariants', () => {
    it('should evaluate answer and generate next question when turn < totalQuestions', async () => {
      const app = createMockApp('SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('SCREENING', 'IN_PROGRESS', 3);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = {
        _id: mockQuestionId1,
        sequenceNumber: 1,
        content: 'What is idempotency?',
        type: 'CONCEPTUAL',
        difficulty: 'MEDIUM',
        expectedPoints: ['Safe retries', 'Unique keys'],
      } as IQuestionDocument;

      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1]),
      } as unknown as never);
      // No existing answers yet
      vi.spyOn(AnswerModel, 'find')
        .mockResolvedValueOnce([]) // initial check
        .mockResolvedValueOnce([{ questionId: mockQuestionId1, score: 85 } as unknown as IAnswerDocument]); // check after creation

      vi.spyOn(AnswerModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(AnswerModel, 'create').mockResolvedValue({
        questionId: mockQuestionId1,
        score: 85,
      } as unknown as IAnswerDocument);

      const nextQ = {
        _id: mockQuestionId2,
        sequenceNumber: 2,
        content: 'How do you handle race conditions?',
      } as IQuestionDocument;
      vi.spyOn(stageEngine, 'generateNextQuestion').mockResolvedValue(nextQ);

      // AI Answer evaluation mock
      (mockAIGateway.execute as unknown as never).mockResolvedValueOnce({
        success: true,
        structuredData: mockAnswerEvaluationPass,
      });

      const result = await stageEngine.submitAnswer(
        mockAppId,
        mockUserId,
        'Idempotency means multiple identical requests produce the same side effect.',
        1
      );

      expect(result.isCompleted).toBe(false);
      expect(result.evaluation.score).toBe(85);
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion?.sequenceNumber).toBe(2);
    });

    it('should prevent answer resubmission on the same question', async () => {
      const app = createMockApp('SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('SCREENING', 'IN_PROGRESS', 3);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = { _id: mockQuestionId1, sequenceNumber: 1 } as IQuestionDocument;
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1]),
      } as unknown as never);
      vi.spyOn(AnswerModel, 'find').mockResolvedValue([]);
      // Answer already exists in DB
      vi.spyOn(AnswerModel, 'findOne').mockResolvedValue({ _id: new Types.ObjectId() } as unknown as never);

      await expect(
        stageEngine.submitAnswer(mockAppId, mockUserId, 'Duplicate answer', 1)
      ).rejects.toThrow(/already been submitted/);
    });

    it('should reject out-of-order answer submission or question skipping', async () => {
      const app = createMockApp('SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('SCREENING', 'IN_PROGRESS', 3);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = { _id: mockQuestionId1, sequenceNumber: 1 } as IQuestionDocument;
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1]),
      } as unknown as never);
      vi.spyOn(AnswerModel, 'find').mockResolvedValue([]);

      // Attempting to answer question #2 when question #1 is active
      await expect(
        stageEngine.submitAnswer(mockAppId, mockUserId, 'Skipping to 2', 2)
      ).rejects.toThrow(/Out of order/);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Authoritative Backend Calculation: Stage Pass vs Rejection
  // ---------------------------------------------------------------------------
  describe('5. Authoritative Stage Completion: Pass vs Rejection', () => {
    it('should authoritatively PASS and advance SCREENING to ASSESSMENT on averageScore >= 70', async () => {
      const app = createMockApp('SCREENING', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('SCREENING', 'IN_PROGRESS', 2);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = { _id: mockQuestionId1, sequenceNumber: 1 } as IQuestionDocument;
      const q2 = { _id: mockQuestionId2, sequenceNumber: 2 } as IQuestionDocument;
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1, q2]),
      } as unknown as never);

      const existingAnswer1 = { questionId: mockQuestionId1, score: 80 } as IAnswerDocument;
      const answer2Doc = { questionId: mockQuestionId2, score: 90 } as IAnswerDocument;

      vi.spyOn(AnswerModel, 'find')
        .mockResolvedValueOnce([existingAnswer1]) // question lookup
        .mockResolvedValueOnce([existingAnswer1, answer2Doc]); // finalization lookup

      vi.spyOn(AnswerModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(AnswerModel, 'create').mockResolvedValue(answer2Doc);
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as IEvaluationDocument);

      (mockAIGateway.execute as unknown as never).mockResolvedValueOnce({
        success: true,
        structuredData: { ...mockAnswerEvaluationPass, score: 90 },
      });

      const result = await stageEngine.submitAnswer(mockAppId, mockUserId, 'Final answer', 2);

      expect(result.isCompleted).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(85); // (80 + 90) / 2 = 85
      expect(result.nextStage).toBe('ASSESSMENT');
      expect(app.currentStage).toBe('ASSESSMENT');
      expect(interview.status).toBe('COMPLETED');
    });

    it('should authoritatively PASS and advance ASSESSMENT to INTERVIEW', async () => {
      const app = createMockApp('ASSESSMENT', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('ASSESSMENT', 'IN_PROGRESS', 1);
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = { _id: mockQuestionId1, sequenceNumber: 1 } as IQuestionDocument;
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1]),
      } as unknown as never);

      const ans1 = { questionId: mockQuestionId1, score: 75 } as IAnswerDocument;
      vi.spyOn(AnswerModel, 'find')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([ans1]);
      vi.spyOn(AnswerModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(AnswerModel, 'create').mockResolvedValue(ans1);
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as IEvaluationDocument);

      (mockAIGateway.execute as unknown as never).mockResolvedValueOnce({
        success: true,
        structuredData: { ...mockAnswerEvaluationPass, score: 75 },
      });

      const result = await stageEngine.submitAnswer(mockAppId, mockUserId, 'Assessment answer', 1);

      expect(result.isCompleted).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.nextStage).toBe('INTERVIEW');
      expect(app.currentStage).toBe('INTERVIEW');
    });

    it('should authoritatively PASS and advance INTERVIEW to FINAL_REVIEW', async () => {
      const app = createMockApp('INTERVIEW', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('INTERVIEW', 'IN_PROGRESS', 1);
      interview.passingScore = 75;
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = { _id: mockQuestionId1, sequenceNumber: 1 } as IQuestionDocument;
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1]),
      } as unknown as never);

      const ans1 = { questionId: mockQuestionId1, score: 88 } as IAnswerDocument;
      vi.spyOn(AnswerModel, 'find')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([ans1]);
      vi.spyOn(AnswerModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(AnswerModel, 'create').mockResolvedValue(ans1);
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as IEvaluationDocument);

      (mockAIGateway.execute as unknown as never).mockResolvedValueOnce({
        success: true,
        structuredData: { ...mockAnswerEvaluationPass, score: 88 },
      });

      const result = await stageEngine.submitAnswer(mockAppId, mockUserId, 'Interview answer', 1);

      expect(result.isCompleted).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.nextStage).toBe('FINAL_REVIEW');
      expect(app.currentStage).toBe('FINAL_REVIEW');
    });

    it('should authoritatively REJECT when score < threshold and persist AI diagnostic feedback', async () => {
      const app = createMockApp('INTERVIEW', 'PRODUCTION');
      vi.spyOn(ApplicationModel, 'findById').mockResolvedValue(app);

      const interview = createMockInterview('INTERVIEW', 'IN_PROGRESS', 1);
      interview.passingScore = 75;
      vi.spyOn(InterviewModel, 'findOne').mockResolvedValue(interview);

      const q1 = { _id: mockQuestionId1, sequenceNumber: 1 } as IQuestionDocument;
      vi.spyOn(QuestionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([q1]),
      } as unknown as never);

      const ans1 = {
        questionId: mockQuestionId1,
        score: 52,
        strengths: ['Basic understanding'],
        weaknesses: ['Missed critical security requirements'],
      } as IAnswerDocument;

      vi.spyOn(AnswerModel, 'find')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([ans1]);
      vi.spyOn(AnswerModel, 'findOne').mockResolvedValue(null);
      vi.spyOn(AnswerModel, 'create').mockResolvedValue(ans1);
      vi.spyOn(EvaluationModel, 'create').mockResolvedValue({} as IEvaluationDocument);

      const feedbackSpy = vi.spyOn(FeedbackModel, 'create').mockResolvedValue({} as IFeedbackDocument);

      // AI Answer evaluation returning 52 (< 75 threshold)
      (mockAIGateway.execute as unknown as never)
        .mockResolvedValueOnce({
          success: true,
          structuredData: mockAnswerEvaluationFail,
        })
        // AI Rejection feedback generation
        .mockResolvedValueOnce({
          success: true,
          structuredData: mockRejectionFeedback,
        });

      const result = await stageEngine.submitAnswer(mockAppId, mockUserId, 'Struggling response', 1);

      expect(result.isCompleted).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.overallScore).toBe(52);
      expect(app.status).toBe('REJECTED');
      expect(result.feedback).toBeDefined();
      expect(result.feedback?.skillsToWorkOn).toContain('Apache Kafka / RabbitMQ');
      expect(feedbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: app._id,
          userId: app.userId,
          rejectionStage: 'INTERVIEW',
        })
      );
    });
  });
});
