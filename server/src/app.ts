import express, { type Express, type Request, type Response, type Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

export function createApp(additionalRouter?: Router): Express {
  const app = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  // 3. Request Identification
  app.use(requestIdMiddleware);

  // 4. Global Rate Limiter
  const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test', // Skip rate limiting during test runs
    handler: (_req: Request, _res: Response, next) => {
      next(AppError.rateLimitExceeded('Too many requests, please try again later'));
    },
  });
  app.use(globalLimiter);

  // 5. Body Parsing with configured limits
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));

  // 6. Request Logging
  app.use((req, _res, next) => {
    logger.debug(`[HTTP] ${req.method} ${req.path}`, {
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // 7. Base Routes
  app.use('/api', healthRouter);
  if (additionalRouter) {
    app.use('/api', additionalRouter);
  }

  // Direct /health alias for container health checks
  app.get('/health', (_req: Request, res: Response) => {
    res.redirect(307, '/api/health');
  });

  // 8. 404 Route Handler
  app.use(notFoundHandler);

  // 9. Central Error Handler
  app.use(errorHandler);

  return app;
}
