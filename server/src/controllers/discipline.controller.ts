import { Request, Response, NextFunction } from 'express';
import { DisciplineService, disciplineService as defaultDisciplineService } from '../services/employee/discipline.service.js';
import { AppError } from '../utils/errors.js';

export class DisciplineController {
  constructor(
    private readonly disciplineService: DisciplineService = defaultDisciplineService
  ) {}

  /**
   * GET /api/employee/warnings
   * Retrieves active unexpired warnings and active warning count for the authenticated employee.
   */
  public async getEmployeeWarnings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const activeWarnings = await this.disciplineService.getActiveWarnings(req.user._id);
      const activeCount = activeWarnings.length;

      res.status(200).json({
        success: true,
        data: {
          activeCount,
          warnings: activeWarnings,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/employees/:id/terminate
   * Administrative force-termination requiring dangerous-action confirmation string.
   * Records immutable audit log.
   */
  public async adminForceTerminate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const employeeId = req.params.id as string;
      const { confirmation, reason } = req.body;

      await this.disciplineService.adminForceTerminate({
        employeeId,
        adminUserId: req.user._id,
        confirmation,
        reason,
      });

      res.status(200).json({
        success: true,
        message: 'Employee force-terminated successfully. User career role returned to Job Seeker.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const disciplineController = new DisciplineController();
