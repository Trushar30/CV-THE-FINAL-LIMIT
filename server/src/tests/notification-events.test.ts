import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { NotificationService } from '../services/notification/notification.service.js';
import { NotificationController } from '../controllers/notification.controller.js';
import { NotificationModel, type INotificationDocument } from '../models/Notification.js';
import { DisciplineService } from '../services/employee/discipline.service.js';
import { WarningModel, type IWarningDocument } from '../models/Warning.js';
import { DemotionModel } from '../models/Demotion.js';
import { type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { ConfigService } from '../services/config/config.service.js';
import { AuditService } from '../services/audit/audit.service.js';
import { NOTIFICATION_TYPES } from '../types/enums.js';

describe('Notification Subsystem & Event Triggers Suite (TASK P9.2)', () => {
  let notificationService: NotificationService;
  let controller: NotificationController;
  let disciplineService: DisciplineService;
  let mockConfigService: ConfigService;
  let mockAuditService: AuditService;

  const mockUserId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();
  const mockEmployeeId = new Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();
    notificationService = new NotificationService();
    controller = new NotificationController(notificationService);

    mockConfigService = {
      getCareerConfig: vi.fn().mockResolvedValue({
        maxLevel: 10,
        salaryBands: [
          { level: 1, title: 'Intern', defaultSalary: 50000 },
          { level: 2, title: 'Junior', defaultSalary: 70000 },
          { level: 3, title: 'Junior+', defaultSalary: 90000 },
        ],
      }),
      getEmployeeConfig: vi.fn().mockResolvedValue({
        warningExpirationDays: 30,
        warningThreshold: 4,
      }),
    } as unknown as ConfigService;

    mockAuditService = {
      record: vi.fn().mockResolvedValue({}),
    } as unknown as AuditService;

    disciplineService = new DisciplineService(
      mockConfigService,
      mockAuditService,
      notificationService
    );
  });

  describe('1. NotificationService Pagination & Unread Count', () => {
    it('returns unread count via getUnreadCount', async () => {
      vi.spyOn(NotificationModel, 'countDocuments').mockResolvedValue(5);

      const count = await notificationService.getUnreadCount(mockUserId);
      expect(count).toBe(5);
      expect(NotificationModel.countDocuments).toHaveBeenCalledWith({
        userId: mockUserId,
        isRead: false,
      });
    });

    it('lists notifications with pagination, total, and unreadCount', async () => {
      const mockNotifs = [
        {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'PROMOTION',
          title: 'Promoted!',
          message: 'Level up',
          isRead: false,
          createdAt: new Date(),
        },
      ] as unknown as INotificationDocument[];

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockNotifs),
      };

      vi.spyOn(NotificationModel, 'find').mockReturnValue(mockQuery as unknown as ReturnType<typeof NotificationModel.find>);
      vi.spyOn(NotificationModel, 'countDocuments')
        .mockResolvedValueOnce(25) // total filtered
        .mockResolvedValueOnce(3); // unreadCount

      const result = await notificationService.list(mockUserId, { page: 2, limit: 10 });

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(25);
      expect(result.unreadCount).toBe(3);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(mockQuery.skip).toHaveBeenCalledWith(10);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('marks a notification as read enforcing owner authorization', async () => {
      const notifId = new Types.ObjectId();
      const mockDoc = {
        _id: notifId,
        userId: mockUserId,
        isRead: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(NotificationModel, 'findById').mockResolvedValue(mockDoc as unknown as INotificationDocument);

      const updated = await notificationService.markRead(notifId, mockUserId);
      expect(updated.isRead).toBe(true);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('rejects markRead if requester is not the notification owner', async () => {
      const notifId = new Types.ObjectId();
      const otherUserId = new Types.ObjectId();
      const mockDoc = {
        _id: notifId,
        userId: otherUserId,
        isRead: false,
      };

      vi.spyOn(NotificationModel, 'findById').mockResolvedValue(mockDoc as unknown as INotificationDocument);

      await expect(notificationService.markRead(notifId, mockUserId)).rejects.toThrow(
        /permission/i
      );
    });

    it('marks all notifications read via markAllRead', async () => {
      vi.spyOn(NotificationModel, 'updateMany').mockResolvedValue({
        modifiedCount: 4,
      } as unknown as ReturnType<typeof NotificationModel.updateMany>);

      const res = await notificationService.markAllRead(mockUserId);
      expect(res.modifiedCount).toBe(4);
      expect(NotificationModel.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, isRead: false },
        { $set: { isRead: true } }
      );
    });
  });

  describe('2. NotificationController Endpoints', () => {
    it('returns unread count via GET /api/notifications/unread-count', async () => {
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(3);

      const req = {
        user: { _id: mockUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const next = vi.fn();

      await controller.getUnreadCount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { unreadCount: 3 },
      });
    });
  });

  describe('3. Employee Discipline Notifications: Demotion & Termination', () => {
    it('dispatches DEMOTION notification with link upon employment demotion', async () => {
      const createNotifSpy = vi.spyOn(notificationService, 'create').mockResolvedValue({} as INotificationDocument);

      const mockEmployee = {
        _id: mockEmployeeId,
        userId: mockUserId,
        companyId: mockCompanyId,
        level: 3,
        positionTitle: 'Junior+',
        salarySimulated: 90000,
        status: 'ACTIVE',
        history: [],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyEmployeeDocument;

      vi.spyOn(DemotionModel, 'create').mockResolvedValue({} as unknown as ReturnType<typeof DemotionModel.create>);
      vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({} as unknown as ReturnType<typeof WarningModel.updateMany>);

      await disciplineService.executeDemotion({
        employee: mockEmployee,
        activeWarningCount: 4,
        reason: 'Poor performance threshold exceeded',
      });

      expect(createNotifSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'DEMOTION',
          title: 'Employment Review Outcome: Demoted',
          link: '/employee/dashboard',
        })
      );
    });

    it('dispatches TERMINATION notification upon employment termination', async () => {
      const createNotifSpy = vi.spyOn(notificationService, 'create').mockResolvedValue({} as INotificationDocument);

      const mockEmployee = {
        _id: mockEmployeeId,
        userId: mockUserId,
        companyId: mockCompanyId,
        level: 1,
        positionTitle: 'Intern',
        status: 'ACTIVE',
        history: [],
        save: vi.fn().mockResolvedValue(true),
      } as unknown as ICompanyEmployeeDocument;

      vi.spyOn(CompanyModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as ICompanyDocument);
      vi.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue({} as unknown as IUserDocument);
      vi.spyOn(WarningModel, 'updateMany').mockResolvedValue({} as unknown as ReturnType<typeof WarningModel.updateMany>);

      await disciplineService.executeTermination({
        employee: mockEmployee,
        reason: '4 active warnings at Level 1 Intern',
        trigger: 'EMPLOYMENT_REVIEW',
      });

      expect(createNotifSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'TERMINATION',
          title: 'Employment Terminated',
          link: '/jobs',
        })
      );
    });
  });

  describe('4. Warning Expiration Soon Notification', () => {
    it('notifies employee when active warning expires within 3 days and deduplicates', async () => {
      const now = Date.now();
      const warning1 = {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        companyId: mockCompanyId,
        status: 'ACTIVE',
        issuedAt: new Date(now - 28 * 86400000),
        expiresAt: new Date(now + 2 * 86400000), // expires in 2 days (within 3 days)
      } as unknown as IWarningDocument;

      vi.spyOn(WarningModel, 'find').mockResolvedValue([warning1]);

      // First check: no existing WARNING_EXPIRING_SOON notification
      vi.spyOn(notificationService, 'list').mockResolvedValue({
        notifications: [],
        total: 0,
        unreadCount: 0,
        page: 1,
        limit: 20,
      });

      const createNotifSpy = vi.spyOn(notificationService, 'create').mockResolvedValue({} as INotificationDocument);

      const notified = await disciplineService.checkAndNotifyExpiringWarnings(mockUserId, 3);
      expect(notified).toBe(1);
      expect(createNotifSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          type: 'WARNING_EXPIRING_SOON',
          title: 'Performance Warning Expiring Soon',
          link: `/employee/warnings?id=${warning1._id.toString()}`,
        })
      );

      // Second check: notification already exists, should NOT notify again
      vi.spyOn(notificationService, 'list').mockResolvedValue({
        notifications: [
          {
            _id: new Types.ObjectId(),
            userId: mockUserId,
            type: 'WARNING_EXPIRING_SOON',
            title: 'Performance Warning Expiring Soon',
            message: 'expiring',
            isRead: false,
            link: `/employee/warnings?id=${warning1._id.toString()}`,
            createdAt: new Date(),
          } as unknown as INotificationDocument,
        ],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 20,
      });

      const notifiedSecond = await disciplineService.checkAndNotifyExpiringWarnings(mockUserId, 3);
      expect(notifiedSecond).toBe(0);
    });
  });

  describe('5. Founder & System Events Notifications', () => {
    it('verifies notification types exist in canonical NOTIFICATION_TYPES enum', () => {
      expect(NOTIFICATION_TYPES).toContain('PROMOTION');
      expect(NOTIFICATION_TYPES).toContain('DEMOTION');
      expect(NOTIFICATION_TYPES).toContain('TERMINATION');
      expect(NOTIFICATION_TYPES).toContain('WARNING_ISSUED');
      expect(NOTIFICATION_TYPES).toContain('WARNING_EXPIRING_SOON');
      expect(NOTIFICATION_TYPES).toContain('COMPANY_BANKRUPT');
      expect(NOTIFICATION_TYPES).toContain('TASK_ASSIGNED');
      expect(NOTIFICATION_TYPES).toContain('TASK_EVALUATED');
      expect(NOTIFICATION_TYPES).toContain('DAILY_SCENARIO_READY');
      expect(NOTIFICATION_TYPES).toContain('LOW_BALANCE_WARNING');
      expect(NOTIFICATION_TYPES).toContain('AI_RESULT_READY');
    });
  });
});
