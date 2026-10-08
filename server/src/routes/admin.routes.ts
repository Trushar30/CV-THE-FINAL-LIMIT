import { Router, Request, Response } from 'express';
import { authenticateJwt, requirePlatformRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { domainController } from '../controllers/domain.controller.js';
import {
  createDomainSchema,
  updateDomainSchema,
  deleteDomainSchema,
} from '../schemas/domain.schema.js';
import { companyController } from '../controllers/company.controller.js';
import {
  adminCreateCompanySchema,
  adminUpdateCompanySchema,
  adminCreateJobSchema,
  adminUpdateJobSchema,
  adminDeleteJobSchema,
} from '../schemas/company.schema.js';

export function createAdminRoutes(): Router {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requirePlatformRole('ADMIN'));

  router.get('/overview', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Admin overview accessible only to platformRole ADMIN',
    });
  });

  // Admin Domain CRUD (Spec Section 20, Collection 5; Section 27.10)
  router.post(
    '/domains',
    validate({ body: createDomainSchema }),
    domainController.adminCreateDomain.bind(domainController)
  );

  router.get('/domains', domainController.adminListDomains.bind(domainController));

  router.get('/domains/:id', domainController.adminGetDomain.bind(domainController));

  router.patch(
    '/domains/:id',
    validate({ body: updateDomainSchema }),
    domainController.adminUpdateDomain.bind(domainController)
  );

  router.delete(
    '/domains/:id',
    validate({ body: deleteDomainSchema }),
    domainController.adminDeleteDomain.bind(domainController)
  );

  // Admin Company Mutation Routes (Spec Section 6 & 27.10)
  router.post(
    '/companies',
    validate({ body: adminCreateCompanySchema }),
    companyController.adminCreateCompany.bind(companyController)
  );

  router.patch(
    '/companies/:id',
    validate({ body: adminUpdateCompanySchema }),
    companyController.adminUpdateCompany.bind(companyController)
  );

  // Admin Job Mutation Routes (Spec Section 6.3 & 27.10)
  router.post(
    '/jobs',
    validate({ body: adminCreateJobSchema }),
    companyController.adminCreateJob.bind(companyController)
  );

  router.patch(
    '/jobs/:id',
    validate({ body: adminUpdateJobSchema }),
    companyController.adminUpdateJob.bind(companyController)
  );

  router.delete(
    '/jobs/:id',
    validate({ body: adminDeleteJobSchema }),
    companyController.adminDeleteJob.bind(companyController)
  );

  return router;
}

export const adminRouter = createAdminRoutes();
