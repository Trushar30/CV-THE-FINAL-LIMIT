import { Types } from 'mongoose';
import {
  AIGateway,
  AIWorker,
  defaultAIGateway,
  defaultAIWorker,
  AIError,
} from '../../ai/index.js';
import type { IAIJobDocument } from '../../models/AIJob.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../../models/CompanyEmployee.js';
import { CompanyModel, type ICompanyDocument } from '../../models/Company.js';
import { EmployeeTaskModel, type IEmployeeTaskDocument } from '../../models/EmployeeTask.js';
import { ConfigService, configService as defaultConfigService } from '../config/config.service.js';
import { NotificationService, notificationService as defaultNotificationService } from '../notification/notification.service.js';
import {
  type TaskKind,
  type TaskDifficulty,
} from '../../types/enums.js';
import {
  taskGenerationOutputSchema,
  taskGenerationJsonSchema,
  type TaskGenerationOutput,
} from '../../schemas/task.schema.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Pure Option A difficulty mapping function per approved decision D7 & user confirmation:
 * - Levels 1–3 (Intern, Junior, Junior+): PRIMARY = EASY (30 EXP), BONUS = MEDIUM (60 EXP)
 * - Levels 4–6 (Associate, Mid, Mid+): PRIMARY = MEDIUM (60 EXP), BONUS = HARD (100 EXP)
 * - Levels 7–10 (Senior, Senior+, Lead, Principal): PRIMARY = HARD (100 EXP), BONUS = HARD (100 EXP)
 */
export function getDifficultyForLevel(level: number, kind: TaskKind): TaskDifficulty {
  const sanitizedLevel = Math.max(1, Math.min(10, Math.floor(Number(level) || 1)));

  if (sanitizedLevel <= 3) {
    return kind === 'PRIMARY' ? 'EASY' : 'MEDIUM';
  }
  if (sanitizedLevel <= 6) {
    return kind === 'PRIMARY' ? 'MEDIUM' : 'HARD';
  }
  return 'HARD';
}

/**
 * Pure max EXP resolver from difficulty tier and platform config limits
 */
export function getMaxExpForDifficulty(
  difficulty: TaskDifficulty,
  config?: { easyMaxExp?: number; mediumMaxExp?: number; hardMaxExp?: number }
): number {
  switch (difficulty) {
    case 'EASY':
      return config?.easyMaxExp ?? 30;
    case 'MEDIUM':
      return config?.mediumMaxExp ?? 60;
    case 'HARD':
      return config?.hardMaxExp ?? 100;
    default:
      return 30;
  }
}

/**
 * Returns UTC calendar day key in YYYY-MM-DD format
 */
export function getUtcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Computes end of day timestamp (23:59:59.999 UTC) for the provided date
 */
export function getEndOfDayUtc(date: Date = new Date()): Date {
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay;
}

export const TASK_GENERATION_SYSTEM_PROMPT = `You are CorpVerse's Automated Engineering Task Bot.
Your responsibility is to synthesize realistic, domain-specific engineering challenges for employees working in technology companies.

CRITICAL GROUNDING RULES:
1. Ground the problem in the company's background, industry, and real engineering challenges.
2. The scenario must be appropriate for the employee's career domain and level.
3. Align problem scope and complexity strictly to the target difficulty tier (EASY, MEDIUM, HARD).
4. Provide specific, unambiguous technical requirements and robust rubric evaluation criteria.

OUTPUT FORMAT:
Return valid JSON adhering to the provided schema with:
- title: concise engineering challenge title (max 160 chars)
- scenario: detailed business/technical problem context
- requirements: array of actionable technical specifications
- difficulty: target difficulty (EASY, MEDIUM, HARD)
- evaluationCriteria: array of rubric criteria assessing code quality and architectural decisions.`;

export class DailyTaskService {
  constructor(
    private readonly aiGateway: AIGateway = defaultAIGateway,
    private readonly aiWorker: AIWorker = defaultAIWorker,
    private readonly configService: ConfigService = defaultConfigService,
    private readonly notificationService: NotificationService = defaultNotificationService
  ) {
    this.registerWorkerHooks();
  }

