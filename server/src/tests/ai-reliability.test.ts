import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { AIJobModel } from '../models/AIJob.js';
import { AIProviderModel } from '../models/AIProvider.js';
import { AIRequestLogModel } from '../models/AIRequestLog.js';
import { AIResponseLogModel } from '../models/AIResponseLog.js';
import { AIHealthLogModel } from '../models/AIHealthLog.js';
import { ProviderRouter } from '../ai/provider-router.js';
import { HealthTracker } from '../ai/health-tracker.js';
import { AIGateway } from '../ai/gateway.js';
import { AIWorker } from '../ai/worker.js';
import { MockAdapter } from '../ai/adapters/mock.adapter.js';
import type { AIRequest } from '../ai/types.js';

const TEST_MONGODB_URI = 'mongodb://localhost:27017/corpverse_test_ai_reliability';

describe('AI Reliability Layer Integration Suite (TASK P3.5)', () => {
  beforeAll(async () => {
    await connectDatabase(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await AIJobModel.collection.deleteMany({});
      await AIProviderModel.collection.deleteMany({});
      await AIRequestLogModel.collection.deleteMany({});
      await AIResponseLogModel.collection.deleteMany({});
      await AIHealthLogModel.collection.deleteMany({});
      await disconnectDatabase();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await AIJobModel.collection.deleteMany({});
      await AIProviderModel.collection.deleteMany({});
      await AIRequestLogModel.collection.deleteMany({});
      await AIResponseLogModel.collection.deleteMany({});
      await AIHealthLogModel.collection.deleteMany({});
    }
  });

  const sampleRequest: AIRequest = {
    taskType: 'TASK_GENERATION',
    systemInstruction: 'You are an engineering evaluator.',
    userInput: 'Generate a mid-level coding task for software engineering.',
    temperature: 0.7,
    maxTokens: 500,
  };

  describe('Fallback after 3 failures on Provider 1 to Provider 2', () => {
    it('should retry 3 times on Provider 1 before cascading to Provider 2 and succeeding', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const gateway = new AIGateway(router, tracker);

      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      // Configure Gemini to fail 3 times with retryable error
      geminiAdapter.setError('TIMEOUT');

      const openaiAdapter = new MockAdapter({ provider: 'openai' });

      router.registerAdapter('PIPELINE', geminiAdapter, 1);
      router.registerAdapter('PIPELINE', openaiAdapter, 2);

      const worker = new AIWorker(router, tracker, {
        pools: ['PIPELINE'],
        maxAttemptsPerProvider: 3,
      });

      // Submit job
      const jobId = await gateway.submit(sampleRequest, { pool: 'PIPELINE' });

      // Tick 1: Gemini attempt 1 fails
      await worker.processNextJob('PIPELINE');
      let job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('RETRYING');
      expect(job?.attempts).toBe(1);
      expect(job?.attemptsPerProvider.get('gemini')).toBe(1);

      // Re-arm Gemini failure for attempt 2
      geminiAdapter.setError('TIMEOUT');
      await worker.processNextJob('PIPELINE');
      job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('RETRYING');
      expect(job?.attempts).toBe(2);
      expect(job?.attemptsPerProvider.get('gemini')).toBe(2);

      // Re-arm Gemini failure for attempt 3
      geminiAdapter.setError('TIMEOUT');
      await worker.processNextJob('PIPELINE');
      job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('RETRYING');
      expect(job?.attempts).toBe(3);
      expect(job?.attemptsPerProvider.get('gemini')).toBe(3);

      // Tick 4: Gemini has 3 attempts; worker falls back to OpenAI and succeeds
      await worker.processNextJob('PIPELINE');
      job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('COMPLETED');
      expect(job?.attempts).toBe(4);
      expect(job?.currentProvider).toBe('openai');
      expect(job?.attemptsPerProvider.get('gemini')).toBe(3);
      expect(job?.attemptsPerProvider.get('openai')).toBe(1);
      expect(job?.result).toBeDefined();
      expect(job?.result?.success).toBe(true);
      expect(job?.error).toBeNull();
    });
  });

  describe('All Providers Down Then Recovery', () => {
    it('should transition to WAITING_FOR_PROVIDER when all providers fail, then resume automatically on recovery', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const gateway = new AIGateway(router, tracker);

      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      const openaiAdapter = new MockAdapter({ provider: 'openai' });

      router.registerAdapter('PIPELINE', geminiAdapter, 1);
      router.registerAdapter('PIPELINE', openaiAdapter, 2);

      const worker = new AIWorker(router, tracker, {
        pools: ['PIPELINE'],
        maxAttemptsPerProvider: 3,
      });

      const jobId = await gateway.submit(sampleRequest, { pool: 'PIPELINE' });

      // Fail Gemini 3 times
      for (let i = 0; i < 3; i++) {
        geminiAdapter.setError('RATE_LIMIT');
        await worker.processNextJob('PIPELINE');
      }

      // Fail OpenAI 3 times
      for (let i = 0; i < 3; i++) {
        openaiAdapter.setError('PROVIDER_ERROR');
        await worker.processNextJob('PIPELINE');
      }

      // 7th call should notice all providers exhausted and transition to WAITING_FOR_PROVIDER
      await worker.processNextJob('PIPELINE');
      let job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('WAITING_FOR_PROVIDER');

      // Now Provider 1 (Gemini) recovers!
      geminiAdapter.reset(); // clear error simulation
      await tracker.recordSuccess('PIPELINE', 'gemini', 150);

      // Check and resume waiting jobs
      const resumedCount = await worker.checkAndResumeWaitingJobs('PIPELINE');
      expect(resumedCount).toBe(1);

      job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('PENDING');

      // Next tick processes and completes the job using Gemini
      await worker.processNextJob('PIPELINE');
      job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('COMPLETED');
      expect(job?.result?.success).toBe(true);
    });
  });

  describe('Worker Crash Mid-Job (Atomic Reclaiming via Expired Lease)', () => {
    it('should safely reclaim and complete a job whose lease expired due to worker crash', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({ provider: 'gemini' });
      router.registerAdapter('PIPELINE', adapter, 1);

      const workerA = new AIWorker(router, tracker, {
        workerId: 'worker-dead-node-1',
        leaseDurationMs: 100,
      });
      const workerB = new AIWorker(router, tracker, {
        workerId: 'worker-surviving-node-2',
        leaseDurationMs: 30000,
      });

      const gateway = new AIGateway(router, tracker);
      const jobId = await gateway.submit(sampleRequest, { pool: 'PIPELINE' });

      // Worker A claims job
      const claimedByA = await workerA.claimJob('PIPELINE');
      expect(claimedByA).toBeDefined();
      expect(claimedByA?.status).toBe('PROCESSING');
      expect(claimedByA?.lockedBy).toBe('worker-dead-node-1');

      // Worker A "crashes": lease expires in the past
      await AIJobModel.findByIdAndUpdate(jobId, {
        $set: {
          lockedUntil: new Date(Date.now() - 5000), // expired 5 seconds ago
        },
      });

      // Worker B polls and claims the expired job atomically
      const claimedByB = await workerB.claimJob('PIPELINE');
      expect(claimedByB).toBeDefined();
      expect(claimedByB?._id.toString()).toBe(jobId);
      expect(claimedByB?.lockedBy).toBe('worker-surviving-node-2');

      // Worker B finishes processing
      await workerB.processClaimedJob(claimedByB!);

      const job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('COMPLETED');
      expect(job?.result?.success).toBe(true);
      expect(job?.lockedBy).toBeNull();
      expect(job?.lockedUntil).toBeNull();
    });
  });

  describe('Duplicate Submit with Same Idempotency Key', () => {
    it('should return existing jobId without creating duplicate job documents', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const gateway = new AIGateway(router, tracker);

      const idempotencyKey = 'req-key-abc-12345';

      const jobId1 = await gateway.submit(sampleRequest, {
        pool: 'PIPELINE',
        idempotencyKey,
      });

      const jobId2 = await gateway.submit(sampleRequest, {
        pool: 'PIPELINE',
        idempotencyKey,
      });

      expect(jobId1).toBe(jobId2);

      const count = await AIJobModel.countDocuments({ idempotencyKey });
      expect(count).toBe(1);
    });
  });

  describe('Non-Retryable Fast-Fail without Cascading', () => {
    it('should immediately fail job on AUTH_CONFIG and mark provider DEGRADED without attempting provider 2', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const gateway = new AIGateway(router, tracker);

      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      geminiAdapter.setError('AUTH_CONFIG');

      const openaiAdapter = new MockAdapter({ provider: 'openai' });

      router.registerAdapter('PIPELINE', geminiAdapter, 1);
      router.registerAdapter('PIPELINE', openaiAdapter, 2);

      const worker = new AIWorker(router, tracker, { pools: ['PIPELINE'] });

      const jobId = await gateway.submit(sampleRequest, { pool: 'PIPELINE' });
      await worker.processNextJob('PIPELINE');

      const job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('FAILED');
      expect(job?.error?.category).toBe('AUTH_CONFIG');
      expect(job?.attempts).toBe(1);
      // OpenAI was NOT called
      expect(openaiAdapter.callHistory.length).toBe(0);

      // Gemini marked DEGRADED
      expect(router.getHealthState('PIPELINE', 'gemini')).toBe('DEGRADED');
    });

    it('should immediately fail job on INVALID_REQUEST without attempting provider 2', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const gateway = new AIGateway(router, tracker);

      const geminiAdapter = new MockAdapter({ provider: 'gemini' });
      geminiAdapter.setError('INVALID_REQUEST');

      const openaiAdapter = new MockAdapter({ provider: 'openai' });

      router.registerAdapter('PIPELINE', geminiAdapter, 1);
      router.registerAdapter('PIPELINE', openaiAdapter, 2);

      const worker = new AIWorker(router, tracker, { pools: ['PIPELINE'] });

      const jobId = await gateway.submit(sampleRequest, { pool: 'PIPELINE' });
      await worker.processNextJob('PIPELINE');

      const job = await AIJobModel.findById(jobId);
      expect(job?.status).toBe('FAILED');
      expect(job?.error?.category).toBe('INVALID_REQUEST');
      expect(openaiAdapter.callHistory.length).toBe(0);
    });
  });

  describe('Observability Logging & Prompt Truncation', () => {
    it('should truncate and sanitize prompts in request logs', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({ provider: 'gemini' });
      router.registerAdapter('PIPELINE', adapter, 1);
      const gateway = new AIGateway(router, tracker);

      const veryLongInput = 'A'.repeat(500);
      await gateway.execute(
        {
          taskType: 'ATS_EVALUATION',
          systemInstruction: 'Screen resume',
          userInput: veryLongInput,
        },
        { pool: 'PIPELINE' }
      );

      const requestLogs = await AIRequestLogModel.find({});
      expect(requestLogs.length).toBeGreaterThan(0);
      const latest = requestLogs[0];
      expect(latest.promptSummary.length).toBeLessThan(300);
      expect(latest.promptSummary).toContain('[TRUNCATED]');

      const responseLogs = await AIResponseLogModel.find({});
      expect(responseLogs.length).toBeGreaterThan(0);
      expect(responseLogs[0].success).toBe(true);
      expect(responseLogs[0].inputTokens).toBeGreaterThan(0);
    });
  });

  describe('Gateway Synchronous Bounded Timeout', () => {
    it('should throw TIMEOUT error when adapter exceeds timeoutMs', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({
        provider: 'gemini',
        delayMs: 200,
      });
      router.registerAdapter('PIPELINE', adapter, 1);
      const gateway = new AIGateway(router, tracker);

      await expect(
        gateway.execute(sampleRequest, {
          pool: 'PIPELINE',
          timeoutMs: 50,
        })
      ).rejects.toMatchObject({
        category: 'TIMEOUT',
      });
    });
  });

  describe('HealthTracker State Transitions & Probing', () => {
    it('should transition to RATE_LIMITED on 429 error and update DB', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({ provider: 'gemini' });
      router.registerAdapter('PIPELINE', adapter, 1);

      await AIProviderModel.create({
        code: 'gemini',
        name: 'Google Gemini',
        priority: 1,
        pool: 'PIPELINE',
        status: 'HEALTHY',
        rateLimitRpm: 60,
      });

      const nextState = await tracker.recordFailure(
        'PIPELINE',
        'gemini',
        'RATE_LIMIT',
        'Too many requests'
      );
      expect(nextState).toBe('RATE_LIMITED');
      expect(router.getHealthState('PIPELINE', 'gemini')).toBe('RATE_LIMITED');

      const doc = await AIProviderModel.findOne({ code: 'gemini', pool: 'PIPELINE' });
      expect(doc?.status).toBe('RATE_LIMITED');
      expect(doc?.recoveryCheckAt).toBeDefined();
    });

    it('should transition to TEMPORARILY_FAILED after 3 consecutive failures', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({ provider: 'openai' });
      router.registerAdapter('PIPELINE', adapter, 1);

      await AIProviderModel.create({
        code: 'openai',
        name: 'OpenAI GPT',
        priority: 1,
        pool: 'PIPELINE',
        status: 'HEALTHY',
        rateLimitRpm: 60,
      });

      await tracker.recordFailure('PIPELINE', 'openai', 'PROVIDER_ERROR', '500 error');
      await tracker.recordFailure('PIPELINE', 'openai', 'TIMEOUT', 'timeout');
      const state3 = await tracker.recordFailure(
        'PIPELINE',
        'openai',
        'NETWORK',
        'connection dropped'
      );

      expect(state3).toBe('TEMPORARILY_FAILED');
      expect(router.getHealthState('PIPELINE', 'openai')).toBe('TEMPORARILY_FAILED');

      const doc = await AIProviderModel.findOne({ code: 'openai', pool: 'PIPELINE' });
      expect(doc?.status).toBe('TEMPORARILY_FAILED');
      expect(doc?.consecutiveFailures).toBe(3);
    });

    it('should never override a manually DISABLED provider on success or probe', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({ provider: 'groq' });
      router.registerAdapter('PIPELINE', adapter, 1);
      router.setHealthState('PIPELINE', 'groq', 'DISABLED');

      await tracker.recordSuccess('PIPELINE', 'groq', 100);
      expect(router.getHealthState('PIPELINE', 'groq')).toBe('DISABLED');

      const recovered = await tracker.probeAndRecover('PIPELINE', adapter);
      expect(recovered).toBe(false);
      expect(router.getHealthState('PIPELINE', 'groq')).toBe('DISABLED');
    });

    it('should probe and recover a degraded provider when healthCheck succeeds', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const adapter = new MockAdapter({ provider: 'gemini' });
      router.registerAdapter('PIPELINE', adapter, 1);
      router.setHealthState('PIPELINE', 'gemini', 'DEGRADED');

      adapter.simulateHealthCheck(true);
      const recovered = await tracker.probeAndRecover('PIPELINE', adapter);
      expect(recovered).toBe(true);
      expect(router.getHealthState('PIPELINE', 'gemini')).toBe('HEALTHY');

      const healthLogs = await AIHealthLogModel.find({ providerCode: 'gemini' });
      expect(healthLogs.length).toBe(1);
      expect(healthLogs[0].status).toBe('HEALTHY');
    });
  });

  describe('Worker Lifecycle & Queue Operations', () => {
    it('should return false when queue is empty', async () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const worker = new AIWorker(router, tracker, { pools: ['PIPELINE'] });

      const processed = await worker.processNextJob('PIPELINE');
      expect(processed).toBe(false);
    });

    it('should start and stop polling loop cleanly', () => {
      const router = new ProviderRouter();
      const tracker = new HealthTracker(router);
      const worker = new AIWorker(router, tracker, { pollIntervalMs: 5000 });

      worker.start();
      // Second start call is a safe no-op
      worker.start();
      worker.stop();
      // Second stop call is a safe no-op
      worker.stop();
    });
  });
});
