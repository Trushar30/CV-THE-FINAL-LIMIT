import { Router } from 'express';
import { resumeController } from '../controllers/resume.controller.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { uploadResumeMiddleware } from '../middleware/upload.middleware.js';
import { resumeUploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Upload resume binary (multipart/form-data)
// Spec Section 27.2: POST /api/profile/resume/upload
router.post(
  '/upload',
  authenticateJwt,
  resumeUploadLimiter,
  uploadResumeMiddleware,
  resumeController.uploadResume.bind(resumeController)
);

// Get current candidate's active resume metadata
router.get('/active', authenticateJwt, resumeController.getActiveResume.bind(resumeController));

// Get current candidate's active resume analysis results & status
router.get(
  '/analysis',
  authenticateJwt,
  resumeController.getActiveResumeAnalysis.bind(resumeController)
);

// Stream raw binary download (Owner or ADMIN only)
// Spec Section 27.2: GET /api/profile/resume/:id/download
router.get(
  '/:id/download',
  authenticateJwt,
  resumeController.downloadResume.bind(resumeController)
);

// Get specific resume analysis results & status (Owner or ADMIN only)
router.get(
  '/:id/analysis',
  authenticateJwt,
  resumeController.getResumeAnalysisById.bind(resumeController)
);

// Get specific resume metadata (Owner or ADMIN only)
router.get('/:id', authenticateJwt, resumeController.getResumeMetadata.bind(resumeController));

export const resumeRouter = router;
