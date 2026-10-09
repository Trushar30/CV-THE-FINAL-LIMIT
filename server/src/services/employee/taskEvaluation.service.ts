import { Types } from 'mongoose';
import {
  AIGateway,
  AIWorker,
  defaultAIGateway,
  defaultAIWorker,
  AIError,
} from '../../ai/index.js';
import type { IAIJobDocument } from '../../models/AIJob.js';
import { EmployeeTaskModel, type IEmployeeTaskDocument } from '../../models/EmployeeTask.js';
import { TaskSubmissionModel, type ITaskSubmissionDocument } from '../../models/TaskSubmission.js';
import { PerformanceRecordModel, type IPerformanceRecordDocument } from '../../models/PerformanceRecord.js';
import { CompanyModel } from '../../models/Company.js';
import { CompanyEmployeeModel } from '../../models/CompanyEmployee.js';
import { LevelService, levelService as defaultLevelService } from '../economy/level.service.js';
import { NotificationService, notificationService as defaultNotificationService } from '../notification/notification.service.js';
import { DisciplineService, disciplineService as defaultDisciplineService } from './discipline.service.js';
import type { PromotionService } from './promotion.service.js';
import { clampScore, calculateTaskExp, performanceBand } from '../economy/expEngine.js';
import {
  taskEvaluationOutputSchema,
  taskEvaluationJsonSchema,
  type TaskEvaluationOutput,
} from '../../schemas/taskEvaluation.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { type PerformanceBand } from '../../types/enums.js';

export const TASK_EVALUATION_SYSTEM_PROMPT = `You are CorpVerse's Automated Senior Lead Engineering Evaluator Bot.
Your responsibility is to rigorously, objectively, and constructively evaluate employee work submissions against given engineering task specifications and rubric criteria.

CRITICAL EVALUATION RULES:
1. Objectively assess how well the submission meets the specified scenario requirements and rubric criteria.
2. Provide a score from 0 to 100 based on functional completeness, architectural quality, and best practices.
3. List explicit technical strengths with concrete examples from the submission.
4. List constructive weaknesses and missing edge cases.
5. Provide actionable feedback so the employee learns and improves.
6. Provide criterion-by-criterion scores for each rubric evaluation criterion provided.

OUTPUT FORMAT:
Return valid JSON conforming to the schema with:
- score: overall integer score 0-100
- strengths: array of observed technical strengths
- weaknesses: array of deficiencies or missed edge cases
- feedback: detailed constructive review
- criteriaScores: array of objects with { criterion, score, comment }`;

