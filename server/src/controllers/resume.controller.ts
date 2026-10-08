import type { Request, Response, NextFunction } from 'express';
import { resumeService } from '../services/resume/resume.service.js';
import { resumeAnalysisService } from '../services/resume/resumeAnalysis.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class ResumeController {
  /**
   * Uploads a candidate resume binary, validates magic bytes, records metadata,
   * and enqueues text extraction and AI analysis.
   * Spec Section 27.2: POST /api/profile/resume/upload -> 202 Accepted
   */
  public async uploadResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required to upload a resume.');
      }

      if (!req.file) {
        throw AppError.validation('No resume file was attached.', { reason: 'MISSING_FILE' });
      }

      const resumeDoc = await resumeService.uploadResume(req.user._id, req.file);

      // Enqueue text extraction & AI resume analysis pipeline
      let analysisId: string | undefined;
      try {
        const analysisDoc = await resumeAnalysisService.createAndEnqueueJob(
          resumeDoc._id,
          req.user._id
        );
        analysisId = analysisDoc._id.toString();
      } catch (pipelineErr) {
        logger.warn(
          `[ResumeController] Could not immediately enqueue analysis: ${(pipelineErr as Error).message}`
        );
      }

      res.status(202).json({
        success: true,
        data: {
          resumeId: resumeDoc._id.toString(),
          analysisId,
          filename: resumeDoc.filename,
          sizeBytes: resumeDoc.sizeBytes,
          mimeType: resumeDoc.mimeType,
          checksum: resumeDoc.sha256,
          status: resumeDoc.status,
          message: 'Resume uploaded successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Downloads the raw binary of a resume via streamed response.
   * Restricted strictly to the document owner and users with platformRole 'ADMIN'.
   * GET /api/profile/resume/:id/download
   */
  public async downloadResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required to download a resume.');
      }

      const id = req.params.id;
      if (!id) {
        throw AppError.badRequest('Resume ID is required.');
      }
      const { stream, resume } = await resumeService.getResumeDownloadStream(req.user, id);

      res.setHeader('Content-Type', resume.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${resume.filename}"`);
      res.setHeader('Content-Length', resume.sizeBytes);

      stream.on('error', (streamErr) => {
        if (!res.headersSent) {
          next(streamErr);
        }
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves resume metadata for the owner or ADMIN.
   * GET /api/profile/resume/:id
   */
  public async getResumeMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = req.params.id;
      if (!id) {
        throw AppError.badRequest('Resume ID is required.');
      }
      const resume = await resumeService.getResumeMetadata(req.user, id);

      res.status(200).json({
        success: true,
        data: {
          resume: {
            id: resume._id.toString(),
            userId: resume.userId.toString(),
            filename: resume.filename,
            mimeType: resume.mimeType,
            sizeBytes: resume.sizeBytes,
            checksum: resume.sha256,
            status: resume.status,
            createdAt: resume.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves the current user's active resume metadata.
   * GET /api/profile/resume/active
   */
  public async getActiveResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const resume = await resumeService.getActiveResumeForUser(req.user._id);
      if (!resume) {
        throw AppError.notFound('No active resume found for this profile.');
      }

      res.status(200).json({
        success: true,
        data: {
          resume: {
            id: resume._id.toString(),
            userId: resume.userId.toString(),
            filename: resume.filename,
            mimeType: resume.mimeType,
            sizeBytes: resume.sizeBytes,
            checksum: resume.sha256,
            status: resume.status,
            createdAt: resume.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves analysis results and status for the caller's active resume.
   * GET /api/profile/resume/analysis
   */
  public async getActiveResumeAnalysis(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const analysis = await resumeAnalysisService.getActiveAnalysisForUser(req.user._id);
      res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves analysis results and status for a specific resume ID.
   * GET /api/profile/resume/:id/analysis
   */
  public async getResumeAnalysisById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = req.params.id;
      if (!id) {
        throw AppError.badRequest('Resume ID is required.');
      }

      const analysis = await resumeAnalysisService.getAnalysisByResumeId(id, req.user);
      res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const resumeController = new ResumeController();
