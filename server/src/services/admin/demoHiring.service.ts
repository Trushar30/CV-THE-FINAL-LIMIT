import { Types } from 'mongoose';
import {
  DemoSessionModel,
  type IDemoSessionDocument,
  type DemoDifficulty,
} from '../../models/DemoSession.js';
import {
  ApplicationModel,
  type IApplicationDocument,
  type IResumeAnalysisSnapshot,
} from '../../models/Application.js';
import { CompanyModel, type ICompanyDocument } from '../../models/Company.js';
import { CompanyJobModel, type ICompanyJobDocument } from '../../models/CompanyJob.js';
import { UserModel, type IUserDocument } from '../../models/User.js';
import { EvaluationModel } from '../../models/Evaluation.js';
import { FeedbackModel } from '../../models/Feedback.js';
import { InterviewModel } from '../../models/Interview.js';
import { QuestionModel } from '../../models/Question.js';
import { AnswerModel } from '../../models/Answer.js';
import { AIJobModel } from '../../models/AIJob.js';
import { AIRequestLogModel } from '../../models/AIRequestLog.js';
import { NotificationModel } from '../../models/Notification.js';
import { CAREER_DOMAINS, type CareerDomain, type ApplicationStage } from '../../types/enums.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { AtsScreeningService } from '../career/atsScreening.service.js';
import { StageEngineService } from '../career/stageEngine.service.js';
import { FinalReviewOfferService } from '../career/finalReviewOffer.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateDemoSessionInput } from '../../schemas/demoHiring.schema.js';
import { defaultAIGateway } from '../../ai/index.js';

export interface DemoInspectionData {
  session: IDemoSessionDocument;
  application: IApplicationDocument;
  stages: {
    ats?: {
      evaluation?: unknown;
      feedback?: unknown;
    };
    interviews?: Array<{
      stage: string;
      interview: unknown;
      questions: unknown[];
      answers: unknown[];
    }>;
    finalReview?: unknown;
    offer?: unknown;
  };
  aiTelemetry: {
    jobs: unknown[];
    recentRequests: unknown[];
  };
}

export class DemoHiringService {
  constructor(
    private readonly atsScreeningService: AtsScreeningService = new AtsScreeningService(),
    private readonly stageEngineService: StageEngineService = new StageEngineService(),
    private readonly finalReviewOfferService: FinalReviewOfferService = new FinalReviewOfferService(),
    private readonly auditService: AuditService = new AuditService()
  ) {}

  /**
   * Resolves or provisions the designated demo company with aiProviderPool: 'DEMO'
   */
  public async ensureDemoCompany(): Promise<ICompanyDocument> {
    let demoCompany = await CompanyModel.findOne({ aiProviderPool: 'DEMO', isPlatformCompany: true });
    if (!demoCompany) {
      demoCompany = await CompanyModel.create({
        name: 'CorpVerse Demo Corporation',
        description: 'Dedicated simulation sandbox for Admin Hiring Engine demonstrations and verification.',
        type: 'PLATFORM',
        isPlatformCompany: true,
        domainsHired: [...CAREER_DOMAINS],
        status: 'ACTIVE',
        financialHealth: 100000,
        employeeCount: 0,
        maxEmployees: 100,
        aiProviderPool: 'DEMO',
      });
      logger.info('[DemoHiringService] Created dedicated demo company', {
        companyId: demoCompany._id.toString(),
      });
    }
    return demoCompany;
  }

  /**
   * Resolves or provisions the designated demo job in the demo company
   */
  public async ensureDemoJob(
    companyId: Types.ObjectId,
    domain: CareerDomain,
    difficulty: DemoDifficulty
  ): Promise<ICompanyJobDocument> {
    let demoJob = await CompanyJobModel.findOne({
      companyId,
      domain,
      isOpen: true,
    });

    if (!demoJob) {
      const skillsMap: Record<CareerDomain, string[]> = {
        SOFTWARE_ENGINEERING: ['TypeScript', 'Node.js', 'React', 'MongoDB', 'System Design'],
        CLOUD_ENGINEERING: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
        AI_ENGINEERING: ['Python', 'PyTorch', 'LLMs', 'Prompt Engineering', 'LangChain'],
      };

      const domainSkills = skillsMap[domain] ?? ['TypeScript', 'Problem Solving'];
      const targetLevel = difficulty === 'HARD' ? 7 : difficulty === 'MEDIUM' ? 4 : 2;

      demoJob = await CompanyJobModel.create({
        companyId,
        title: `Demo ${domain.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}`,
        domain,
        targetLevel,
        minLevel: 1,
        maxLevel: 10,
        requiredSkills: domainSkills,
        description: `Demo requisition for showcasing the ${domain} hiring engine.`,
        isOpen: true,
      });

      logger.info('[DemoHiringService] Created dedicated demo job', {
        jobId: demoJob._id.toString(),
        domain,
      });
    }

    return demoJob;
  }

