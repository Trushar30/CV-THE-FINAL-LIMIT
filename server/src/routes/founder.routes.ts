import { Router } from 'express';
import { founderController } from '../controllers/founder.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  unlockFounderBodySchema,
  createFounderCompanySchema,
  purchaseBotSchema,
  createFounderJobSchema,
  listFounderApplicationsQuerySchema,
} from '../schemas/founder.schema.js';
import { objectIdParamSchema } from '../schemas/common.schema.js';

export function createFounderRoutes(): Router {
  const router = Router();

  // All founder management routes require authentication
  router.use(authenticateJwt);

  // GET /api/founder/eligibility - Check founder mode eligibility & status
  router.get('/eligibility', founderController.getEligibility);

  // POST /api/founder/unlock - Authoritative founder mode unlock with explicit confirmation
  router.post(
    '/unlock',
    validate({ body: unlockFounderBodySchema }),
    founderController.unlock
  );

  // POST /api/founder/company - Create a new company for the founder
  router.post(
    '/company',
    validate({ body: createFounderCompanySchema }),
    founderController.createCompany
  );

  // GET /api/founder/company - Retrieve founder's active company details & bot roster
  router.get('/company', founderController.getCompany);

  // POST /api/founder/bots/purchase - Purchase an AI bot for the company
  router.post(
    '/bots/purchase',
    validate({ body: purchaseBotSchema }),
    founderController.buyBot
  );

  // GET /api/founder/bots - Retrieve purchased bots and bot storefront catalog
  router.get('/bots', founderController.getBots);

  // POST /api/founder/jobs - Create a new job requisition
  router.post(
    '/jobs',
    validate({ body: createFounderJobSchema }),
    founderController.createJob
  );

  // GET /api/founder/jobs - List company job requisitions
  router.get('/jobs', founderController.getJobs);

  // PATCH /api/founder/jobs/:id/close - Close a job requisition
  router.patch(
    '/jobs/:id/close',
    validate({ params: objectIdParamSchema }),
    founderController.closeJob
  );

  // GET /api/founder/employees & GET /api/founder/company/employees - View company roster & capacity
  router.get('/employees', founderController.getEmployees);
  router.get('/company/employees', founderController.getEmployees);

  // GET /api/founder/applications - View applicants for company
  router.get(
    '/applications',
    validate({ query: listFounderApplicationsQuerySchema }),
    founderController.getApplications
  );

  // GET /api/founder/applications/:id - View application stage progress & evaluation outcomes
  router.get(
    '/applications/:id',
    validate({ params: objectIdParamSchema }),
    founderController.getApplicationById
  );

  // GET /api/founder/ledger - View CorpCoin transaction history
  router.get('/ledger', founderController.getLedger);

  return router;
}

export const founderRouter = createFounderRoutes();
