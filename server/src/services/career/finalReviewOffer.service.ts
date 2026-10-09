import mongoose, { Types } from 'mongoose';
import {
  AIGateway,
  AIWorker,
  defaultAIGateway,
  defaultAIWorker,
  AIError,
} from '../../ai/index.js';
import { ApplicationModel, type IApplicationDocument } from '../../models/Application.js';
import { CompanyModel } from '../../models/Company.js';
import { CompanyJobModel } from '../../models/CompanyJob.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../../models/CompanyEmployee.js';
import { UserModel } from '../../models/User.js';
import { EvaluationModel } from '../../models/Evaluation.js';
import { FeedbackModel } from '../../models/Feedback.js';
import { InterviewModel } from '../../models/Interview.js';
import { notificationService } from '../notification/notification.service.js';
import { configService } from '../config/config.service.js';
import { ApplicationStateMachine } from './applicationStateMachine.js';
import {
  finalReviewSummaryOutputSchema,
  finalReviewSummaryJsonSchema,
  offerNegotiationOutputSchema,
  offerNegotiationJsonSchema,
} from '../../schemas/offer.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface FinalReviewResult {
  passed: boolean;
  finalScore: number;
  passingScore: number;
  summary: string;
  recommendations: string[];
  stageScores: {
    atsScore: number;
    screeningScore: number;
    assessmentScore: number;
    interviewScore: number;
  };
  offer?: IApplicationDocument['offer'];
}

export interface NegotiateOfferResult {
  offer: NonNullable<IApplicationDocument['offer']>;
  round: number;
  aiResponse: string;
  newSalary: number;
}

export interface AcceptOfferResult {
  success: boolean;
  application: IApplicationDocument;
  employee: ICompanyEmployeeDocument | null;
}

export interface DeclineOfferResult {
  success: boolean;
  status: string;
  message: string;
}