export class TaskEvaluationService {
  private promotionService?: PromotionService;

  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly aiWorker: AIWorker = defaultAIWorker,
    private readonly levelService: LevelService = defaultLevelService,
    private readonly notificationService: NotificationService = defaultNotificationService,
    private readonly disciplineService: DisciplineService = defaultDisciplineService,
    promotionService?: PromotionService
  ) {
    this.promotionService = promotionService;
    this.registerWorkerHooks();
  }

  public setPromotionService(promotionService: PromotionService): void {
    this.promotionService = promotionService;
  }


  private registerWorkerHooks(): void {
    const taskTypes = ['TASK_EVALUATION', 'TASK_EVALUATE'] as const;

    for (const taskType of taskTypes) {
      // 1. Strict Zod validation on queue job results
      this.aiWorker.registerValidator(taskType, (_job, response) => {
        if (!response.structuredData) {
          throw new AIError(`AI provider returned no structured data for ${taskType}`, 'PROVIDER_ERROR');
        }
        const parsed = taskEvaluationOutputSchema.safeParse(response.structuredData);
        if (!parsed.success) {
          throw new AIError(
            `Zod validation failed for ${taskType}: ${parsed.error.message}`,
            'PROVIDER_ERROR'
          );
        }
      });

      // 2. Job completion handler
      this.aiWorker.registerHandler(taskType, async (job) => {
        await this.handleJobCompletion(job);
      });
    }
  }

  /**
   * Completes asynchronous AIJob when processed by AIWorker
   */
  public async handleJobCompletion(job: IAIJobDocument): Promise<void> {
    const submissionId = job.requestorReference;
    if (!submissionId || !Types.ObjectId.isValid(submissionId)) {
      return;
    }

    const submission = await TaskSubmissionModel.findById(submissionId);
    if (!submission) {
      logger.warn(`[TaskEvaluationService] No submission found for completed AIJob ${job._id.toString()}`);
      return;
    }

    const structured = job.result?.structuredData;
    if (!structured) {
      logger.error(`[TaskEvaluationService] Completed AIJob ${job._id.toString()} has empty structuredData`);
      return;
    }

    const parsed = taskEvaluationOutputSchema.safeParse(structured);
    if (!parsed.success) {
      logger.error(
        `[TaskEvaluationService] Output failed schema parsing for AIJob ${job._id.toString()}: ${parsed.error.message}`
      );
      return;
    }

    await this.applyEvaluation(submission, parsed.data);
  }

  /**
   * Submits employee work once before dueAt.
   * If deadline has passed, marks task EXPIRED and rejects submission.
   */
  public async submitTask(params: {
    taskId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    content: string;
  }): Promise<{ submission: ITaskSubmissionDocument; task: IEmployeeTaskDocument }> {
    const { taskId, userId, content } = params;

    if (!Types.ObjectId.isValid(taskId.toString())) {
      throw AppError.badRequest('Invalid task ID');
    }

    const task = await EmployeeTaskModel.findById(taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    if (task.userId.toString() !== userId.toString()) {
      throw AppError.forbidden('Access denied: You do not own this task');
    }

    if (task.status === 'SUBMITTED' || task.status === 'EVALUATED') {
      throw AppError.badRequest('Task has already been submitted');
    }

    // Check expiration against dueAt
    const now = new Date();
    if (now > task.dueAt || task.status === 'EXPIRED') {
      if (task.status !== 'EXPIRED') {
        task.status = 'EXPIRED';
        await task.save();
      }
      throw AppError.badRequest('Task deadline has passed');
    }

    // Verify employee is still active
    const employee = await CompanyEmployeeModel.findOne({
      userId: new Types.ObjectId(userId.toString()),
      companyId: task.companyId,
      status: 'ACTIVE',
    });
    if (!employee) {
      throw AppError.forbidden('Access denied: Active employee status required');
    }

    let submission: ITaskSubmissionDocument;
    try {
      submission = await TaskSubmissionModel.create({
        taskId: task._id,
        userId: task.userId,
        content: content.trim(),
        submittedAt: now,
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        throw AppError.badRequest('Task has already been submitted');
      }
      throw err;
    }

    task.status = 'SUBMITTED';
    await task.save();

    logger.info(`[TaskEvaluationService] Task ${task._id.toString()} submitted by user ${userId.toString()}`);

    return { submission, task };
  }

  /**
   * Evaluates task submission via AI Gateway, validates output, and awards EXP authoritatively.
   * Completely idempotent: if already evaluated, returns existing record without re-awarding.
   */
  public async evaluateSubmission(params: {
    submissionId: string | Types.ObjectId;
  }): Promise<IPerformanceRecordDocument> {
    const { submissionId } = params;

    if (!Types.ObjectId.isValid(submissionId.toString())) {
      throw AppError.badRequest('Invalid submission ID');
    }

    const submission = await TaskSubmissionModel.findById(submissionId);
    if (!submission) {
      throw AppError.notFound('Task submission not found');
    }

    // 1. Idempotency Check: if already evaluated, return existing record immediately
    const existingRecord = await PerformanceRecordModel.findOne({
      taskSubmissionId: submission._id,
    });
    if (existingRecord) {
      logger.info(
        `[TaskEvaluationService] Submission ${submission._id.toString()} was already evaluated, returning existing record`
      );
      return existingRecord;
    }

    const task = await EmployeeTaskModel.findById(submission.taskId);
    if (!task) {
      throw AppError.notFound('Associated task not found');
    }

    const company = await CompanyModel.findById(task.companyId);

    // 2. Build contextual prompt for AI evaluation
    const userInput = this.buildEvaluationUserInput({
      task,
      submission,
      companyName: company?.name ?? 'Enterprise Employer',
    });

    const response = await this.aiGateway.execute(
      {
        taskType: 'TASK_EVALUATION',
        systemInstruction: TASK_EVALUATION_SYSTEM_PROMPT,
        userInput,
        context: {
          taskId: task._id.toString(),
          submissionId: submission._id.toString(),
          userId: task.userId.toString(),
          companyId: task.companyId.toString(),
          domain: task.domain,
          level: task.level,
          difficulty: task.difficulty,
          maxExp: task.maxExp,
        },
        outputSchema: taskEvaluationJsonSchema,
        temperature: 0.2,
      },
      {
        pool: 'PIPELINE',
      }
    );

    if (!response.structuredData) {
      throw new AIError('Provider returned empty structured data for task evaluation', 'PROVIDER_ERROR');
    }

    const parsed = taskEvaluationOutputSchema.safeParse(response.structuredData);
    if (!parsed.success) {
      throw new AIError(`Output validation failed: ${parsed.error.message}`, 'PROVIDER_ERROR');
    }

    return await this.applyEvaluation(submission, parsed.data, task);
  }

  /**
   * Authoritatively applies evaluation: clamps score, awards EXP via LevelService,
   * creates PerformanceRecord, marks task EVALUATED, and sends notification.
   */
  private async applyEvaluation(
    submission: ITaskSubmissionDocument,
    evalOutput: TaskEvaluationOutput,
    existingTask?: IEmployeeTaskDocument
  ): Promise<IPerformanceRecordDocument> {
    // Re-check idempotency
    const existingRecord = await PerformanceRecordModel.findOne({
      taskSubmissionId: submission._id,
    });
    if (existingRecord) {
      return existingRecord;
    }

    const task = existingTask ?? (await EmployeeTaskModel.findById(submission.taskId));
    if (!task) {
      throw AppError.notFound('Associated task not found');
    }

    // 1. Backend-authoritative clamping
    const rawScore = evalOutput.score;
    const clampedScore = clampScore(rawScore);
    const scoreBand: PerformanceBand = performanceBand(clampedScore);
    const awardedExp = calculateTaskExp(clampedScore, task.maxExp);

    // 2. Award EXP via LevelService with sourceId = submission._id
    await this.levelService.awardTaskExp({
      userId: task.userId,
      taskId: task._id,
      sourceId: submission._id,
      maxExp: task.maxExp,
      score: clampedScore,
      reason: `Daily task evaluation: ${task.title} (${task.kind}) [score: ${clampedScore}, +${awardedExp} EXP]`,
    });

    // 3. Create PerformanceRecord
    let record: IPerformanceRecordDocument;
    try {
      record = await PerformanceRecordModel.create({
        taskSubmissionId: submission._id,
        taskId: task._id,
        userId: task.userId,
        companyId: task.companyId,
        aiScore: clampedScore,
        scoreBand,
        awardedExp,
        feedback: evalOutput.feedback,
        strengths: evalOutput.strengths,
        weaknesses: evalOutput.weaknesses,
        criteriaScores: evalOutput.criteriaScores,
      });
    } catch (createErr: unknown) {
      if (
        typeof createErr === 'object' &&
        createErr !== null &&
        'code' in createErr &&
        (createErr as { code: number }).code === 11000
      ) {
        const found = await PerformanceRecordModel.findOne({ taskSubmissionId: submission._id });
        if (found) return found;
      }
      throw createErr;
    }

    // 4. Update task status to EVALUATED
    task.status = 'EVALUATED';
    await task.save();

    // 5. Send in-app notification
    try {
      await this.notificationService.create({
        userId: task.userId,
        type: 'TASK_EVALUATED',
        title: `Task Evaluated: ${task.title}`,
        message: `Your ${task.kind.toLowerCase()} daily task received a score of ${clampedScore}/100 (${scoreBand}). You earned +${awardedExp} EXP.`,
        link: `/employee/tasks/${task._id.toString()}`,
      });
    } catch (notifErr) {
      logger.error('[TaskEvaluationService] Failed to send evaluation notification', {
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    // 6. Issue discipline warning per Rule D4 if score is in the Poor band (score <= 39)
    if (clampedScore <= 39) {
      try {
        await this.disciplineService.issueWarning({
          userId: task.userId,
          companyId: task.companyId,
          taskSubmissionId: submission._id,
          score: clampedScore,
          sourcePerformanceRecordId: record._id,
          reason: `Poor task evaluation score: ${clampedScore}/100 on ${task.title}.`,
        });
      } catch (warnErr) {
        logger.error('[TaskEvaluationService] Failed to issue discipline warning', {
          error: warnErr instanceof Error ? warnErr.message : String(warnErr),
        });
      }
    }

    // 7. Check deterministic promotion eligibility
    if (this.promotionService) {
      try {
        await this.promotionService.checkAndExecutePromotion({
          userId: task.userId,
          companyId: task.companyId,
        });
      } catch (promoErr) {
        logger.error('[TaskEvaluationService] Failed to check promotion eligibility', {
          error: promoErr instanceof Error ? promoErr.message : String(promoErr),
        });
      }
    }

    logger.info(
      `[TaskEvaluationService] Evaluated task ${task._id.toString()}: score ${clampedScore}, awarded ${awardedExp} EXP, band ${scoreBand}`
    );

    return record;
  }

  /**
   * Retrieves performance evaluation by task ID with ownership verification
   */
  public async getEvaluationByTaskId(
    taskId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<{
    task: IEmployeeTaskDocument;
    submission: ITaskSubmissionDocument | null;
    performanceRecord: IPerformanceRecordDocument | null;
  }> {
    if (!Types.ObjectId.isValid(taskId.toString())) {
      throw AppError.badRequest('Invalid task ID');
    }

    const task = await EmployeeTaskModel.findById(taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    if (task.userId.toString() !== userId.toString()) {
      throw AppError.forbidden('Access denied: You do not own this task');
    }

    const submission = await TaskSubmissionModel.findOne({ taskId: task._id });
    const performanceRecord = submission
      ? await PerformanceRecordModel.findOne({ taskSubmissionId: submission._id })
      : null;

    return { task, submission, performanceRecord };
  }

  /**
   * Computes running average score, completed task count, and score bands distribution
   * for promotion criteria checks per Spec Section 11.3
   */
  public async getEmployeePerformanceStats(userId: string | Types.ObjectId): Promise<{
    completedTasksCount: number;
    averageScore: number;
    scoreBandsCount: Record<PerformanceBand, number>;
  }> {
    const userObjectId = new Types.ObjectId(userId.toString());
    const records = await PerformanceRecordModel.find({ userId: userObjectId });

    const completedTasksCount = records.length;
    let scoreSum = 0;
    const scoreBandsCount: Record<PerformanceBand, number> = {
      POOR: 0,
      NEEDS_IMPROVEMENT: 0,
      ACCEPTABLE: 0,
      GOOD: 0,
      EXCELLENT: 0,
    };

    for (const record of records) {
      scoreSum += record.aiScore;
      if (record.scoreBand in scoreBandsCount) {
        scoreBandsCount[record.scoreBand]++;
      }
    }

    const averageScore = completedTasksCount > 0 ? Math.round(scoreSum / completedTasksCount) : 0;

    return {
      completedTasksCount,
      averageScore,
      scoreBandsCount,
    };
  }

  private buildEvaluationUserInput(params: {
    task: IEmployeeTaskDocument;
    submission: ITaskSubmissionDocument;
    companyName: string;
  }): string {
    const { task, submission, companyName } = params;
    const requirementsList = task.scenario?.requirements?.join('\n- ') ?? 'Complete task requirements';
    const criteriaList =
      task.scenario?.evaluationCriteria?.join('\n- ') ?? 'Code quality and technical correctness';

    return `TASK CONTEXT:
Employer: ${companyName}
Domain: ${task.domain} (Level ${task.level})
Task Title: ${task.title}
Task Kind: ${task.kind}
Difficulty Tier: ${task.difficulty}
Max EXP Available: ${task.maxExp}

SCENARIO:
${task.description || task.scenario?.scenario}

REQUIREMENTS:
- ${requirementsList}

EVALUATION RUBRIC CRITERIA:
- ${criteriaList}

EMPLOYEE SUBMISSION CONTENT:
"""
${submission.content}
"""

Evaluate the solution thoroughly and return valid JSON adhering to the output schema.`;
  }
}

export const taskEvaluationService = new TaskEvaluationService();