  /**
   * Resolves or provisions the dedicated demo candidate user
   */
  public async ensureDemoCandidate(): Promise<IUserDocument> {
    let candidate = await UserModel.findOne({ email: 'demo-candidate@corpverse.dev' });
    if (!candidate) {
      candidate = await UserModel.create({
        email: 'demo-candidate@corpverse.dev',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashfordemocandidate$dummy',
        displayName: 'Demo Candidate (Alex Mercer)',
        isEmailVerified: true,
        careerRole: 'JOB_SEEKER',
        platformRole: 'NONE',
      });
      logger.info('[DemoHiringService] Created demo candidate user', {
        candidateId: candidate._id.toString(),
      });
    }
    return candidate;
  }

  /**
   * Creates an Admin Demo Hiring Session.
   * Runs against the SAME hiring engine, mode = DEMO, DEMO provider pool.
   */
  public async createDemoSession(
    adminUserId: string | Types.ObjectId,
    input: CreateDemoSessionInput
  ): Promise<{
    demoSessionId: string;
    applicationId: string;
    session: IDemoSessionDocument;
    application: IApplicationDocument;
  }> {
    const adminObjectId = typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId;

    // 1. Ensure isolated Demo Company, Job, and Candidate
    const domain = input.domain as CareerDomain;
    const demoCompany = await this.ensureDemoCompany();
    const demoJob = await this.ensureDemoJob(demoCompany._id, domain, input.difficulty);
    const demoCandidate = await this.ensureDemoCandidate();

    // 2. Build realistic candidate resume snapshot tailored to domain and difficulty
    const resumeSnapshot: IResumeAnalysisSnapshot = {
      resumeAnalysisId: new Types.ObjectId(),
      resumeId: new Types.ObjectId(),
      domainClassification: domain,
      parsedSkills: demoJob.requiredSkills,
      yearsOfExperience: input.difficulty === 'HARD' ? 6 : input.difficulty === 'MEDIUM' ? 3 : 1,
      extractedSummary: `Demo candidate with expertise in ${demoJob.requiredSkills.join(', ')}.`,
      name: 'Demo Candidate (Alex Mercer)',
      snapshotAt: new Date(),
    };

    // 3. Create demo application with mode: 'DEMO'
    const application = await ApplicationModel.create({
      userId: demoCandidate._id,
      jobId: demoJob._id,
      companyId: demoCompany._id,
      mode: 'DEMO',
      currentStage: 'APPLIED',
      status: 'ACTIVE',
      resumeAnalysisId: resumeSnapshot.resumeAnalysisId,
      resumeAnalysisSnapshot: resumeSnapshot,
      stageHistory: [
        {
          stage: 'APPLIED',
          enteredAt: new Date(),
          result: 'DEMO_SESSION_INITIALIZED',
        },
      ],
    });

    // 4. Create DemoSession tracking record
    const demoSession = await DemoSessionModel.create({
      createdBy: adminObjectId,
      applicationId: application._id,
      companyId: demoCompany._id,
      jobId: demoJob._id,
      candidateUserId: demoCandidate._id,
      domain: input.domain,
      difficulty: input.difficulty,
      questionsCount: input.questionsCount,
      interviewType: input.interviewType,
      currentStage: 'APPLIED',
      status: 'INITIALIZED',
      metadata: {
        companyName: demoCompany.name,
        jobTitle: demoJob.title,
      },
    });

    logger.info('[DemoHiringService] Created demo hiring session', {
      demoSessionId: demoSession._id.toString(),
      applicationId: application._id.toString(),
      domain: input.domain,
      difficulty: input.difficulty,
    });

    return {
      demoSessionId: demoSession._id.toString(),
      applicationId: application._id.toString(),
      session: demoSession,
      application,
    };
  }

