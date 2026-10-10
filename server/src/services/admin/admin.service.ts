import { Types, FilterQuery } from 'mongoose';
import { UserModel, IUserDocument } from '../../models/User.js';
import { ProfileModel, IProfileDocument } from '../../models/Profile.js';
import { CompanyModel } from '../../models/Company.js';
import { CompanyJobModel } from '../../models/CompanyJob.js';
import { CompanyEmployeeModel } from '../../models/CompanyEmployee.js';
import { FounderModel } from '../../models/Founder.js';
import { RefreshTokenModel } from '../../models/RefreshToken.js';
import { EmailVerificationTokenModel } from '../../models/EmailVerificationToken.js';
import { AuditService, auditService as defaultAuditService } from '../audit/audit.service.js';
import { ConfigService, configService as defaultConfigService } from '../config/config.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import {
  AdminQueryUsersInput,
  AdminUpdateUserInput,
  ConfigSectionName,
  CONFIG_SECTION_SCHEMAS,
} from '../../schemas/admin.schema.js';
import { PlatformConfig } from '../../config/platformConfig.schema.js';
import {
  type CareerRole,
  type PlatformRole,
  type UserStatus,
  type CareerDomain,
} from '../../types/enums.js';

export interface SanitizedUser {
  _id: string;
  email: string;
  careerRole: string;
  platformRole: string;
  status: string;
  isSuspended: boolean;
  emailVerified: boolean;
  onboardingStep: string;
  totalExp: number;
  corpCoinBalance: number;
  founderStarterCoinGranted: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    displayName?: string;
    domain?: string;
    skills?: string[];
    bio?: string;
  } | null;
}

