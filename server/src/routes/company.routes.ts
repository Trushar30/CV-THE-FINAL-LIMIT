import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { companyController } from '../controllers/company.controller.js';
import { listCompaniesQuerySchema, listJobsQuerySchema } from '../schemas/company.schema.js';

export function createCompanyRoutes(): Router {
  const router = Router();

  // Public/Job Seeker endpoints for viewing companies
  router.get(
    '/',
    validate({ query: listCompaniesQuerySchema }),
    companyController.listCompanies.bind(companyController)
  );

  router.get('/:id', companyController.getCompany.bind(companyController));

  return router;
}

export function createJobRoutes(): Router {
  const router = Router();

  // Public/Job Seeker endpoints for viewing jobs
  router.get(
    '/',
    validate({ query: listJobsQuerySchema }),
    companyController.listJobs.bind(companyController)
  );

  router.get('/:id', companyController.getJob.bind(companyController));

  return router;
}

export const companyRouter = createCompanyRoutes();
export const jobRouter = createJobRoutes();
