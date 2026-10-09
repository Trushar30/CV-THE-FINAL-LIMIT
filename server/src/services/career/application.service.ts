import { Types } from 'mongoose';
import { ApplicationModel, type IApplicationDocument } from '../../models/Application.js';
import { CompanyModel } from '../../models/Company.js';
import { CompanyJobModel } from '../../models/CompanyJob.js';
import { UserModel } from '../../models/User.js';
import { ProfileModel } from '../../models/Profile.js';
import { ResumeAnalysisModel } from '../../models/ResumeAnalysis.js';
import { FeedbackModel, type IFeedbackDocument } from '../../models/Feedback.js';
import { notificationService } from '../notification/notification.service.js';
import { ApplicationStateMachine } from './applicationStateMachine.js';
import { configService } from '../config/config.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type {
  ApplicationMode,
  ApplicationStage,
  ApplicationStatus,
} from '../../types/enums.js';

export interface ApplyForJobInput {
  jobId: string | Types.ObjectId;
  mode?: ApplicationMode;
}

export interface ListApplicationsFilters {
  status?: ApplicationStatus;
  currentStage?: ApplicationStage;
  jobId?: string | Types.ObjectId;
  companyId?: string | Types.ObjectId;
  page?: number;
  limit?: number;
}

export class ApplicationService {
  /**
   * Submit a new job application.
   * Enforces:
   * 1. Candidate must have careerRole === 'JOB_SEEKER'.
   * 2. Candidate must have a completed Profile and completed ResumeAnalysis.
   * 3. Max active applications limit from PlatformConfig (default: 5).
   * 4. Duplicate prevention: cannot apply if an active application exists for this job.
   * 5. Target job must be OPEN and target company ACTIVE.
   * 6. Captures immutable ResumeAnalysisSnapshot.
   */
  public async applyForJob(
    userId: string | Types.ObjectId,
    input: ApplyForJobInput
  ): Promise<IApplicationDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const jobObjectId = new Types.ObjectId(input.jobId);

    // 1. Verify user exists and has careerRole === 'JOB_SEEKER'
    const user = await UserModel.findById(userObjectId);
    if (!user) {
      throw AppError.notFound('Candidate user account not found.');
    }
    if (user.careerRole !== 'JOB_SEEKER') {
      throw AppError.businessRuleViolation(
        `Only users with career role JOB_SEEKER can apply for jobs (current role: '${user.careerRole}').`
      );
    }

    // 2. Verify candidate has completed Profile & ResumeAnalysis
    const profile = await ProfileModel.findOne({ userId: userObjectId });
    if (!profile) {
      throw AppError.businessRuleViolation('Candidate profile must be created before applying.');
    }
    if (!profile.resumeAnalysisId) {
      throw AppError.businessRuleViolation(
        'A completed resume analysis is required to apply for jobs.'
      );
    }

    const resumeAnalysis = await ResumeAnalysisModel.findById(profile.resumeAnalysisId);
    if (!resumeAnalysis || resumeAnalysis.status !== 'COMPLETED') {
      throw AppError.businessRuleViolation(
        'Resume analysis must be in COMPLETED status to apply.'
      );
    }

    // 3. Verify maximum active applications limit from PlatformConfig (default 5)
    let maxActive = 5;
    try {
      const applicationsConfig = await configService.getApplicationsConfig();
      if (applicationsConfig && typeof applicationsConfig.maxActive === 'number') {
        maxActive = applicationsConfig.maxActive;
      }
    } catch (err) {
      logger.warn('[ApplicationService] Could not fetch PlatformConfig applications section, defaulting to 5', {
        error: (err as Error).message,
      });
    }

    const activeCount = await ApplicationModel.countDocuments({
      userId: userObjectId,
      status: 'ACTIVE',
    });

    if (activeCount >= maxActive) {
      throw AppError.businessRuleViolation(
        `Maximum active applications limit reached (${maxActive}). Withdraw or wait for existing applications to complete before applying.`
      );
    }

