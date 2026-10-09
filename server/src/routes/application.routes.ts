import { Router } from 'express';
import { applicationController } from '../controllers/application.controller.js';
import { stageEngineController } from '../controllers/stageEngine.controller.js';
import { finalReviewOfferController } from '../controllers/finalReviewOffer.controller.js';
import { authenticateJwt, requireCareerRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  applyJobBodySchema,
  withdrawApplicationParamsSchema,
  withdrawApplicationBodySchema,
  getApplicationParamsSchema,
  listApplicationsQuerySchema,
} from '../schemas/application.schema.js';
import { postAnswerBodySchema } from '../schemas/stageChat.schema.js';
import {
  negotiateOfferBodySchema,
  declineOfferBodySchema,
} from '../schemas/offer.schema.js';

export function createApplicationRoutes(): Router {
  const router = Router();

  // POST /api/applications - Submit new job application (JOB_SEEKER only)
  router.post(
    '/',
    authenticateJwt,
    requireCareerRole('JOB_SEEKER'),
    validate({ body: applyJobBodySchema }),
    applicationController.apply.bind(applicationController)
  );

  // POST /api/applications/:id/withdraw - Voluntarily withdraw an active application
  router.post(
    '/:id/withdraw',
    authenticateJwt,
    validate({
      params: withdrawApplicationParamsSchema,
      body: withdrawApplicationBodySchema,
    }),
    applicationController.withdraw.bind(applicationController)
  );

  // GET /api/applications - List candidate's applications
  router.get(
    '/',
    authenticateJwt,
    validate({ query: listApplicationsQuerySchema }),
    applicationController.list.bind(applicationController)
  );

  // GET /api/applications/:id - View application detail
  router.get(
    '/:id',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    applicationController.getById.bind(applicationController)
  );

  // GET /api/applications/:id/feedback - View feedback for rejected application (owner only)
  router.get(
    '/:id/feedback',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    applicationController.getFeedback.bind(applicationController)
  );

  // POST /api/applications/:id/ats-screen - Enqueue ATS screening AI evaluation
  router.post(
    '/:id/ats-screen',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    applicationController.atsScreen.bind(applicationController)
  );

  // GET /api/applications/:id/stage (and /interview) - View current chat stage session
  router.get(
    '/:id/stage',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    stageEngineController.getSession.bind(stageEngineController)
  );
  router.get(
    '/:id/interview',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    stageEngineController.getSession.bind(stageEngineController)
  );

  // POST /api/applications/:id/stage/messages (and /interview/messages) - Submit answer
  router.post(
    '/:id/stage/messages',
    authenticateJwt,
    validate({
      params: getApplicationParamsSchema,
      body: postAnswerBodySchema,
    }),
    stageEngineController.submitMessage.bind(stageEngineController)
  );
  router.post(
    '/:id/interview/messages',
    authenticateJwt,
    validate({
      params: getApplicationParamsSchema,
      body: postAnswerBodySchema,
    }),
    stageEngineController.submitMessage.bind(stageEngineController)
  );

  // POST /api/applications/:id/final-review - Synthesize multi-stage review
  router.post(
    '/:id/final-review',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    finalReviewOfferController.executeFinalReview.bind(finalReviewOfferController)
  );

  // GET /api/applications/:id/offer - View employment offer terms
  router.get(
    '/:id/offer',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    finalReviewOfferController.getOffer.bind(finalReviewOfferController)
  );

  // POST /api/applications/:id/offer/negotiate - Negotiate compensation terms
  router.post(
    '/:id/offer/negotiate',
    authenticateJwt,
    validate({
      params: getApplicationParamsSchema,
      body: negotiateOfferBodySchema,
    }),
    finalReviewOfferController.negotiateOffer.bind(finalReviewOfferController)
  );

  // POST /api/applications/:id/offer/accept - Atomically accept offer & create employee record
  router.post(
    '/:id/offer/accept',
    authenticateJwt,
    validate({ params: getApplicationParamsSchema }),
    finalReviewOfferController.acceptOffer.bind(finalReviewOfferController)
  );

  // POST /api/applications/:id/offer/decline - Decline employment offer
  router.post(
    '/:id/offer/decline',
    authenticateJwt,
    validate({
      params: getApplicationParamsSchema,
      body: declineOfferBodySchema,
    }),
    finalReviewOfferController.declineOffer.bind(finalReviewOfferController)
  );

  return router;
}

export const applicationRouter = createApplicationRoutes();

