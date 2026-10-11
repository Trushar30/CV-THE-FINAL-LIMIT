import { Router } from 'express';
import { domainController } from '../controllers/domain.controller.js';
import { validate } from '../middleware/validate.js';
import { listSkillsQuerySchema } from '../schemas/common.schema.js';
import { publicQueryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get(
  '/',
  publicQueryLimiter,
  validate({ query: listSkillsQuerySchema }),
  domainController.listSkills.bind(domainController)
);

export const skillRouter = router;