  private registerWorkerHooks(): void {
    const taskTypes = ['TASK_GENERATION', 'TASK_GENERATE'] as const;

    for (const taskType of taskTypes) {
      // 1. Strict Zod validation on queue job results
      this.aiWorker.registerValidator(taskType, (_job, response) => {
        if (!response.structuredData) {
          throw new AIError(`AI provider returned no structured data for ${taskType}`, 'PROVIDER_ERROR');
        }
        const parsed = taskGenerationOutputSchema.safeParse(response.structuredData);
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
   * Completes an asynchronous AIJob when processed by AIWorker, updating task to ASSIGNED
   */
  public async handleJobCompletion(job: IAIJobDocument): Promise<void> {
    const requestorRef = job.requestorReference;
    if (!requestorRef || !Types.ObjectId.isValid(requestorRef)) {
      return;
    }

    const task = await EmployeeTaskModel.findById(requestorRef);
    if (!task) {
      logger.warn(`[DailyTaskService] No EmployeeTask found for completed AIJob ${job._id.toString()}`);
      return;
    }

    if (task.status !== 'WAITING_FOR_PROVIDER') {
      logger.info(
        `[DailyTaskService] Task ${task._id.toString()} is already in status '${task.status}', skipping AI update`
      );
      return;
    }

    const structured = job.result?.structuredData;
    if (!structured) {
      logger.error(`[DailyTaskService] Completed AIJob ${job._id.toString()} has empty structuredData`);
      return;
    }

    const parsed = taskGenerationOutputSchema.safeParse(structured);
    if (!parsed.success) {
      logger.error(
        `[DailyTaskService] AI output failed schema parsing for AIJob ${job._id.toString()}: ${parsed.error.message}`
      );
      return;
    }

    task.scenario = parsed.data;
    task.title = parsed.data.title;
    task.description = parsed.data.scenario;
    task.status = 'ASSIGNED';
    await task.save();

    if (task.userId) {
      try {
        await this.notificationService.create({
          userId: task.userId,
          type: 'TASK_ASSIGNED',
          title: `Daily Task Ready: ${task.title}`,
          message: `Your ${(task.kind || 'primary').toLowerCase()} daily engineering task has been generated by AI and is now ready.`,
          link: `/employee/tasks/${task._id.toString()}`,
        });
      } catch (notifErr) {
        logger.warn('[DailyTaskService] Failed to send task ready notification', {
          error: notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
      }
    }

    logger.info(`[DailyTaskService] Task ${task._id.toString()} transitioned from WAITING_FOR_PROVIDER to ASSIGNED`);
  }

  /**
   * Lazy, idempotent retrieval and generation of today's employee tasks.
   * Ensures 1 PRIMARY and 1 BONUS task exist per day per PlatformConfig without crons.
   */
  public async getOrCreateDailyTasks(params: {
    userId?: string | Types.ObjectId;
    employeeId?: string | Types.ObjectId;
    dayKey?: string;
  }): Promise<IEmployeeTaskDocument[]> {
    const dayKey = params.dayKey ?? getUtcDayKey();

    // 1. Resolve employee record
    let employee: ICompanyEmployeeDocument | null = null;
    if (params.employeeId && Types.ObjectId.isValid(params.employeeId.toString())) {
      employee = await CompanyEmployeeModel.findById(params.employeeId);
    } else if (params.userId && Types.ObjectId.isValid(params.userId.toString())) {
      employee = await CompanyEmployeeModel.findOne({
        userId: new Types.ObjectId(params.userId.toString()),
        status: 'ACTIVE',
      });
    }

    if (!employee || employee.status !== 'ACTIVE') {
      throw AppError.notFound('Active employee record not found');
    }

    // 2. Resolve company context
    const company = await CompanyModel.findById(employee.companyId);
    if (!company) {
      throw AppError.notFound('Company associated with employee not found');
    }

    // 3. Read PlatformConfig limits
    const config = await this.configService.getConfig();
    const requiredKinds: TaskKind[] = [];
    if (config.employee.primaryTasksPerDay >= 1) {
      requiredKinds.push('PRIMARY');
    }
    if (config.employee.bonusTasksPerDay >= 1) {
      requiredKinds.push('BONUS');
    }

    // 4. Query existing tasks for employee & dayKey
    const existingTasks = await EmployeeTaskModel.find({
      employeeId: employee._id,
      dayKey,
    }).sort({ kind: 1 });

    const existingKindMap = new Map<TaskKind, IEmployeeTaskDocument>();
    for (const task of existingTasks) {
      existingKindMap.set(task.kind, task);
    }

    // Check if any existing tasks in WAITING_FOR_PROVIDER can be regenerated
    for (const task of existingTasks) {
      if (task.status === 'WAITING_FOR_PROVIDER') {
        await this.attemptResolveWaitingTask(task, employee, company);
      }
    }

    // 5. Generate any missing required kinds idempotently
    for (const kind of requiredKinds) {
      if (!existingKindMap.has(kind)) {
        const newTask = await this.generateAndPersistTask({
          employee,
          company,
          kind,
          dayKey,
          configEmployee: config.employee,
        });
        existingKindMap.set(kind, newTask);
      }
    }

    // 6. Return all tasks for today sorted (PRIMARY first, then BONUS)
    const resultTasks = Array.from(existingKindMap.values());
    return resultTasks.sort((a, _b) => (a.kind === 'PRIMARY' ? -1 : 1));
  }

  /**
   * Retrieves single task by ID with ownership checks
   */
  public async getTaskById(
    taskId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IEmployeeTaskDocument> {
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

    return task;
  }

  /**
   * Attempts to resolve a task stuck in WAITING_FOR_PROVIDER synchronously
   */
  private async attemptResolveWaitingTask(
    task: IEmployeeTaskDocument,
    employee: ICompanyEmployeeDocument,
    company: ICompanyDocument
  ): Promise<void> {
    try {
      const generated = await this.invokeAIGateway({
        employee,
        company,
        kind: task.kind,
        difficulty: task.difficulty,
        maxExp: task.maxExp,
      });

      if (generated) {
        task.scenario = generated;
        task.title = generated.title;
        task.description = generated.scenario;
        task.status = 'ASSIGNED';
        await task.save();
        logger.info(`[DailyTaskService] Successfully refreshed waiting task ${task._id.toString()}`);
      }
    } catch {
      // Retain WAITING_FOR_PROVIDER status silently
    }
  }

  /**
   * Creates and persists a daily task idempotently with duplicate key race protection
   */
  private async generateAndPersistTask(params: {
    employee: ICompanyEmployeeDocument;
    company: ICompanyDocument;
    kind: TaskKind;
    dayKey: string;
    configEmployee: { easyMaxExp: number; mediumMaxExp: number; hardMaxExp: number };
  }): Promise<IEmployeeTaskDocument> {
    const { employee, company, kind, dayKey, configEmployee } = params;

    // Backend authoritatively chooses difficulty from employee level
    const difficulty = getDifficultyForLevel(employee.level, kind);
    // Backend authoritatively chooses maxExp from difficulty
    const maxExp = getMaxExpForDifficulty(difficulty, configEmployee);
    const dueAt = getEndOfDayUtc();

    let scenario: TaskGenerationOutput;
    let status: 'ASSIGNED' | 'WAITING_FOR_PROVIDER' = 'ASSIGNED';
    const aiJobId: Types.ObjectId | null = null;

    try {
      const generated = await this.invokeAIGateway({
        employee,
        company,
        kind,
        difficulty,
        maxExp,
      });

      if (generated) {
        scenario = generated;
      } else {
        throw new Error('No generated scenario returned');
      }
    } catch (err: unknown) {
      logger.warn(
        `[DailyTaskService] AI generation unavailable for employee ${employee._id.toString()} (${kind}). Setting WAITING_FOR_PROVIDER`,
        { error: err instanceof Error ? err.message : String(err) }
      );
      status = 'WAITING_FOR_PROVIDER';
      scenario = {
        title: `${kind === 'PRIMARY' ? 'Core' : 'Bonus'} Engineering Challenge`,
        scenario: `Task generation is currently queued and awaiting AI provider availability for ${company.name}. The challenge will appear once providers recover.`,
        requirements: ['Awaiting AI provider generation to load specific technical deliverables.'],
        difficulty,
        evaluationCriteria: ['Technical accuracy', 'Domain engineering best practices'],
      };
    }

    try {
      const createdTask = await EmployeeTaskModel.create({
        employeeId: employee._id,
        userId: employee.userId,
        companyId: company._id,
        domain: employee.domain,
        level: employee.level,
        kind,
        difficulty,
        scenario,
        title: scenario.title,
        description: scenario.scenario,
        maxExp,
        status,
        dayKey,
        dueAt,
        aiJobId,
      });

      if (status === 'ASSIGNED') {
        try {
          await this.notificationService.create({
            userId: employee.userId,
            type: 'TASK_ASSIGNED',
            title: `New ${kind === 'PRIMARY' ? 'Primary' : 'Bonus'} Task Available`,
            message: `A new ${difficulty.toLowerCase()} engineering task "${createdTask.title}" has been assigned for today.`,
            link: `/employee/tasks/${createdTask._id.toString()}`,
          });
        } catch (notifErr) {
          logger.warn('[DailyTaskService] Failed to send task assigned notification', {
            error: notifErr instanceof Error ? notifErr.message : String(notifErr),
          });
        }
      }

      // If created with WAITING_FOR_PROVIDER, submit background queue job so worker can fulfill later
      if (status === 'WAITING_FOR_PROVIDER') {
        try {
          const submittedJobId = await this.aiGateway.submit(
            {
              taskType: 'TASK_GENERATION',
              systemInstruction: TASK_GENERATION_SYSTEM_PROMPT,
              userInput: this.buildUserInput({ employee, company, kind, difficulty, maxExp }),
              context: {
                taskId: createdTask._id.toString(),
                employeeId: employee._id.toString(),
                companyId: company._id.toString(),
                domain: employee.domain,
                level: employee.level,
                kind,
                difficulty,
              },
              outputSchema: taskGenerationJsonSchema,
            },
            {
              pool: 'PIPELINE',
              requestorReference: createdTask._id.toString(),
              idempotencyKey: `task-gen-${employee._id.toString()}-${dayKey}-${kind}`,
            }
          );
          if (Types.ObjectId.isValid(submittedJobId)) {
            createdTask.aiJobId = new Types.ObjectId(submittedJobId);
            await createdTask.save();
          }
        } catch {
          // If queue submission also fails, task stays WAITING_FOR_PROVIDER and can be retried on next poll
        }
      }

      return createdTask;
    } catch (createErr: unknown) {
      // Handle race condition: another concurrent request already created the task
      if (
        typeof createErr === 'object' &&
        createErr !== null &&
        'code' in createErr &&
        (createErr as { code: number }).code === 11000
      ) {
        const existing = await EmployeeTaskModel.findOne({
          employeeId: employee._id,
          dayKey,
          kind,
        });
        if (existing) {
          return existing;
        }
      }
      throw createErr;
    }
  }

  /**
   * Calls AI Gateway synchronously with strict schema and pool PIPELINE
   */
  private async invokeAIGateway(params: {
    employee: ICompanyEmployeeDocument;
    company: ICompanyDocument;
    kind: TaskKind;
    difficulty: TaskDifficulty;
    maxExp: number;
  }): Promise<TaskGenerationOutput | null> {
    const { employee, company, kind, difficulty, maxExp } = params;
    const userInput = this.buildUserInput({ employee, company, kind, difficulty, maxExp });

    const response = await this.aiGateway.execute(
      {
        taskType: 'TASK_GENERATION',
        systemInstruction: TASK_GENERATION_SYSTEM_PROMPT,
        userInput,
        context: {
          employeeId: employee._id.toString(),
          companyId: company._id.toString(),
          domain: employee.domain,
          level: employee.level,
          kind,
          difficulty,
        },
        outputSchema: taskGenerationJsonSchema,
        temperature: 0.7,
      },
      {
        pool: 'PIPELINE',
      }
    );

    if (!response.structuredData) {
      return null;
    }

    const parsed = taskGenerationOutputSchema.safeParse(response.structuredData);
    if (!parsed.success) {
      logger.error(`[DailyTaskService] Schema validation failed for generated task: ${parsed.error.message}`);
      return null;
    }

    // Backend authoritatively clamps/forces target difficulty
    return {
      ...parsed.data,
      difficulty,
    };
  }

  private buildUserInput(params: {
    employee: ICompanyEmployeeDocument;
    company: ICompanyDocument;
    kind: TaskKind;
    difficulty: TaskDifficulty;
    maxExp: number;
  }): string {
    const { employee, company, kind, difficulty, maxExp } = params;
    return `Generate a daily engineering challenge for:
Company: ${company.name}
Company Overview: ${company.description || 'Enterprise Technology Provider'}
Employee Domain: ${employee.domain}
Employee Level: Level ${employee.level} (${employee.positionTitle || 'Engineer'})
Task Type: ${kind} (${kind === 'PRIMARY' ? 'Core Daily Engineering Challenge' : 'Optional Bonus Engineering Challenge'})
Required Difficulty Tier: ${difficulty}
Target Max EXP: ${maxExp}

Return structured JSON conforming to the schema with realistic, detailed problem statements and concrete technical requirements.`;
  }
}

export const dailyTaskService = new DailyTaskService();
