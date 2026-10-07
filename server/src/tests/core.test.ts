import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { z } from 'zod';
import { createApp } from '../app.js';
import { AppError } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { getDatabaseState } from '../config/database.js';

describe('Server Core Architecture & Error Handling', () => {
  const testRouter = Router();

  // Route specifically added for testing validation middleware
  const testSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    level: z.number().int().min(1, 'Level must be at least 1'),
  });

  testRouter.post(
    '/test/validation',
    validate({ body: testSchema }),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    }
  );

  // Route specifically added for testing custom AppError throws
  testRouter.get('/test/conflict-error', () => {
    throw AppError.conflict('A company with this name already exists', { field: 'name' });
  });

  testRouter.get('/test/unauthorized-error', () => {
    throw AppError.unauthorized('Invalid or expired authentication token');
  });

  const app = createApp(testRouter);

  describe('GET /api/health', () => {
    it('should return 200 with service information and database status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body.service).toBe('corpverse-server');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptimeSeconds');
      expect(res.body).toHaveProperty('database');
      expect(res.body.database).toHaveProperty('connected');
      expect(res.body.database).toHaveProperty('state');
      expect(res.body.database).toHaveProperty('readyState');
    });

    it('should redirect GET /health to /api/health', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(307);
      expect(res.header.location).toBe('/api/health');
    });
  });

  describe('Zod Validation Middleware & 400 VALIDATION_ERROR', () => {
    it('should return 200 when payload is valid', async () => {
      const res = await request(app)
        .post('/api/test/validation')
        .send({ username: 'founder_alice', level: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ username: 'founder_alice', level: 5 });
    });

    it('should return 400 VALIDATION_ERROR matching spec format on invalid body', async () => {
      const res = await request(app)
        .post('/api/test/validation')
        .send({ username: 'al', level: 0 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            issues: [
              {
                path: 'username',
                message: 'Username must be at least 3 characters',
              },
              {
                path: 'level',
                message: 'Level must be at least 1',
              },
            ],
          },
        },
      });
    });

    it('should return 400 with VALIDATION_ERROR for malformed JSON syntax', async () => {
      const res = await request(app)
        .post('/api/test/validation')
        .set('Content-Type', 'application/json')
        .send('{ "username": "bad_json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Malformed JSON payload in request body');
    });
  });

  describe('404 Unknown Route Handling', () => {
    it('should return 404 RESOURCE_NOT_FOUND matching spec format for non-existent routes', async () => {
      const res = await request(app).get('/api/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Route not found: GET /api/does-not-exist',
          details: {},
        },
      });
    });
  });

  describe('Standardized Error Format & AppError', () => {
    it('should return 409 BUSINESS_RULE_VIOLATION for conflict errors', async () => {
      const res = await request(app).get('/api/test/conflict-error');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'A company with this name already exists',
          details: { field: 'name' },
        },
      });
    });

    it('should return 401 AUTHENTICATION_ERROR for unauthorized errors', async () => {
      const res = await request(app).get('/api/test/unauthorized-error');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired authentication token',
          details: {},
        },
      });
    });
  });

  describe('Request ID Middleware', () => {
    it('should generate and return a unique x-request-id header if none provided', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers).toHaveProperty('x-request-id');
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should preserve and reflect an incoming x-request-id header', async () => {
      const incomingId = 'client-custom-req-id-12345';
      const res = await request(app).get('/api/health').set('x-request-id', incomingId);

      expect(res.headers['x-request-id']).toBe(incomingId);
    });
  });

  describe('Structured Logger Redaction', () => {
    it('should redact sensitive keys such as passwords, tokens, and api keys', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('User authenticated', {
        email: 'alice@corpverse.io',
        password: 'SuperSecretPassword123!',
        token: 'jwt.token.secret',
        apiKey: 'ai-provider-api-key',
        nested: {
          refreshToken: 'refresh.token.here',
          normalData: 'visible',
        },
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const rawLogged = consoleLogSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(rawLogged);

      expect(parsed.meta.email).toBe('alice@corpverse.io');
      expect(parsed.meta.password).toBe('[REDACTED]');
      expect(parsed.meta.token).toBe('[REDACTED]');
      expect(parsed.meta.apiKey).toBe('[REDACTED]');
      expect(parsed.meta.nested.refreshToken).toBe('[REDACTED]');
      expect(parsed.meta.nested.normalData).toBe('visible');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Database State Helper', () => {
    it('should report database disconnected state accurately before connection', () => {
      const state = getDatabaseState();
      expect(state).toHaveProperty('connected');
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('readyState');
      expect(typeof state.connected).toBe('boolean');
      expect(typeof state.state).toBe('string');
      expect(typeof state.readyState).toBe('number');
    });
  });
});
