import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

const storage = multer.memoryStorage();

// Memory ceiling set to 50 MB (maximum allowed in PlatformConfig schema) to prevent heap starvation
const upload = multer({
  storage,
  limits: {
    fileSize: 52428800,
    files: 1,
  },
});

/**
 * Express middleware for parsing single resume file multipart uploads.
 * Accepts either field 'resume' or 'file'.
 */
export const uploadResumeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const handler = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError('File size exceeds the maximum upload threshold.', 'VALIDATION_ERROR', 413)
        );
      }
      return next(
        new AppError(err.message || 'Multipart form parsing failed.', 'VALIDATION_ERROR', 400)
      );
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = files?.resume?.[0] || files?.file?.[0];

    if (!file) {
      return next(
        AppError.validation(
          'No resume file was attached. Please attach a file under field "resume".',
          { reason: 'MISSING_FILE' }
        )
      );
    }

    req.file = file;
    next();
  });
};
