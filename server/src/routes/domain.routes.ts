import { Router } from 'express';
import { domainController } from '../controllers/domain.controller.js';

const router = Router();

router.get('/', domainController.listDomains.bind(domainController));

export const domainRouter = router;
