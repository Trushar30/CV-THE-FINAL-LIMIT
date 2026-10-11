import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { companyController } from '../controllers/company.controller.js';
import { listCompaniesQuerySchema, listJobsQuerySchema } from '../schemas/company.schema.js';
import { objectIdParamSchema } from '../schemas/common.schema.js';
import { publicQueryLimiter } from '../middleware/rateLimiter.js';

export function createCompanyRoutes(): Router {
  const router = Router();

  // Public/Job Seeker endpoints for viewing companies
  router.get(
    '/',
    publicQueryLimiter,
    validate({ query: listCompaniesQuerySchema }),
    companyController.listCompanies.bind(companyController)
  );

  router.get(
    '/:id',
    publicQueryLimiter,
    validate({ params: objectIdParamSchema }),
    companyController.getCompany.bind(companyController)
  );

  return router;
}

export function createJobRoutes(): Router {
  const router = Router();

  // Public/Job Seeker endpoints for viewing jobs
  router.get(
    '/',
    publicQueryLimiter,
    validate({ query: listJobsQuerySchema }),
    companyController.listJobs.bind(companyController)
  );

  router.get(
    '/:id',
    publicQueryLimiter,
    validate({ params: objectIdParamSchema }),
    companyController.getJob.bind(companyController)
  );

  return router;
}

export const companyRouter = createCompanyRoutes();
export const jobRouter = createJobRoutes();

