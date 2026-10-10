import { Request, Response, NextFunction } from 'express';
import { AdminService, adminService as defaultAdminService } from '../services/admin/admin.service.js';
import { AppError } from '../utils/errors.js';
import { ConfigSectionName } from '../schemas/admin.schema.js';

export class AdminController {
  constructor(private readonly adminService: AdminService = defaultAdminService) {}

  /**
   * GET /api/admin/users
   * List, search, filter and paginate user accounts.
   */
  public async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.adminService.listUsers(req.query as never);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/users/:id
   * View user detail and profile. Password hashes are never returned.
   */
  public async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id as string;
      const result = await this.adminService.getUserById(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/users/:id
   * Edit user details or profile with mandatory audit logging.
   */
  public async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.params.id as string;
      const result = await this.adminService.updateUser({
        adminId: req.user._id.toString(),
        userId,
        input: req.body,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/suspend
   * Suspend a user account with mandatory audit logging.
   */
  public async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.params.id as string;
      const result = await this.adminService.suspendUser({
        adminId: req.user._id.toString(),
        userId,
        reason: req.body.reason,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/restore
   * Restore a suspended user account with mandatory audit logging.
   */
  public async restoreUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.params.id as string;
      const result = await this.adminService.restoreUser({
        adminId: req.user._id.toString(),
        userId,
        reason: req.body.reason,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/admin/users/:id
   * Dangerous operation: delete user account, profiles, and tokens.
   */
  public async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const userId = req.params.id as string;
      const { confirmation, reason } = req.body;

      const result = await this.adminService.deleteUser({
        adminId: req.user._id.toString(),
        userId,
        confirmation,
        reason,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/admin/companies/:id
   * Dangerous operation: delete company, close jobs, release employees.
   */
  public async deleteCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const companyId = req.params.id as string;
      const { confirmation, reason } = req.body;

      const result = await this.adminService.deleteCompany({
        adminId: req.user._id.toString(),
        companyId,
        confirmation,
        reason,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/economy/reset
   * Dangerous operation: reset simulated economy balances.
   */
  public async resetEconomy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { confirmation, reason, scope, targetUserId } = req.body;

      const result = await this.adminService.resetEconomy({
        adminId: req.user._id.toString(),
        confirmation,
        reason,
        scope,
        targetUserId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/config
   * View active PlatformConfig (sanitized).
   */
  public async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await this.adminService.getActiveConfig();
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/config/sections/:section
   * View specific section of active PlatformConfig.
   */
  public async getConfigSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const section = req.params.section as ConfigSectionName;
      const sectionConfig = await this.adminService.getConfigSection(section);
      res.status(200).json({
        success: true,
        data: {
          section,
          config: sectionConfig,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/config/sections/:section
   * Update specific section of PlatformConfig with Zod validation and audit logging.
   */
  public async updateConfigSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const section = req.params.section as ConfigSectionName;
      const { data, reason } = req.body;

      const updatedConfig = await this.adminService.updateConfigSection({
        adminId: req.user._id.toString(),
        section,
        sectionData: data,
        reason,
      });

      res.status(200).json({
        success: true,
        data: {
          section,
          updatedConfig,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
