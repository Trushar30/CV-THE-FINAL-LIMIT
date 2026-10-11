import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { AIJobModel, type IAIJobDocument } from '../models/AIJob.js';
import { AIRequestLogModel } from '../models/AIRequestLog.js';
import { AIResponseLogModel } from '../models/AIResponseLog.js';
import { AIProviderModel } from '../models/AIProvider.js';
import { AIWorker } from '../ai/worker.js';
import { AIGateway } from '../ai/gateway.js';
import { ProviderRouter } from '../ai/provider-router.js';
import { HealthTracker } from '../ai/health-tracker.js';
import { MockAdapter } from '../ai/adapters/mock.adapter.js';
import type { AIRequest } from '../types/ai.js';

describe('TASK P10.3: AI Queue Behavior Under Load & Worker Idempotency Suite', () => {
  let router: ProviderRouter;
  let mockAdapter: MockAdapter;
  let healthTracker: HealthTracker;
  let gateway: AIGateway;
  let worker: AIWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    vi.spyOn(AIRequestLogModel, 'create').mockResolvedValue({} as never);
    vi.spyOn(AIResponseLogModel, 'create').mockResolvedValue({} as never);
    vi.spyOn(AIProviderModel, 'findOne').mockResolvedValue(null as never);

    mockAdapter = new MockAdapter({
      provider: 'groq',
      mockResponse: {
        provider: 'groq',
        model: 'groq-mock-v1',
        requestId: 'req-mock-1',
        content: 'Simulation output completed successfully',
        latencyMs: 15,
      },
    });

    router = new ProviderRouter();
    router.registerAdapter('PIPELINE', mockAdapter, 1);

    healthTracker = new HealthTracker(router);
    vi.spyOn(healthTracker, 'logRequest').mockResolvedValue(new Types.ObjectId());
    vi.spyOn(healthTracker, 'logResponse').mockResolvedValue(undefined);
    vi.spyOn(healthTracker, 'recordSuccess').mockResolvedValue(undefined);
    vi.spyOn(healthTracker, 'recordFailure').mockResolvedValue(undefined);

    gateway = new AIGateway(router, healthTracker);
    worker = new AIWorker(router, healthTracker, {
      pollIntervalMs: 1000,
      leaseDurationMs: 30000,
      pools: ['PIPELINE'],
    });
  });

  afterEach(() => {
    worker.stop();
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
    vi.restoreAllMocks();
  });

  it('enforces idempotency key deduplication on rapid concurrent job submission', async () => {
    const idempotencyKey = 'task-eval-batch-key-999';
    const request: AIRequest = {
      taskType: 'TASK_EVALUATION',
      userInput: 'Implement distributed locking mechanism',
    };

    const existingJob = {
      _id: new Types.ObjectId(),
      idempotencyKey,
      status: 'PENDING',
    };

    // First call: no existing job, creates new job
    vi.spyOn(AIJobModel, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingJob as unknown as IAIJobDocument);

    vi.spyOn(AIJobModel, 'create').mockResolvedValueOnce(existingJob as unknown as never);

    const jobId1 = await gateway.submit(request, {
      pool: 'PIPELINE',
      idempotencyKey,
    });

    const jobId2 = await gateway.submit(request, {
      pool: 'PIPELINE',
      idempotencyKey,
    });

    // Both submissions must resolve to the identical jobId
    expect(jobId1).toBe(existingJob._id.toString());
    expect(jobId2).toBe(existingJob._id.toString());
    expect(AIJobModel.create).toHaveBeenCalledTimes(1);
  });

  it('guarantees atomic single-worker claiming under concurrent load without double processing', async () => {
    const jobsCount = 50;
    const queuedJobs: Partial<IAIJobDocument>[] = [];

    for (let i = 0; i < jobsCount; i++) {
      queuedJobs.push({
        _id: new Types.ObjectId(),
        taskType: 'TASK_EVALUATION',
        pool: 'PIPELINE',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        attemptsPerProvider: new Map<string, number>(),
        payload: {
          taskType: 'TASK_EVALUATION',
          userInput: `Load task #${i}`,
        },
        save: vi.fn().mockResolvedValue(true),
      });
    }

    let claimIndex = 0;
    // Mock atomic findOneAndUpdate to return each job exactly once, then null when drained
    vi.spyOn(AIJobModel, 'findOneAndUpdate').mockImplementation(async () => {
      if (claimIndex < queuedJobs.length) {
        const claimed = queuedJobs[claimIndex++];
        claimed.status = 'PROCESSING';
        return claimed as IAIJobDocument;
      }
      return null;
    });

    // Simulate 5 concurrent workers trying to process the queue simultaneously
    const workerOptions = {
      pollIntervalMs: 1000,
      leaseDurationMs: 30000,
      pools: ['PIPELINE' as const],
    };
    const workers = [
      worker,
      new AIWorker(router, healthTracker, workerOptions),
      new AIWorker(router, healthTracker, workerOptions),
      new AIWorker(router, healthTracker, workerOptions),
      new AIWorker(router, healthTracker, workerOptions),
    ];

    // Mock processClaimedJob so we purely test concurrent atomic queue claiming without provider latency
    vi.spyOn(AIWorker.prototype, 'processClaimedJob').mockImplementation(async (job: IAIJobDocument) => {
      job.status = 'COMPLETED';
      await job.save();
    });

    const results: boolean[] = [];
    const runWorkerBatch = async (w: AIWorker) => {
      let processed = true;
      while (processed) {
        processed = await w.processNextJob('PIPELINE');
        if (processed) results.push(true);
      }
    };

    await Promise.all(workers.map((w) => runWorkerBatch(w)));

    // Exactly 50 jobs claimed and processed across all concurrent workers
    expect(results.length).toBe(jobsCount);
    expect(claimIndex).toBe(jobsCount);

    // Each job must have status = COMPLETED and save called
    for (const job of queuedJobs) {
      expect(job.status).toBe('COMPLETED');
      expect(job.save).toHaveBeenCalled();
    }
  });

  it('recovers expired leases when worker crashes without completing', async () => {
    const expiredJob: Partial<IAIJobDocument> = {
      _id: new Types.ObjectId(),
      taskType: 'ATS_SCREEN',
      pool: 'PIPELINE',
      status: 'PROCESSING',
      lockedUntil: new Date(Date.now() - 5000), // Expired 5 seconds ago
      lockedBy: 'crashed-worker-pid-1234',
      attempts: 1,
      maxAttempts: 3,
      attemptsPerProvider: new Map<string, number>(),
      payload: {
        taskType: 'ATS_SCREEN',
        userInput: 'Evaluate candidate resume',
      },
      save: vi.fn().mockResolvedValue(true),
    };

    // findOneAndUpdate claims the expired lease
    vi.spyOn(AIJobModel, 'findOneAndUpdate').mockImplementation(async (filter: unknown) => {
      const f = filter as { $or?: Array<{ status: string; lockedUntil?: { $lt: Date } }> };
      const allowsExpired = f.$or?.some((clause) => clause.status === 'PROCESSING' && clause.lockedUntil);
      if (allowsExpired) {
        expiredJob.status = 'PROCESSING';
        expiredJob.lockedBy = worker.workerId;
        return expiredJob as IAIJobDocument;
      }
      return null;
    });

    const claimed = await worker.claimJob('PIPELINE');
    expect(claimed).not.toBeNull();
    expect(claimed?._id).toEqual(expiredJob._id);
    expect(claimed?.lockedBy).toBe(worker.workerId);
  });
});