    // 4. Duplicate check: candidate cannot have another ACTIVE application to the same job
    const existingActive = await ApplicationModel.findOne({
      userId: userObjectId,
      jobId: jobObjectId,
      status: 'ACTIVE',
    });

    if (existingActive) {
      throw AppError.conflict(
        'An active application already exists for this job. You cannot submit multiple active applications for the same position.'
      );
    }

    // 5. Verify target job exists and is OPEN
    const job = await CompanyJobModel.findById(jobObjectId);
    if (!job) {
      throw AppError.notFound('Job requisition not found.');
    }
    if (job.status !== 'OPEN' || job.isOpen === false) {
      throw AppError.businessRuleViolation(
        'This job requisition is closed and no longer accepting applications.'
      );
    }

    // 6. Verify target company exists and is ACTIVE
    const company = await CompanyModel.findById(job.companyId);
    if (!company) {
      throw AppError.notFound('Target company not found.');
    }
    if (company.status !== 'ACTIVE') {
      throw AppError.businessRuleViolation(
        `Cannot apply to '${company.name}' because company is ${company.status.toLowerCase()}.`
      );
    }

    // 7. Resolve mode (PRODUCTION or DEMO)
    const mode: ApplicationMode = input.mode === 'DEMO' ? 'DEMO' : 'PRODUCTION';

    // 8. Assemble snapshot of candidate resume analysis
    const resumeAnalysisSnapshot = {
      resumeAnalysisId: resumeAnalysis._id,
      resumeId: resumeAnalysis.resumeId,
      domainClassification: resumeAnalysis.domainClassification,
      parsedSkills: resumeAnalysis.parsedSkills ?? [],
      yearsOfExperience: resumeAnalysis.yearsOfExperience ?? 0,
      extractedSummary: resumeAnalysis.extractedSummary,
      name: resumeAnalysis.name,
      education: resumeAnalysis.education ?? [],
      workHistory: resumeAnalysis.workHistory ?? [],
      projects: resumeAnalysis.projects ?? [],
      certifications: resumeAnalysis.certifications ?? [],
      snapshotAt: new Date(),
    };

    // 9. Instantiate application with initial APPLIED stage and stageHistory
    const application = new ApplicationModel({
      userId: userObjectId,
      jobId: job._id,
      companyId: company._id,
      mode,
      currentStage: 'APPLIED',
      status: 'ACTIVE',
      resumeAnalysisId: resumeAnalysis._id,
      resumeAnalysisSnapshot,
      stageHistory: [
        {
          stage: 'APPLIED',
          enteredAt: new Date(),
        },
      ],
    });

    await application.save();

    logger.info('[ApplicationService] New application submitted', {
      applicationId: application._id.toString(),
      userId: userObjectId.toString(),
      jobId: job._id.toString(),
      companyId: company._id.toString(),
      mode,
      activeCount: activeCount + 1,
    });

