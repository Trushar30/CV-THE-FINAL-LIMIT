/**
 * AIWorker — MongoDB-backed polling worker with atomic job claiming.
 *
 * Spec Section 21.2: Custom MongoDB Worker polling every 2 seconds.
 * Spec Section 21.1: Retry rules (3 attempts per provider, fallback priority, WAITING_FOR_PROVIDER).
 * Spec Section 21.3: AI Job State Machine.
 * Decision D6:       In-process Node worker with atomic job claiming (no Redis in v1).
 */

import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { AIJobModel, IAIJobDocument } from '../models/AIJob.js';
import type { AIPool, AIResponse } from './types.js';
import { AIError } from './types.js';
import type { ProviderRouter } from './provider-router.js';
import type { HealthTracker } from './health-tracker.js';
import { validateAgainstSchema } from './gateway.js';
import { logger } from '../utils/logger.js';

export type JobValidator = (job: IAIJobDocument, response: AIResponse) => void | Promise<void>;
export type JobCompletionHandler = (job: IAIJobDocument) => Promise<void>;
export type JobStateChangeHandler = (job: IAIJobDocument) => Promise<void>;

export interface AIWorkerOptions {
  workerId?: string;
  pollIntervalMs?: number; // default: 2000ms
  leaseDurationMs?: number; // default: 30000ms (30s)
  pools?: AIPool[]; // default: ['PIPELINE', 'DEMO']
  maxAttemptsPerProvider?: number; // default: 3
}

export class AIWorker {
  public readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly pools: AIPool[];
  private readonly maxAttemptsPerProvider: number;

  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private isProcessingTick = false;

  private readonly validators = new Map<string, JobValidator>();
  private readonly handlers = new Map<string, JobCompletionHandler>();
  private readonly stateChangeHandlers = new Map<string, JobStateChangeHandler>();

  constructor(
    private readonly router: ProviderRouter,
    private readonly healthTracker: HealthTracker,
    options: AIWorkerOptions = {}
  ) {
    this.workerId = options.workerId ?? `worker-${randomUUID()}`;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.leaseDurationMs = options.leaseDurationMs ?? 30000;
    this.pools = options.pools ?? ['PIPELINE', 'DEMO'];
    this.maxAttemptsPerProvider = options.maxAttemptsPerProvider ?? 3;
  }

  public registerValidator(taskType: string, validator: JobValidator): void {
    this.validators.set(taskType, validator);
  }

  public registerHandler(taskType: string, handler: JobCompletionHandler): void {
    this.handlers.set(taskType, handler);
  }

  public registerStateChangeHandler(taskType: string, handler: JobStateChangeHandler): void {
    this.stateChangeHandlers.set(taskType, handler);
  }

