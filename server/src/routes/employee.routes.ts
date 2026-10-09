import { Router } from 'express';
import { dailyTaskController } from '../controllers/dailyTask.controller.js';
import { disciplineController } from '../controllers/discipline.controller.js';
import { promotionController } from '../controllers/promotion.controller.js';
import { authenticateJwt, requireCareerRole } from '../middleware/auth.middleware.js';

export function createEmployeeRoutes(): Router {
  const router = Router();

  // Enforce authentication and active career role EMPLOYEE on all employee endpoints
  router.use(authenticateJwt);
  router.use(requireCareerRole('EMPLOYEE'));

  // GET /api/employee/promotion/progress - Employee level promotion eligibility & progress
  router.get(
    '/promotion/progress',
    promotionController.getPromotionProgress.bind(promotionController)
  );

  // GET /api/employee/company - Active employment and company context
  router.get(
    '/company',
    dailyTaskController.getEmployeeCompany.bind(dailyTaskController)
  );

  // GET /api/employee/warnings - Active warnings & active warning count
  router.get(
    '/warnings',
    disciplineController.getEmployeeWarnings.bind(disciplineController)
  );

  // GET /api/employee/performance/stats - Employee performance stats & running averages
  router.get(
    '/performance/stats',
    dailyTaskController.getPerformanceStats.bind(dailyTaskController)
  );

  // GET /api/employee/tasks/history - Evaluated task history
  router.get(
    '/tasks/history',
    dailyTaskController.getTaskHistory.bind(dailyTaskController)
  );

  // GET /api/employee/ledger/exp - Immutable EXP transaction ledger records
  router.get(
    '/ledger/exp',
    dailyTaskController.getExpLedger.bind(dailyTaskController)
  );


  // GET /api/employee/tasks/today - Get or lazily generate today's tasks
  router.get(
    '/tasks/today',
    dailyTaskController.getTodayTasks.bind(dailyTaskController)
  );

  // GET /api/employee/tasks/:id/evaluation - Get submission evaluation and performance record
  router.get(
    '/tasks/:id/evaluation',
    dailyTaskController.getTaskEvaluation.bind(dailyTaskController)
  );

  // POST /api/employee/tasks/:id/submit - Submit daily task work and trigger AI evaluation
  router.post(
    '/tasks/:id/submit',
    dailyTaskController.submitTask.bind(dailyTaskController)
  );

  // GET /api/employee/tasks/:id - Get specific daily task by ID
  router.get(
    '/tasks/:id',
    dailyTaskController.getTaskById.bind(dailyTaskController)
  );

  return router;
}

export const employeeRouter = createEmployeeRoutes();

