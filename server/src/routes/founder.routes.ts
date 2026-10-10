import { Router } from 'express';
import { founderController } from '../controllers/founder.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';

export function createFounderRoutes(): Router {
  const router = Router();

  // All founder management routes require authentication
  router.use(authenticateJwt);

  // GET /api/founder/eligibility - Check founder mode eligibility & status
  router.get('/eligibility', founderController.getEligibility);

  // POST /api/founder/unlock - Authoritative founder mode unlock with explicit confirmation
  router.post('/unlock', founderController.unlock);

  // POST /api/founder/company - Create a new company for the founder
  router.post('/company', founderController.createCompany);

  // GET /api/founder/company - Retrieve founder's active company details & bot roster
  router.get('/company', founderController.getCompany);

  // POST /api/founder/bots/purchase - Purchase an AI bot for the company
  router.post('/bots/purchase', founderController.buyBot);

  // GET /api/founder/bots - Retrieve purchased bots and bot storefront catalog
  router.get('/bots', founderController.getBots);

  // POST /api/founder/jobs - Create a new job requisition
  router.post('/jobs', founderController.createJob);

  // GET /api/founder/jobs - List company job requisitions
  router.get('/jobs', founderController.getJobs);

  // PATCH /api/founder/jobs/:id/close - Close a job requisition
  router.patch('/jobs/:id/close', founderController.closeJob);

  // GET /api/founder/employees & GET /api/founder/company/employees - View company roster & capacity
  router.get('/employees', founderController.getEmployees);
  router.get('/company/employees', founderController.getEmployees);

  // GET /api/founder/applications - View applicants for company
  router.get('/applications', founderController.getApplications);

  // GET /api/founder/applications/:id - View application stage progress & evaluation outcomes
  router.get('/applications/:id', founderController.getApplicationById);

  // GET /api/founder/ledger - View CorpCoin transaction history
  router.get('/ledger', founderController.getLedger);

  return router;
}

export const founderRouter = createFounderRoutes();
