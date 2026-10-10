import { Request, Response, NextFunction } from 'express';
import { FounderService, founderService as defaultFounderService } from '../services/founder/founder.service.js';
import {
  unlockFounderBodySchema,
  createFounderCompanySchema,
  purchaseBotSchema,
  createFounderJobSchema,
  listFounderApplicationsQuerySchema,
} from '../schemas/founder.schema.js';
import { AppError } from '../utils/errors.js';

export class FounderController {
  constructor(
    private readonly founderService: FounderService = defaultFounderService
  ) {}

  /**
   * GET /api/founder/eligibility
   * Returns Founder Mode eligibility status, EXP progress, and starter capital availability.
   */
  public getEligibility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const eligibility = await this.founderService.getEligibility(req.user._id);

      res.status(200).json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/founder/unlock
   * Authoritatively unlocks Founder Mode for eligible users with explicit confirmation.
   */
  public unlock = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const parsed = unlockFounderBodySchema.parse(req.body);
      const result = await this.founderService.unlockFounderMode(req.user._id, parsed.confirm);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/founder/company
   * Creates a new company for the founder, deducting the creation fee from CorpCoin balance.
   */
  public createCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const parsed = createFounderCompanySchema.parse(req.body);
      const result = await this.founderService.createCompany(req.user._id, parsed);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/company
   * Returns the founder's active company details and bot roster.
   */
  public getCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const result = await this.founderService.getFounderCompany(req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/founder/bots/purchase
   * Purchases an abstract AI bot for the founder's company, debiting CorpCoin.
   */
  public buyBot = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const parsed = purchaseBotSchema.parse(req.body);
      const result = await this.founderService.buyBot(req.user._id, parsed);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/bots
   * Retrieves purchased bots and storefront catalog for the founder's company.
   */
  public getBots = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const result = await this.founderService.getBots(req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/founder/jobs
   * Creates a new job requisition for the founder's active company.
   */
  public createJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const parsed = createFounderJobSchema.parse(req.body);
      const job = await this.founderService.createJob(req.user._id, parsed);

      res.status(201).json({
        success: true,
        data: { job },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/founder/jobs/:id/close
   * Closes an active job requisition belonging to the founder's company.
   */
  public closeJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      if (!req.params.id) {
        throw AppError.validation('Job ID parameter is required');
      }

      const job = await this.founderService.closeJob(req.user._id, req.params.id);

      res.status(200).json({
        success: true,
        data: { job },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/jobs
   * Retrieves all job requisitions belonging to the founder's active company.
   */
  public getJobs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const jobs = await this.founderService.getJobs(req.user._id);

      res.status(200).json({
        success: true,
        data: { jobs },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/employees
   * Retrieves active company employee roster with capacity bounds.
   */
  public getEmployees = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const result = await this.founderService.getEmployees(req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/applications
   * Retrieves applications submitted to the founder's active company.
   */
  public getApplications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const filters = listFounderApplicationsQuerySchema.parse(req.query);
      const applications = await this.founderService.getApplications(req.user._id, filters);

      res.status(200).json({
        success: true,
        data: { applications },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/applications/:id
   * Retrieves single application details, stage progression, and evaluation outcomes.
   */
  public getApplicationById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      if (!req.params.id) {
        throw AppError.validation('Application ID parameter is required');
      }

      const result = await this.founderService.getApplicationById(req.user._id, req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/founder/ledger
   * Retrieves the founder's CorpCoin double-entry transaction history.
   */
  public getLedger = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const transactions = await this.founderService.getCorpCoinLedger(req.user._id, limit);

      res.status(200).json({
        success: true,
        data: { transactions },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const founderController = new FounderController();
