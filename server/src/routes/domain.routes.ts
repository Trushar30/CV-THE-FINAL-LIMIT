import { Router } from 'express';
import { domainController } from '../controllers/domain.controller.js';
import { publicQueryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/', publicQueryLimiter, domainController.listDomains.bind(domainController));

export const domainRouter = router;

