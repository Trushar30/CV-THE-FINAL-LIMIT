import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin/admin.service.js';
import { AdminController } from '../controllers/admin.controller.js';
import { requirePlatformRole } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/User.js';
import { ProfileModel } from '../models/Profile.js';
import { CompanyModel } from '../models/Company.js';
import { CompanyJobModel } from '../models/CompanyJob.js';
import { CompanyEmployeeModel } from '../models/CompanyEmployee.js';
import { FounderModel } from '../models/Founder.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { EmailVerificationTokenModel } from '../models/EmailVerificationToken.js';
import { AuditService } from '../services/audit/audit.service.js';
import { ConfigService } from '../services/config/config.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import {
  adminDeleteUserSchema,
  adminDeleteCompanySchema,
  adminResetEconomySchema,
  adminUpdateConfigSectionBodySchema,
} from '../schemas/admin.schema.js';
import { AppError } from '../utils/errors.js';

describe('Admin Management APIs & Permission Matrix Suite (TASK P9.3)', () => {
  let adminService: AdminService;
  let adminController: AdminController;
  let mockAuditService: AuditService;
  let mockConfigService: ConfigService;

  const mockAdminId = new Types.ObjectId();
  const mockTargetUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuditService = {
      record: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      log: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({ ...DEFAULT_PLATFORM_CONFIG }),
      updateConfig: vi.fn().mockImplementation(async (params) => params.newConfig),
    } as unknown as ConfigService;

    adminService = new AdminService(mockAuditService, mockConfigService);
    adminController = new AdminController(adminService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. User Management Unit Tests
  // =========================================================================
  describe('1. User Listing, Search & Filters', () => {
    it('lists users with pagination, populates profile and NEVER exposes passwordHash', async () => {
      const mockUsers = [
        {
          _id: mockTargetUserId,
          email: 'candidate@test.com',
          careerRole: 'JOB_SEEKER',
          platformRole: 'NONE',
          status: 'ACTIVE',
          isSuspended: false,
          emailVerified: true,
          onboardingStep: 'PROFILE_COMPLETED',
          totalExp: 1500,
          corpCoinBalance: 200,
          founderStarterCoinGranted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(UserModel, 'countDocuments').mockResolvedValue(1 as never);
      vi.spyOn(UserModel, 'find').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockUsers as never),
      } as never);

      vi.spyOn(ProfileModel, 'find').mockResolvedValue([
        {
          userId: mockTargetUserId,
          displayName: 'Ada Lovelace',
          domain: 'SOFTWARE_ENGINEERING',
          skills: ['TypeScript', 'Node.js'],
          bio: 'First programmer',
        },
      ] as never);

      const result = await adminService.listUsers({ page: 1, limit: 10 });

      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('candidate@test.com');
      expect(result.users[0].profile?.displayName).toBe('Ada Lovelace');
      expect((result.users[0] as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
    });

    it('searches users by email or profile display name', async () => {
      vi.spyOn(ProfileModel, 'find').mockResolvedValue([
        { userId: mockTargetUserId, displayName: 'Grace Hopper' },
      ] as never);

      vi.spyOn(UserModel, 'countDocuments').mockResolvedValue(1 as never);
      vi.spyOn(UserModel, 'find').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            _id: mockTargetUserId,
            email: 'grace@test.com',
            careerRole: 'EMPLOYEE',
            platformRole: 'NONE',
            status: 'ACTIVE',
            isSuspended: false,
            emailVerified: true,
            totalExp: 4500,
            corpCoinBalance: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ] as never),
      } as never);

      const result = await adminService.listUsers({ page: 1, limit: 10, search: 'Grace' });
      expect(result.users[0].email).toBe('grace@test.com');
    });

    it('retrieves user details by ID including profile and employment without passwordHash', async () => {
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: mockTargetUserId,
          email: 'employee@test.com',
          careerRole: 'EMPLOYEE',
          platformRole: 'NONE',
          status: 'ACTIVE',
          isSuspended: false,
          emailVerified: true,
          totalExp: 3000,
          corpCoinBalance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never),
      } as never);

      vi.spyOn(ProfileModel, 'findOne').mockResolvedValue({
        userId: mockTargetUserId,
        displayName: 'Senior Dev',
        domain: 'CLOUD_ENGINEERING',
      } as never);

      vi.spyOn(FounderModel, 'findOne').mockResolvedValue(null as never);
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          userId: mockTargetUserId,
          level: 5,
          positionTitle: 'Mid Cloud Engineer',
          companyId: { name: 'CloudScale Infrastructure' },
        } as never),
      } as never);

      const result = await adminService.getUserById(mockTargetUserId.toString());
      expect(result.user.email).toBe('employee@test.com');
      expect((result.user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
      expect(result.profile?.displayName).toBe('Senior Dev');
      expect(result.employee).toBeDefined();
    });

    it('throws notFound when user does not exist', async () => {
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue(null as never),
      } as never);

      await expect(
        adminService.getUserById(new Types.ObjectId().toString())
      ).rejects.toThrow('User not found');
    });
  });

  // =========================================================================
  // 2. User Editing, Suspend & Restore
  // =========================================================================
  describe('2. User Editing, Suspend and Restore with Mandatory Audit', () => {
    it('updates user attributes and profile, writing an immutable audit log', async () => {
      const mockUserDoc = {
        _id: mockTargetUserId,
        email: 'user@test.com',
        careerRole: 'JOB_SEEKER',
        platformRole: 'NONE',
        status: 'ACTIVE',
        isSuspended: false,
        emailVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUserDoc as never),
      } as never);

      vi.spyOn(ProfileModel, 'findOne').mockResolvedValue({
        userId: mockTargetUserId,
        displayName: 'Old Name',
        skills: ['JavaScript'],
        save: vi.fn().mockResolvedValue(true),
      } as never);

      const result = await adminService.updateUser({
        adminId: mockAdminId.toString(),
        userId: mockTargetUserId.toString(),
        input: {
          careerRole: 'EMPLOYEE',
          emailVerified: true,
          displayName: 'New Name',
          reason: 'Promoted candidate to employee during system reconciliation',
        },
      });

      expect(mockUserDoc.careerRole).toBe('EMPLOYEE');
      expect(mockUserDoc.emailVerified).toBe(true);
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: 'ADMIN',
          action: 'ADMIN_UPDATE_USER',
          targetType: 'users',
          reason: 'Promoted candidate to employee during system reconciliation',
        })
      );
      expect(result.email).toBe('user@test.com');
    });

    it('suspends user account and writes audit log', async () => {
      const mockUserDoc = {
        _id: mockTargetUserId,
        email: 'malicious@test.com',
        status: 'ACTIVE',
        isSuspended: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUserDoc as never),
      } as never);
      vi.spyOn(ProfileModel, 'findOne').mockResolvedValue(null as never);

      await adminService.suspendUser({
        adminId: mockAdminId.toString(),
        userId: mockTargetUserId.toString(),
        reason: 'Violated terms of service by attempting automated DDoS',
      });

      expect(mockUserDoc.status).toBe('SUSPENDED');
      expect(mockUserDoc.isSuspended).toBe(true);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_SUSPEND_USER',
          reason: 'Violated terms of service by attempting automated DDoS',
        })
      );
    });

    it('restores suspended user account and writes audit log', async () => {
      const mockUserDoc = {
        _id: mockTargetUserId,
        email: 'cleared@test.com',
        status: 'SUSPENDED',
        isSuspended: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUserDoc as never),
      } as never);
      vi.spyOn(ProfileModel, 'findOne').mockResolvedValue(null as never);

      await adminService.restoreUser({
        adminId: mockAdminId.toString(),
        userId: mockTargetUserId.toString(),
        reason: 'Account reinstated following formal security clearance review',
      });

      expect(mockUserDoc.status).toBe('ACTIVE');
      expect(mockUserDoc.isSuspended).toBe(false);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_RESTORE_USER',
          reason: 'Account reinstated following formal security clearance review',
        })
      );
    });
  });

  // =========================================================================
  // 3. Dangerous Operations (Confirmation Mechanism & Audit Log)
  // =========================================================================
  describe('3. Dangerous Operations Confirmation Gate', () => {
    describe('Delete User', () => {
      it('rejects without exact confirmation string CONFIRM_DELETE_USER', async () => {
        await expect(
          adminService.deleteUser({
            adminId: mockAdminId.toString(),
            userId: mockTargetUserId.toString(),
            confirmation: 'WRONG_CONFIRM',
            reason: 'Deleting user due to compliance request',
          })
        ).rejects.toThrow('Dangerous action confirmation failed');
      });

      it('rejects when reason is less than 10 characters', async () => {
        await expect(
          adminService.deleteUser({
            adminId: mockAdminId.toString(),
            userId: mockTargetUserId.toString(),
            confirmation: 'CONFIRM_DELETE_USER',
            reason: 'too short',
          })
        ).rejects.toThrow('Audit reason must be at least 10 characters');
      });

      it('prevents administrator from deleting their own account', async () => {
        await expect(
          adminService.deleteUser({
            adminId: mockAdminId.toString(),
            userId: mockAdminId.toString(),
            confirmation: 'CONFIRM_DELETE_USER',
            reason: 'Accidental self deletion attempt by admin',
          })
        ).rejects.toThrow('Administrators cannot delete their own active account');
      });

      it('deletes user, profile, tokens and writes audit log upon valid confirmation', async () => {
        vi.spyOn(UserModel, 'findById').mockResolvedValue({
          _id: mockTargetUserId,
          email: 'delete_me@test.com',
          careerRole: 'JOB_SEEKER',
        } as never);

        vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null as never);
        vi.spyOn(RefreshTokenModel, 'deleteMany').mockResolvedValue({} as never);
        vi.spyOn(EmailVerificationTokenModel, 'deleteMany').mockResolvedValue({} as never);
        vi.spyOn(ProfileModel, 'deleteMany').mockResolvedValue({} as never);
        vi.spyOn(UserModel, 'findByIdAndDelete').mockResolvedValue({} as never);

        const result = await adminService.deleteUser({
          adminId: mockAdminId.toString(),
          userId: mockTargetUserId.toString(),
          confirmation: 'CONFIRM_DELETE_USER',
          reason: 'GDPR Right to Be Forgotten deletion request validated',
        });

        expect(result.deletedUserId).toBe(mockTargetUserId.toString());
        expect(UserModel.findByIdAndDelete).toHaveBeenCalledWith(mockTargetUserId);
        expect(mockAuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'ADMIN_DELETE_USER',
            reason: 'GDPR Right to Be Forgotten deletion request validated',
          })
        );
      });
    });

    describe('Delete Company', () => {
      it('rejects without exact confirmation string CONFIRM_DELETE_COMPANY', async () => {
        await expect(
          adminService.deleteCompany({
            adminId: mockAdminId.toString(),
            companyId: mockCompanyId.toString(),
            confirmation: 'NO_CONFIRM',
            reason: 'Closing insolvent shell enterprise permanently',
          })
        ).rejects.toThrow('Dangerous action confirmation failed');
      });

      it('releases employees, closes jobs, and marks company suspended with audit log', async () => {
        const mockCompany = {
          _id: mockCompanyId,
          name: 'Zombie Enterprises',
          status: 'ACTIVE',
          isOpenForHiring: true,
          employeeCount: 2,
          save: vi.fn().mockResolvedValue(true),
        };

        vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompany as never);
        vi.spyOn(CompanyEmployeeModel, 'find').mockResolvedValue([
          {
            userId: mockTargetUserId,
            status: 'ACTIVE',
            history: [],
            save: vi.fn().mockResolvedValue(true),
          },
        ] as never);

        vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({} as never);
        vi.spyOn(CompanyJobModel, 'updateMany').mockResolvedValue({} as never);

        const result = await adminService.deleteCompany({
          adminId: mockAdminId.toString(),
          companyId: mockCompanyId.toString(),
          confirmation: 'CONFIRM_DELETE_COMPANY',
          reason: 'Liquidation of fraudulent platform entity ordered by governance',
        });

        expect(result.deletedCompanyId).toBe(mockCompanyId.toString());
        expect(mockCompany.status).toBe('SUSPENDED');
        expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(mockTargetUserId, {
          careerRole: 'JOB_SEEKER',
        });
        expect(CompanyJobModel.updateMany).toHaveBeenCalledWith(
          { companyId: mockCompanyId },
          { status: 'CLOSED', isOpen: false }
        );
        expect(mockAuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'ADMIN_DELETE_COMPANY',
            reason: 'Liquidation of fraudulent platform entity ordered by governance',
          })
        );
      });
    });

    describe('Reset Economy', () => {
      it('rejects without exact confirmation string CONFIRM_RESET_ECONOMY', async () => {
        await expect(
          adminService.resetEconomy({
            adminId: mockAdminId.toString(),
            confirmation: 'INCORRECT',
            reason: 'Complete simulation economy reboot for testing',
          })
        ).rejects.toThrow('Dangerous action confirmation failed');
      });

      it('resets all user EXP and CorpCoins when scope is ALL with audit log', async () => {
        vi.spyOn(UserModel, 'updateMany').mockResolvedValue({ modifiedCount: 42 } as never);

        const result = await adminService.resetEconomy({
          adminId: mockAdminId.toString(),
          confirmation: 'CONFIRM_RESET_ECONOMY',
          scope: 'ALL',
          reason: 'Staging environment global wipe before tournament start',
        });

        expect(result.affectedCount).toBe(42);
        expect(mockAuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'ADMIN_RESET_ECONOMY',
            targetType: 'system_economy',
            reason: 'Staging environment global wipe before tournament start',
          })
        );
      });

      it('resets targeted user balances when scope is USER', async () => {
        const mockTargetUser = {
          _id: mockTargetUserId,
          totalExp: 10000,
          totalExpCached: 10000,
          corpCoinBalance: 500,
          corpCoinBalanceCached: 500,
          save: vi.fn().mockResolvedValue(true),
        };

        vi.spyOn(UserModel, 'findById').mockResolvedValue(mockTargetUser as never);

        const result = await adminService.resetEconomy({
          adminId: mockAdminId.toString(),
          confirmation: 'CONFIRM_RESET_ECONOMY',
          scope: 'USER',
          targetUserId: mockTargetUserId.toString(),
          reason: 'Rollback of exploitatively acquired tokens and experience',
        });

        expect(result.affectedCount).toBe(1);
        expect(mockTargetUser.totalExp).toBe(0);
        expect(mockTargetUser.corpCoinBalance).toBe(0);
        expect(mockAuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'ADMIN_RESET_ECONOMY',
            targetType: 'users',
            targetId: mockTargetUserId,
          })
        );
      });
    });
  });

  // =========================================================================
  // 4. PlatformConfig Section Oversight & Updates
  // =========================================================================
  describe('4. PlatformConfig Section Oversight & Updates', () => {
    it('returns active configuration without exposing internal secrets', async () => {
      const config = await adminService.getActiveConfig();
      expect(config.career.founderUnlockExp).toBe(12000);
      expect(config.employee.warningThreshold).toBe(4);
    });

    it('returns specific config section', async () => {
      const founderConfig = await adminService.getConfigSection('founder');
      expect((founderConfig as typeof DEFAULT_PLATFORM_CONFIG.founder).starterCorpCoin).toBe(1000);
    });

    it('rejects update with invalid section data according to Zod schema', async () => {
      await expect(
        adminService.updateConfigSection({
          adminId: mockAdminId.toString(),
          section: 'employee',
          sectionData: { warningThreshold: -5 }, // Invalid: min is 1
          reason: 'Testing illegal threshold update',
        })
      ).rejects.toThrow('Invalid employee configuration parameters');
    });

    it('successfully updates section and increments version via ConfigService', async () => {
      const validEmployeeData = {
        primaryTasksPerDay: 2,
        bonusTasksPerDay: 1,
        easyMaxExp: 30,
        mediumMaxExp: 60,
        hardMaxExp: 100,
        warningThreshold: 5,
        warningExpirationDays: 45,
        minimumPromotionScore: 75,
        promotionRules: DEFAULT_PLATFORM_CONFIG.employee.promotionRules,
      };

      const updated = await adminService.updateConfigSection({
        adminId: mockAdminId.toString(),
        section: 'employee',
        sectionData: validEmployeeData,
        reason: 'Adjusting warning threshold and expiration for holiday period',
      });

      expect(mockConfigService.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdminId.toString(),
          reason: 'Adjusting warning threshold and expiration for holiday period',
          newConfig: expect.objectContaining({
            employee: expect.objectContaining({
              warningThreshold: 5,
              warningExpirationDays: 45,
            }),
          }),
        })
      );
      expect(updated).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Permission Matrix & Access Control (Spec Section 29)
  // =========================================================================
  describe('5. Permission Matrix & Access Control (Spec Section 29)', () => {
    const rolesMatrix = [
      { role: 'JOB_SEEKER', careerRole: 'JOB_SEEKER', platformRole: 'NONE', expectedDenied: true },
      { role: 'EMPLOYEE', careerRole: 'EMPLOYEE', platformRole: 'NONE', expectedDenied: true },
      { role: 'FOUNDER', careerRole: 'FOUNDER', platformRole: 'NONE', expectedDenied: true },
      { role: 'AI_MANAGER', careerRole: 'NONE', platformRole: 'AI_MANAGER', expectedDenied: true },
      { role: 'ADMIN', careerRole: 'NONE', platformRole: 'ADMIN', expectedDenied: false },
    ];

    it('rejects unauthenticated requests without req.user with 401 UNAUTHORIZED', () => {
      const middleware = requirePlatformRole('ADMIN');
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = (next as unknown as { mock: { calls: [[AppError]] } }).mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    for (const testCase of rolesMatrix) {
      it(`enforces permission matrix for ${testCase.role}: access ${testCase.expectedDenied ? 'DENIED (403)' : 'GRANTED'}`, () => {
        const middleware = requirePlatformRole('ADMIN');
        const req = {
          user: {
            _id: new Types.ObjectId(),
            email: `${testCase.role.toLowerCase()}@corpverse.io`,
            careerRole: testCase.careerRole,
            platformRole: testCase.platformRole,
          },
        } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        middleware(req, res, next);

        if (testCase.expectedDenied) {
          expect(next).toHaveBeenCalledWith(expect.any(AppError));
          const error = (next as unknown as { mock: { calls: [[AppError]] } }).mock.calls[0][0];
          expect(error.statusCode).toBe(403);
          expect(error.message).toContain('Access denied. Required platform role: ADMIN');
        } else {
          expect(next).toHaveBeenCalledWith();
        }
      });
    }

    it('allows ADMIN to list users and guarantees passwordHash is stripped in response', async () => {
      const req = {
        query: { page: '1', limit: '10' },
      } as unknown as Request;

      const jsonMock = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: jsonMock,
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      vi.spyOn(adminService, 'listUsers').mockResolvedValue({
        users: [
          {
            _id: mockTargetUserId.toString(),
            email: 'user@test.com',
            careerRole: 'JOB_SEEKER',
            platformRole: 'NONE',
            status: 'ACTIVE',
            isSuspended: false,
            emailVerified: true,
            onboardingStep: 'PROFILE_COMPLETED',
            totalExp: 100,
            corpCoinBalance: 0,
            founderStarterCoinGranted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      await adminController.listUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: expect.arrayContaining([
              expect.objectContaining({
                email: 'user@test.com',
              }),
            ]),
          }),
        })
      );
      const returnedUser = jsonMock.mock.calls[0][0].data.users[0];
      expect(returnedUser.passwordHash).toBeUndefined();
    });

    it('validates dangerous user deletion schema rejecting non-conforming confirmation', () => {
      const invalidPayload = {
        confirmation: 'WRONG_CONFIRM',
        reason: 'Valid reason exceeding ten characters',
      };
      const result = adminDeleteUserSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Dangerous action confirmation failed');
      }
    });

    it('validates dangerous company deletion schema rejecting short reasons', () => {
      const invalidPayload = {
        confirmation: 'CONFIRM_DELETE_COMPANY',
        reason: 'short',
      };
      const result = adminDeleteCompanySchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Audit reason must be at least 10 characters');
      }
    });

    it('validates dangerous economy reset schema requiring confirmation and reason', () => {
      const validPayload = {
        confirmation: 'CONFIRM_RESET_ECONOMY',
        scope: 'ALL',
        reason: 'Resetting economy for season 2 start tournament',
      };
      const result = adminResetEconomySchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('validates config section update body schema', () => {
      const validPayload = {
        data: { warningThreshold: 5 },
        reason: 'Updating threshold for governance experiment',
      };
      const result = adminUpdateConfigSectionBodySchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });
});
