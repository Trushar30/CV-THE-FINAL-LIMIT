import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import {
  registerLimiter,
  resendVerificationLimiter,
  loginLimiter,
  refreshLimiter,
} from '../middleware/rateLimiter.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
} from '../schemas/auth.schema.js';

const router = Router();

// Public registration & email verification endpoints
router.post(
  '/register',
  registerLimiter,
  validate({ body: registerSchema }),
  authController.register.bind(authController)
);

router.post(
  '/verify-email',
  validate({ body: verifyEmailSchema }),
  authController.verifyEmail.bind(authController)
);

router.post(
  '/resend-verification',
  resendVerificationLimiter,
  validate({ body: resendVerificationSchema }),
  authController.resendVerification.bind(authController)
);

// Public session endpoints
router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  authController.login.bind(authController)
);

router.post('/refresh', refreshLimiter, authController.refresh.bind(authController));

router.post('/logout', authController.logout.bind(authController));

// Authenticated user profile endpoint
router.get('/me', authenticateJwt, authController.getCurrentUser.bind(authController));

export const authRouter = router;
