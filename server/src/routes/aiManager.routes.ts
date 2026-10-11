import { Router } from 'express';
import { AIManagerController } from '../controllers/aiManager.controller.js';
import { authenticateJwt, requirePlatformRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createProviderSchema,
  updateProviderSchema,
  statusActionSchema,
} from '../schemas/aiManager.schema.js';

export function createAIManagerRoutes(controller: AIManagerController): Router {
  const router = Router();

  // Enforce JWT authentication on all AI Manager endpoints
  router.use(authenticateJwt);

  // Read-only endpoints accessible by both AI_MANAGER and ADMIN
  router.get('/providers', requirePlatformRole('AI_MANAGER', 'ADMIN'), controller.listProviders);

  router.get(
    '/health-usage',
    requirePlatformRole('AI_MANAGER', 'ADMIN'),
    controller.getHealthAndUsage
  );

  // Mutation endpoints restricted strictly to AI_MANAGER
  router.post(
    '/providers',
    requirePlatformRole('AI_MANAGER'),
    validate({ body: createProviderSchema }),
    controller.createProvider
  );

  router.patch(
    '/providers/:idOrCode',
    requirePlatformRole('AI_MANAGER'),
    validate({ body: updateProviderSchema }),
    controller.updateProvider
  );

  router.post(
    '/providers/:idOrCode/enable',
    requirePlatformRole('AI_MANAGER'),
    validate({ body: statusActionSchema }),
    controller.enableProvider
  );

  router.post(
    '/providers/:idOrCode/disable',
    requirePlatformRole('AI_MANAGER'),
    validate({ body: statusActionSchema }),
    controller.disableProvider
  );

  router.delete(
    '/providers/:idOrCode',
    requirePlatformRole('AI_MANAGER'),
    validate({ body: statusActionSchema }),
    controller.removeProvider
  );

  router.post(
    '/providers/:idOrCode/test',
    requirePlatformRole('AI_MANAGER'),
    controller.testProvider
  );

  return router;
}

import { defaultRouter, defaultTracker } from '../ai/index.js';
import { AuditService } from '../services/audit/audit.service.js';
import { AIManagerService } from '../services/ai/aiManager.service.js';

const defaultAuditService = new AuditService();
export const defaultAIManagerService = new AIManagerService(
  defaultRouter,
  defaultTracker,
  defaultAuditService
);
export const defaultAIManagerController = new AIManagerController(defaultAIManagerService);
export const aiManagerRouter = createAIManagerRoutes(defaultAIManagerController);