  /**
   * Start background polling loop
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('AIWorker started', {
      workerId: this.workerId,
      pollIntervalMs: this.pollIntervalMs,
    });

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);

    // Initial immediate tick
    void this.tick();
  }

  /**
   * Stop background polling loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('AIWorker stopped', { workerId: this.workerId });
  }

  /**
   * Single polling tick: attempts to process one job across configured pools
   */
  async tick(): Promise<void> {
    if (this.isProcessingTick) return;
    this.isProcessingTick = true;

    try {
      // Check and resume waiting jobs if healthy providers exist
      for (const pool of this.pools) {
        await this.checkAndResumeWaitingJobs(pool);
      }

      // Try claiming and processing jobs in each pool
      for (const pool of this.pools) {
        let processed = true;
        // Drain jobs if available, up to a sensible batch limit per tick
        let count = 0;
        while (processed && count < 5) {
          processed = await this.processNextJob(pool);
          if (processed) count++;
        }
      }
    } catch (err) {
      logger.error('Error during AIWorker tick', { workerId: this.workerId, error: String(err) });
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
   * Atomically claim the next eligible job for a pool.
   * Eligible states:
   *   - PENDING
   *   - RETRYING
   *   - PROCESSING with expired lockedUntil (worker crash recovery)
   */
  async claimJob(pool: AIPool): Promise<IAIJobDocument | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    const now = new Date();
    const filter = {
      pool,
      $or: [
        { status: 'PENDING' },
        { status: 'RETRYING' },
        { status: 'PROCESSING', lockedUntil: { $lt: now } },
      ],
    };

    const update = {
      $set: {
        status: 'PROCESSING',
        lockedBy: this.workerId,
        lockedUntil: new Date(Date.now() + this.leaseDurationMs),
      },
    };

    const claimed = await AIJobModel.findOneAndUpdate(filter, update, {
      sort: { createdAt: 1 },
      new: true,
    });

    return claimed;
  }

  /**
   * Process a single job: executes on eligible provider, handles fallback, retries, or transitions to WAITING_FOR_PROVIDER.
   * Returns true if a job was claimed and handled, false if queue is empty.
   */
  async processNextJob(pool: AIPool): Promise<boolean> {
    const job = await this.claimJob(pool);
    if (!job) {
      return false;
    }

    await this.processClaimedJob(job);
    return true;
  }

  /**
   * Process an already-claimed job document
   */
  async processClaimedJob(job: IAIJobDocument): Promise<void> {
    const pool = job.pool;
    const maxAttempts = job.maxAttempts || this.maxAttemptsPerProvider;

    // Convert attemptsPerProvider map if needed
    if (!job.attemptsPerProvider) {
      job.attemptsPerProvider = new Map<string, number>();
    }

    // 1. Select eligible provider
    const availableEntries = this.router.getAvailableProviders(pool);
    let selectedEntry = null;

    for (const entry of availableEntries) {
      const attempts = job.attemptsPerProvider.get(entry.provider) ?? 0;
      if (attempts < maxAttempts) {
        selectedEntry = entry;
        break;
      }
    }

    // If all providers have reached attempt limit -> WAITING_FOR_PROVIDER
    if (!selectedEntry) {
      job.status = 'WAITING_FOR_PROVIDER';
      job.lockedBy = null;
      job.lockedUntil = null;
      await job.save();
      logger.warn('All AI providers exhausted for job, transitioning to WAITING_FOR_PROVIDER', {
        jobId: job._id.toString(),
        pool,
      });

      const stateHandler = this.stateChangeHandlers.get(job.taskType);
      if (stateHandler) {
        await stateHandler(job);
      }
      return;
    }

    const provider = selectedEntry.provider;
    const previousAttemptsOnProvider = job.attemptsPerProvider.get(provider) ?? 0;

    // Update job state before attempting execution
    job.currentProvider = provider;
    job.attempts += 1;
    job.attemptsPerProvider.set(provider, previousAttemptsOnProvider + 1);
    job.lockedUntil = new Date(Date.now() + this.leaseDurationMs);
    await job.save();

    const startTime = Date.now();
    const promptPreview = `${job.payload.systemInstruction ? `[SYSTEM: ${job.payload.systemInstruction}] ` : ''}${job.payload.userInput}`;
    const logRequestId = await this.healthTracker.logRequest({
      taskType: job.taskType,
      pool,
      providerCode: provider,
      modelId: 'dynamic',
      jobId: job._id,
      promptSummary: promptPreview,
    });

    let response: AIResponse;
    try {
      response = await selectedEntry.adapter.generate(job.payload);

      // Validate structured output if schema present
      if (job.payload.outputSchema) {
        if (!response.structuredData) {
          throw new AIError(
            `Output schema specified but provider '${provider}' returned no structured data`,
            'PROVIDER_ERROR',
            provider
          );
        }
        const validationErrors = validateAgainstSchema(
          response.structuredData,
          job.payload.outputSchema
        );
        if (validationErrors.length > 0) {
          throw new AIError(
            `Structured output validation failed: ${validationErrors.join('; ')}`,
            'PROVIDER_ERROR',
            provider
          );
        }
      }

      // Execute registered task-specific validator (e.g., Zod schema validation)
      const validator = this.validators.get(job.taskType);
      if (validator) {
        await validator(job, response);
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      let aiError: AIError;

      if (err instanceof AIError) {
        aiError = err;
      } else {
        aiError = new AIError(
          `Unexpected error from provider '${provider}': ${err instanceof Error ? err.message : String(err)}`,
          'PROVIDER_ERROR',
          provider
        );
      }

      await this.healthTracker.recordFailure(pool, provider, aiError.category, aiError.message);
      await this.healthTracker.logResponse({
        requestId: logRequestId,
        jobId: job._id,
        providerCode: provider,
        latencyMs,
        success: false,
        errorCode: aiError.category,
      });

      // Handle non-retryable vs retryable
      if (!aiError.retryable) {
        // Spec: "AUTH_CONFIG and INVALID_REQUEST fail fast and mark the provider DEGRADED/needs attention without cascading."
        job.status = 'FAILED';
        job.error = {
          category: aiError.category,
          message: aiError.message,
          provider,
          timestamp: new Date(),
        };
        job.lockedBy = null;
        job.lockedUntil = null;
        await job.save();

        const stateHandler = this.stateChangeHandlers.get(job.taskType);
        if (stateHandler) {
          await stateHandler(job);
        }
        return;
      }

      // Retryable error handling:
      job.error = {
        category: aiError.category,
        message: aiError.message,
        provider,
        timestamp: new Date(),
      };

      // Check if more attempts remain on this provider or next providers
      const attemptsAfterThis = previousAttemptsOnProvider + 1;
      const providerHasAttemptsLeft = attemptsAfterThis < maxAttempts;

      // Check if any subsequent provider has attempts left
      const nextProvidersHaveAttempts = availableEntries.some((e) => {
        if (e.provider === provider) return false;
        const a = job.attemptsPerProvider.get(e.provider) ?? 0;
        return a < maxAttempts;
      });

      if (providerHasAttemptsLeft || nextProvidersHaveAttempts) {
        job.status = 'RETRYING';
        job.lockedBy = null;
        job.lockedUntil = null;
        await job.save();

        const stateHandler = this.stateChangeHandlers.get(job.taskType);
        if (stateHandler) {
          await stateHandler(job);
        }
      } else {
        job.status = 'WAITING_FOR_PROVIDER';
        job.lockedBy = null;
        job.lockedUntil = null;
        await job.save();

        const stateHandler = this.stateChangeHandlers.get(job.taskType);
        if (stateHandler) {
          await stateHandler(job);
        }
      }
      return;
    }

    // Success path
    const latencyMs = Date.now() - startTime;
    await this.healthTracker.recordSuccess(pool, provider, latencyMs);
    await this.healthTracker.logResponse({
      requestId: logRequestId,
      jobId: job._id,
      providerCode: provider,
      latencyMs,
      usage: response.usage,
      success: true,
    });

    job.status = 'COMPLETED';
    job.result = response;
    job.error = null;
    job.lockedBy = null;
    job.lockedUntil = null;
    await job.save();

    // Trigger registered completion handler
    const handler = this.handlers.get(job.taskType);
    if (handler) {
      try {
        await handler(job);
      } catch (handlerErr) {
        logger.error(`Handler for taskType '${job.taskType}' failed`, {
          jobId: job._id.toString(),
          error: String(handlerErr),
        });
      }
    }

    // After success, attempt resuming any waiting jobs
    await this.checkAndResumeWaitingJobs(pool);
  }

  /**
   * Resumes jobs in WAITING_FOR_PROVIDER state when healthy providers are available.
   * Resets attempts count on healthy providers so waiting jobs get processed cleanly.
   */
  async checkAndResumeWaitingJobs(pool: AIPool): Promise<number> {
    if (mongoose.connection.readyState !== 1) {
      return 0;
    }

    const available = this.router.getAvailableProviders(pool);
    const hasHealthyProvider = available.some((p) => p.healthState === 'HEALTHY');

    if (!hasHealthyProvider) {
      return 0;
    }

    // Find waiting jobs
    const waitingJobs = await AIJobModel.find({
      pool,
      status: 'WAITING_FOR_PROVIDER',
    });

    if (waitingJobs.length === 0) {
      return 0;
    }

    for (const job of waitingJobs) {
      // Clear attempt counters for healthy providers
      for (const entry of available) {
        if (entry.healthState === 'HEALTHY') {
          job.attemptsPerProvider.delete(entry.provider);
        }
      }
      job.status = 'PENDING';
      job.currentProvider = null;
      job.lockedBy = null;
      job.lockedUntil = null;
      await job.save();
    }

    logger.info('Resumed waiting AI jobs upon provider recovery', {
      pool,
      resumedCount: waitingJobs.length,
    });

    return waitingJobs.length;
  }
}
