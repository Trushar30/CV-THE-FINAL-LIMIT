import { Router } from 'express';
import { simulationController } from '../controllers/simulation.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { submitDecisionSchema } from '../schemas/simulation.schema.js';

const router = Router();

// All simulation routes require authenticated founder
router.use(authenticateJwt);

router.get('/scenario', (req, res, next) => {
  simulationController.getDailyScenario(req, res).catch(next);
});

router.post('/decision', validate({ body: submitDecisionSchema }), (req, res, next) => {
  simulationController.submitDecision(req, res).catch(next);
});

router.post('/tick', (req, res, next) => {
  simulationController.executeDailyTick(req, res).catch(next);
});

router.get('/financials', (req, res, next) => {
  simulationController.getFinancialHistory(req, res).catch(next);
});

export const simulationRouter = router;
