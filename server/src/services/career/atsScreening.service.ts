import { Types } from 'mongoose';
import {
  AIGateway,
  AIWorker,
  defaultAIGateway,
  defaultAIWorker,
  AIError,
} from '../../ai/index.js';
import type { IAIJobDocument } from '../../models/AIJob.js';
import { ApplicationModel, type IApplicationDocument } from '../../models/Application.js';
import { CompanyJobModel } from '../../models/CompanyJob.js';
import { ProfileModel } from '../../models/Profile.js';
import { ResumeAnalysisModel } from '../../models/ResumeAnalysis.js';
import { EvaluationModel, type IEvaluationDocument } from '../../models/Evaluation.js';
import { FeedbackModel, type IFeedbackDocument } from '../../models/Feedback.js';
import { notificationService } from '../notification/notification.service.js';
import { configService } from '../config/config.service.js';
import { ApplicationStateMachine } from './applicationStateMachine.js';
import {
  atsScreeningOutputSchema,
  atsScreeningJsonSchema,
  type AtsScreeningOutput,
} from '../../schemas/atsScreening.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const ATS_SCREENING_SYSTEM_PROMPT = `You are CorpVerse's automated ATS Screening Bot.
Your responsibility is to screen candidate applications against job requirements with rigorous, objective, and constructive evaluation.

CRITICAL GROUNDING RULES:
1. Every strength, weakness, and improvement suggestion MUST strictly reference the candidate's actual verified resume analysis and profile.
2. DO NOT fabricate qualifications, experience, or attributes not present in the candidate data.
3. DO NOT critique tools, libraries, or concepts that have no relevance to either the job requirements or the candidate's stated background.
4. Provide structured, fair, and actionable critique so unsuccessful candidates understand exactly how to strengthen their candidacy.

SCORING CRITERIA (0-100 matchScore):
- Domain Relevance (40%): Alignment between candidate background and job engineering domain.
- Technical Skill Match (35%): Overlap between verified skills and required job skills.
- Project / Experience Depth (15%): Demonstrated practical depth and years of experience.
- Clarity & Presentation (10%): Quality and coherence of experience descriptions.

