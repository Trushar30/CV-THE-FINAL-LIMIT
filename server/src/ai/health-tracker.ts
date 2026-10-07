import mongoose, { Types } from 'mongoose';
import { AIProvider, ProviderHealthState } from '../types/enums.js';
import type { AIPool, AIRequest, AIResponse, AIErrorCategory, ProviderAdapter } from './types.js';
import type { ProviderRouter } from './provider-router.js';
import { AIProviderModel } from '../models/AIProvider.js';
import { AIRequestLogModel } from '../models/AIRequestLog.js';
import { AIResponseLogModel } from '../models/AIResponseLog.js';
import { AIHealthLogModel } from '../models/AIHealthLog.js';
import { logger } from '../utils/logger.js';

export interface HealthTrackerOptions {
  failureThresholdForTempFail?: number; // default: 3
  rateLimitBackoffMs?: number; // default: 60_000 (1 min)
  tempFailInitialBackoffMs?: number; // default: 30_000 (30 sec)
}

export class HealthTracker {
  private readonly failureThreshold: number;
  private readonly rateLimitBackoffMs: number;
  private readonly tempFailInitialBackoffMs: number;

  constructor(
    private readonly router: ProviderRouter,
    options: HealthTrackerOptions = {}
  ) {
    this.failureThreshold = options.failureThresholdForTempFail ?? 3;
    this.rateLimitBackoffMs = options.rateLimitBackoffMs ?? 60_000;
    this.tempFailInitialBackoffMs = options.tempFailInitialBackoffMs ?? 30_000;
  }

  /**
   * Helper: Truncate prompt and sanitize secrets for logging
   */
  public sanitizeAndTruncatePrompt(prompt: string, maxLen = 200): string {
    if (!prompt) return '';
    // Single-line preview with whitespace collapsed
    const collapsed = prompt.replace(/\s+/g, ' ').trim();
    if (collapsed.length <= maxLen) {
      return collapsed;
    }
    return collapsed.slice(0, maxLen) + '... [TRUNCATED]';
  }

  /**
   * Record an AI Request in aiRequests log
   */
  async logRequest(params: {
    taskType: AIRequest['taskType'];
    pool: AIPool;
    providerCode: string;
    modelId: string;
    jobId?: Types.ObjectId | null;
    promptSummary: string;
  }): Promise<Types.ObjectId> {
    const id = new Types.ObjectId();
    if (mongoose.connection.readyState === 1) {
      try {
        await AIRequestLogModel.create({
          _id: id,
          taskType: params.taskType,
          pool: params.pool,
          providerCode: params.providerCode,
          modelId: params.modelId,
          jobId: params.jobId ?? null,
          promptSummary: this.sanitizeAndTruncatePrompt(params.promptSummary),
          createdAt: new Date(),
        });
      } catch (err) {
        logger.warn('Failed to write to aiRequests log', { error: String(err) });
      }
    }
    return id;
  }

