import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorCode } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

interface ErrorResponsePayload {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown>;
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let code: ErrorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred';
  let details: Record<string, unknown> = {};

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = {
      issues: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  } else if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: number }).status === 400
  ) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Malformed JSON payload in request body';
  } else if (err instanceof Error) {
    // Unknown standard error
    if (env.NODE_ENV !== 'production') {
      message = err.message;
    }
  }

  logger.error(`[Error] ${req.method} ${req.originalUrl} - ${statusCode} ${code}: ${message}`, {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    details,
  });

  const response: ErrorResponsePayload = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };

  res.status(statusCode).json(response);
}
