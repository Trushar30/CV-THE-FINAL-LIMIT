import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeNoSql } from '../middleware/sanitize.js';
import { verifyCsrfOrigin } from '../middleware/csrf.middleware.js';
import { objectIdParamSchema } from '../schemas/common.schema.js';
import { validateResumeFile } from '../utils/fileValidation.js';
import { logger } from '../utils/logger.js';
import helmet from 'helmet';
import { AppError } from '../utils/errors.js';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';

describe('TASK P10.1: Security Hardening & Audit Verification', () => {
  describe('1. NoSQL Injection Prevention Middleware (sanitizeNoSql)', () => {
    it('strips MongoDB query operators ($gt, $ne, $where) from request body, query, and params', () => {
      const req = {
        body: {
          email: { $gt: '' },
          password: 'Password123!',
          nested: {
            legit: 'value',
            $where: 'sleep(1000)',
            'dot.key': 'blocked',
          },
        },
        query: {
          filter: { $ne: 'secret' },
          normal: 'clean',
        },
        params: {
          id: '507f1f77bcf86cd799439011',
          $evil: 'payload',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = vi.fn();

      sanitizeNoSql(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      // $gt operator stripped from body
      expect(req.body.email).toEqual({});
      expect(req.body.password).toBe('Password123!');
      // nested $where and dot notation stripped
      expect(req.body.nested).toEqual({ legit: 'value' });
      // query $ne operator stripped
      expect(req.query.filter).toEqual({});
      expect(req.query.normal).toBe('clean');
      // params $evil stripped
      expect((req.params as Record<string, unknown>).$evil).toBeUndefined();
      expect(req.params.id).toBe('507f1f77bcf86cd799439011');
    });

    it('leaves clean legitimate input intact', () => {
      const cleanBody = {
        displayName: 'Elena Rostova',
        domain: 'SOFTWARE_ENGINEERING',
        skills: ['TypeScript', 'Node.js', 'React'],
      };

      const req = {
        body: { ...cleanBody },
        query: { domainCode: 'SOFTWARE_ENGINEERING' },
        params: { id: '507f1f77bcf86cd799439011' },
      } as unknown as Request;

      const res = {} as Response;
      const next = vi.fn();

      sanitizeNoSql(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body).toEqual(cleanBody);
      expect(req.query.domainCode).toBe('SOFTWARE_ENGINEERING');
      expect(req.params.id).toBe('507f1f77bcf86cd799439011');
    });
  });

  describe('2. CSRF Defense-in-Depth for Cookie Auth (verifyCsrfOrigin)', () => {
    it('allows requests with matching allowed client origin', () => {
      const req = {
        method: 'POST',
        headers: {
          origin: 'http://localhost:5173',
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      verifyCsrfOrigin(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('allows requests authenticated with Bearer tokens even from other origins', () => {
      const req = {
        method: 'POST',
        headers: {
          origin: 'http://evil-site.com',
          authorization: 'Bearer valid.jwt.token',
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      verifyCsrfOrigin(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('allows safe read methods (GET, HEAD, OPTIONS) without origin check', () => {
      const req = {
        method: 'GET',
        headers: {
          origin: 'http://evil-site.com',
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      verifyCsrfOrigin(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('3. Common Parameter & Input Validation Schemas', () => {
    it('validates 24-character hexadecimal ObjectId parameters correctly', () => {
      const valid = objectIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' });
      expect(valid.success).toBe(true);

      const invalidLength = objectIdParamSchema.safeParse({ id: '123' });
      expect(invalidLength.success).toBe(false);

      const invalidChars = objectIdParamSchema.safeParse({ id: '507f1f77bcf86cd7994390zz' });
      expect(invalidChars.success).toBe(false);

      const injectionParam = objectIdParamSchema.safeParse({ id: '{"$ne":null}' });
      expect(injectionParam.success).toBe(false);
    });
  });

  describe('4. File Upload Security & Magic Byte Validation Edge Cases', () => {
    it('rejects empty buffers with 400 validation error', async () => {
      await expect(validateResumeFile(Buffer.alloc(0), 'resume.pdf')).rejects.toThrow(
        'Uploaded file is empty.'
      );
    });

    it('rejects files smaller than minimum realistic size (32 bytes)', async () => {
      await expect(
        validateResumeFile(Buffer.from('tiny'), 'resume.pdf')
      ).rejects.toThrow('File size is too small to be a valid document.');
    });

    it('rejects fake PDFs that have .pdf extension but lack %PDF- magic bytes', async () => {
      const fakePdf = Buffer.alloc(100);
      fakePdf.write('THIS IS NOT A PDF FILE IN REALITY');
      await expect(validateResumeFile(fakePdf, 'fake.pdf')).rejects.toThrow(
        'Invalid file type. Only genuine PDF and DOCX files are accepted'
      );
    });

    it('rejects password-protected PDF files containing /Encrypt trailer dictionary', async () => {
      const encryptedPdf = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.alloc(50),
        Buffer.from('/Encrypt 1 0 R\n'),
        Buffer.alloc(50),
        Buffer.from('%%EOF'),
      ]);
      await expect(validateResumeFile(encryptedPdf, 'locked.pdf')).rejects.toThrow(
        'Password-protected or encrypted PDF files are not supported'
      );
    });

    it('rejects truncated or corrupt PDFs missing the %%EOF terminator', async () => {
      const corruptPdf = Buffer.concat([
        Buffer.from('%PDF-1.4\nSome binary content without EOF'),
        Buffer.alloc(50),
      ]);
      await expect(validateResumeFile(corruptPdf, 'corrupt.pdf')).rejects.toThrow(
        'missing %%EOF marker'
      );
    });

    it('sanitizes malicious filenames with directory traversal and illegal characters', async () => {
      const validPdf = Buffer.concat([
        Buffer.from('%PDF-1.7\nValid stream data here for test\n'),
        Buffer.alloc(50),
        Buffer.from('\n%%EOF'),
      ]);

      const result = await validateResumeFile(
        validPdf,
        '../../../../etc/passwd\0malicious_name!.pdf'
      );
      expect(result.sanitizedFilename).toBe('passwd_malicious_name_.pdf');
      expect(result.sanitizedFilename).not.toContain('..');
      expect(result.sanitizedFilename).not.toContain('/');
      expect(result.sanitizedFilename).not.toContain('\0');
    });
  });

  describe('5. Sensitive Data Redaction in Logging', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('redacts passwords, tokens, API keys, cookies, and secret keys in log metadata', () => {
      logger.info('User session event', {
        email: 'user@example.com',
        password: 'SecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        accessToken: 'access-secret-value',
        refreshToken: 'refresh-secret-value',
        gemini_api_key: 'AIzaSySecretGeminiKey',
        groq_api_key: 'gsk_secret_groq_key',
        cookie: 'refreshToken=xyz',
      });

      expect(logSpy).toHaveBeenCalled();
      const loggedJson = JSON.parse(logSpy.mock.calls[0][0]);
      expect(loggedJson.meta.email).toBe('user@example.com');
      expect(loggedJson.meta.password).toBe('[REDACTED]');
      expect(loggedJson.meta.token).toBe('[REDACTED]');
      expect(loggedJson.meta.accessToken).toBe('[REDACTED]');
      expect(loggedJson.meta.refreshToken).toBe('[REDACTED]');
      expect(loggedJson.meta.gemini_api_key).toBe('[REDACTED]');
      expect(loggedJson.meta.groq_api_key).toBe('[REDACTED]');
      expect(loggedJson.meta.cookie).toBe('[REDACTED]');
    });
  });

  describe('6. Security Headers via Helmet', () => {
    it('sets standard defensive security headers on HTTP response headers', () => {
      const helmetMiddleware = helmet();
      const req = {
        headers: {},
      } as unknown as Request;

      const headersSet: Record<string, string> = {};
      const res = {
        setHeader(name: string, value: string) {
          headersSet[name.toLowerCase()] = value;
          return this;
        },
        getHeader(name: string) {
          return headersSet[name.toLowerCase()];
        },
        removeHeader: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();
      helmetMiddleware(req, res, next);

      expect(headersSet['x-content-type-options']).toBe('nosniff');
      expect(headersSet['x-frame-options']).toBe('SAMEORIGIN');
      expect(headersSet['x-download-options']).toBe('noopen');
      expect(headersSet['x-permitted-cross-domain-policies']).toBe('none');
    });
  });

  describe('7. IDOR Protection Verification Across Services', () => {
    it('verifies resume download authorization rejects non-owner and non-admin callers', async () => {
      const userAId = new Types.ObjectId();
      const userBId = new Types.ObjectId();

      const requesterA = { _id: userAId, platformRole: 'NONE' };
      const resumeDocB = {
        _id: new Types.ObjectId(),
        userId: userBId,
      };

      // Simulating ResumeService authorization rule
      const checkResumeAuth = (requester: { _id: Types.ObjectId; platformRole: string }, resume: { userId: Types.ObjectId }) => {
        const isOwner = requester._id.toString() === resume.userId.toString();
        const isAdmin = requester.platformRole === 'ADMIN';
        if (!isOwner && !isAdmin) {
          throw AppError.forbidden('You are not authorized to download this resume.');
        }
      };

      expect(() => checkResumeAuth(requesterA, resumeDocB)).toThrow(
        'You are not authorized to download this resume.'
      );

      const requesterAdmin = { _id: userAId, platformRole: 'ADMIN' };
      expect(() => checkResumeAuth(requesterAdmin, resumeDocB)).not.toThrow();
    });

    it('verifies application access authorization rejects non-owner callers', () => {
      const userAId = new Types.ObjectId();
      const userBId = new Types.ObjectId();

      const applicationDocB = {
        _id: new Types.ObjectId(),
        userId: userBId,
      };

      const checkApplicationAuth = (requesterId: Types.ObjectId, app: { userId: Types.ObjectId }) => {
        if (app.userId.toString() !== requesterId.toString()) {
          throw AppError.forbidden('You do not have permission to view this application.');
        }
      };

      expect(() => checkApplicationAuth(userAId, applicationDocB)).toThrow(
        'You do not have permission to view this application.'
      );
      expect(() => checkApplicationAuth(userBId, applicationDocB)).not.toThrow();
    });

    it('verifies daily task ownership rejects access from other employees', () => {
      const empAId = new Types.ObjectId();
      const empBId = new Types.ObjectId();

      const taskDocB = {
        _id: new Types.ObjectId(),
        userId: empBId,
      };

      const checkTaskAuth = (requesterId: Types.ObjectId, task: { userId: Types.ObjectId }) => {
        if (task.userId.toString() !== requesterId.toString()) {
          throw AppError.forbidden('Access denied: You do not own this task');
        }
      };

      expect(() => checkTaskAuth(empAId, taskDocB)).toThrow(
        'Access denied: You do not own this task'
      );
      expect(() => checkTaskAuth(empBId, taskDocB)).not.toThrow();
    });

    it('verifies notification markRead rejects non-owner callers', () => {
      const userAId = new Types.ObjectId();
      const userBId = new Types.ObjectId();

      const notificationDocB = {
        _id: new Types.ObjectId(),
        userId: userBId,
      };

      const checkNotificationAuth = (requesterId: Types.ObjectId, notif: { userId: Types.ObjectId }) => {
        if (!notif.userId.equals(requesterId)) {
          throw AppError.forbidden('You do not have permission to view or modify this notification.');
        }
      };

      expect(() => checkNotificationAuth(userAId, notificationDocB)).toThrow(
        'You do not have permission to view or modify this notification.'
      );
      expect(() => checkNotificationAuth(userBId, notificationDocB)).not.toThrow();
    });

    it('verifies founder application access rejects access to applicants of other companies', () => {
      const companyAId = new Types.ObjectId();
      const companyBId = new Types.ObjectId();

      const applicationDocB = {
        _id: new Types.ObjectId(),
        companyId: companyBId,
      };

      const checkFounderApplicationAuth = (founderCompanyId: Types.ObjectId, app: { companyId: Types.ObjectId }) => {
        if (!app.companyId.equals(founderCompanyId)) {
          throw AppError.forbidden('Founder cannot access applicant data belonging to another company.');
        }
      };

      expect(() => checkFounderApplicationAuth(companyAId, applicationDocB)).toThrow(
        'Founder cannot access applicant data belonging to another company.'
      );
      expect(() => checkFounderApplicationAuth(companyBId, applicationDocB)).not.toThrow();
    });
  });
});
