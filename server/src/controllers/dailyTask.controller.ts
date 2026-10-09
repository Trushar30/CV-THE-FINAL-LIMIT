import { Request, Response, NextFunction } from 'express';
import {
  DailyTaskService,
  dailyTaskService as defaultDailyTaskService,
} from '../services/employee/dailyTask.service.js';
import {
  TaskEvaluationService,
  taskEvaluationService as defaultTaskEvaluationService,
} from '../services/employee/taskEvaluation.service.js';
import { taskSubmissionInputSchema } from '../schemas/taskEvaluation.schema.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { CompanyModel } from '../models/Company.js';
import { EmployeeTaskModel } from '../models/EmployeeTask.js';
import { PerformanceRecordModel } from '../models/PerformanceRecord.js';
import { ExpTransactionModel } from '../models/ExpTransaction.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class DailyTaskController {
  constructor(
    private readonly dailyTaskService: DailyTaskService = defaultDailyTaskService,
    private readonly taskEvaluationService: TaskEvaluationService = defaultTaskEvaluationService
  ) {}

  /**
   * GET /api/employee/tasks/today
   * Retrieves today's primary and bonus tasks for the authenticated employee.
   * Generates tasks idempotently on-demand if not already generated.
   */
  public async getTodayTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const tasks = await this.dailyTaskService.getOrCreateDailyTasks({
        userId: req.user._id,
      });

      res.status(200).json({
        success: true,
        data: {
          tasks,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employee/tasks/:id
   * Retrieves a specific daily task by ID, enforcing employee ownership.
   */
  public async getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const taskId = req.params.id as string;
      const task = await this.dailyTaskService.getTaskById(taskId, req.user._id);

      res.status(200).json({
        success: true,
        data: {
          task,
        },
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * POST /api/employee/tasks/:id/submit
   * Submits employee work for a daily task, enforcing deadline, and triggers AI evaluation.
   */
  public async submitTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const taskId = req.params.id as string;
      const parsedBody = taskSubmissionInputSchema.parse(req.body);

      // 1. Submit task (idempotency, ownership, and dueAt checks applied)
      const { submission, task } = await this.taskEvaluationService.submitTask({
        taskId,
        userId: req.user._id,
        content: parsedBody.content,
      });

      // 2. Trigger evaluation (handles synchronous completion or AI gateway queuing)
      let performanceRecord = null;
      try {
        performanceRecord = await this.taskEvaluationService.evaluateSubmission({
          submissionId: submission._id,
        });
        if (performanceRecord) {
          task.status = 'EVALUATED';
        }
      } catch (evalErr) {
        logger.warn(
          `[DailyTaskController] Evaluation processing deferred or failed for submission ${submission._id.toString()}: ${evalErr instanceof Error ? evalErr.message : String(evalErr)}`
        );
      }

      res.status(201).json({
        success: true,
        data: {
          submission,
          task,
          performanceRecord,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employee/tasks/:id/evaluation
   * Retrieves evaluation and performance record for a specific daily task.
   */
  public async getTaskEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const taskId = req.params.id as string;
      const result = await this.taskEvaluationService.getEvaluationByTaskId(taskId, req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employee/performance/stats
   * Retrieves aggregated performance stats (completed count, average score, score bands) for promotion checks.
   */
  public async getPerformanceStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const stats = await this.taskEvaluationService.getEmployeePerformanceStats(req.user._id);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employee/company
   * Retrieves active employment record and associated company information.
   */
  public async getEmployeeCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const employee = await CompanyEmployeeModel.findOne({
        userId: req.user._id,
        status: 'ACTIVE',
      });

      if (!employee) {
        throw AppError.notFound('Active employee record not found');
      }

      const company = await CompanyModel.findById(employee.companyId);
      if (!company) {
        throw AppError.notFound('Associated company record not found');
      }

      res.status(200).json({
        success: true,
        data: {
          employee,
          company,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employee/tasks/history
   * Retrieves evaluated task history with associated performance records.
   */
  public async getTaskHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const records = await PerformanceRecordModel.find({
        userId: req.user._id,
      }).sort({ createdAt: -1 });

      const taskIds = records.map((r) => r.taskId);
      const tasks = await EmployeeTaskModel.find({ _id: { $in: taskIds } });
      const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));

      const history = records.map((record) => ({
        record,
        task: taskMap.get(record.taskId.toString()) || null,
      }));

      res.status(200).json({
        success: true,
        data: {
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employee/ledger/exp
   * Retrieves immutable EXP transaction ledger records for the employee.
   */
  public async getExpLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const transactions = await ExpTransactionModel.find({
        userId: req.user._id,
      })
        .sort({ createdAt: -1 })
        .limit(50);

      res.status(200).json({
        success: true,
        data: {
          transactions,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dailyTaskController = new DailyTaskController();