  /**
   * Retrieves full inspection details for a demo session, including stage evaluations and AI telemetry
   */
  public async getDemoSession(sessionId: string | Types.ObjectId): Promise<DemoInspectionData> {
    const sessionObjectId = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;

    const session = await DemoSessionModel.findById(sessionObjectId);
    if (!session) {
      throw AppError.notFound('Demo session not found.');
    }

    const application = await ApplicationModel.findById(session.applicationId);
    if (!application) {
      throw AppError.notFound('Target demo application not found.');
    }

    // 1. ATS evaluation and feedback
    const atsEvaluation = await EvaluationModel.findOne({
      applicationId: application._id,
      stage: 'ATS_SCREENING',
    });
    const rejectionFeedback = await FeedbackModel.findOne({
      applicationId: application._id,
    });

    // 2. Chat interview sessions
    const interviews = await InterviewModel.find({ applicationId: application._id }).sort({ startedAt: 1 });
    const interviewData = [];
    for (const interview of interviews) {
      const questions = await QuestionModel.find({ interviewId: interview._id }).sort({ sequenceNumber: 1 });
      const answers = await AnswerModel.find({ interviewId: interview._id }).sort({ sequenceNumber: 1 });
      interviewData.push({
        stage: interview.stage,
        interview,
        questions,
        answers,
      });
    }

    // 3. AI telemetry: AI Jobs & request logs
    const aiJobs = await AIJobModel.find({
      $or: [
        { requestorReference: application._id.toString() },
        { _id: application.aiJobId },
      ],
    }).sort({ createdAt: -1 });

    const recentRequests = await AIRequestLogModel.find({ pool: 'DEMO' })
      .sort({ createdAt: -1 })
      .limit(20);

    return {
      session,
      application,
      stages: {
        ats: {
          evaluation: atsEvaluation,
          feedback: rejectionFeedback,
        },
        interviews: interviewData,
        finalReview: application.finalReview,
        offer: application.offer,
      },
      aiTelemetry: {
        jobs: aiJobs,
        recentRequests,
      },
    };
  }

  /**
   * Advances the demo hiring session by one step/stage using the authoritative hiring engine
   */
  public async stepDemoSession(
    sessionId: string | Types.ObjectId
  ): Promise<{
    stage: ApplicationStage;
    application: IApplicationDocument;
    actionResult: unknown;
  }> {
    const sessionObjectId = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;
    const session = await DemoSessionModel.findById(sessionObjectId);
    if (!session) {
      throw AppError.notFound('Demo session not found.');
    }

    const application = await ApplicationModel.findById(session.applicationId);
    if (!application) {
      throw AppError.notFound('Demo application not found.');
    }

    let actionResult: unknown = null;

    if (application.currentStage === 'APPLIED') {
      // Step: Enqueue ATS screening
      const result = await this.atsScreeningService.enqueueAtsScreening(application._id);
      actionResult = { action: 'ATS_SCREENING_ENQUEUED', jobId: result.jobId };
    } else if (
      application.currentStage === 'SCREENING' ||
      application.currentStage === 'ASSESSMENT' ||
      application.currentStage === 'INTERVIEW'
    ) {
      // Step: Initialize chat interview stage
      const stageSession = await this.stageEngineService.getOrInitStageSession(
        application._id,
        application.userId,
        {
          totalQuestions: session.questionsCount,
          difficulty: session.difficulty,
          isStaffOverride: true,
        }
      );
      actionResult = { action: 'CHAT_STAGE_ACTIVE', stageSession };
    } else if (application.currentStage === 'FINAL_REVIEW') {
      // Step: Execute final review
      const reviewResult = await this.finalReviewOfferService.executeFinalReview(
        application._id.toString(),
        application.userId.toString()
      );
      actionResult = { action: 'FINAL_REVIEW_EXECUTED', reviewResult };
    } else if (application.currentStage === 'OFFER') {
      // Step: Offer details
      const offerResult = await this.finalReviewOfferService.getOffer(
        application._id.toString(),
        application.userId.toString()
      );
      actionResult = { action: 'OFFER_RETRIEVED', offerResult };
    } else {
      actionResult = { action: 'NOOP', currentStage: application.currentStage };
    }

    // Refresh application state
    const refreshedApplication = (await ApplicationModel.findById(application._id))!;
    session.currentStage = refreshedApplication.currentStage;
    session.status = refreshedApplication.status === 'ACTIVE' ? 'IN_PROGRESS' : 'COMPLETED';
    await session.save();

    return {
      stage: refreshedApplication.currentStage,
      application: refreshedApplication,
      actionResult,
    };
  }

