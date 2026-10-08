import { Request, Response, NextFunction } from 'express';
import { domainService } from '../services/domain/domain.service.js';
import {
  CreateDomainInput,
  UpdateDomainInput,
  DeleteDomainInput,
} from '../schemas/domain.schema.js';
import { AppError } from '../utils/errors.js';

export class DomainController {
  /**
   * GET /api/domains
   * Public / Authenticated retrieval of active career domains.
   */
  async listDomains(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domains = await domainService.listActiveDomains();
      res.status(200).json({
        success: true,
        data: { domains },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/skills
   * Queryable by ?domainCode=...
   */
  async listSkills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domainCode = req.query.domainCode as string | undefined;
      const skills = await domainService.listSkills(domainCode);
      res.status(200).json({
        success: true,
        data: { skills },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/domains
   * Admin-only retrieval of all domains (including inactive).
   */
  async adminListDomains(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domains = await domainService.listAllDomains();
      res.status(200).json({
        success: true,
        data: { domains },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/domains/:id
   * Admin-only retrieval of a single domain by ID or code.
   */
  async adminGetDomain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const domain = await domainService.getDomain(id);
      res.status(200).json({
        success: true,
        data: { domain },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/domains
   * Admin-only creation of a new domain with mandatory audit logging.
   */
  async adminCreateDomain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = req.body as CreateDomainInput;
      const domain = await domainService.createDomain(
        req.user._id.toString(),
        req.user.platformRole as 'ADMIN',
        input
      );

      res.status(201).json({
        success: true,
        message: 'Domain created successfully',
        data: { domain },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/domains/:id
   * Admin-only update of an existing domain with mandatory audit logging.
   */
  async adminUpdateDomain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const id = req.params.id as string;
      const input = req.body as UpdateDomainInput;
      const domain = await domainService.updateDomain(
        req.user._id.toString(),
        req.user.platformRole as 'ADMIN',
        id,
        input
      );

      res.status(200).json({
        success: true,
        message: 'Domain updated successfully',
        data: { domain },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/admin/domains/:id
   * Admin-only deactivation of a domain with mandatory audit logging.
   */
  async adminDeleteDomain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const id = req.params.id as string;
      const input = req.body as DeleteDomainInput;
      const domain = await domainService.deleteDomain(
        req.user._id.toString(),
        req.user.platformRole as 'ADMIN',
        id,
        input.reason
      );

      res.status(200).json({
        success: true,
        message: 'Domain deactivated successfully',
        data: { domain },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const domainController = new DomainController();
