import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { profileSetupSchema, profileUpdateSchema } from '../schemas/profile.schema.js';

const router = Router();

// Public / informative domains listing
router.get('/domains', profileController.getDomains.bind(profileController));

// Authenticated profile operations
router.post(
  '/setup',
  authenticateJwt,
  validate({ body: profileSetupSchema }),
  profileController.setupProfile.bind(profileController)
);

router.get('/me', authenticateJwt, profileController.getProfile.bind(profileController));

router.put(
  '/me',
  authenticateJwt,
  validate({ body: profileUpdateSchema }),
  profileController.updateProfile.bind(profileController)
);

export const profileRouter = router;