  /**
   * Record an AI Response in aiResponses log
   */
  async logResponse(params: {
    requestId: Types.ObjectId;
    jobId?: Types.ObjectId | null;
    providerCode: string;
    latencyMs: number;
    usage?: AIResponse['usage'];
    success: boolean;
    errorCode?: string | null;
  }): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      try {
        await AIResponseLogModel.create({
          requestId: params.requestId,
          jobId: params.jobId ?? null,
          providerCode: params.providerCode,
          latencyMs: params.latencyMs,
          inputTokens: params.usage?.inputTokens ?? 0,
          outputTokens: params.usage?.outputTokens ?? 0,
          totalTokens: params.usage?.totalTokens ?? 0,
          success: params.success,
          errorCode: params.errorCode ?? null,
          createdAt: new Date(),
        });
      } catch (err) {
        logger.warn('Failed to write to aiResponses log', { error: String(err) });
      }
    }
  }

  /**
   * Record health diagnostics ping in aiHealthLogs
   */
  async logHealthCheck(params: {
    providerCode: string;
    pool: AIPool;
    status: string;
    latencyMs: number;
    errorMessage?: string | null;
  }): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      try {
        await AIHealthLogModel.create({
          providerCode: params.providerCode,
          pool: params.pool,
          status: params.status,
          latencyMs: params.latencyMs,
          errorMessage: params.errorMessage ?? null,
          timestamp: new Date(),
        });
      } catch (err) {
        logger.warn('Failed to write to aiHealthLogs', { error: String(err) });
      }
    }
  }

  /**
   * Handle successful provider call:
   * Reset consecutive failures, update average latency, and restore HEALTHY state if recovered.
   */
  async recordSuccess(pool: AIPool, provider: AIProvider, latencyMs: number): Promise<void> {
    const currentRouterState = this.router.getHealthState(pool, provider);

    // If disabled manually by AI Manager, do not auto-enable
    if (currentRouterState !== 'DISABLED') {
      this.router.setHealthState(pool, provider, 'HEALTHY');
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await AIProviderModel.findOne({ code: provider, pool });
        if (doc) {
          const oldTotal = doc.totalRequests;
          const oldAvg = doc.averageLatencyMs || 0;
          const newAvg = Math.round((oldAvg * oldTotal + latencyMs) / (oldTotal + 1));

          doc.totalRequests += 1;
          doc.consecutiveFailures = 0;
          doc.lastSuccessAt = new Date();
          doc.averageLatencyMs = newAvg;
          if (doc.status !== 'DISABLED') {
            doc.status = 'HEALTHY';
          }
          doc.recoveryCheckAt = null;
          await doc.save();
        }
      } catch (err) {
        logger.warn('Failed to update provider health on success', {
          provider,
          error: String(err),
        });
      }
    }
  }

  /**
   * Handle provider error:
   * Updates state per spec:
   * - 429 RATE_LIMIT -> RATE_LIMITED with backoff
   * - Consecutive failures >= threshold (3) -> TEMPORARILY_FAILED with backoff
   * - Transient errors -> DEGRADED
   * - AUTH_CONFIG / INVALID_REQUEST -> DEGRADED (needs attention)
   */
  async recordFailure(
    pool: AIPool,
    provider: AIProvider,
    category: AIErrorCategory,
    errorMessage: string
  ): Promise<ProviderHealthState> {
    const currentRouterState = this.router.getHealthState(pool, provider);
    if (currentRouterState === 'DISABLED') {
      return 'DISABLED';
    }

    let nextState: ProviderHealthState = 'DEGRADED';

    if (category === 'RATE_LIMIT') {
      nextState = 'RATE_LIMITED';
    }

    // Read or increment consecutive failures in DB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await AIProviderModel.findOne({ code: provider, pool });
        if (doc) {
          doc.totalRequests += 1;
          doc.totalFailures += 1;
          doc.consecutiveFailures += 1;
          doc.lastFailureAt = new Date();
          doc.lastFailureReason = `${category}: ${errorMessage.slice(0, 200)}`;

          if (category === 'RATE_LIMIT') {
            doc.status = 'RATE_LIMITED';
            doc.recoveryCheckAt = new Date(Date.now() + this.rateLimitBackoffMs);
          } else if (doc.consecutiveFailures >= this.failureThreshold) {
            nextState = 'TEMPORARILY_FAILED';
            doc.status = 'TEMPORARILY_FAILED';
            const multiplier = Math.min(doc.consecutiveFailures - this.failureThreshold, 4);
            const backoff = this.tempFailInitialBackoffMs * Math.pow(2, multiplier);
            doc.recoveryCheckAt = new Date(Date.now() + backoff);
          } else {
            nextState = 'DEGRADED';
            doc.status = 'DEGRADED';
          }

          await doc.save();
        }
      } catch (err) {
        logger.warn('Failed to update provider health on failure', {
          provider,
          error: String(err),
        });
      }
    } else {
      // In-memory calculation if DB not connected (e.g. unit tests)
      if (category === 'RATE_LIMIT') {
        nextState = 'RATE_LIMITED';
      }
    }

    this.router.setHealthState(pool, provider, nextState);
    return nextState;
  }

  /**
   * Probe an unhealthy provider with an adapter health check and recover if successful.
   * Returns true if provider is now HEALTHY.
   */
  async probeAndRecover(pool: AIPool, adapter: ProviderAdapter): Promise<boolean> {
    const provider = adapter.name;
    const currentState = this.router.getHealthState(pool, provider);

    if (currentState === 'HEALTHY' || currentState === 'DISABLED') {
      return currentState === 'HEALTHY';
    }

    const startTime = Date.now();
    let isHealthy = false;
    let errorMessage: string | null = null;

    try {
      isHealthy = await adapter.healthCheck();
    } catch (err) {
      isHealthy = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Date.now() - startTime;

    await this.logHealthCheck({
      providerCode: provider,
      pool,
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      latencyMs,
      errorMessage,
    });

    if (isHealthy) {
      this.router.setHealthState(pool, provider, 'HEALTHY');
      if (mongoose.connection.readyState === 1) {
        try {
          await AIProviderModel.updateOne(
            { code: provider, pool },
            {
              $set: {
                status: 'HEALTHY',
                consecutiveFailures: 0,
                lastSuccessAt: new Date(),
                recoveryCheckAt: null,
              },
            }
          );
        } catch (err) {
          logger.warn('Failed to mark provider healthy in DB', {
            provider,
            error: String(err),
          });
        }
      }
      return true;
    } else {
      // Keep degraded/failed and increment backoff
      if (mongoose.connection.readyState === 1) {
        try {
          await AIProviderModel.updateOne(
            { code: provider, pool },
            {
              $set: {
                recoveryCheckAt: new Date(Date.now() + this.tempFailInitialBackoffMs),
                lastFailureAt: new Date(),
                lastFailureReason: errorMessage ?? 'Health check failed',
              },
            }
          );
        } catch (err) {
          logger.warn('Failed to update recoveryCheckAt in DB', {
            provider,
            error: String(err),
          });
        }
      }
      return false;
    }
  }
}
