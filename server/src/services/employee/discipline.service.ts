import { Types } from 'mongoose';
import { WarningModel, type IWarningDocument } from '../../models/Warning.js';
import { DemotionModel, type IDemotionDocument } from '../../models/Demotion.js';
import { EmploymentReviewModel, type IEmploymentReviewDocument } from '../../models/EmploymentReview.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../../models/CompanyEmployee.js';
import { CompanyModel } from '../../models/Company.js';
import { UserModel } from '../../models/User.js';
import { ConfigService, configService as defaultConfigService } from '../config/config.service.js';
import { AuditService, auditService as defaultAuditService } from '../audit/audit.service.js';
import { NotificationService, notificationService as defaultNotificationService } from '../notification/notification.service.js';
import { clampScore } from '../economy/expEngine.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface IssueWarningParams {
  userId: string | Types.ObjectId;
  companyId: string | Types.ObjectId;
  taskSubmissionId: string | Types.ObjectId;
  score: number;
  reason?: string;
  sourcePerformanceRecordId?: string | Types.ObjectId;
}

export interface ForceTerminateParams {
  employeeId: string | Types.ObjectId;
  adminUserId: string | Types.ObjectId;
  reason: string;
  confirmation: string;
}

export class DisciplineService {
  constructor(
    private readonly configService: ConfigService = defaultConfigService,
    private readonly auditService: AuditService = defaultAuditService,
    private readonly notificationService: NotificationService = defaultNotificationService
  ) {}

