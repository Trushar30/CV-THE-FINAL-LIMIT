import mongoose, { Types } from 'mongoose';
import { ResumeFile, type IResumeFileDocument } from '../../models/ResumeFile.js';
import { ProfileModel } from '../../models/Profile.js';
import { UserModel } from '../../models/User.js';
import { configService } from '../config/config.service.js';
import { validateResumeFile } from '../../utils/fileValidation.js';
import { AppError } from '../../utils/errors.js';
import type { PlatformRole } from '../../types/enums.js';

export interface RequesterIdentity {
  _id: string | Types.ObjectId;
  platformRole?: PlatformRole;
  careerRole?: string;
}

export class ResumeService {
  /**
   * Returns a GridFS bucket instance attached to the active MongoDB connection.
   */
  public getBucket(): mongoose.mongo.GridFSBucket {
    if (!mongoose.connection.db) {
      throw new AppError(
        'Database connection is not available for GridFS operations',
        'INTERNAL_SERVER_ERROR',
        500
      );
    }
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'resumes',
    });
  }

  /**
   * Authoritatively uploads, validates, stores in GridFS, records metadata,
   * updates the user's profile linkage and advances their onboarding step.
   */
  public async uploadResume(
    userId: string | Types.ObjectId,
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
      mimetype?: string;
    }
  ): Promise<IResumeFileDocument> {
    if (!file || !file.buffer) {
      throw AppError.validation('No resume file provided.', { reason: 'MISSING_FILE' });
    }

    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    // 1. Fetch max allowed size dynamically from PlatformConfig (default 10 MB = 10,485,760 bytes)
    const securityConfig = await configService.getSecurityConfig();
    const maxSizeBytes = securityConfig.resumeMaxSizeBytes || 10485760;

    if (file.size > maxSizeBytes || file.buffer.length > maxSizeBytes) {
      const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      throw new AppError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of ${maxMb} MB.`,
        'VALIDATION_ERROR',
        413,
        { sizeBytes: file.size, maxSizeBytes }
      );
    }

    // 2. Validate real file type by magic bytes (PDF & DOCX only, rejects corruption & passwords)
    const validated = await validateResumeFile(file.buffer, file.originalname);

    // 3. Store binary payload into MongoDB GridFS
    const bucket = this.getBucket();
    const uploadStream = bucket.openUploadStream(validated.sanitizedFilename, {
      contentType: validated.mimeType,
      metadata: {
        userId: userObjectId.toString(),
        sha256: validated.sha256,
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadStream.on('error', (err) => reject(err));
      uploadStream.on('finish', () => resolve());
      uploadStream.end(file.buffer);
    });

    const gridFsFileId = uploadStream.id as Types.ObjectId;

    // 4. Archive previous resumes per ADR-039 (Archive & Preserve for application history)
    await ResumeFile.updateMany(
      { userId: userObjectId, status: { $ne: 'ARCHIVED' } },
      { $set: { status: 'ARCHIVED' } }
    );

    // 5. Create authoritative metadata record in resumes collection
    const resumeRecord = await ResumeFile.create({
      userId: userObjectId,
      gridFsFileId,
      filename: validated.sanitizedFilename,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      sha256: validated.sha256,
      status: 'UPLOADED',
    });

    // 6. Update user's Profile with active resumeId
    await ProfileModel.findOneAndUpdate(
      { userId: userObjectId },
      { $set: { resumeId: resumeRecord._id } },
      { upsert: false }
    );

    // 7. Advance onboarding step if user is currently at or prior to RESUME stage
    const user = await UserModel.findById(userObjectId);
    if (
      user &&
      ['REGISTERED', 'EMAIL_VERIFIED', 'NAME', 'DOMAIN', 'SKILLS'].includes(user.onboardingStep)
    ) {
      user.onboardingStep = 'RESUME';
      await user.save();
    }

    return resumeRecord;
  }

  /**
   * Retrieves a streamed download for the document owner and ADMIN only.
   */
  public async getResumeDownloadStream(
    requester: RequesterIdentity,
    resumeId: string | Types.ObjectId
  ): Promise<{
    stream: NodeJS.ReadableStream;
    resume: IResumeFileDocument;
  }> {
    if (!resumeId || !mongoose.isValidObjectId(resumeId)) {
      throw AppError.badRequest('Invalid resume ID format.');
    }

    const resumeDoc = await ResumeFile.findById(resumeId);
    if (!resumeDoc) {
      throw AppError.notFound('Resume not found.');
    }

    // Authorization check: Owner or ADMIN platform role only
    const requesterIdStr = requester._id.toString();
    const ownerIdStr = resumeDoc.userId.toString();
    const isAdmin = requester.platformRole === 'ADMIN';

    if (requesterIdStr !== ownerIdStr && !isAdmin) {
      throw AppError.forbidden('You are not authorized to download this resume.');
    }

    // Verify binary chunk exists in GridFS
    const bucket = this.getBucket();
    const files = await bucket.find({ _id: resumeDoc.gridFsFileId }).toArray();
    if (!files || files.length === 0) {
      throw AppError.notFound('Resume binary file not found in storage.');
    }

    const stream = bucket.openDownloadStream(resumeDoc.gridFsFileId);
    return {
      stream,
      resume: resumeDoc,
    };
  }

  /**
   * Retrieves resume metadata record, verifying authorization.
   */
  public async getResumeMetadata(
    requester: RequesterIdentity,
    resumeId: string | Types.ObjectId
  ): Promise<IResumeFileDocument> {
    if (!resumeId || !mongoose.isValidObjectId(resumeId)) {
      throw AppError.badRequest('Invalid resume ID format.');
    }

    const resumeDoc = await ResumeFile.findById(resumeId);
    if (!resumeDoc) {
      throw AppError.notFound('Resume not found.');
    }

    const requesterIdStr = requester._id.toString();
    const ownerIdStr = resumeDoc.userId.toString();
    const isAdmin = requester.platformRole === 'ADMIN';

    if (requesterIdStr !== ownerIdStr && !isAdmin) {
      throw AppError.forbidden('You are not authorized to view this resume metadata.');
    }

    return resumeDoc;
  }

  /**
   * Retrieves the active resume for a specific candidate.
   */
  public async getActiveResumeForUser(
    userId: string | Types.ObjectId
  ): Promise<IResumeFileDocument | null> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const profile = await ProfileModel.findOne({ userId: userObjectId });
    if (profile?.resumeId) {
      const active = await ResumeFile.findById(profile.resumeId);
      if (active) return active;
    }

    return ResumeFile.findOne({ userId: userObjectId, status: 'UPLOADED' }).sort({
      createdAt: -1,
    });
  }
}

export const resumeService = new ResumeService();