OUTPUT FORMAT:
Return valid JSON matching the provided schema. The recommendation field must be 'PASS' if matchScore >= 70, or 'FAIL' if matchScore < 70. Note: The backend system is authoritative and will enforce the final progression decision based on platform configuration.`;

export class AtsScreeningService {
  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly aiWorker: AIWorker = defaultAIWorker
  ) {
    this.registerWorkerHooks();
  }

  /**
   * Registers custom Zod validation and completion handlers with AIWorker
   */
  private registerWorkerHooks(): void {
    const taskTypes = ['ATS_SCREEN', 'ATS_EVALUATION'] as const;

    for (const taskType of taskTypes) {
      // 1. Strict Zod validation
      this.aiWorker.registerValidator(taskType, (_job, response) => {
        if (!response.structuredData) {
          throw new AIError(
            `AI provider returned no structured data for ${taskType}`,
            'PROVIDER_ERROR'
          );
        }

        const parseResult = atsScreeningOutputSchema.safeParse(response.structuredData);
        if (!parseResult.success) {
          const issuesMsg = parseResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          logger.warn(`[AtsScreeningService] AI output failed strict Zod validation: ${issuesMsg}`);
          throw new AIError(
            `Zod schema validation failed for ${taskType}: ${issuesMsg}`,
            'PROVIDER_ERROR'
          );
        }
      });

      // 2. Completion handler: evaluate score, transition state machine, persist evaluations/feedback
      this.aiWorker.registerHandler(taskType, async (job) => {
        await this.handleJobCompletion(job);
      });

      // 3. State change handler: queue resilience when providers are degraded or waiting
      this.aiWorker.registerStateChangeHandler(taskType, async (job) => {
        await this.handleJobStateChange(job);
      });
    }
  }

  /**
   * Submits an ATS screening AI job for an application.
   * If application is in APPLIED stage, advances to ATS_SCREENING first.
   */
  public async enqueueAtsScreening(
    applicationId: string | Types.ObjectId
  ): Promise<{ jobId: string; application: IApplicationDocument }> {
    const appObjectId = typeof applicationId === 'string' ? new Types.ObjectId(applicationId) : applicationId;

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.status !== 'ACTIVE') {
      throw AppError.businessRuleViolation(
        `Cannot screen application with non-active status '${application.status}'.`
      );
    }

    // Advance to ATS_SCREENING if currently APPLIED
    if (application.currentStage === 'APPLIED') {
      ApplicationStateMachine.advanceStage(application, 'ATS_SCREENING', {
        result: 'ENQUEUED_FOR_ATS_SCREENING',
      });
      await application.save();
    } else if (application.currentStage !== 'ATS_SCREENING') {
      throw AppError.businessRuleViolation(
        `Cannot start ATS screening from stage '${application.currentStage}'. Expected 'APPLIED' or 'ATS_SCREENING'.`
      );
    }

    // 1. Retrieve job details
    const job = await CompanyJobModel.findById(application.jobId);
    if (!job) {
      throw AppError.notFound('Target job not found for application screening.');
    }

    // 2. Retrieve candidate profile and resume analysis
    const profile = await ProfileModel.findOne({ userId: application.userId });
    const resumeAnalysis = await ResumeAnalysisModel.findById(application.resumeAnalysisId);

    // 3. Construct grounded prompt context
    const candidateContext = {
      profile: {
        displayName: profile?.displayName ?? application.resumeAnalysisSnapshot.name ?? 'Candidate',
        domain: profile?.domain ?? application.resumeAnalysisSnapshot.domainClassification,
        skills: profile?.skills ?? application.resumeAnalysisSnapshot.parsedSkills,
        bio: profile?.bio ?? '',
        projects: profile?.projects ?? application.resumeAnalysisSnapshot.projects ?? [],
        certifications: profile?.certifications ?? application.resumeAnalysisSnapshot.certifications ?? [],
        githubUrl: profile?.githubUrl ?? '',
        linkedinUrl: profile?.linkedinUrl ?? '',
      },
      resumeAnalysisSnapshot: application.resumeAnalysisSnapshot,
      detailedResumeAnalysis: resumeAnalysis
        ? {
            parsedSkills: resumeAnalysis.parsedSkills,
            yearsOfExperience: resumeAnalysis.yearsOfExperience,
            domainClassification: resumeAnalysis.domainClassification,
            extractedSummary: resumeAnalysis.extractedSummary,
            workHistory: resumeAnalysis.workHistory,
            education: resumeAnalysis.education,
            projects: resumeAnalysis.projects,
            certifications: resumeAnalysis.certifications,
          }
        : null,
    };

    const jobContext = {
      title: job.title,
      description: job.description,
      domain: job.domain,
      minLevel: job.minLevel,
      maxLevel: job.maxLevel,
      targetLevel: job.targetLevel,
      requiredSkills: job.requiredSkills,
    };

    const userInput = JSON.stringify(
      {
        jobRequisition: jobContext,
        candidateResumeAndProfile: candidateContext,
      },
      null,
      2
    );

    // 4. Submit AI job via AIGateway
    const pool = application.mode === 'DEMO' ? 'DEMO' : 'PIPELINE';
    const idempotencyKey = `ats-screen-${application._id.toString()}-${Date.now()}`;

    const jobId = await this.aiGateway.submit(
      {
        taskType: 'ATS_SCREEN',
        systemInstruction: ATS_SCREENING_SYSTEM_PROMPT,
        userInput,
        context: {
          applicationId: application._id.toString(),
          jobId: job._id.toString(),
          userId: application.userId.toString(),
        },
        outputSchema: atsScreeningJsonSchema,
      },
      {
        pool,
        requestorReference: application._id.toString(),
        idempotencyKey,
      }
    );

    if (Types.ObjectId.isValid(jobId)) {
      application.aiJobId = new Types.ObjectId(jobId);
    }
    await application.save();

    logger.info('[AtsScreeningService] ATS screening AI job submitted', {
      applicationId: application._id.toString(),
      jobId,
      pool,
    });

    return { jobId, application };
  }

  /**
   * Finalizes ATS screening when an AIJob completes.
   * Authoritative backend decision: checks matchScore >= PlatformConfig.ats.passingScore.
   */
  public async handleJobCompletion(job: IAIJobDocument): Promise<void> {
    const requestorRef = job.requestorReference;
    const query: Record<string, unknown> =
      requestorRef && Types.ObjectId.isValid(requestorRef)
        ? { $or: [{ aiJobId: job._id }, { _id: new Types.ObjectId(requestorRef) }] }
        : { aiJobId: job._id };

    const application = await ApplicationModel.findOne(query);

    if (!application) {
      logger.error(`[AtsScreeningService] No Application found for completed AIJob ${job._id.toString()}`);
      return;
    }

    const structured = job.result?.structuredData;
    if (!structured) {
      logger.error(`[AtsScreeningService] Completed AIJob ${job._id.toString()} has empty structuredData`);
      return;
    }

    const parseResult = atsScreeningOutputSchema.safeParse(structured);
    if (!parseResult.success) {
      logger.error(
        `[AtsScreeningService] AI output data failed schema parsing for AIJob ${job._id.toString()}: ${parseResult.error.message}`
      );
      return;
    }

    await this.applyAtsEvaluation(application, parseResult.data);
  }

  /**
   * Handles state changes such as WAITING_FOR_PROVIDER or degraded health.
   * Ensures the application remains in ATS_SCREENING (waiting in queue).
   */
  public async handleJobStateChange(job: IAIJobDocument): Promise<void> {
    if (job.status === 'WAITING_FOR_PROVIDER') {
      logger.warn(
        `[AtsScreeningService] AIJob ${job._id.toString()} waiting for provider. Stage ATS_SCREENING is queued.`
      );
    } else if (job.status === 'FAILED') {
      logger.error(
        `[AtsScreeningService] AIJob ${job._id.toString()} failed. Error: ${job.error?.message ?? 'unknown'}`
      );
    }
  }

  /**
   * Applies the ATS evaluation authoritatively to the application.
   * Clamps score, decides pass/fail based on PlatformConfig, persists Evaluation and Feedback.
   */
  public async applyAtsEvaluation(
    application: IApplicationDocument,
    output: AtsScreeningOutput
  ): Promise<{ evaluation: IEvaluationDocument; feedback: IFeedbackDocument | null; passed: boolean }> {
    // 1. Retrieve authoritative passing threshold from PlatformConfig
    const atsConfig = await configService.getAtsConfig();
    const passingScore = atsConfig.passingScore; // default: 70

    // 2. Validate and clamp match score (0-100)
    const rawScore = Number(output.matchScore);
    const clampedScore = Math.max(0, Math.min(100, Math.round(Number.isFinite(rawScore) ? rawScore : 0)));

    // 3. Authoritative decision: Backend decides, AI only recommends
    const passed = clampedScore >= passingScore;

    logger.info('[AtsScreeningService] Applying ATS evaluation', {
      applicationId: application._id.toString(),
      clampedScore,
      passingScore,
      aiRecommendation: output.recommendation,
      backendDecision: passed ? 'PASS' : 'FAIL',
    });

    const summaryText = passed
      ? `Candidate passed ATS screening with score ${clampedScore}/100 (Threshold: ${passingScore}). Matched skills: ${output.matchedSkills.join(', ') || 'None'}.`
      : `Candidate did not meet ATS screening threshold (Score: ${clampedScore}/100, Required: ${passingScore}). Missing skills: ${output.missingSkills.join(', ') || 'None'}.`;

    // 4. Persist in evaluations collection per Spec Section 26.15
    const evaluation = await EvaluationModel.create({
      applicationId: application._id,
      stage: 'ATS_SCREENING',
      score: clampedScore,
      scoreBreakdown: {
        matchedSkills: output.matchedSkills,
        missingSkills: output.missingSkills,
        strengths: output.strengths,
        weaknesses: output.weaknesses,
        improvementSuggestions: output.improvementSuggestions,
        aiRecommendation: output.recommendation,
        passingThreshold: passingScore,
      },
      summary: summaryText,
      createdAt: new Date(),
    });

    let feedbackDoc: IFeedbackDocument | null = null;

    // 5. Update Application record and execute state transition
    application.atsScore = clampedScore;

    if (passed) {
      // Advance to SCREENING stage
      ApplicationStateMachine.advanceStage(application, 'SCREENING', {
        result: `PASSED_ATS_SCORE_${clampedScore}`,
      });
      application.atsFeedback = summaryText;
      await application.save();

      // Trigger stage advanced notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'STAGE_ADVANCED',
          title: 'Stage Advanced',
          message: 'Your application has passed ATS screening and advanced to Screening.',
          link: `/applications/${application._id}`,
        });
      } catch (notifErr) {
        logger.warn('[AtsScreeningService] Failed to send stage advanced notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }
    } else {
      // Create feedback record per Spec Section 26.16
      feedbackDoc = await FeedbackModel.create({
        applicationId: application._id,
        userId: application.userId,
        rejectionStage: 'ATS_SCREENING',
        strengths: output.strengths,
        weaknesses: output.weaknesses,
        actionableSuggestions: output.improvementSuggestions,
        createdAt: new Date(),
      });

      const detailedFeedbackFormatted = [
        `ATS Screening Feedback (Score: ${clampedScore}/${passingScore})`,
        '',
        'Strengths:',
        ...output.strengths.map((s) => `- ${s}`),
        '',
        'Areas for Improvement:',
        ...output.weaknesses.map((w) => `- ${w}`),
        '',
        'Actionable Suggestions:',
        ...output.improvementSuggestions.map((s) => `- ${s}`),
      ].join('\n');

      application.atsFeedback = detailedFeedbackFormatted;

      // Reject application via state machine
      ApplicationStateMachine.reject(application, {
        reason: `Did not meet the ATS threshold score of ${passingScore} (Scored: ${clampedScore})`,
        result: `REJECTED_ATS_SCORE_${clampedScore}`,
      });
      await application.save();

      // Trigger rejected with feedback link notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'APPLICATION_REJECTED',
          title: 'Application Update',
          message: 'Your application was not selected after ATS screening. Constructive feedback is available.',
          link: `/applications/${application._id}/feedback`,
        });
      } catch (notifErr) {
        logger.warn('[AtsScreeningService] Failed to send rejection notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }
    }

    return {
      evaluation,
      feedback: feedbackDoc,
      passed,
    };
  }

  /**
   * Retrieves evaluations and feedback for an application
   */
  public async getEvaluationAndFeedback(
    applicationId: string | Types.ObjectId
  ): Promise<{ evaluations: IEvaluationDocument[]; feedback: IFeedbackDocument | null }> {
    const appObjectId = typeof applicationId === 'string' ? new Types.ObjectId(applicationId) : applicationId;

    const [evaluations, feedback] = await Promise.all([
      EvaluationModel.find({ applicationId: appObjectId }).sort({ createdAt: -1 }),
      FeedbackModel.findOne({ applicationId: appObjectId }),
    ]);

    return { evaluations, feedback };
  }
}

export const atsScreeningService = new AtsScreeningService();
