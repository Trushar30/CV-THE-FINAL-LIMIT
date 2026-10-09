import { Types } from 'mongoose';
import {
  AIGateway,
  AIWorker,
  defaultAIGateway,
  defaultAIWorker,
  AIError,
} from '../../ai/index.js';
import { ApplicationModel, type IApplicationDocument } from '../../models/Application.js';
import { CompanyJobModel } from '../../models/CompanyJob.js';
import { ProfileModel } from '../../models/Profile.js';
import { ResumeAnalysisModel } from '../../models/ResumeAnalysis.js';
import { EvaluationModel } from '../../models/Evaluation.js';
import { FeedbackModel } from '../../models/Feedback.js';
import { notificationService } from '../notification/notification.service.js';
import {
  InterviewModel,
  type IInterviewDocument,
  type ChatStage,
  type QuestionDifficulty,
} from '../../models/Interview.js';
import { QuestionModel, type IQuestionDocument } from '../../models/Question.js';
import { AnswerModel, type IAnswerDocument } from '../../models/Answer.js';
import { configService } from '../config/config.service.js';
import { ApplicationStateMachine } from './applicationStateMachine.js';
import {
  stageQuestionOutputSchema,
  stageQuestionJsonSchema,
  stageAnswerEvaluationOutputSchema,
  stageAnswerEvaluationJsonSchema,
  type StageAnswerEvaluationOutput,
  stageRejectionFeedbackOutputSchema,
  stageRejectionFeedbackJsonSchema,
  type StageRejectionFeedbackOutput,
} from '../../schemas/stageChat.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface StageSessionState {
  interview: IInterviewDocument;
  currentQuestion?: IQuestionDocument;
  previousAnswers: Array<{
    sequenceNumber: number;
    question: string;
    answer: string;
    score?: number;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  isCompleted: boolean;
  isWaitingAI: boolean;
}

export interface PostAnswerResult {
  evaluation: StageAnswerEvaluationOutput;
  nextQuestion?: IQuestionDocument;
  isCompleted: boolean;
  passed?: boolean;
  overallScore?: number;
  nextStage?: string;
  feedback?: StageRejectionFeedbackOutput;
}

const MAX_HISTORY_CHAR_BUDGET = 8000; // ~2000 tokens

