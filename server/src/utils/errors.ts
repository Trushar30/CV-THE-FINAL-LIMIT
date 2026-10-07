export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'BUSINESS_RULE_VIOLATION'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AI_GATEWAY_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: ErrorDetails;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = 'INTERNAL_SERVER_ERROR',
    statusCode = 500,
    details: ErrorDetails = {},
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details: ErrorDetails = {}): AppError {
    return new AppError(message, 'BUSINESS_RULE_VIOLATION', 400, details);
  }

  static validation(message: string, details: ErrorDetails = {}): AppError {
    return new AppError(message, 'VALIDATION_ERROR', 400, details);
  }

  static unauthorized(message = 'Authentication required', details: ErrorDetails = {}): AppError {
    return new AppError(message, 'AUTHENTICATION_ERROR', 401, details);
  }

  static forbidden(message = 'Access forbidden', details: ErrorDetails = {}): AppError {
    return new AppError(message, 'AUTHORIZATION_ERROR', 403, details);
  }

  static notFound(message = 'Resource not found', details: ErrorDetails = {}): AppError {
    return new AppError(message, 'RESOURCE_NOT_FOUND', 404, details);
  }

  static conflict(message: string, details: ErrorDetails = {}): AppError {
    return new AppError(message, 'BUSINESS_RULE_VIOLATION', 409, details);
  }

  static businessRuleViolation(message: string, details: ErrorDetails = {}): AppError {
    return new AppError(message, 'BUSINESS_RULE_VIOLATION', 409, details);
  }

  static accountLocked(
    message = 'Account temporarily locked',
    details: ErrorDetails = {}
  ): AppError {
    return new AppError(message, 'ACCOUNT_LOCKED', 423, details);
  }

  static rateLimitExceeded(message = 'Too many requests', details: ErrorDetails = {}): AppError {
    return new AppError(message, 'RATE_LIMIT_EXCEEDED', 429, details);
  }

  static internal(message = 'Internal server error', details: ErrorDetails = {}): AppError {
    return new AppError(message, 'INTERNAL_SERVER_ERROR', 500, details, false);
  }
}