export interface UserListResult {
  users: SanitizedUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class AdminService {
  constructor(
    private readonly auditService: AuditService = defaultAuditService,
    private readonly configService: ConfigService = defaultConfigService
  ) {}

  /**
   * Helper to sanitize a User document, ensuring passwordHash is NEVER exposed.
   */
  private sanitizeUser(user: IUserDocument, profile?: IProfileDocument | null): SanitizedUser {
    return {
      _id: user._id.toString(),
      email: user.email,
      careerRole: user.careerRole,
      platformRole: user.platformRole,
      status: user.status,
      isSuspended: user.isSuspended,
      emailVerified: user.emailVerified,
      onboardingStep: user.onboardingStep,
      totalExp: user.totalExp,
      corpCoinBalance: user.corpCoinBalance,
      founderStarterCoinGranted: user.founderStarterCoinGranted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: profile
        ? {
            displayName: profile.displayName,
            domain: profile.domain,
            skills: profile.skills,
            bio: profile.bio,
          }
        : null,
    };
  }

  /**
   * List, search, filter and paginate users.
   * Admin never sees password hashes.
   */
  public async listUsers(query: AdminQueryUsersInput): Promise<UserListResult> {
    const { page, limit, search, careerRole, platformRole, status, isSuspended, emailVerified } =
      query;

    const filter: FilterQuery<IUserDocument> = {};

    if (careerRole) filter.careerRole = careerRole;
    if (platformRole) filter.platformRole = platformRole;
    if (status) filter.status = status;
    if (isSuspended !== undefined) filter.isSuspended = isSuspended;
    if (emailVerified !== undefined) filter.emailVerified = emailVerified;

    if (search && search.trim().length > 0) {
      const searchRegex = new RegExp(search.trim(), 'i');
      // Search matching display names in profiles
      const matchingProfiles = await ProfileModel.find({ displayName: searchRegex });
      const profileUserIds = matchingProfiles.map((p) => p.userId);

      filter.$or = [{ email: searchRegex }, { _id: { $in: profileUserIds } }];
    }

    const total = await UserModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const users = await UserModel.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const userIds = users.map((u) => u._id);
    const profiles = await ProfileModel.find({ userId: { $in: userIds } });
    const profileMap = new Map<string, IProfileDocument>();
    for (const p of profiles) {
      profileMap.set(p.userId.toString(), p);
    }

    const sanitizedUsers = users.map((u) =>
      this.sanitizeUser(u, profileMap.get(u._id.toString()) ?? null)
    );

    return {
      users: sanitizedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * View detailed user account + profile + employment/founder status.
   * Admin never sees password hashes.
   */
  public async getUserById(userId: string): Promise<{
    user: SanitizedUser;
    profile: IProfileDocument | null;
    founder: unknown | null;
    employee: unknown | null;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID format');
    }

    const user = await UserModel.findById(userId).select('-passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const profile = await ProfileModel.findOne({ userId: user._id });
    const founder = await FounderModel.findOne({ userId: user._id });
    const employee = await CompanyEmployeeModel.findOne({
      userId: user._id,
      status: { $in: ['ACTIVE', 'PROBATION', 'UNDER_REVIEW'] },
    }).populate('companyId', 'name status');

    return {
      user: this.sanitizeUser(user, profile),
      profile,
      founder,
      employee,
    };
  }

  /**
   * Edit user account details or profile with mandatory audit logging.
   */
  public async updateUser(params: {
    adminId: string;
    userId: string;
    input: AdminUpdateUserInput;
  }): Promise<SanitizedUser> {
    const { adminId, userId, input } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID format');
    }

    const user = await UserModel.findById(userId).select('-passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const oldUserSnapshot = {
      careerRole: user.careerRole,
      platformRole: user.platformRole,
      status: user.status,
      isSuspended: user.isSuspended,
      emailVerified: user.emailVerified,
    };

    if (input.careerRole) user.careerRole = input.careerRole as CareerRole;
    if (input.platformRole) user.platformRole = input.platformRole as PlatformRole;
    if (input.status) {
      user.status = input.status as UserStatus;
      user.isSuspended = input.status === 'SUSPENDED';
    }
    if (input.isSuspended !== undefined) {
      user.isSuspended = input.isSuspended;
      user.status = input.isSuspended ? 'SUSPENDED' : 'ACTIVE';
    }
    if (input.emailVerified !== undefined) {
      user.emailVerified = input.emailVerified;
      user.isEmailVerified = input.emailVerified;
    }

    await user.save();

    // Check if profile fields were provided
    let profile = await ProfileModel.findOne({ userId: user._id });
    if (
      input.displayName !== undefined ||
      input.domain !== undefined ||
      input.skills !== undefined ||
      input.bio !== undefined
    ) {
      if (profile) {
        if (input.displayName) profile.displayName = input.displayName;
        if (input.domain) profile.domain = input.domain as CareerDomain;
        if (input.skills) profile.skills = input.skills;
        if (input.bio !== undefined) profile.bio = input.bio;
        await profile.save();
      } else if (input.displayName) {
        profile = await ProfileModel.create({
          userId: user._id,
          displayName: input.displayName,
          domain: input.domain as CareerDomain,
          skills: input.skills ?? [],
          bio: input.bio,
        });
      }
    }

    // Append audit log
    await this.auditService.record({
      actorId: new Types.ObjectId(adminId),
      actorRole: 'ADMIN',
      action: 'ADMIN_UPDATE_USER',
      targetType: 'users',
      targetId: user._id,
      oldValue: oldUserSnapshot,
      newValue: {
        careerRole: user.careerRole,
        platformRole: user.platformRole,
        status: user.status,
        isSuspended: user.isSuspended,
        emailVerified: user.emailVerified,
      },
      reason: input.reason,
    });

    logger.info(`[AdminService] Admin ${adminId} updated user ${user._id}`);
    return this.sanitizeUser(user, profile);
  }

  /**
   * Suspend a user account with mandatory audit logging.
   */
  public async suspendUser(params: {
    adminId: string;
    userId: string;
    reason: string;
  }): Promise<SanitizedUser> {
    const { adminId, userId, reason } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID format');
    }

    const user = await UserModel.findById(userId).select('-passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const oldStatus = user.status;
    const oldIsSuspended = user.isSuspended;

    user.status = 'SUSPENDED';
    user.isSuspended = true;
    await user.save();

    await this.auditService.record({
      actorId: new Types.ObjectId(adminId),
      actorRole: 'ADMIN',
      action: 'ADMIN_SUSPEND_USER',
      targetType: 'users',
      targetId: user._id,
      oldValue: { status: oldStatus, isSuspended: oldIsSuspended },
      newValue: { status: 'SUSPENDED', isSuspended: true },
      reason,
    });

    logger.info(`[AdminService] Admin ${adminId} suspended user ${user._id}`);
    const profile = await ProfileModel.findOne({ userId: user._id });
    return this.sanitizeUser(user, profile);
  }

  /**
   * Restore a suspended user account with mandatory audit logging.
   */
  public async restoreUser(params: {
    adminId: string;
    userId: string;
    reason: string;
  }): Promise<SanitizedUser> {
    const { adminId, userId, reason } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID format');
    }

    const user = await UserModel.findById(userId).select('-passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const oldStatus = user.status;
    const oldIsSuspended = user.isSuspended;

    user.status = 'ACTIVE';
    user.isSuspended = false;
    await user.save();

    await this.auditService.record({
      actorId: new Types.ObjectId(adminId),
      actorRole: 'ADMIN',
      action: 'ADMIN_RESTORE_USER',
      targetType: 'users',
      targetId: user._id,
      oldValue: { status: oldStatus, isSuspended: oldIsSuspended },
      newValue: { status: 'ACTIVE', isSuspended: false },
      reason,
    });

    logger.info(`[AdminService] Admin ${adminId} restored user ${user._id}`);
    const profile = await ProfileModel.findOne({ userId: user._id });
    return this.sanitizeUser(user, profile);
  }

  /**
   * Dangerous operation: Delete user account, profiles, and associated tokens.
   * Requires confirmation string CONFIRM_DELETE_USER and audit reason >= 10 chars.
   */
  public async deleteUser(params: {
    adminId: string;
    userId: string;
    confirmation: string;
    reason: string;
  }): Promise<{ message: string; deletedUserId: string }> {
    const { adminId, userId, confirmation, reason } = params;

    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user ID format');
    }

    if (confirmation !== 'CONFIRM_DELETE_USER') {
      throw AppError.badRequest(
        'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_DELETE_USER".'
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw AppError.badRequest('Audit reason must be at least 10 characters');
    }

    if (adminId.toString() === userId.toString()) {
      throw AppError.badRequest('Administrators cannot delete their own active account');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const userSnapshot = {
      email: user.email,
      careerRole: user.careerRole,
      platformRole: user.platformRole,
      totalExp: user.totalExp,
      corpCoinBalance: user.corpCoinBalance,
    };

    // If active employee, decrement company count
    const activeEmployee = await CompanyEmployeeModel.findOne({
      userId: user._id,
      status: { $in: ['ACTIVE', 'PROBATION', 'UNDER_REVIEW'] },
    });
    if (activeEmployee) {
      await CompanyModel.findByIdAndUpdate(activeEmployee.companyId, {
        $inc: { employeeCount: -1 },
      });
      activeEmployee.status = 'TERMINATED';
      await activeEmployee.save();
    }

    // Remove tokens and profile
    await RefreshTokenModel.deleteMany({ userId: user._id });
    await EmailVerificationTokenModel.deleteMany({ userId: user._id });
    await ProfileModel.deleteMany({ userId: user._id });

    // Remove user record
    await UserModel.findByIdAndDelete(user._id);

    // Record audit log
    await this.auditService.record({
      actorId: new Types.ObjectId(adminId),
      actorRole: 'ADMIN',
      action: 'ADMIN_DELETE_USER',
      targetType: 'users',
      targetId: user._id,
      oldValue: userSnapshot,
      newValue: null,
      reason,
    });

    logger.info(`[AdminService] Admin ${adminId} deleted user ${userId}`);
    return {
      message: 'User account and associated profile deleted successfully',
      deletedUserId: userId,
    };
  }

  /**
   * Dangerous operation: Delete company, closes open jobs, and releases employees.
   * Requires confirmation string CONFIRM_DELETE_COMPANY and audit reason >= 10 chars.
   */
  public async deleteCompany(params: {
    adminId: string;
    companyId: string;
    confirmation: string;
    reason: string;
  }): Promise<{ message: string; deletedCompanyId: string }> {
    const { adminId, companyId, confirmation, reason } = params;

    if (!Types.ObjectId.isValid(companyId)) {
      throw AppError.badRequest('Invalid company ID format');
    }

    if (confirmation !== 'CONFIRM_DELETE_COMPANY') {
      throw AppError.badRequest(
        'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_DELETE_COMPANY".'
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw AppError.badRequest('Audit reason must be at least 10 characters');
    }

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw AppError.notFound('Company not found');
    }

    const companySnapshot = {
      name: company.name,
      type: company.type,
      status: company.status,
      employeeCount: company.employeeCount,
    };

    // 1. Release all active employees back to JOB_SEEKER
    const activeEmployees = await CompanyEmployeeModel.find({
      companyId: company._id,
      status: { $in: ['ACTIVE', 'PROBATION', 'UNDER_REVIEW'] },
    });

    for (const emp of activeEmployees) {
      emp.status = 'TERMINATED';
      emp.endedAt = new Date();
      emp.history.push({
        status: 'TERMINATED',
        level: emp.level,
        positionTitle: emp.positionTitle,
        reason: `Company deleted by administrator: ${reason}`,
        changedAt: new Date(),
      });
      await emp.save();

      await UserModel.findByIdAndUpdate(emp.userId, {
        careerRole: 'JOB_SEEKER',
      });
    }

    // 2. Close all company jobs
    await CompanyJobModel.updateMany(
      { companyId: company._id },
      { status: 'CLOSED', isOpen: false }
    );

    // 3. Mark company deleted / closed
    company.status = 'SUSPENDED';
    company.isOpenForHiring = false;
    company.employeeCount = 0;
    await company.save();

    // 4. Record audit log
    await this.auditService.record({
      actorId: new Types.ObjectId(adminId),
      actorRole: 'ADMIN',
      action: 'ADMIN_DELETE_COMPANY',
      targetType: 'companies',
      targetId: company._id,
      oldValue: companySnapshot,
      newValue: { status: 'SUSPENDED', isOpenForHiring: false, employeeCount: 0 },
      reason,
    });

    logger.info(`[AdminService] Admin ${adminId} deleted company ${companyId}`);
    return {
      message: 'Company deleted, open jobs closed, and employees released successfully',
      deletedCompanyId: companyId,
    };
  }

  /**
   * Dangerous operation: Reset simulated economy balances.
   * Requires confirmation string CONFIRM_RESET_ECONOMY and audit reason >= 10 chars.
   */
  public async resetEconomy(params: {
    adminId: string;
    confirmation: string;
    reason: string;
    scope?: 'ALL' | 'USER';
    targetUserId?: string;
  }): Promise<{ message: string; scope: string; affectedCount: number }> {
    const { adminId, confirmation, reason, scope = 'ALL', targetUserId } = params;

    if (confirmation !== 'CONFIRM_RESET_ECONOMY') {
      throw AppError.badRequest(
        'Dangerous action confirmation failed. You must provide confirmation: "CONFIRM_RESET_ECONOMY".'
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw AppError.badRequest('Audit reason must be at least 10 characters');
    }

    let affectedCount = 0;

    if (scope === 'USER') {
      if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
        throw AppError.badRequest('Valid targetUserId is required when scope is "USER"');
      }

      const user = await UserModel.findById(targetUserId);
      if (!user) {
        throw AppError.notFound('Target user not found for economy reset');
      }

      const oldValue = {
        totalExp: user.totalExp,
        corpCoinBalance: user.corpCoinBalance,
      };

      user.totalExp = 0;
      user.totalExpCached = 0;
      user.corpCoinBalance = 0;
      user.corpCoinBalanceCached = 0;
      await user.save();
      affectedCount = 1;

      await this.auditService.record({
        actorId: new Types.ObjectId(adminId),
        actorRole: 'ADMIN',
        action: 'ADMIN_RESET_ECONOMY',
        targetType: 'users',
        targetId: user._id,
        oldValue,
        newValue: { totalExp: 0, corpCoinBalance: 0 },
        reason,
      });
    } else {
      // Scope ALL
      const result = await UserModel.updateMany(
        {},
        {
          $set: {
            totalExp: 0,
            totalExpCached: 0,
            corpCoinBalance: 0,
            corpCoinBalanceCached: 0,
          },
        }
      );
      affectedCount = result.modifiedCount;

      await this.auditService.record({
        actorId: new Types.ObjectId(adminId),
        actorRole: 'ADMIN',
        action: 'ADMIN_RESET_ECONOMY',
        targetType: 'system_economy',
        targetId: new Types.ObjectId(adminId),
        oldValue: { scope: 'ALL' },
        newValue: { affectedUsers: affectedCount, resetValues: { exp: 0, coins: 0 } },
        reason,
      });
    }

    logger.info(`[AdminService] Admin ${adminId} reset economy. Scope: ${scope}, count: ${affectedCount}`);
    return {
      message: `Economy reset successfully for scope ${scope}`,
      scope,
      affectedCount,
    };
  }

  /**
   * View active PlatformConfig (safely, no secrets/keys exposed).
   */
  public async getActiveConfig(): Promise<PlatformConfig> {
    return this.configService.getConfig();
  }

  /**
   * View a specific section of active PlatformConfig.
   */
  public async getConfigSection(section: ConfigSectionName): Promise<unknown> {
    const config = await this.configService.getConfig();
    return config[section];
  }

  /**
   * Update a specific section of PlatformConfig with strict Zod validation,
   * version increment, cache refresh, and audit logging.
   */
  public async updateConfigSection(params: {
    adminId: string;
    section: ConfigSectionName;
    sectionData: Record<string, unknown>;
    reason: string;
  }): Promise<PlatformConfig> {
    const { adminId, section, sectionData, reason } = params;

    if (!reason || reason.trim().length < 10) {
      throw AppError.badRequest('Audit reason must be at least 10 characters');
    }

    const sectionSchema = CONFIG_SECTION_SCHEMAS[section];
    if (!sectionSchema) {
      throw AppError.badRequest(`Unknown configuration section: ${section}`);
    }

    const validatedSection = sectionSchema.safeParse(sectionData);
    if (!validatedSection.success) {
      throw AppError.validation(`Invalid ${section} configuration parameters`, {
        issues: validatedSection.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }

    const currentConfig = await this.configService.getConfig();
    const newConfig: PlatformConfig = {
      ...currentConfig,
      [section]: validatedSection.data,
    };

    return this.configService.updateConfig({
      adminId,
      reason,
      newConfig,
    });
  }
}

export const adminService = new AdminService();
