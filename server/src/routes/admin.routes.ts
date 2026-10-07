import { Router, Request, Response } from 'express';
import { authenticateJwt, requirePlatformRole } from '../middleware/auth.middleware.js';

export function createAdminRoutes(): Router {
  const router = Router();

  router.use(authenticateJwt);
  router.use(requirePlatformRole('ADMIN'));

  router.get('/overview', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Admin overview accessible only to platformRole ADMIN',
    });
  });

  return router;
}

export const adminRouter = createAdminRoutes();