  /**
   * Retrieves active warnings for a user/company.
   * Active = status is ACTIVE and expiresAt > now (decay computed purely by query, cron-free).
   */
  public async getActiveWarnings(
    userId: string | Types.ObjectId,
    companyId?: string | Types.ObjectId
  ): Promise<IWarningDocument[]> {
    const now = new Date();
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId.toString()),
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    };

    if (companyId) {
      query.companyId = new Types.ObjectId(companyId.toString());
    }

    return await WarningModel.find(query).sort({ issuedAt: -1 });
  }

  /**
   * Counts active warnings for a user/company.
   * Decays naturally past 30 days without cron jobs.
   */
  public async getActiveWarningsCount(
    userId: string | Types.ObjectId,
    companyId?: string | Types.ObjectId
  ): Promise<number> {
    const now = new Date();
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId.toString()),
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    };

    if (companyId) {
      query.companyId = new Types.ObjectId(companyId.toString());
    }

    return await WarningModel.countDocuments(query);
  }

  /**
   * Issues a warning ONLY per approved D4:
   * Triggers when task performance score is in the Poor band (0 <= score <= 39).
   * Enforces 1 warning per task submission (idempotency).
   * If active warnings reach warningThreshold (default 4), automatically triggers Employment Review per D5.
   */
  public async issueWarning(params: IssueWarningParams): Promise<{
    warning: IWarningDocument | null;
    activeCount: number;
    employmentReview: IEmploymentReviewDocument | null;
  }> {
    const { userId, companyId, taskSubmissionId, score, reason, sourcePerformanceRecordId } = params;

    const clamped = clampScore(score);

    // Rule D4: A warning is issued ONLY if score is in the Poor band (score <= 39)
    if (clamped > 39) {
      const activeCount = await this.getActiveWarningsCount(userId, companyId);
      return { warning: null, activeCount, employmentReview: null };
    }

    const userObjectId = new Types.ObjectId(userId.toString());
    const companyObjectId = new Types.ObjectId(companyId.toString());
    const submissionObjectId = new Types.ObjectId(taskSubmissionId.toString());

    // 1. Idempotency Check: prevent duplicate warning for same submission
    const existing = await WarningModel.findOne({ taskSubmissionId: submissionObjectId });
    if (existing) {
      const activeCount = await this.getActiveWarningsCount(userId, companyId);
      return { warning: existing, activeCount, employmentReview: null };
    }

    const employeeConfig = await this.configService.getEmployeeConfig();
    const expirationDays = employeeConfig.warningExpirationDays ?? 30;

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + expirationDays * 86400000);

    const warningReason =
      reason || `Substandard task performance score of ${clamped}/100 in the Poor band.`;

    let warning: IWarningDocument;
    try {
      warning = await WarningModel.create({
        userId: userObjectId,
        companyId: companyObjectId,
        taskSubmissionId: submissionObjectId,
        sourcePerformanceRecordId: sourcePerformanceRecordId
          ? new Types.ObjectId(sourcePerformanceRecordId.toString())
          : undefined,
        status: 'ACTIVE',
        reason: warningReason,
        issuedAt,
        expiresAt,
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        const found = await WarningModel.findOne({ taskSubmissionId: submissionObjectId });
        if (found) {
          const activeCount = await this.getActiveWarningsCount(userId, companyId);
          return { warning: found, activeCount, employmentReview: null };
        }
      }
      throw err;
    }

    // 2. Count active warnings (strictly unexpired)
    const activeCount = await this.getActiveWarningsCount(userId, companyId);

    // 3. Dispatch in-app notification
    try {
      await this.notificationService.create({
        userId: userObjectId,
        type: 'WARNING_ISSUED',
        title: 'Performance Warning Issued',
        message: `A performance warning was issued for a task score of ${clamped}/100. You now have ${activeCount} active warning(s). Warnings expire after ${expirationDays} days.`,
        link: `/employee/warnings`,
      });
    } catch (notifErr) {
      logger.error('[DisciplineService] Failed to send warning notification', {
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    logger.warn(
      `[DisciplineService] Warning issued for user ${userId.toString()} at company ${companyId.toString()} (active count: ${activeCount})`
    );

    // 4. Threshold check: active warnings >= warningThreshold (default 4) triggers Employment Review
    let employmentReview: IEmploymentReviewDocument | null = null;
    const warningThreshold = employeeConfig.warningThreshold ?? 4;

    if (activeCount >= warningThreshold) {
      employmentReview = await this.conductEmploymentReview({
        userId,
        companyId,
        activeWarningCount: activeCount,
        reason: `Employment review triggered: reached ${activeCount} active performance warnings (threshold: ${warningThreshold}).`,
      });
    }

    return { warning, activeCount, employmentReview };
  }

  /**
   * Conducts an Employment Review per approved D5:
   * Backend decision:
   * - Demotion: If level > 1, lowers level by 1, adjusts position/compensation, resets active warnings, EXP untouched.
   * - Termination: If level === 1, terminates employment, returns to JOB_SEEKER, EXP and career capital untouched.
   * AI may supply qualitative recommendation text only.
   */
  public async conductEmploymentReview(params: {
    userId: string | Types.ObjectId;
    companyId: string | Types.ObjectId;
    activeWarningCount: number;
    reason: string;
    aiRecommendation?: string;
  }): Promise<IEmploymentReviewDocument> {
    const { userId, companyId, activeWarningCount, reason, aiRecommendation } = params;

    const userObjectId = new Types.ObjectId(userId.toString());
    const companyObjectId = new Types.ObjectId(companyId.toString());

    const employee = await CompanyEmployeeModel.findOne({
      userId: userObjectId,
      companyId: companyObjectId,
      status: { $in: ['ACTIVE', 'UNDER_REVIEW'] },
    });

    if (!employee) {
      throw AppError.notFound('Active employee record not found for employment review');
    }

    // Set employee state to UNDER_REVIEW
    employee.status = 'UNDER_REVIEW';
    await employee.save();

    // Backend decision logic per approved D5:
    // If level > 1, demote by 1 level.
    // If level === 1 (Intern), employee cannot be demoted further, so they are terminated.
    let decision: 'DEMOTION' | 'TERMINATION';
    let demotionRecord: IDemotionDocument | null = null;

    if (employee.level > 1) {
      decision = 'DEMOTION';
      demotionRecord = await this.executeDemotion({
        employee,
        activeWarningCount,
        reason,
      });
    } else {
      decision = 'TERMINATION';
      await this.executeTermination({
        employee,
        reason: `Employment terminated: reached ${activeWarningCount} active warnings at Level 1 (cannot demote below Intern).`,
        trigger: 'EMPLOYMENT_REVIEW',
      });
    }

    const review = await EmploymentReviewModel.create({
      userId: userObjectId,
      companyId: companyObjectId,
      employeeId: employee._id,
      activeWarningCount,
      decision,
      reason,
      aiRecommendation:
        aiRecommendation ||
        `Backend authoritative review decided ${decision} based on ${activeWarningCount} active warnings and employee level ${employee.level}.`,
      demotionId: demotionRecord?._id,
      reviewedAt: new Date(),
    });

    logger.info(
      `[DisciplineService] Employment review completed for user ${userId.toString()}: Decision = ${decision}`
    );

    return review;
  }

  /**
   * Executes Demotion branch per Spec Section 11.4:
   * - Drops current level by 1.
   * - Updates position title and compensation simulation.
   * - Resets active warnings to 0 (marks RESOLVED).
   * - NEVER removes EXP.
   * - Records in demotions collection.
   */
  public async executeDemotion(params: {
    employee: ICompanyEmployeeDocument;
    activeWarningCount: number;
    reason: string;
  }): Promise<IDemotionDocument> {
    const { employee, activeWarningCount, reason } = params;

    const previousLevel = employee.level;
    const newLevel = Math.max(1, previousLevel - 1);
    const previousPositionTitle = employee.positionTitle;

    // Resolve salary band title and default simulated salary from PlatformConfig
    const careerConfig = await this.configService.getCareerConfig();
    const targetBand = careerConfig.salaryBands.find((b) => b.level === newLevel);
    const newPositionTitle = targetBand?.title ?? `Level ${newLevel} Engineer`;
    const newSalary = targetBand?.defaultSalary;

    // Update employee document
    employee.level = newLevel;
    employee.positionTitle = newPositionTitle;
    if (newSalary !== undefined) {
      employee.salarySimulated = newSalary;
    }
    employee.status = 'ACTIVE';

    employee.history.push({
      status: 'ACTIVE',
      level: newLevel,
      positionTitle: newPositionTitle,
      reason: `Demoted from L${previousLevel} to L${newLevel}: ${reason}`,
      changedAt: new Date(),
    });

    await employee.save();

    // Create immutable Demotion record
    const demotion = await DemotionModel.create({
      userId: employee.userId,
      companyId: employee.companyId,
      employeeId: employee._id,
      previousLevel,
      newLevel,
      previousPositionTitle,
      newPositionTitle,
      activeWarningCount,
      reason,
      demotedAt: new Date(),
    });

    // Reset active warnings to 0 per Spec Section 11.4
    await WarningModel.updateMany(
      {
        userId: employee.userId,
        companyId: employee.companyId,
        status: 'ACTIVE',
      },
      {
        status: 'RESOLVED',
        reason: `Active warnings reset to 0 upon demotion from L${previousLevel} to L${newLevel}.`,
      }
    );

    // Notify employee of demotion
    try {
      await this.notificationService.create({
        userId: employee.userId,
        type: 'DEMOTION',
        title: 'Employment Review Outcome: Demoted',
        message: `Following an employment review, your role was demoted from Level ${previousLevel} (${previousPositionTitle}) to Level ${newLevel} (${newPositionTitle}). Your active warnings have been reset to 0. Your career EXP is fully preserved.`,
        link: `/employee/dashboard`,
      });
    } catch (notifErr) {
      logger.error('[DisciplineService] Failed to send demotion notification', {
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    logger.info(
      `[DisciplineService] Demoted employee ${employee._id.toString()} from L${previousLevel} to L${newLevel} (EXP intact)`
    );

    return demotion;
  }

  /**
   * Executes Termination branch per Spec Section 11.4:
   * - companyEmployees status = TERMINATED.
   * - user.careerRole = JOB_SEEKER.
   * - Keeps EXP, skills, resume, profile, history intact; removes only the active company job.
   * - Decrements company employeeCount.
   */
  public async executeTermination(params: {
    employee: ICompanyEmployeeDocument;
    reason: string;
    aiRecommendation?: string;
    trigger: 'EMPLOYMENT_REVIEW' | 'ADMIN_FORCE_TERMINATION';
  }): Promise<void> {
    const { employee, reason, trigger } = params;

    // 1. Mark employee record TERMINATED
    employee.status = 'TERMINATED';
    employee.endedAt = new Date();
    employee.history.push({
      status: 'TERMINATED',
      reason: `${trigger}: ${reason}`,
      changedAt: new Date(),
    });
    await employee.save();

    // 2. Decrement company employee count
    await CompanyModel.findByIdAndUpdate(employee.companyId, {
      $inc: { employeeCount: -1 },
    });

    // 3. Revert user careerRole to JOB_SEEKER (EXP, profile, skills, resume are untouched)
    await UserModel.findByIdAndUpdate(employee.userId, {
      careerRole: 'JOB_SEEKER',
    });

    // 4. Resolve remaining active warnings
    await WarningModel.updateMany(
      {
        userId: employee.userId,
        companyId: employee.companyId,
        status: 'ACTIVE',
      },
      {
        status: 'RESOLVED',
        reason: `Resolved upon employment termination (${trigger}).`,
      }
    );

    // 5. Send notification
    try {
      await this.notificationService.create({
        userId: employee.userId,
        type: 'TERMINATION',
        title: 'Employment Terminated',
        message: `Your employment has been terminated: ${reason}. Your career status has returned to Job Seeker. All your accumulated EXP, completed projects, and profile assets remain permanent.`,
        link: `/jobs`,
      });
    } catch (notifErr) {
      logger.error('[DisciplineService] Failed to send termination notification', {
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    logger.info(
      `[DisciplineService] Terminated employee ${employee._id.toString()} for user ${employee.userId.toString()} (EXP intact)`
    );
  }

  /**
   * Admin Force-Terminate with Dangerous-Action Confirmation & Audit Log:
   * Enforces confirmation string CONFIRM_FORCE_TERMINATE and reason >= 10 chars.
   * Writes immutable entry in auditLogs.
   * Terminates employment while preserving user EXP and profile.
   */
  public async adminForceTerminate(params: ForceTerminateParams): Promise<void> {
    const { employeeId, adminUserId, reason, confirmation } = params;

    if (!Types.ObjectId.isValid(employeeId.toString())) {
      throw AppError.badRequest('Invalid employee ID');
    }

    if (confirmation !== 'CONFIRM_FORCE_TERMINATE') {
      throw AppError.badRequest(
        'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_FORCE_TERMINATE".'
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw AppError.badRequest('Termination reason must be at least 10 characters');
    }

    const employee = await CompanyEmployeeModel.findById(employeeId);
    if (!employee) {
      throw AppError.notFound('Employee record not found');
    }

    if (employee.status === 'TERMINATED') {
      throw AppError.badRequest('Employee is already terminated');
    }

    const previousState = {
      status: employee.status,
      level: employee.level,
      positionTitle: employee.positionTitle,
      companyId: employee.companyId.toString(),
    };

    // 1. Record immutable audit log
    await this.auditService.record({
      actorId: adminUserId.toString(),
      actorRole: 'ADMIN',
      action: 'ADMIN_MUTATION',
      targetType: 'companyEmployees',
      targetId: employee._id.toString(),
      oldValue: previousState,
      newValue: {
        status: 'TERMINATED',
        careerRole: 'JOB_SEEKER',
      },
      reason: reason.trim(),
    });

    // 2. Execute termination
    await this.executeTermination({
      employee,
      reason: reason.trim(),
      trigger: 'ADMIN_FORCE_TERMINATION',
    });

    logger.warn(
      `[DisciplineService] Admin ${adminUserId.toString()} force-terminated employee ${employeeId.toString()}`
    );
  }

  /**
   * Checks for active warnings expiring within daysThreshold days (default: 3)
   * and dispatches a WARNING_EXPIRING_SOON notification if not already sent.
   */
  public async checkAndNotifyExpiringWarnings(
    userId?: string | Types.ObjectId,
    daysThreshold: number = 3
  ): Promise<number> {
    const now = new Date();
    const futureCutoff = new Date(now.getTime() + daysThreshold * 86400000);

    const query: Record<string, unknown> = {
      status: 'ACTIVE',
      expiresAt: { $gt: now, $lte: futureCutoff },
    };

    if (userId) {
      query.userId = new Types.ObjectId(userId.toString());
    }

    const expiringWarnings = await WarningModel.find(query);
    let notifiedCount = 0;

    for (const warning of expiringWarnings) {
      const warningLink = `/employee/warnings?id=${warning._id.toString()}`;
      const existingNotifs = await this.notificationService.list(warning.userId, {
        type: 'WARNING_EXPIRING_SOON',
      });
      const alreadyNotified = existingNotifs.notifications.some(
        (n) => n.link === warningLink
      );

      if (!alreadyNotified) {
        const daysRemaining = Math.max(1, Math.ceil((warning.expiresAt.getTime() - now.getTime()) / 86400000));
        await this.notificationService.create({
          userId: warning.userId,
          type: 'WARNING_EXPIRING_SOON',
          title: 'Performance Warning Expiring Soon',
          message: `Your active warning issued on ${warning.issuedAt.toLocaleDateString()} will expire in ${daysRemaining} day(s). Once expired, it no longer counts towards employment reviews.`,
          link: warningLink,
        });
        notifiedCount++;
      }
    }

    return notifiedCount;
  }
}

export const disciplineService = new DisciplineService();
