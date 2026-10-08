import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { resumeRouter } from './resume.routes.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  profileSetupSchema,
  profileUpdateSchema,
  onboardingStepSchema,
} from '../schemas/profile.schema.js';

const router = Router();

// Resume upload and management routes (Spec Section 27.2)
router.use('/resume', resumeRouter);

// Public / informative domains listing
router.get('/domains', profileController.getDomains.bind(profileController));

// Authenticated profile operations
router.post(
  '/setup',
  authenticateJwt,
  validate({ body: profileSetupSchema }),
  profileController.setupProfile.bind(profileController)
);

// Step-by-step onboarding endpoints (Spec Sections 5 & 27.2)
router.patch(
  '/step',
  authenticateJwt,
  validate({ body: onboardingStepSchema }),
  profileController.updateStep.bind(profileController)
);

router.post(
  '/step',
  authenticateJwt,
  validate({ body: onboardingStepSchema }),
  profileController.updateStep.bind(profileController)
);

router.post(
  '/complete-onboarding',
  authenticateJwt,
  profileController.completeOnboarding.bind(profileController)
);

router.get('/me', authenticateJwt, profileController.getProfile.bind(profileController));

router.put(
  '/me',
  authenticateJwt,
  validate({ body: profileUpdateSchema }),
  profileController.updateProfile.bind(profileController)
);

export const profileRouter = router;
