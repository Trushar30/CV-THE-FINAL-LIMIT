import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import {
  DailyTaskService,
  getDifficultyForLevel,
  getMaxExpForDifficulty,
  getUtcDayKey,
  getEndOfDayUtc,
} from '../services/employee/dailyTask.service.js';
import {
  taskGenerationOutputSchema,
  type TaskGenerationOutput,
} from '../schemas/task.schema.js';
import { EmployeeTaskModel, type IEmployeeTaskDocument } from '../models/EmployeeTask.js';
import { CompanyEmployeeModel, type ICompanyEmployeeDocument } from '../models/CompanyEmployee.js';
import { CompanyModel, type ICompanyDocument } from '../models/Company.js';
import { ConfigService } from '../services/config/config.service.js';
import { DEFAULT_PLATFORM_CONFIG } from '../config/platformConfig.schema.js';
import { AIGateway, AIWorker, AIError } from '../ai/index.js';
import { type IAIJobDocument } from '../models/AIJob.js';

describe('Daily Tasks Engine & Idempotent Generation Suite (TASK P7.2)', () => {
  let dailyTaskService: DailyTaskService;
  let mockAIGateway: AIGateway;
  let mockAIWorker: AIWorker;
  let mockConfigService: ConfigService;

  const mockUserId = new Types.ObjectId();
  const mockOtherUserId = new Types.ObjectId();
  const mockEmployeeId = new Types.ObjectId();
  const mockCompanyId = new Types.ObjectId();

  const mockGeneratedPrimary: TaskGenerationOutput = {
    title: 'Implement Resilient Circuit Breaker',
    scenario:
      'The core API gateway is experiencing downstream cascading timeouts during peak payment settlement windows. Implement an exponential backoff circuit breaker with half-open probing state.',
    requirements: [
      'Implement closed, open, and half-open state transitions',
      'Support configurable threshold failure rates',
      'Add unit tests verifying transition behavior',
    ],
    difficulty: 'EASY',
    evaluationCriteria: [
      'Thread safety or async concurrency handling',
      'Accurate failure metric window computation',
    ],
  };

  const mockGeneratedBonus: TaskGenerationOutput = {
    title: 'Distributed Distributed Trace Propagator',
    scenario:
      'Service-to-service RPC calls are dropping W3C tracecontext headers across asynchronous queue boundaries. Build a zero-overhead trace propagator.',
    requirements: [
      'Extract and inject traceparent headers',
      'Ensure baggage items survive queue hops',
    ],
    difficulty: 'MEDIUM',
    evaluationCriteria: [
      'Zero mutation of existing envelope payloads',
      'Comprehensive error handling for malformed headers',
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAIGateway = {
      submit: vi.fn().mockResolvedValue(new Types.ObjectId().toString()),
      execute: vi.fn().mockImplementation(async (req) => {
        const isBonus = req.userInput.includes('Task Type: BONUS');
        return {
          success: true,
          provider: 'gemini',
          model: 'configured-gemini-model',
          requestId: 'test-req-id',
          content: '{"ok":true}',
          structuredData: isBonus ? mockGeneratedBonus : mockGeneratedPrimary,
          usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
          latencyMs: 150,
        };
      }),
    } as unknown as AIGateway;

    mockAIWorker = {
      registerValidator: vi.fn(),
      registerHandler: vi.fn(),
      registerStateChangeHandler: vi.fn(),
    } as unknown as AIWorker;

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_CONFIG),
    } as unknown as ConfigService;

    dailyTaskService = new DailyTaskService(mockAIGateway, mockAIWorker, mockConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Pure Option A Level-to-Difficulty Mapping
  // ---------------------------------------------------------------------------
  describe('Option A Level-to-Difficulty Mapping (getDifficultyForLevel)', () => {
    it('should map L1–L3 to PRIMARY: EASY, BONUS: MEDIUM', () => {
      // Level 1 (Intern)
      expect(getDifficultyForLevel(1, 'PRIMARY')).toBe('EASY');
      expect(getDifficultyForLevel(1, 'BONUS')).toBe('MEDIUM');

      // Level 2 (Junior)
      expect(getDifficultyForLevel(2, 'PRIMARY')).toBe('EASY');
      expect(getDifficultyForLevel(2, 'BONUS')).toBe('MEDIUM');

      // Level 3 (Junior+)
      expect(getDifficultyForLevel(3, 'PRIMARY')).toBe('EASY');
      expect(getDifficultyForLevel(3, 'BONUS')).toBe('MEDIUM');
    });

    it('should map L4–L6 to PRIMARY: MEDIUM, BONUS: HARD', () => {
      // Level 4 (Associate)
      expect(getDifficultyForLevel(4, 'PRIMARY')).toBe('MEDIUM');
      expect(getDifficultyForLevel(4, 'BONUS')).toBe('HARD');

      // Level 5 (Mid)
      expect(getDifficultyForLevel(5, 'PRIMARY')).toBe('MEDIUM');
      expect(getDifficultyForLevel(5, 'BONUS')).toBe('HARD');

      // Level 6 (Mid+)
      expect(getDifficultyForLevel(6, 'PRIMARY')).toBe('MEDIUM');
      expect(getDifficultyForLevel(6, 'BONUS')).toBe('HARD');
    });

    it('should map L7–L10 to PRIMARY: HARD, BONUS: HARD', () => {
      // Level 7 (Senior)
      expect(getDifficultyForLevel(7, 'PRIMARY')).toBe('HARD');
      expect(getDifficultyForLevel(7, 'BONUS')).toBe('HARD');

      // Level 8 (Senior+)
      expect(getDifficultyForLevel(8, 'PRIMARY')).toBe('HARD');
      expect(getDifficultyForLevel(8, 'BONUS')).toBe('HARD');

      // Level 9 (Lead)
      expect(getDifficultyForLevel(9, 'PRIMARY')).toBe('HARD');
      expect(getDifficultyForLevel(9, 'BONUS')).toBe('HARD');

      // Level 10 (Principal)
      expect(getDifficultyForLevel(10, 'PRIMARY')).toBe('HARD');
      expect(getDifficultyForLevel(10, 'BONUS')).toBe('HARD');
    });

    it('should defensively clamp out-of-bounds levels to valid [1, 10] range', () => {
      expect(getDifficultyForLevel(0, 'PRIMARY')).toBe('EASY'); // Clamped to 1
      expect(getDifficultyForLevel(-5, 'BONUS')).toBe('MEDIUM'); // Clamped to 1
      expect(getDifficultyForLevel(15, 'PRIMARY')).toBe('HARD'); // Clamped to 10
      expect(getDifficultyForLevel(NaN, 'PRIMARY')).toBe('EASY'); // Clamped to 1
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Max EXP Resolution per Difficulty Tier
  // ---------------------------------------------------------------------------
  describe('Max EXP Resolution (getMaxExpForDifficulty)', () => {
    it('should resolve default EXP ceilings: EASY=30, MEDIUM=60, HARD=100', () => {
      expect(getMaxExpForDifficulty('EASY')).toBe(30);
      expect(getMaxExpForDifficulty('MEDIUM')).toBe(60);
      expect(getMaxExpForDifficulty('HARD')).toBe(100);
    });

    it('should respect custom PlatformConfig employee limits if provided', () => {
      const customConfig = {
        easyMaxExp: 35,
        mediumMaxExp: 75,
        hardMaxExp: 120,
      };
      expect(getMaxExpForDifficulty('EASY', customConfig)).toBe(35);
      expect(getMaxExpForDifficulty('MEDIUM', customConfig)).toBe(75);
      expect(getMaxExpForDifficulty('HARD', customConfig)).toBe(120);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Date & Key Helpers
  // ---------------------------------------------------------------------------
  describe('Date Helpers', () => {
    it('should compute UTC dayKey in YYYY-MM-DD format', () => {
      const testDate = new Date('2026-10-09T14:30:00.000Z');
      expect(getUtcDayKey(testDate)).toBe('2026-10-09');
    });

    it('should compute end of day in UTC at 23:59:59.999', () => {
      const testDate = new Date('2026-10-09T08:00:00.000Z');
      const endOfDay = getEndOfDayUtc(testDate);
      expect(endOfDay.getUTCFullYear()).toBe(2026);
      expect(endOfDay.getUTCMonth()).toBe(9); // 0-indexed October
      expect(endOfDay.getUTCDate()).toBe(9);
      expect(endOfDay.getUTCHours()).toBe(23);
      expect(endOfDay.getUTCMinutes()).toBe(59);
      expect(endOfDay.getUTCSeconds()).toBe(59);
      expect(endOfDay.getUTCMilliseconds()).toBe(999);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Schema Validation
  // ---------------------------------------------------------------------------
  describe('taskGenerationOutputSchema Validation', () => {
    it('should validate complete AI task outputs', () => {
      const parsed = taskGenerationOutputSchema.parse(mockGeneratedPrimary);
      expect(parsed.title).toBe(mockGeneratedPrimary.title);
      expect(parsed.difficulty).toBe('EASY');
      expect(parsed.requirements.length).toBe(3);
    });

    it('should reject payload missing requirements or evaluation criteria', () => {
      const invalid = {
        title: 'Title',
        scenario: 'This is a sufficiently long scenario description explaining things.',
        requirements: [],
        difficulty: 'EASY',
        evaluationCriteria: [],
      };
      expect(() => taskGenerationOutputSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid difficulty values', () => {
      const invalid = {
        ...mockGeneratedPrimary,
        difficulty: 'SUPER_HARD',
      };
      expect(() => taskGenerationOutputSchema.parse(invalid)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. DailyTaskService - Lazy, Idempotent Generation
  // ---------------------------------------------------------------------------
  describe('Lazy, Idempotent Generation', () => {
    const mockEmployee = {
      _id: mockEmployeeId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      level: 2, // L2 Junior -> PRIMARY: EASY (30), BONUS: MEDIUM (60)
      positionTitle: 'Junior Software Engineer',
      status: 'ACTIVE',
    } as unknown as ICompanyEmployeeDocument;

    const mockCompany = {
      _id: mockCompanyId,
      name: 'Nexus Cloud Systems',
      description: 'Distributed Cloud Infrastructure Provider',
    } as unknown as ICompanyDocument;

    it('should lazily generate PRIMARY and BONUS tasks when none exist', async () => {
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompany);
      vi.spyOn(EmployeeTaskModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof EmployeeTaskModel.find>);

      const createdTasks: Array<Record<string, unknown>> = [];
      vi.spyOn(EmployeeTaskModel, 'create').mockImplementation(async (doc: unknown) => {
        const fullDoc = {
          _id: new Types.ObjectId(),
          ...(doc as Record<string, unknown>),
        } as unknown as IEmployeeTaskDocument;
        createdTasks.push(doc as Record<string, unknown>);
        return fullDoc;
      });

      const tasks = await dailyTaskService.getOrCreateDailyTasks({
        userId: mockUserId,
        dayKey: '2026-10-09',
      });

      expect(tasks).toHaveLength(2);
      expect(tasks[0].kind).toBe('PRIMARY');
      expect(tasks[0].difficulty).toBe('EASY');
      expect(tasks[0].maxExp).toBe(30);
      expect(tasks[0].status).toBe('ASSIGNED');

      expect(tasks[1].kind).toBe('BONUS');
      expect(tasks[1].difficulty).toBe('MEDIUM');
      expect(tasks[1].maxExp).toBe(60);
      expect(tasks[1].status).toBe('ASSIGNED');

      // AI Gateway was executed twice (once for PRIMARY, once for BONUS)
      expect(mockAIGateway.execute).toHaveBeenCalledTimes(2);
    });

    it('should be completely idempotent and not call AI Gateway if tasks already exist', async () => {
      const existingPrimary = {
        _id: new Types.ObjectId(),
        employeeId: mockEmployeeId,
        userId: mockUserId,
        companyId: mockCompanyId,
        domain: 'SOFTWARE_ENGINEERING',
        level: 2,
        kind: 'PRIMARY',
        difficulty: 'EASY',
        maxExp: 30,
        status: 'ASSIGNED',
        dayKey: '2026-10-09',
        scenario: mockGeneratedPrimary,
        title: mockGeneratedPrimary.title,
        description: mockGeneratedPrimary.scenario,
      } as unknown as IEmployeeTaskDocument;

      const existingBonus = {
        _id: new Types.ObjectId(),
        employeeId: mockEmployeeId,
        userId: mockUserId,
        companyId: mockCompanyId,
        domain: 'SOFTWARE_ENGINEERING',
        level: 2,
        kind: 'BONUS',
        difficulty: 'MEDIUM',
        maxExp: 60,
        status: 'ASSIGNED',
        dayKey: '2026-10-09',
        scenario: mockGeneratedBonus,
        title: mockGeneratedBonus.title,
        description: mockGeneratedBonus.scenario,
      } as unknown as IEmployeeTaskDocument;

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompany);
      vi.spyOn(EmployeeTaskModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([existingPrimary, existingBonus]),
      } as unknown as ReturnType<typeof EmployeeTaskModel.find>);

      const tasks = await dailyTaskService.getOrCreateDailyTasks({
        userId: mockUserId,
        dayKey: '2026-10-09',
      });

      expect(tasks).toHaveLength(2);
      expect(tasks[0]._id).toEqual(existingPrimary._id);
      expect(tasks[1]._id).toEqual(existingBonus._id);
      // AI Gateway should NOT be called since both tasks already exist
      expect(mockAIGateway.execute).not.toHaveBeenCalled();
    });

    it('should assign correct difficulty for senior employee (L8 Senior+)', async () => {
      const seniorEmployee = {
        ...mockEmployee,
        level: 8, // L8 -> PRIMARY: HARD (100), BONUS: HARD (100)
      } as unknown as ICompanyEmployeeDocument;

      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(seniorEmployee);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompany);
      vi.spyOn(EmployeeTaskModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof EmployeeTaskModel.find>);

      vi.spyOn(EmployeeTaskModel, 'create').mockImplementation(async (doc: unknown) => {
        return {
          _id: new Types.ObjectId(),
          ...(doc as Record<string, unknown>),
        } as unknown as IEmployeeTaskDocument;
      });

      const tasks = await dailyTaskService.getOrCreateDailyTasks({
        userId: mockUserId,
        dayKey: '2026-10-09',
      });

      expect(tasks).toHaveLength(2);
      expect(tasks[0].kind).toBe('PRIMARY');
      expect(tasks[0].difficulty).toBe('HARD');
      expect(tasks[0].maxExp).toBe(100);

      expect(tasks[1].kind).toBe('BONUS');
      expect(tasks[1].difficulty).toBe('HARD');
      expect(tasks[1].maxExp).toBe(100);
    });

    it('should handle MongoDB duplicate key race condition gracefully', async () => {
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompany);
      vi.spyOn(EmployeeTaskModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof EmployeeTaskModel.find>);

      const existingTask = {
        _id: new Types.ObjectId(),
        employeeId: mockEmployeeId,
        kind: 'PRIMARY',
        status: 'ASSIGNED',
      } as unknown as IEmployeeTaskDocument;

      const bonusTask = {
        _id: new Types.ObjectId(),
        employeeId: mockEmployeeId,
        kind: 'BONUS',
        status: 'ASSIGNED',
      } as unknown as IEmployeeTaskDocument;

      // Simulate duplicate key error on create for PRIMARY, then finding the existing record; then normal create for BONUS
      vi.spyOn(EmployeeTaskModel, 'create')
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce(bonusTask);
      vi.spyOn(EmployeeTaskModel, 'findOne').mockResolvedValue(existingTask);

      const tasks = await dailyTaskService.getOrCreateDailyTasks({
        userId: mockUserId,
        dayKey: '2026-10-09',
      });

      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. DailyTaskService - Provider Outage Fallback (WAITING_FOR_PROVIDER)
  // ---------------------------------------------------------------------------
  describe('Provider Resilience & WAITING_FOR_PROVIDER Fallback', () => {
    const mockEmployee = {
      _id: mockEmployeeId,
      userId: mockUserId,
      companyId: mockCompanyId,
      domain: 'SOFTWARE_ENGINEERING',
      level: 1,
      positionTitle: 'Intern',
      status: 'ACTIVE',
    } as unknown as ICompanyEmployeeDocument;

    const mockCompany = {
      _id: mockCompanyId,
      name: 'Acme Corp',
      description: 'Tech solutions',
    } as unknown as ICompanyDocument;

    it('should create tasks with WAITING_FOR_PROVIDER when AI providers are unavailable', async () => {
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(mockEmployee);
      vi.spyOn(CompanyModel, 'findById').mockResolvedValue(mockCompany);
      vi.spyOn(EmployeeTaskModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof EmployeeTaskModel.find>);

      // Simulate AI Gateway failure (e.g. all providers unavailable)
      (mockAIGateway.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new AIError("No available providers in pool 'PIPELINE'", 'UNAVAILABLE')
      );

      const createdTasks: Array<Record<string, unknown>> = [];
      vi.spyOn(EmployeeTaskModel, 'create').mockImplementation(async (doc: unknown) => {
        const full = {
          _id: new Types.ObjectId(),
          save: vi.fn().mockResolvedValue(true),
          ...(doc as Record<string, unknown>),
        } as unknown as IEmployeeTaskDocument;
        createdTasks.push(doc as Record<string, unknown>);
        return full;
      });

      const tasks = await dailyTaskService.getOrCreateDailyTasks({
        userId: mockUserId,
        dayKey: '2026-10-09',
      });

      expect(tasks).toHaveLength(2);
      expect(tasks[0].status).toBe('WAITING_FOR_PROVIDER');
      expect(tasks[1].status).toBe('WAITING_FOR_PROVIDER');
      expect(tasks[0].scenario.requirements).toBeDefined();

      // Confirms async background queue submission was triggered for recovery
      expect(mockAIGateway.submit).toHaveBeenCalledTimes(2);
    });

    it('should update task to ASSIGNED upon AIWorker job completion', async () => {
      const mockTaskId = new Types.ObjectId();
      const mockTask = {
        _id: mockTaskId,
        status: 'WAITING_FOR_PROVIDER',
        title: 'Placeholder',
        description: 'Placeholder description',
        scenario: {},
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IEmployeeTaskDocument;

      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);

      const completedJob = {
        _id: new Types.ObjectId(),
        requestorReference: mockTaskId.toString(),
        status: 'COMPLETED',
        result: {
          structuredData: mockGeneratedPrimary,
        },
      } as unknown as IAIJobDocument;

      await dailyTaskService.handleJobCompletion(completedJob);

      expect(mockTask.status).toBe('ASSIGNED');
      expect(mockTask.title).toBe(mockGeneratedPrimary.title);
      expect(mockTask.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Ownership and Authorization
  // ---------------------------------------------------------------------------
  describe('Ownership and Error Handling', () => {
    it('should throw 404 EMPLOYEE_NOT_FOUND if user is not an active employee', async () => {
      vi.spyOn(CompanyEmployeeModel, 'findOne').mockResolvedValue(null);

      await expect(
        dailyTaskService.getOrCreateDailyTasks({ userId: mockUserId })
      ).rejects.toThrow('Active employee record not found');
    });

    it('should allow user to get their own task by ID', async () => {
      const mockTaskId = new Types.ObjectId();
      const mockTask = {
        _id: mockTaskId,
        userId: mockUserId,
        title: 'My Task',
      } as unknown as IEmployeeTaskDocument;

      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);

      const result = await dailyTaskService.getTaskById(mockTaskId, mockUserId);
      expect(result._id).toEqual(mockTaskId);
    });

    it('should throw 403 FORBIDDEN when user requests another employees task', async () => {
      const mockTaskId = new Types.ObjectId();
      const mockTask = {
        _id: mockTaskId,
        userId: mockOtherUserId,
        title: 'Other Task',
      } as unknown as IEmployeeTaskDocument;

      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(mockTask);

      await expect(
        dailyTaskService.getTaskById(mockTaskId, mockUserId)
      ).rejects.toThrow('Access denied: You do not own this task');
    });

    it('should throw 404 TASK_NOT_FOUND when task does not exist', async () => {
      vi.spyOn(EmployeeTaskModel, 'findById').mockResolvedValue(null);

      await expect(
        dailyTaskService.getTaskById(new Types.ObjectId(), mockUserId)
      ).rejects.toThrow('Task not found');
    });
  });
});
