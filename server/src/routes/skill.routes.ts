import { Router } from 'express';
import { domainController } from '../controllers/domain.controller.js';

const router = Router();

router.get('/', domainController.listSkills.bind(domainController));

export const skillRouter = router;