  /**
   * Submits an answer to the current chat question on behalf of the demo candidate
   */
  public async submitDemoAnswer(
    sessionId: string | Types.ObjectId,
    candidateResponse: string
  ): Promise<unknown> {
    const sessionObjectId = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;
    const session = await DemoSessionModel.findById(sessionObjectId);
    if (!session) {
      throw AppError.notFound('Demo session not found.');
    }

    const application = await ApplicationModel.findById(session.applicationId);
    if (!application) {
      throw AppError.notFound('Demo application not found.');
    }

    const result = await this.stageEngineService.submitAnswer(
      application._id,
      application.userId,
      candidateResponse,
      undefined,
      { isStaffOverride: true }
    );

    const refreshed = (await ApplicationModel.findById(application._id))!;
    session.currentStage = refreshed.currentStage;
    if (refreshed.status !== 'ACTIVE') {
      session.status = 'COMPLETED';
    }
    await session.save();

    return result;
  }

  /**
   * Automates the full demo hiring pipeline end-to-end for instant Admin verification and presentations.
   */
  public async simulateDemoSession(sessionId: string | Types.ObjectId): Promise<DemoInspectionData> {
    const sessionObjectId = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;
    const session = await DemoSessionModel.findById(sessionObjectId);
    if (!session) {
      throw AppError.notFound('Demo session not found.');
    }

    const application = await ApplicationModel.findById(session.applicationId);
    if (!application) {
      throw AppError.notFound('Demo application not found.');
    }

    // 1. ATS Screening Stage
    if (application.currentStage === 'APPLIED') {
      await this.atsScreeningService.enqueueAtsScreening(application._id);
    }

    // If an AI Job is pending and can be executed via default gateway
    const pendingJob = await AIJobModel.findOne({
      requestorReference: application._id.toString(),
      status: 'PENDING',
    });

    if (pendingJob) {
      // Execute job through DEMO provider pool
      const response = await defaultAIGateway.execute(pendingJob.payload, {
        pool: 'DEMO',
      });
      pendingJob.status = 'COMPLETED';
      pendingJob.result = response;
      await pendingJob.save();
      await this.atsScreeningService.handleJobCompletion(pendingJob);
    }

    // Reload application
    let app = (await ApplicationModel.findById(application._id))!;

    // 2. Chat Stages (SCREENING -> ASSESSMENT -> INTERVIEW)
    const chatStages: Array<'SCREENING' | 'ASSESSMENT' | 'INTERVIEW'> = ['SCREENING', 'ASSESSMENT', 'INTERVIEW'];

    for (const chatStage of chatStages) {
      if (app.currentStage === chatStage && app.status === 'ACTIVE') {
        await this.stageEngineService.getOrInitStageSession(
          app._id,
          app.userId,
          {
            totalQuestions: session.questionsCount,
            difficulty: session.difficulty,
            isStaffOverride: true,
          }
        );

        // Answer all questions in this stage
        for (let q = 0; q < session.questionsCount; q++) {
          const sampleAnswer = `I have extensive hands-on experience solving ${app.resumeAnalysisSnapshot.domainClassification} challenges using ${app.resumeAnalysisSnapshot.parsedSkills.join(', ')}. In my prior production projects, I designed distributed scalable solutions with strict automated test coverage, robust monitoring, and maintainable architectural boundaries.`;

          await this.stageEngineService.submitAnswer(
            app._id,
            app.userId,
            sampleAnswer,
            undefined,
            { isStaffOverride: true }
          );
        }

        app = (await ApplicationModel.findById(application._id))!;
      }
    }

    // 3. FINAL_REVIEW
    if (app.currentStage === 'FINAL_REVIEW' && app.status === 'ACTIVE') {
      await this.finalReviewOfferService.executeFinalReview(app._id.toString(), app.userId.toString());
      app = (await ApplicationModel.findById(application._id))!;
    }

    // 4. OFFER
    if (app.currentStage === 'OFFER' && app.status === 'ACTIVE') {
      // Accept offer in demo mode (guaranteed 0 mutations to real employees or ledgers)
      await this.finalReviewOfferService.acceptOffer(app._id.toString(), app.userId.toString());
    }

    // Update demo session status
    session.currentStage = (await ApplicationModel.findById(application._id))!.currentStage;
    session.status = 'COMPLETED';
    await session.save();

    return await this.getDemoSession(sessionObjectId);
  }

