import type { Request, Response, NextFunction } from 'express';
import { companyService } from '../services/company/company.service.js';
import type {
  AdminCreateCompanyInput,
  AdminCreateJobInput,
  AdminUpdateCompanyInput,
  AdminUpdateJobInput,
  ListCompaniesQueryInput,
  ListJobsQueryInput,
} from '../schemas/company.schema.js';
import type { AuditActorRole } from '../types/enums.js';

export class CompanyController {
  // ==========================================
  // CANDIDATE / PUBLIC ENDPOINTS
  // ==========================================

  /**
   * GET /api/companies
   * List/search companies with domain filter, search keyword, and pagination.
   */
  async listCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListCompaniesQueryInput;
      const result = await companyService.listCompanies(query);

      res.status(200).json({
        success: true,
        data: result.companies,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/companies/:id
   * Get company details by ID along with its active job openings.
   */
  async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await companyService.getCompanyDetails(id);

      res.status(200).json({
        success: true,
        data: {
          company: result.company,
          openJobs: result.openJobs,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/jobs
   * List/search/filter open jobs by domain, level, keyword, and company.
   */
  async listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListJobsQueryInput;
      const result = await companyService.listJobs(query);

      res.status(200).json({
        success: true,
        data: result.jobs,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/jobs/:id
   * Get single job details by ID populated with company summary.
   */
  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const job = await companyService.getJobDetails(id);

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ADMIN MUTATION ENDPOINTS
  // ==========================================

  /**
   * POST /api/admin/companies
   */
  async adminCreateCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.id;
      const actorRole = (req.user!.platformRole || 'ADMIN') as AuditActorRole;
      const input = req.body as AdminCreateCompanyInput;

      const company = await companyService.adminCreateCompany(actorId, actorRole, input);

      res.status(201).json({
        success: true,
        message: 'Company created successfully',
        data: company,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/companies/:id
   */
  async adminUpdateCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.id;
      const actorRole = (req.user!.platformRole || 'ADMIN') as AuditActorRole;
      const id = req.params.id as string;
      const input = req.body as AdminUpdateCompanyInput;

      const company = await companyService.adminUpdateCompany(actorId, actorRole, id, input);

      res.status(200).json({
        success: true,
        message: 'Company updated successfully',
        data: company,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/jobs
   */
  async adminCreateJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.id;
      const actorRole = (req.user!.platformRole || 'ADMIN') as AuditActorRole;
      const input = req.body as AdminCreateJobInput;

      const job = await companyService.adminCreateJob(actorId, actorRole, input);

      res.status(201).json({
        success: true,
        message: 'Job posting created successfully',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/jobs/:id
   */
  async adminUpdateJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.id;
      const actorRole = (req.user!.platformRole || 'ADMIN') as AuditActorRole;
      const id = req.params.id as string;
      const input = req.body as AdminUpdateJobInput;

      const job = await companyService.adminUpdateJob(actorId, actorRole, id, input);

      res.status(200).json({
        success: true,
        message: 'Job posting updated successfully',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/admin/jobs/:id
   */
  async adminDeleteJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.id;
      const actorRole = (req.user!.platformRole || 'ADMIN') as AuditActorRole;
      const id = req.params.id as string;
      const { reason } = req.body as { reason: string };

      const job = await companyService.adminDeleteJob(actorId, actorRole, id, reason);

      res.status(200).json({
        success: true,
        message: 'Job posting closed successfully',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const companyController = new CompanyController();