export class FinalReviewOfferService {
  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly aiWorker: AIWorker = defaultAIWorker
  ) {
    this.registerWorkerHooks();
  }

  private registerWorkerHooks(): void {
    // 1. Final Review Summary Validator
    this.aiWorker.registerValidator('FINAL_REVIEW_SUMMARY', (_job, response) => {
      if (!response.structuredData) {
        throw new AIError('AI provider returned no structured data for FINAL_REVIEW_SUMMARY', 'PROVIDER_ERROR');
      }
      const parsed = finalReviewSummaryOutputSchema.safeParse(response.structuredData);
      if (!parsed.success) {
        throw new AIError(`Zod validation failed for FINAL_REVIEW_SUMMARY: ${parsed.error.message}`, 'PROVIDER_ERROR');
      }
    });

    // 2. Offer Negotiation Validator
    this.aiWorker.registerValidator('OFFER_NEGOTIATION', (_job, response) => {
      if (!response.structuredData) {
        throw new AIError('AI provider returned no structured data for OFFER_NEGOTIATION', 'PROVIDER_ERROR');
      }
      const parsed = offerNegotiationOutputSchema.safeParse(response.structuredData);
      if (!parsed.success) {
        throw new AIError(`Zod validation failed for OFFER_NEGOTIATION: ${parsed.error.message}`, 'PROVIDER_ERROR');
      }
    });
  }

  /**
   * Runs an operation inside a MongoDB transaction if replica sets are enabled,
   * or executes without transaction in standalone test environments.
   */
  private async runWithTransaction<T>(
    work: (session?: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    if (mongoose.connection.readyState !== 1) {
      return await work();
    }

    let session: mongoose.ClientSession | null = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch {
      // Standalone MongoDB without replica set
      if (session) {
        session.endSession();
        session = null;
      }
    }

    if (session && useTransaction) {
      try {
        const result = await work(session);
        await session.commitTransaction();
        return result;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('replica set member') || errMsg.includes('Transaction numbers are only allowed')) {
          logger.warn('[FinalReviewOfferService] Standalone MongoDB detected, executing without transaction');
          return await work();
        }
        try {
          await session.abortTransaction();
        } catch {
          // ignore abort error if transaction was never started on server
        }
        throw err;
      } finally {
        session.endSession();
      }
    } else {
      return await work();
    }
  }

  /**
   * Executes the FINAL_REVIEW stage.
   * Gathers scores from all prior stages, computes the backend authoritative weighted score,
   * requests an AI executive summary, and either advances to OFFER (with generated initial terms)
   * or transitions to REJECTED (with diagnostic feedback).
   */
  async executeFinalReview(applicationId: string, userId: string): Promise<FinalReviewResult> {
    const appObjectId = new Types.ObjectId(applicationId);
    const userObjectId = new Types.ObjectId(userId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to review this application.');
    }

    if (application.status !== 'ACTIVE') {
      throw AppError.businessRuleViolation(`Cannot execute final review for application with status '${application.status}'.`);
    }

    if (application.currentStage !== 'FINAL_REVIEW') {
      throw AppError.businessRuleViolation(
        `Application is in stage '${application.currentStage}', expected 'FINAL_REVIEW'.`
      );
    }

    // 1. Gather stage scores from prior stages
    const atsScore = await this.getStageScore(application, 'ATS_SCREENING');
    const screeningScore = await this.getStageScore(application, 'SCREENING');
    const assessmentScore = await this.getStageScore(application, 'ASSESSMENT');
    const interviewScore = await this.getStageScore(application, 'INTERVIEW');

    // 2. Fetch weights and thresholds from PlatformConfig
    const weightsConfig = await configService.getFinalReviewSettings();
    const {
      atsWeight,
      screeningWeight,
      assessmentWeight,
      interviewWeight,
      passingScore,
    } = weightsConfig;

    const totalWeight = atsWeight + screeningWeight + assessmentWeight + interviewWeight;
    const weightedSum =
      atsScore * atsWeight +
      screeningScore * screeningWeight +
      assessmentScore * assessmentWeight +
      interviewScore * interviewWeight;

    const finalScore = Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));
    const isPassing = finalScore >= passingScore;

    // 3. Generate AI summary
    const pool = application.mode === 'DEMO' ? 'DEMO' : 'PIPELINE';
    const systemInstruction = `You are CorpVerse's executive hiring committee synthesizer.
Based on the candidate's scores across all stages, synthesize a concise executive evaluation summary and actionable recommendations.
Output JSON schema: { summary: string, recommendations: string[] }.`;

    const job = await CompanyJobModel.findById(application.jobId);
    const userInput = JSON.stringify(
      {
        jobTitle: job?.title ?? 'Software Engineer',
        candidateDomain: application.resumeAnalysisSnapshot.domainClassification,
        stageScores: {
          atsScore,
          screeningScore,
          assessmentScore,
          interviewScore,
        },
        weightedFinalScore: finalScore,
        passingThreshold: passingScore,
        isPassing,
      },
      null,
      2
    );

    let summary = `Candidate scored ${finalScore}/100 across evaluation stages (ATS: ${atsScore}, Screening: ${screeningScore}, Assessment: ${assessmentScore}, Interview: ${interviewScore}). Outcome: ${isPassing ? 'PASSED' : 'FAILED'}.`;
    let recommendations: string[] = isPassing
      ? ['Proceed with formal employment offer', 'Align on team onboarding plan']
      : ['Deepen core architectural concepts', 'Acquire additional domain practical experience'];

    try {
      const aiResult = await this.aiGateway.execute(
        {
          taskType: 'FINAL_REVIEW_SUMMARY',
          systemInstruction,
          userInput,
          outputSchema: finalReviewSummaryJsonSchema,
          temperature: 0.2,
        },
        { pool }
      );

      if (aiResult.success && aiResult.structuredData) {
        const parsed = finalReviewSummaryOutputSchema.parse(aiResult.structuredData);
        summary = parsed.summary;
        recommendations = parsed.recommendations;
      }
    } catch (aiErr: unknown) {
      logger.warn('[FinalReviewOfferService] AI summary generation degraded, using deterministic fallback', {
        error: aiErr instanceof Error ? aiErr.message : String(aiErr),
      });
    }

    // 4. Save in Evaluation collection
    await EvaluationModel.create({
      applicationId: application._id,
      stage: 'FINAL_REVIEW',
      score: finalScore,
      scoreBreakdown: {
        atsScore,
        atsWeight,
        screeningScore,
        screeningWeight,
        assessmentScore,
        assessmentWeight,
        interviewScore,
        interviewWeight,
        finalScore,
        passingScore,
      },
      summary,
      createdAt: new Date(),
    });

    // 5. Update Application.finalReview subdocument
    application.finalReview = {
      atsScore,
      atsWeight,
      screeningScore,
      screeningWeight,
      assessmentScore,
      assessmentWeight,
      interviewScore,
      interviewWeight,
      finalScore,
      passingScore,
      isPassing,
      summary,
      recommendations,
      evaluatedAt: new Date(),
    };

    if (isPassing) {
      // Advance to OFFER
      ApplicationStateMachine.advanceStage(application, 'OFFER', {
        result: `PASSED_FINAL_REVIEW_SCORE_${finalScore}`,
      });

      // Build initial offer
      const level = Math.max(1, Math.min(10, job?.targetLevel ?? job?.minLevel ?? 1));
      const band = (await configService.getSalaryBandForLevel(level)) ?? {
        level,
        minSalary: 45000,
        maxSalary: 60000,
      };

      const startingSalary = Math.round((band.minSalary + band.maxSalary) / 2);
      const offerConfig = await configService.getOfferSettings();
      const maxRounds =
        application.mode === 'DEMO'
          ? offerConfig.demoMaxNegotiationRounds
          : offerConfig.maxNegotiationRounds;

      application.offer = {
        positionTitle: job?.title ?? 'Software Engineer',
        level,
        salarySimulated: startingSalary,
        salaryMin: band.minSalary,
        salaryMax: band.maxSalary,
        negotiationRoundsLeft: maxRounds,
        maxNegotiationRounds: maxRounds,
        negotiationHistory: [],
        status: 'OFFERED',
        offeredAt: new Date(),
      };

      await application.save();

      // Trigger offer received notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'OFFER_RECEIVED',
          title: 'Job Offer Received',
          message: `Congratulations! You have received an employment offer for ${application.offer.positionTitle}.`,
          link: `/applications/${application._id}/offer`,
        });
      } catch (notifErr) {
        logger.warn('[FinalReviewOfferService] Failed to send offer received notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }

      logger.info(`[FinalReviewOfferService] Final review passed. Advanced to OFFER.`, {
        applicationId: application._id.toString(),
        finalScore,
      });

      return {
        passed: true,
        finalScore,
        passingScore,
        summary,
        recommendations,
        stageScores: { atsScore, screeningScore, assessmentScore, interviewScore },
        offer: application.offer,
      };
    } else {
      // Rejection
      ApplicationStateMachine.reject(application, {
        reason: `Final review score of ${finalScore} did not meet the passing threshold of ${passingScore}.`,
        result: 'FINAL_REVIEW_FAILED',
      });

      await FeedbackModel.create({
        applicationId: application._id,
        userId: application.userId,
        rejectionStage: 'FINAL_REVIEW',
        strengths: ['Demonstrated capability across multiple pipeline stages'],
        weaknesses: [`Aggregate final review score (${finalScore}) fell below the benchmark (${passingScore})`],
        actionableSuggestions: recommendations,
        createdAt: new Date(),
      });

      await application.save();

      // Trigger rejected with feedback link notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'APPLICATION_REJECTED',
          title: 'Application Update',
          message: 'Your application was not selected after final review. Constructive feedback is available.',
          link: `/applications/${application._id}/feedback`,
        });
      } catch (notifErr) {
        logger.warn('[FinalReviewOfferService] Failed to send rejection notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }

      logger.info(`[FinalReviewOfferService] Final review failed. Application REJECTED.`, {
        applicationId: application._id.toString(),
        finalScore,
      });

      return {
        passed: false,
        finalScore,
        passingScore,
        summary,
        recommendations,
        stageScores: { atsScore, screeningScore, assessmentScore, interviewScore },
      };
    }
  }

  /**
   * Helper to retrieve stage score from EvaluationModel, InterviewModel, or Application document
   */
  private async getStageScore(
    application: IApplicationDocument,
    stage: 'ATS_SCREENING' | 'SCREENING' | 'ASSESSMENT' | 'INTERVIEW'
  ): Promise<number> {
    const evalDoc = await EvaluationModel.findOne({ applicationId: application._id, stage });
    if (evalDoc && typeof evalDoc.score === 'number') {
      return evalDoc.score;
    }

    if (stage === 'ATS_SCREENING') {
      if (typeof application.atsScore === 'number') {
        return application.atsScore;
      }
      return 70;
    }

    const interviewDoc = await InterviewModel.findOne({ applicationId: application._id, stage });
    if (interviewDoc && typeof interviewDoc.overallScore === 'number') {
      return interviewDoc.overallScore;
    }

    if (stage === 'INTERVIEW' && typeof application.interviewScore === 'number') {
      return application.interviewScore;
    }

    return 70;
  }

  /**
   * Retrieves the current offer details for an application.
   */
  async getOffer(applicationId: string, userId: string): Promise<NonNullable<IApplicationDocument['offer']>> {
    const appObjectId = new Types.ObjectId(applicationId);
    const userObjectId = new Types.ObjectId(userId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to view this offer.');
    }

    if (!application.offer) {
      throw AppError.notFound('No offer found for this application.');
    }

    return application.offer;
  }

  /**
   * Negotiates an employment offer with AI assistance and authoritative backend salary clamping.
   */
  async negotiateOffer(
    applicationId: string,
    userId: string,
    message: string,
    requestedSalary?: number
  ): Promise<NegotiateOfferResult> {
    const appObjectId = new Types.ObjectId(applicationId);
    const userObjectId = new Types.ObjectId(userId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to negotiate this offer.');
    }

    if (application.status !== 'ACTIVE' || application.currentStage !== 'OFFER') {
      throw AppError.businessRuleViolation(
        `Cannot negotiate offer for application in stage '${application.currentStage}' with status '${application.status}'.`
      );
    }

    const offer = application.offer;
    if (!offer || offer.status !== 'OFFERED') {
      throw AppError.businessRuleViolation('Application does not have an active open offer.');
    }

    if (offer.negotiationRoundsLeft <= 0) {
      throw AppError.businessRuleViolation(
        'No negotiation rounds remaining. Please accept or decline the current offer.'
      );
    }

    // Call AI for negotiation response
    const pool = application.mode === 'DEMO' ? 'DEMO' : 'PIPELINE';
    const systemInstruction = `You are CorpVerse's hiring manager communicating with a candidate negotiating their job offer.
Current Offer:
- Position: ${offer.positionTitle}
- Level: L${offer.level}
- Current Simulated Salary: $${offer.salarySimulated}
- Salary Band for Level: [$${offer.salaryMin} - $${offer.salaryMax}]

CRITICAL RULES:
1. Experience points (EXP) are strictly non-negotiable.
2. Maintain a professional, encouraging tone.
3. If the candidate asks for higher compensation, you may suggest a reasonable counter-offer within the band.
Output JSON schema: { aiResponse: string, counterOfferSalary?: number }.`;

    const userInput = JSON.stringify(
      {
        candidateMessage: message,
        requestedSalary,
        currentSalary: offer.salarySimulated,
        salaryMin: offer.salaryMin,
        salaryMax: offer.salaryMax,
        level: offer.level,
        roundsRemaining: offer.negotiationRoundsLeft,
      },
      null,
      2
    );

    let aiResponse = 'Thank you for discussing your compensation terms. We have reviewed your request against our level salary bands.';
    let aiCounterSalary: number | undefined;

    try {
      const aiResult = await this.aiGateway.execute(
        {
          taskType: 'OFFER_NEGOTIATION',
          systemInstruction,
          userInput,
          outputSchema: offerNegotiationJsonSchema,
          temperature: 0.3,
        },
        { pool }
      );

      if (aiResult.success && aiResult.structuredData) {
        const parsed = offerNegotiationOutputSchema.parse(aiResult.structuredData);
        aiResponse = parsed.aiResponse;
        aiCounterSalary = parsed.counterOfferSalary;
      }
    } catch (aiErr: unknown) {
      logger.warn('[FinalReviewOfferService] AI offer negotiation degraded, using fallback response', {
        error: aiErr instanceof Error ? aiErr.message : String(aiErr),
      });
    }

    // Authoritative backend salary calculation and clamping
    let proposedSalary = offer.salarySimulated;
    if (typeof requestedSalary === 'number' && requestedSalary > 0) {
      // Meet halfway between current and requested, or adopt requested
      proposedSalary = Math.round((offer.salarySimulated + requestedSalary) / 2);
    } else if (typeof aiCounterSalary === 'number') {
      proposedSalary = aiCounterSalary;
    }

    // STRICT CLAMPING TO BAND
    const clampedSalary = Math.max(
      offer.salaryMin,
      Math.min(offer.salaryMax, Math.round(proposedSalary))
    );

    const roundNumber = offer.maxNegotiationRounds - offer.negotiationRoundsLeft + 1;
    offer.negotiationHistory.push({
      round: roundNumber,
      candidateMessage: message,
      requestedSalary,
      aiResponse,
      counterOfferSalary: clampedSalary,
      timestamp: new Date(),
    });

    offer.salarySimulated = clampedSalary;
    offer.negotiationRoundsLeft -= 1;

    await application.save();

    logger.info(`[FinalReviewOfferService] Offer negotiation round ${roundNumber} completed`, {
      applicationId: application._id.toString(),
      newSalary: clampedSalary,
      roundsLeft: offer.negotiationRoundsLeft,
    });

    return {
      offer,
      round: roundNumber,
      aiResponse,
      newSalary: clampedSalary,
    };
  }

  /**
   * Accepts an employment offer atomically across MongoDB collections.
   * - Enforces company capacity (fails if full)
   * - Prevents double acceptance
   * - Creates CompanyEmployee record
   * - Sets User.careerRole = 'EMPLOYEE'
   * - Increments Company.employeeCount
   * - Sets Application status to ACCEPTED
   * - Closes all other active applications of the user as WITHDRAWN
   */
  async acceptOffer(applicationId: string, userId: string): Promise<AcceptOfferResult> {
    const appObjectId = new Types.ObjectId(applicationId);
    const userObjectId = new Types.ObjectId(userId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to accept this offer.');
    }

    if (application.status === 'ACCEPTED') {
      throw AppError.conflict('This offer has already been accepted.');
    }

    if (application.currentStage !== 'OFFER' || application.status !== 'ACTIVE') {
      throw AppError.businessRuleViolation(
        `Cannot accept offer for application in stage '${application.currentStage}' with status '${application.status}'.`
      );
    }

    if (!application.offer) {
      throw AppError.businessRuleViolation('Application has no active offer to accept.');
    }

    const company = await CompanyModel.findById(application.companyId);
    if (!company) {
      throw AppError.notFound('Company not found.');
    }

    if (company.employeeCount >= company.maxEmployees) {
      throw AppError.businessRuleViolation(
        `Company has reached its maximum employee capacity (${company.maxEmployees} employees).`
      );
    }

    const job = await CompanyJobModel.findById(application.jobId);
    const domain = job?.domain ?? application.resumeAnalysisSnapshot.domainClassification;

    // DEMO mode guard: demo applications NEVER create real employees, mutate careerRole, or touch ledgers
    if (application.mode === 'DEMO') {
      application.status = 'ACCEPTED';
      application.offer.status = 'ACCEPTED';
      application.offer.acceptedAt = new Date();
      await application.save();

      logger.info('[FinalReviewOfferService] Demo offer accepted without mutating production employment', {
        applicationId: application._id.toString(),
      });

      return {
        success: true,
        application,
        employee: null,
      };
    }

    return await this.runWithTransaction(async (session) => {
      // 1. Atomic capacity check and increment
      const updatedCompany = await CompanyModel.findOneAndUpdate(
        {
          _id: application.companyId,
          employeeCount: { $lt: company.maxEmployees },
        },
        {
          $inc: { employeeCount: 1 },
        },
        { new: true, session }
      );

      if (!updatedCompany) {
        throw AppError.businessRuleViolation(
          `Company has reached its maximum employee capacity (${company.maxEmployees} employees).`
        );
      }

      // 2. Create CompanyEmployee record
      const createdEmployees = await CompanyEmployeeModel.create(
        [
          {
            userId: application.userId,
            companyId: application.companyId,
            domain,
            level: application.offer!.level,
            positionTitle: application.offer!.positionTitle,
            jobTitle: application.offer!.positionTitle,
            status: 'ACTIVE',
            salarySimulated: application.offer!.salarySimulated,
            startedAt: new Date(),
            history: [
              {
                status: 'ACTIVE',
                level: application.offer!.level,
                positionTitle: application.offer!.positionTitle,
                reason: 'Offer accepted',
                changedAt: new Date(),
              },
            ],
          },
        ],
        session ? { session } : undefined
      );

      const employee = createdEmployees[0];
      if (!employee) {
        throw AppError.internal('Failed to create company employee record.');
      }

      // 3. Update User careerRole
      await UserModel.updateOne(
        { _id: application.userId },
        { $set: { careerRole: 'EMPLOYEE' } },
        session ? { session } : undefined
      );

      // 4. Update Application status to ACCEPTED
      ApplicationStateMachine.acceptOffer(application, { result: 'OFFER_ACCEPTED' });
      application.offer!.status = 'ACCEPTED';
      application.offer!.acceptedAt = new Date();
      await application.save(session ? { session } : undefined);

      // 5. Close other active applications of user as WITHDRAWN
      await ApplicationModel.updateMany(
        {
          userId: application.userId,
          _id: { $ne: application._id },
          status: 'ACTIVE',
        },
        {
          $set: {
            status: 'WITHDRAWN',
            withdrawalReason: 'Accepted another job offer',
            updatedAt: new Date(),
          },
          $push: {
            stageHistory: {
              stage: 'WITHDRAWN',
              enteredAt: new Date(),
              exitedAt: new Date(),
              result: 'WITHDRAWN_ACCEPTED_OTHER_OFFER',
            },
          },
        },
        session ? { session } : undefined
      );

      logger.info(`[FinalReviewOfferService] Offer accepted successfully.`, {
        applicationId: application._id.toString(),
        userId: application.userId.toString(),
        companyId: application.companyId.toString(),
        employeeId: employee._id.toString(),
      });

      // Trigger HIRED notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'HIRED',
          title: 'Welcome Aboard!',
          message: `Congratulations! You have accepted the offer and are now an Employee at ${company.name}.`,
          link: `/employee`,
        });
      } catch (notifErr) {
        logger.warn('[FinalReviewOfferService] Failed to send hired notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }

      return {
        success: true,
        application,
        employee,
      };
    });
  }

  /**
   * Declines an employment offer.
   * Updates offer status to DECLINED and transitions application to WITHDRAWN (or REJECTED per config).
   */
  async declineOffer(
    applicationId: string,
    userId: string,
    reason?: string
  ): Promise<DeclineOfferResult> {
    const appObjectId = new Types.ObjectId(applicationId);
    const userObjectId = new Types.ObjectId(userId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to decline this offer.');
    }

    if (application.status !== 'ACTIVE' || application.currentStage !== 'OFFER') {
      throw AppError.businessRuleViolation(
        `Cannot decline offer for application in stage '${application.currentStage}' with status '${application.status}'.`
      );
    }

    const offer = application.offer;
    if (!offer || offer.status !== 'OFFERED') {
      throw AppError.businessRuleViolation('Application does not have an active open offer.');
    }

    offer.status = 'DECLINED';
    offer.declinedAt = new Date();
    offer.declineReason = reason || 'Candidate declined offer';

    const offerConfig = await configService.getOfferSettings();
    const declineStatus = offerConfig.declineStatus || 'WITHDRAWN';

    if (declineStatus === 'WITHDRAWN') {
      ApplicationStateMachine.withdraw(application, {
        reason: offer.declineReason,
        result: 'OFFER_DECLINED',
      });
    } else {
      ApplicationStateMachine.reject(application, {
        reason: offer.declineReason,
        result: 'OFFER_DECLINED',
      });
    }

    await application.save();

    logger.info(`[FinalReviewOfferService] Offer declined. Application status is '${application.status}'.`, {
      applicationId: application._id.toString(),
      declineStatus,
    });

    return {
      success: true,
      status: application.status,
      message: 'Offer declined successfully.',
    };
  }
}

export const finalReviewOfferService = new FinalReviewOfferService();
export const defaultFinalReviewOfferService = finalReviewOfferService;