export class StageEngineService {
  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly aiWorker: AIWorker = defaultAIWorker
  ) {
    this.registerWorkerHooks();
  }

  private registerWorkerHooks(): void {
    // 1. Question Generation Validator
    this.aiWorker.registerValidator('INTERVIEW_QUESTION', (_job, response) => {
      if (!response.structuredData) {
        throw new AIError('AI provider returned no structured data for INTERVIEW_QUESTION', 'PROVIDER_ERROR');
      }
      const parsed = stageQuestionOutputSchema.safeParse(response.structuredData);
      if (!parsed.success) {
        throw new AIError(`Zod validation failed for INTERVIEW_QUESTION: ${parsed.error.message}`, 'PROVIDER_ERROR');
      }
    });

    // 2. Answer Evaluation Validator
    this.aiWorker.registerValidator('INTERVIEW_EVALUATION', (_job, response) => {
      if (!response.structuredData) {
        throw new AIError('AI provider returned no structured data for INTERVIEW_EVALUATION', 'PROVIDER_ERROR');
      }
      const parsed = stageAnswerEvaluationOutputSchema.safeParse(response.structuredData);
      if (!parsed.success) {
        throw new AIError(`Zod validation failed for INTERVIEW_EVALUATION: ${parsed.error.message}`, 'PROVIDER_ERROR');
      }
    });

    // 3. Stage Feedback Validator
    this.aiWorker.registerValidator('STAGE_FEEDBACK', (_job, response) => {
      if (!response.structuredData) {
        throw new AIError('AI provider returned no structured data for STAGE_FEEDBACK', 'PROVIDER_ERROR');
      }
      const parsed = stageRejectionFeedbackOutputSchema.safeParse(response.structuredData);
      if (!parsed.success) {
        throw new AIError(`Zod validation failed for STAGE_FEEDBACK: ${parsed.error.message}`, 'PROVIDER_ERROR');
      }
    });
  }

  /**
   * Trims conversation history to remain within token budget
   */
  public trimHistory(
    history: Array<{ role: 'assistant' | 'user'; content: string }>
  ): Array<{ role: 'assistant' | 'user'; content: string }> {
    let totalChars = history.reduce((sum, item) => sum + item.content.length, 0);
    if (totalChars <= MAX_HISTORY_CHAR_BUDGET) {
      return history;
    }

    // Keep the most recent items while fitting into char budget
    const trimmed: Array<{ role: 'assistant' | 'user'; content: string }> = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (!item) continue;
      if (totalChars > MAX_HISTORY_CHAR_BUDGET && trimmed.length >= 2) {
        totalChars -= item.content.length;
        continue;
      }
      trimmed.unshift(item);
    }
    return trimmed;
  }

  /**
   * Retrieves or initializes the chat session for an application in its current chat stage
   */
  public async getOrInitStageSession(
    applicationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    options?: {
      totalQuestions?: number;
      difficulty?: QuestionDifficulty;
      isStaffOverride?: boolean;
    }
  ): Promise<StageSessionState> {
    const appObjectId = typeof applicationId === 'string' ? new Types.ObjectId(applicationId) : applicationId;
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (!options?.isStaffOverride && application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to access this stage session.');
    }

    const currentStage = application.currentStage;
    if (currentStage !== 'SCREENING' && currentStage !== 'ASSESSMENT' && currentStage !== 'INTERVIEW') {
      throw AppError.businessRuleViolation(
        `Application is currently in stage '${currentStage}', which is not a chat-based stage.`
      );
    }

    // Find existing interview session for this stage
    const existingInterview = await InterviewModel.findOne({
      applicationId: application._id,
      stage: currentStage,
    });

    const interview: IInterviewDocument =
      existingInterview ?? (await this.createInterviewSession(application, currentStage, options));

    // Load questions and answers
    const questions = await QuestionModel.find({ interviewId: interview._id }).sort({ sequenceNumber: 1 });
    const answers = await AnswerModel.find({ interviewId: interview._id });
    const answerMap = new Map<string, IAnswerDocument>();
    for (const a of answers) {
      answerMap.set(a.questionId.toString(), a);
    }

    // Assemble previous answers
    const previousAnswers = [];
    for (const q of questions) {
      const ans = answerMap.get(q._id.toString());
      if (ans) {
        previousAnswers.push({
          sequenceNumber: q.sequenceNumber,
          question: q.content,
          answer: ans.candidateResponse,
          score: ans.score,
          strengths: ans.strengths,
          weaknesses: ans.weaknesses,
        });
      }
    }

    // If session is completed
    if (interview.status === 'COMPLETED') {
      return {
        interview,
        previousAnswers,
        isCompleted: true,
        isWaitingAI: false,
      };
    }

    // Find current active question (next unanswered question)
    let currentQuestion: IQuestionDocument | undefined = questions.find((q) => !answerMap.has(q._id.toString()));

    // If no unanswered question exists and we have not reached totalQuestions, generate next question
    if (!currentQuestion && questions.length < interview.totalQuestions) {
      const nextSequence = questions.length + 1;
      currentQuestion = await this.generateNextQuestion(application, interview, nextSequence, previousAnswers);
    }

    return {
      interview,
      currentQuestion,
      previousAnswers,
      isCompleted: false,
      isWaitingAI: interview.status === 'WAITING_AI',
    };
  }

  /**
   * Creates an interview record configured per stage and mode
   */
  private async createInterviewSession(
    application: IApplicationDocument,
    stage: ChatStage,
    options?: { totalQuestions?: number; difficulty?: QuestionDifficulty }
  ): Promise<IInterviewDocument> {
    const job = await CompanyJobModel.findById(application.jobId);
    if (!job) {
      throw AppError.notFound('Target job not found for interview session.');
    }

    const stageSettings = await configService.getStageSettings(stage);
    const isDemo = application.mode === 'DEMO';

    const totalQuestions =
      options?.totalQuestions ??
      (isDemo ? stageSettings.demoQuestionCount : stageSettings.questionCount);
    const difficulty =
      options?.difficulty ??
      ((isDemo ? stageSettings.demoDifficulty : stageSettings.difficulty) as QuestionDifficulty);
    const passingScore = stageSettings.passingScore;

    const interview = await InterviewModel.create({
      applicationId: application._id,
      userId: application.userId,
      companyId: application.companyId,
      domain: job.domain,
      stage,
      status: 'IN_PROGRESS',
      currentQuestionIndex: 0,
      totalQuestions,
      passingScore,
      difficulty,
      mode: application.mode,
      startedAt: new Date(),
    });

    return interview;
  }

  /**
   * Generates next question dynamically using AI
   */
  public async generateNextQuestion(
    application: IApplicationDocument,
    interview: IInterviewDocument,
    sequenceNumber: number,
    previousTurns: Array<{ question: string; answer: string; score?: number }>
  ): Promise<IQuestionDocument> {
    const job = await CompanyJobModel.findById(application.jobId);
    const profile = await ProfileModel.findOne({ userId: application.userId });
    const resumeAnalysis = await ResumeAnalysisModel.findById(application.resumeAnalysisId);

    // Format trimmed prior conversation context
    const conversationHistory = previousTurns.flatMap((t) => [
      { role: 'assistant' as const, content: `Q${t.question}` },
      { role: 'user' as const, content: `A: ${t.answer}` },
    ]);
    const trimmedHistory = this.trimHistory(conversationHistory);

    const systemInstruction = `You are CorpVerse's automated Hiring AI for the '${interview.stage}' stage in domain '${interview.domain}'.
Target Difficulty: ${interview.difficulty}.
Current Question: #${sequenceNumber} of ${interview.totalQuestions}.

Generate the next technical/screening question tailored to the job requisition and candidate background.
Grounding requirements:
1. Ground the question in the candidate's verified skills (${(profile?.skills ?? application.resumeAnalysisSnapshot.parsedSkills).join(', ')}) and projects.
2. Advance conversation naturally based on prior answers. Do not repeat topics already covered.
3. Output valid JSON matching schema: { question, type, difficulty, expectedPoints }.`;

    const userInput = JSON.stringify(
      {
        jobTitle: job?.title ?? 'Software Engineer',
        domain: interview.domain,
        targetDifficulty: interview.difficulty,
        sequenceNumber,
        candidateSummary: resumeAnalysis?.extractedSummary ?? application.resumeAnalysisSnapshot.extractedSummary,
        verifiedSkills: profile?.skills ?? application.resumeAnalysisSnapshot.parsedSkills,
        priorQAHistory: trimmedHistory,
      },
      null,
      2
    );

    const pool = interview.mode === 'DEMO' ? 'DEMO' : 'PIPELINE';
    const directResult = await this.aiGateway.execute(
      {
        taskType: 'INTERVIEW_QUESTION',
        systemInstruction,
        userInput,
        outputSchema: stageQuestionJsonSchema,
        temperature: 0.3,
      },
      { pool }
    );

    if (!directResult.success || !directResult.structuredData) {
      throw new AIError('Failed to generate stage question from AI provider', 'PROVIDER_ERROR');
    }

    const validated = stageQuestionOutputSchema.parse(directResult.structuredData);

    const questionDoc = await QuestionModel.create({
      interviewId: interview._id,
      sequenceNumber,
      content: validated.question,
      type: validated.type,
      difficulty: validated.difficulty as QuestionDifficulty,
      expectedPoints: validated.expectedPoints,
      createdAt: new Date(),
    });

    interview.currentQuestionIndex = sequenceNumber - 1;
    await interview.save();

    return questionDoc;
  }

  /**
   * Submits candidate's answer, evaluates it with AI, and returns next question or final stage outcome
   */
  public async submitAnswer(
    applicationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    candidateResponse: string,
    questionSequence?: number,
    options?: { isStaffOverride?: boolean }
  ): Promise<PostAnswerResult> {
    const appObjectId = typeof applicationId === 'string' ? new Types.ObjectId(applicationId) : applicationId;
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (!options?.isStaffOverride && application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to submit answers for this application.');
    }

    if (application.status !== 'ACTIVE') {
      throw AppError.businessRuleViolation(`Cannot submit answers for application with status '${application.status}'.`);
    }

    const currentStage = application.currentStage;
    if (currentStage !== 'SCREENING' && currentStage !== 'ASSESSMENT' && currentStage !== 'INTERVIEW') {
      throw AppError.businessRuleViolation(
        `Application is in stage '${currentStage}', which does not accept chat answers.`
      );
    }

    const interview = await InterviewModel.findOne({
      applicationId: application._id,
      stage: currentStage,
    });

    if (!interview) {
      throw AppError.notFound(`No active interview session found for stage '${currentStage}'.`);
    }

    if (interview.status === 'COMPLETED') {
      throw AppError.businessRuleViolation('This stage session has already been completed.');
    }

    if (interview.status === 'WAITING_AI') {
      throw AppError.conflict('An evaluation is currently in progress. Please wait.');
    }

    // 1. Identify active question
    const questions = await QuestionModel.find({ interviewId: interview._id }).sort({ sequenceNumber: 1 });
    const existingAnswers = await AnswerModel.find({ interviewId: interview._id });
    const answeredQuestionIds = new Set(existingAnswers.map((a) => a.questionId.toString()));

    const currentQuestion = questions.find((q) => !answeredQuestionIds.has(q._id.toString()));
    if (!currentQuestion) {
      throw AppError.businessRuleViolation('No active question waiting for response.');
    }

    // 2. Prevent skipping and out-of-order requests
    if (questionSequence && questionSequence !== currentQuestion.sequenceNumber) {
      throw AppError.businessRuleViolation(
        `Out of order answer submission. Expected answer for question #${currentQuestion.sequenceNumber}, got #${questionSequence}.`
      );
    }

    // 3. Prevent answer resubmission
    const alreadyAnswered = await AnswerModel.findOne({ questionId: currentQuestion._id });
    if (alreadyAnswered) {
      throw AppError.conflict('An answer has already been submitted for this question.');
    }

    // 4. Evaluate candidate response with AI
    const pool = interview.mode === 'DEMO' ? 'DEMO' : 'PIPELINE';
    const evalSystemInstruction = `You are CorpVerse's automated evaluator for stage '${interview.stage}'.
Evaluate the candidate's answer strictly against the expected key points and criteria.
Output JSON schema: { score: number 0-100, strengths: string[], weaknesses: string[], notes: string }.`;

    const evalInput = JSON.stringify(
      {
        question: currentQuestion.content,
        questionType: currentQuestion.type,
        difficulty: currentQuestion.difficulty,
        expectedPoints: currentQuestion.expectedPoints,
        candidateResponse,
      },
      null,
      2
    );

    const evalResult = await this.aiGateway.execute(
      {
        taskType: 'INTERVIEW_EVALUATION',
        systemInstruction: evalSystemInstruction,
        userInput: evalInput,
        outputSchema: stageAnswerEvaluationJsonSchema,
        temperature: 0.2,
      },
      { pool }
    );

    if (!evalResult.success || !evalResult.structuredData) {
      throw new AIError('Failed to evaluate answer from AI provider', 'PROVIDER_ERROR');
    }

    const evaluation = stageAnswerEvaluationOutputSchema.parse(evalResult.structuredData);
    const clampedScore = Math.max(0, Math.min(100, Math.round(evaluation.score)));

    // 5. Store answer in answers collection
    await AnswerModel.create({
      questionId: currentQuestion._id,
      interviewId: interview._id,
      candidateResponse,
      score: clampedScore,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      notes: evaluation.notes,
      submittedAt: new Date(),
      evaluatedAt: new Date(),
    });

    // 6. Check if more questions remaining
    const allAnswersNow = await AnswerModel.find({ interviewId: interview._id });
    const isCompleted = allAnswersNow.length >= interview.totalQuestions;

    if (!isCompleted) {
      // Generate next question
      const previousTurns = [];
      const updatedAnswersMap = new Map(
        allAnswersNow.map((a) => [a.questionId ? a.questionId.toString() : '', a])
      );
      for (const q of questions) {
        const a = updatedAnswersMap.get(q._id.toString());
        if (a) {
          previousTurns.push({ question: q.content, answer: a.candidateResponse, score: a.score });
        }
      }

      const nextSequence = questions.length + 1;
      const nextQuestion = await this.generateNextQuestion(application, interview, nextSequence, previousTurns);

      return {
        evaluation,
        nextQuestion,
        isCompleted: false,
      };
    }

    // 7. Final Stage Resolution (Backend calculates authoritatively)
    return await this.finalizeStageOutcome(application, interview, allAnswersNow, evaluation);
  }

  /**
   * Finalizes the stage outcome authoritatively: calculates average score, checks PlatformConfig,
   * advances stage or rejects application with AI feedback.
   */
  private async finalizeStageOutcome(
    application: IApplicationDocument,
    interview: IInterviewDocument,
    answers: IAnswerDocument[],
    lastEvaluation: StageAnswerEvaluationOutput
  ): Promise<PostAnswerResult> {
    const sumScore = answers.reduce((acc, a) => acc + (a.score ?? 0), 0);
    const averageScore = Math.max(0, Math.min(100, Math.round(sumScore / answers.length)));
    const passed = averageScore >= interview.passingScore;

    interview.overallScore = averageScore;
    interview.status = 'COMPLETED';
    interview.completedAt = new Date();
    await interview.save();

    // Persist in evaluations collection
    await EvaluationModel.create({
      applicationId: application._id,
      stage: interview.stage,
      score: averageScore,
      scoreBreakdown: {
        answers: answers.map((a) => ({
          questionId: a.questionId,
          score: a.score,
          strengths: a.strengths,
          weaknesses: a.weaknesses,
        })),
        totalQuestions: interview.totalQuestions,
        passingThreshold: interview.passingScore,
      },
      summary: `Completed ${interview.stage} stage with average score ${averageScore}/100 (Threshold: ${interview.passingScore}). Result: ${passed ? 'PASSED' : 'FAILED'}.`,
      createdAt: new Date(),
    });

    if (passed) {
      // Determine next sequential pipeline stage
      let nextStage: 'ASSESSMENT' | 'INTERVIEW' | 'FINAL_REVIEW';
      if (interview.stage === 'SCREENING') {
        nextStage = 'ASSESSMENT';
      } else if (interview.stage === 'ASSESSMENT') {
        nextStage = 'INTERVIEW';
      } else {
        nextStage = 'FINAL_REVIEW';
      }

      ApplicationStateMachine.advanceStage(application, nextStage, {
        result: `PASSED_${interview.stage}_SCORE_${averageScore}`,
      });
      await application.save();

      // Trigger stage advanced notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'STAGE_ADVANCED',
          title: 'Stage Advanced',
          message: `Congratulations! You passed the ${interview.stage} stage and advanced to ${nextStage}.`,
          link: `/applications/${application._id}`,
        });
      } catch (notifErr) {
        logger.warn('[StageEngine] Failed to send stage advanced notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }

      logger.info(`[StageEngine] Stage ${interview.stage} passed`, {
        applicationId: application._id.toString(),
        averageScore,
        nextStage,
      });

      return {
        evaluation: lastEvaluation,
        isCompleted: true,
        passed: true,
        overallScore: averageScore,
        nextStage,
      };
    } else {
      // Stage failure -> Generate structured rejection feedback with AI
      const feedback = await this.generateRejectionFeedback(application, interview, answers, averageScore);

      await FeedbackModel.create({
        applicationId: application._id,
        userId: application.userId,
        rejectionStage: interview.stage,
        strengths: answers.flatMap((a) => a.strengths ?? []).slice(0, 5),
        weaknesses: [
          ...answers.flatMap((a) => a.weaknesses ?? []).slice(0, 5),
          ...feedback.skillsToWorkOn,
        ],
        actionableSuggestions: [...feedback.whatToImprove, ...feedback.whatToAdd],
        createdAt: new Date(),
      });

      // Reject application via state machine
      ApplicationStateMachine.reject(application, {
        reason: `Did not meet passing score of ${interview.passingScore} for ${interview.stage} (Scored: ${averageScore})`,
        result: `FAILED_${interview.stage}_SCORE_${averageScore}`,
      });
      application.atsFeedback = feedback.summary;
      await application.save();

      // Trigger rejected with feedback link notification
      try {
        await notificationService.create({
          userId: application.userId,
          type: 'APPLICATION_REJECTED',
          title: 'Application Update',
          message: `Your application was not selected after the ${interview.stage} stage. Constructive feedback is available.`,
          link: `/applications/${application._id}/feedback`,
        });
      } catch (notifErr) {
        logger.warn('[StageEngine] Failed to send rejection notification', {
          applicationId: application._id.toString(),
          error: (notifErr as Error).message,
        });
      }

      logger.info(`[StageEngine] Stage ${interview.stage} failed`, {
        applicationId: application._id.toString(),
        averageScore,
        threshold: interview.passingScore,
      });

      return {
        evaluation: lastEvaluation,
        isCompleted: true,
        passed: false,
        overallScore: averageScore,
        feedback,
      };
    }
  }

  /**
   * Generates detailed, actionable rejection feedback via AI
   */
  private async generateRejectionFeedback(
    application: IApplicationDocument,
    interview: IInterviewDocument,
    answers: IAnswerDocument[],
    averageScore: number
  ): Promise<StageRejectionFeedbackOutput> {
    const pool = interview.mode === 'DEMO' ? 'DEMO' : 'PIPELINE';
    const systemInstruction = `You are CorpVerse's diagnostic career coach.
The candidate did not clear the '${interview.stage}' stage (scored ${averageScore}/100, threshold ${interview.passingScore}).
Generate actionable, constructive feedback detailing what to improve, what to add, and specific skills to work on.
Output JSON schema: { whatToImprove: string[], whatToAdd: string[], skillsToWorkOn: string[], summary: string }.`;

    const feedbackInput = JSON.stringify(
      {
        stage: interview.stage,
        domain: interview.domain,
        candidateName: application.resumeAnalysisSnapshot.name,
        answersPerformance: answers.map((a) => ({
          score: a.score,
          strengths: a.strengths,
          weaknesses: a.weaknesses,
          notes: a.notes,
        })),
      },
      null,
      2
    );

    const feedbackResult = await this.aiGateway.execute(
      {
        taskType: 'STAGE_FEEDBACK',
        systemInstruction,
        userInput: feedbackInput,
        outputSchema: stageRejectionFeedbackJsonSchema,
        temperature: 0.3,
      },
      { pool }
    );

    if (!feedbackResult.success || !feedbackResult.structuredData) {
      return {
        whatToImprove: ['Review key domain fundamentals and practice technical articulation.'],
        whatToAdd: ['Add practical projects demonstrating depth in required technical competencies.'],
        skillsToWorkOn: ['Core engineering problem solving and clear communication.'],
        summary: `Candidate completed ${interview.stage} with score ${averageScore}, below passing threshold ${interview.passingScore}.`,
      };
    }

    return stageRejectionFeedbackOutputSchema.parse(feedbackResult.structuredData);
  }
}

export const stageEngineService = new StageEngineService();
