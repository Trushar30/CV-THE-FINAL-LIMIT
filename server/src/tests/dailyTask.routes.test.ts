import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DailyTaskController } from '../controllers/dailyTask.controller.js';
import { requireCareerRole, authenticateJwt } from '../middleware/auth.middleware.js';
import { dailyTaskService } from '../services/employee/dailyTask.service.js';
import { UserModel, type IUserDocument } from '../models/User.js';
import { type IEmployeeTaskDocument } from '../models/EmployeeTask.js';
import { signAccessToken } from '../utils/jwt.js';

describe('Daily Task Controller & Middleware RBAC Suite (TASK P7.2)', () => {
  let controller: DailyTaskController;

  const employeeUserId = new Types.ObjectId();
  const mockEmployeeUser = {
    _id: employeeUserId,
    email: 'employee@example.com',
    careerRole: 'EMPLOYEE',
    platformRole: 'NONE',
    isSuspended: false,
    status: 'ACTIVE',
    isEmailVerified: true,
    emailVerified: true,
  } as unknown as IUserDocument;

  const mockJobSeekerUser = {
    _id: new Types.ObjectId(),
    email: 'jobseeker@example.com',
    careerRole: 'JOB_SEEKER',
    platformRole: 'NONE',
    isSuspended: false,
    status: 'ACTIVE',
    isEmailVerified: true,
    emailVerified: true,
  } as unknown as IUserDocument;

  const mockTaskId = new Types.ObjectId();
  const mockPrimaryTask = {
    _id: mockTaskId,
    userId: employeeUserId,
    employeeId: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    kind: 'PRIMARY',
    difficulty: 'EASY',
    maxExp: 30,
    status: 'ASSIGNED',
    dayKey: '2026-10-09',
    title: 'Implement Database Connection Pool',
    description: 'Optimize PostgreSQL idle connection pool limits.',
  } as unknown as IEmployeeTaskDocument;

  const mockBonusTask = {
    _id: new Types.ObjectId(),
    userId: employeeUserId,
    employeeId: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    kind: 'BONUS',
    difficulty: 'MEDIUM',
    maxExp: 60,
    status: 'ASSIGNED',
    dayKey: '2026-10-09',
    title: 'Add Distributed Tracing Header Validator',
    description: 'Ensure W3C tracecontext headers validate cleanly.',
  } as unknown as IEmployeeTaskDocument;

  beforeEach(() => {
    vi.restoreAllMocks();
    controller = new DailyTaskController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockRes() {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  }

  // ---------------------------------------------------------------------------
  // 1. RBAC Guard: requireCareerRole('EMPLOYEE')
  // ---------------------------------------------------------------------------
  describe('RBAC Guard: requireCareerRole(EMPLOYEE)', () => {
    const guard = requireCareerRole('EMPLOYEE');

    it('should reject unauthenticated request with 401', () => {
      const req = {} as Request;
      const res = createMockRes();
      const next = vi.fn();

      guard(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: 'Authentication required' })
      );
    });

    it('should reject non-EMPLOYEE (e.g. JOB_SEEKER) with 403 Forbidden', () => {
      const req = { user: mockJobSeekerUser } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      guard(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining('Required career role: EMPLOYEE'),
        })
      );
    });

    it('should allow active EMPLOYEE to proceed to next()', () => {
      const req = { user: mockEmployeeUser } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      guard(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. JWT Authentication: authenticateJwt
  // ---------------------------------------------------------------------------
  describe('authenticateJwt with Token', () => {
    it('should reject missing Authorization header with 401', async () => {
      const req = { headers: {} } as Request;
      const res = createMockRes();
      const next = vi.fn();

      await authenticateJwt(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: 'Authentication token is required' })
      );
    });

    it('should load user onto req.user with valid bearer token', async () => {
      const validToken = signAccessToken({
        userId: employeeUserId.toString(),
        email: 'employee@example.com',
        role: 'EMPLOYEE',
        platformRole: 'NONE',
      });

      vi.spyOn(UserModel, 'findById').mockResolvedValue(mockEmployeeUser);

      const req = {
        headers: { authorization: `Bearer ${validToken}` },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await authenticateJwt(req, res, next);
      expect(req.user).toEqual(mockEmployeeUser);
      expect(next).toHaveBeenCalledWith();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Controller: getTodayTasks
  // ---------------------------------------------------------------------------
  describe('DailyTaskController.getTodayTasks', () => {
    it('should return 200 with today tasks for authenticated employee', async () => {
      vi.spyOn(dailyTaskService, 'getOrCreateDailyTasks').mockResolvedValue([
        mockPrimaryTask,
        mockBonusTask,
      ]);

      const req = { user: mockEmployeeUser } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getTodayTasks(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tasks: [mockPrimaryTask, mockBonusTask],
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass service errors to next(error)', async () => {
      const error = new Error('Service failure');
      vi.spyOn(dailyTaskService, 'getOrCreateDailyTasks').mockRejectedValue(error);

      const req = { user: mockEmployeeUser } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getTodayTasks(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Controller: getTaskById
  // ---------------------------------------------------------------------------
  describe('DailyTaskController.getTaskById', () => {
    it('should return 200 with single task details', async () => {
      vi.spyOn(dailyTaskService, 'getTaskById').mockResolvedValue(mockPrimaryTask);

      const req = {
        user: mockEmployeeUser,
        params: { id: mockTaskId.toString() },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getTaskById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          task: mockPrimaryTask,
        },
      });
    });

    it('should pass unauthorized error if req.user is missing', async () => {
      const req = { params: { id: mockTaskId.toString() } } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn();

      await controller.getTaskById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: 'Authentication required' })
      );
    });
  });
});