    return application;
  }

  /**
   * Withdraw an active application voluntarily.
   */
  public async withdrawApplication(
    userId: string | Types.ObjectId,
    applicationId: string | Types.ObjectId,
    reason?: string
  ): Promise<IApplicationDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const appObjectId = new Types.ObjectId(applicationId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (application.userId.toString() !== userObjectId.toString()) {
      throw AppError.forbidden('You do not have permission to withdraw this application.');
    }

    ApplicationStateMachine.withdraw(application, {
      reason: reason || 'Voluntary candidate withdrawal',
    });

    await application.save();

    logger.info('[ApplicationService] Application withdrawn', {
      applicationId: application._id.toString(),
      userId: userObjectId.toString(),
      reason,
    });

    return application;
  }

  /**
   * List applications for a candidate with optional filtering.
   */
  public async getApplications(
    userId: string | Types.ObjectId,
    filters?: ListApplicationsFilters
  ): Promise<{ applications: IApplicationDocument[]; total: number; page: number; limit: number }> {
    const userObjectId = new Types.ObjectId(userId);
    const query: Record<string, unknown> = { userId: userObjectId };

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.currentStage) {
      query.currentStage = filters.currentStage;
    }
    if (filters?.jobId) {
      query.jobId = new Types.ObjectId(filters.jobId);
    }
    if (filters?.companyId) {
      query.companyId = new Types.ObjectId(filters.companyId);
    }

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      ApplicationModel.find(query)
        .populate('companyId', 'name description type companyRating')
        .populate('jobId', 'title domain minLevel maxLevel openings status')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      ApplicationModel.countDocuments(query),
    ]);

    return { applications, total, page, limit };
  }

  /**
   * Get application by ID.
   */
  public async getApplicationById(
    applicationId: string | Types.ObjectId,
    requestingUserId?: string | Types.ObjectId
  ): Promise<IApplicationDocument> {
    const appObjectId = new Types.ObjectId(applicationId);

    const application = await ApplicationModel.findById(appObjectId)
      .populate('companyId', 'name description type companyRating')
      .populate('jobId', 'title domain minLevel maxLevel requiredSkills status');

    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (
      requestingUserId &&
      application.userId.toString() !== requestingUserId.toString()
    ) {
      throw AppError.forbidden('You do not have permission to view this application.');
    }

    return application;
  }

  /**
   * Retrieves the stored rejection feedback for an application.
   * Strictly owner-only, and only valid for REJECTED applications per Spec Section 27.4.
   */
  public async getApplicationFeedback(
    applicationId: string | Types.ObjectId,
    requestingUserId: string | Types.ObjectId
  ): Promise<IFeedbackDocument> {
    const appObjectId = new Types.ObjectId(applicationId);
    const userObjectId = new Types.ObjectId(requestingUserId);

    const application = await ApplicationModel.findById(appObjectId);
    if (!application) {
      throw AppError.notFound('Application not found.');
    }

    if (!application.userId.equals(userObjectId)) {
      throw AppError.forbidden('You do not have permission to view feedback for this application.');
    }

    if (application.status !== 'REJECTED') {
      throw AppError.badRequest('Feedback is only available for rejected applications.');
    }

    const feedback = await FeedbackModel.findOne({ applicationId: appObjectId });
    if (!feedback) {
      throw AppError.notFound('No feedback found for this rejected application.');
    }

    return feedback;
  }

  /**
   * Expiry job for stale applications.
   * Finds active applications where last stage activity / updatedAt is older than staleDays.
   * Note: The spec does not fix an exact application staleness window; default is 30 days.
   */
  public async expireStaleApplications(staleDays = 30): Promise<{
    expiredCount: number;
    expiredApplicationIds: string[];
  }> {
    const cutoffDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const staleApplications = await ApplicationModel.find({
      status: 'ACTIVE',
      updatedAt: { $lte: cutoffDate },
    });

    const expiredApplicationIds: string[] = [];

    for (const app of staleApplications) {
      try {
        ApplicationStateMachine.expire(app, {
          reason: `Application expired after ${staleDays} days of inactivity.`,
        });
        await app.save();
        expiredApplicationIds.push(app._id.toString());

        // Notify candidate of expired application
        try {
          await notificationService.create({
            userId: app.userId,
            type: 'APPLICATION_EXPIRED',
            title: 'Application Expired',
            message: `Your application has expired after ${staleDays} days of inactivity.`,
            link: `/applications/${app._id}`,
          });
        } catch (notifErr) {
          logger.warn('[ApplicationService] Failed to send expiration notification', {
            applicationId: app._id.toString(),
            error: (notifErr as Error).message,
          });
        }
      } catch (err) {
        logger.error('[ApplicationService] Failed to expire stale application', {
          applicationId: app._id.toString(),
          error: (err as Error).message,
        });
      }
    }

    logger.info('[ApplicationService] Stale application expiry job completed', {
      staleDays,
      cutoffDate,
      expiredCount: expiredApplicationIds.length,
    });

    return {
      expiredCount: expiredApplicationIds.length,
      expiredApplicationIds,
    };
  }
}

export const applicationService = new ApplicationService();