  /**
   * Cleans up all data generated for a specific demo session, recording an audit log entry
   */
  public async cleanupDemoSession(
    sessionId: string | Types.ObjectId,
    adminUserId: string | Types.ObjectId,
    reason = 'Admin cleaned up demo session data'
  ): Promise<{ deletedSessionId: string }> {
    const sessionObjectId = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;
    const adminObjectId = typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId;

    const session = await DemoSessionModel.findById(sessionObjectId);
    if (!session) {
      throw AppError.notFound('Demo session not found.');
    }

    const appId = session.applicationId;

    // Delete all linked demo artifacts
    await ApplicationModel.deleteOne({ _id: appId, mode: 'DEMO' });
    await InterviewModel.deleteMany({ applicationId: appId });
    await QuestionModel.deleteMany({ applicationId: appId });
    await AnswerModel.deleteMany({ applicationId: appId });
    await EvaluationModel.deleteMany({ applicationId: appId });
    await FeedbackModel.deleteMany({ applicationId: appId });
    await AIJobModel.deleteMany({ requestorReference: appId.toString() });
    await NotificationModel.deleteMany({ link: { $regex: appId.toString() } });
    await DemoSessionModel.deleteOne({ _id: sessionObjectId });

    // Record immutable audit log
    await this.auditService.record({
      actorId: adminObjectId,
      actorRole: 'ADMIN',
      action: 'DEMO_DATA_CLEANUP',
      targetType: 'demoSessions',
      targetId: sessionObjectId,
      reason,
      oldValue: {
        applicationId: appId.toString(),
        domain: session.domain,
        difficulty: session.difficulty,
      },
    });

    logger.info('[DemoHiringService] Successfully cleaned up demo session', {
      sessionId: sessionObjectId.toString(),
      applicationId: appId.toString(),
    });

    return { deletedSessionId: sessionObjectId.toString() };
  }

  /**
   * Cleans up ALL demo data system-wide, recording an audit log entry
   */
  public async cleanupAllDemoData(
    adminUserId: string | Types.ObjectId,
    reason = 'Admin executed bulk demo data purge'
  ): Promise<{ deletedSessionsCount: number; deletedApplicationsCount: number }> {
    const adminObjectId = typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId;

    const demoApplications = await ApplicationModel.find({ mode: 'DEMO' }, { _id: 1 });
    const appIds = demoApplications.map((a) => a._id);

    const appDeleteResult = await ApplicationModel.deleteMany({ mode: 'DEMO' });
    await InterviewModel.deleteMany({ applicationId: { $in: appIds } });
    await QuestionModel.deleteMany({ applicationId: { $in: appIds } });
    await AnswerModel.deleteMany({ applicationId: { $in: appIds } });
    await EvaluationModel.deleteMany({ applicationId: { $in: appIds } });
    await FeedbackModel.deleteMany({ applicationId: { $in: appIds } });
    await AIJobModel.deleteMany({
      $or: [
        { pool: 'DEMO' },
        { requestorReference: { $in: appIds.map((id) => id.toString()) } },
      ],
    });
    await NotificationModel.deleteMany({
      link: { $regex: `/applications/(${appIds.map((id) => id.toString()).join('|')})` },
    });

    const sessionDeleteResult = await DemoSessionModel.deleteMany({});

    // Record audit log
    await this.auditService.record({
      actorId: adminObjectId,
      actorRole: 'ADMIN',
      action: 'BULK_DEMO_DATA_PURGE',
      targetType: 'demoSessions',
      targetId: adminObjectId,
      reason,
      newValue: {
        deletedSessionsCount: sessionDeleteResult.deletedCount,
        deletedApplicationsCount: appDeleteResult.deletedCount,
      },
    });

    logger.info('[DemoHiringService] Bulk demo cleanup completed', {
      deletedSessions: sessionDeleteResult.deletedCount,
      deletedApplications: appDeleteResult.deletedCount,
    });

    return {
      deletedSessionsCount: sessionDeleteResult.deletedCount,
      deletedApplicationsCount: appDeleteResult.deletedCount,
    };
  }

  /**
   * List all demo hiring sessions sorted by createdAt descending
   */
  public async listDemoSessions(limit = 50): Promise<IDemoSessionDocument[]> {
    return DemoSessionModel.find()
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}

export const defaultDemoHiringService = new DemoHiringService();
