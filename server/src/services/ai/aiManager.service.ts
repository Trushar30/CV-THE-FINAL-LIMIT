import { Types } from 'mongoose';
import { AIProvider, ProviderHealthState } from '../../types/enums.js';
import type { AIPool, ProviderAdapter } from '../../ai/types.js';
import type { ProviderRouter } from '../../ai/provider-router.js';
import type { HealthTracker } from '../../ai/health-tracker.js';
import type { IAuditService } from '../audit/audit.interface.js';
import { AIProviderModel, IAIProviderDocument } from '../../models/AIProvider.js';
import { AIHealthLogModel } from '../../models/AIHealthLog.js';
import { AIResponseLogModel } from '../../models/AIResponseLog.js';
import { AIJobModel } from '../../models/AIJob.js';
import { encryptSecret, decryptSecret, maskApiKey } from '../../utils/crypto.js';
import { AppError } from '../../utils/errors.js';
import type { CreateProviderInput, UpdateProviderInput } from '../../schemas/aiManager.schema.js';
import { GeminiAdapter, OpenAIAdapter, GroqAdapter } from '../../ai/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export function createDefaultAdapter(
  code: AIProvider,
  apiKey?: string,
  modelId?: string
): ProviderAdapter {
  switch (code) {
    case 'gemini':
      return new GeminiAdapter({ modelId: modelId || 'gemini-2.5-flash', apiKey });
    case 'openai':
      return new OpenAIAdapter({ modelId: modelId || 'gpt-4o-mini', apiKey });
    case 'groq':
      return new GroqAdapter({ modelId: modelId || 'llama-3.3-70b-versatile', apiKey });
    default:
      throw new Error(`Unsupported provider code: ${code}`);
  }
}

export interface QueueStatsDto {
  depth: number;
  pending: number;
  retrying: number;
  processing: number;
  waitingForProvider: number;
  completed: number;
  failed: number;
  total: number;
}

export interface ProviderResponseDto {
  id: string;
  code: AIProvider;
  name: string;
  priority: number;
  pool: AIPool;
  status: ProviderHealthState;
  modelId?: string | null;
  maskedApiKey?: string | null;
  rateLimitRpm: number;
  dailyLimit?: number | null;
  dailyRequests: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  averageLatencyMs: number;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  lastFailureReason?: string | null;
  lastCheckedAt?: Date | null;
}

export class AIManagerService {
  constructor(
    private readonly router: ProviderRouter,
    private readonly healthTracker: HealthTracker,
    private readonly auditService: IAuditService
  ) {}

  private toDto(doc: IAIProviderDocument): ProviderResponseDto {
    return {
      id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      priority: doc.priority,
      pool: doc.pool,
      status: doc.status,
      modelId: doc.modelId ?? null,
      maskedApiKey: doc.maskedApiKey ?? null,
      rateLimitRpm: doc.rateLimitRpm,
      dailyLimit: doc.dailyLimit ?? null,
      dailyRequests: doc.dailyRequests ?? 0,
      consecutiveFailures: doc.consecutiveFailures,
      totalRequests: doc.totalRequests,
      totalFailures: doc.totalFailures,
      averageLatencyMs: doc.averageLatencyMs,
      lastSuccessAt: doc.lastSuccessAt ?? null,
      lastFailureAt: doc.lastFailureAt ?? null,
      lastFailureReason: doc.lastFailureReason ?? null,
      lastCheckedAt: doc.lastCheckedAt ?? null,
    };
  }

  /**
   * List providers with masked keys
   */
  async listProviders(pool?: AIPool): Promise<ProviderResponseDto[]> {
    const filter = pool ? { pool } : {};
    const docs = await AIProviderModel.find(filter).sort({ pool: 1, priority: 1 });
    return docs.map((d) => this.toDto(d));
  }

  /**
   * Add a new runtime AI provider
   */
  async addProvider(
    input: CreateProviderInput,
    actorId: string | Types.ObjectId,
    adapterFactory?: (code: AIProvider, apiKey?: string, modelId?: string) => ProviderAdapter
  ): Promise<ProviderResponseDto> {
    const existing = await AIProviderModel.findOne({
      code: input.code as AIProvider,
      pool: input.pool as AIPool,
    });

    if (existing) {
      throw AppError.conflict(`Provider '${input.code}' already exists in pool '${input.pool}'`);
    }

    let encryptedApiKey: string | null = null;
    let maskedKey: string | null = null;

    if (input.apiKey) {
      encryptedApiKey = encryptSecret(input.apiKey);
      maskedKey = maskApiKey(input.apiKey);
    }

    const doc = await AIProviderModel.create({
      code: input.code as AIProvider,
      name: input.name,
      priority: input.priority,
      pool: input.pool as AIPool,
      status: 'HEALTHY',
      modelId: input.modelId ?? null,
      encryptedApiKey,
      maskedApiKey: maskedKey,
      rateLimitRpm: input.rateLimitRpm ?? 60,
      dailyLimit: input.dailyLimit ?? null,
      dailyRequests: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
      averageLatencyMs: 0,
    });

    // If an adapter is provided or can be constructed, register into ProviderRouter
    const effectiveFactory = adapterFactory ?? createDefaultAdapter;
    try {
      const adapter = effectiveFactory(input.code as AIProvider, input.apiKey, input.modelId);
      this.router.registerAdapter(input.pool as AIPool, adapter, input.priority);
    } catch (err) {
      logger.warn(
        `[AIManager] Could not register adapter in router for '${input.code}': ${(err as Error).message}`
      );
    }

    // Write audit log with reason
    await this.auditService.record({
      actorId,
      actorRole: 'AI_MANAGER',
      action: 'AI_PROVIDER_CREATE',
      targetType: 'AIProvider',
      targetId: doc._id,
      newValue: {
        code: doc.code,
        name: doc.name,
        pool: doc.pool,
        priority: doc.priority,
        modelId: doc.modelId,
        maskedApiKey: doc.maskedApiKey,
      },
      reason: input.reason,
    });

    return this.toDto(doc);
  }

  /**
   * Update an existing AI provider (priority, model, rate limits, status, api key)
   */
  async updateProvider(
    code: AIProvider,
    pool: AIPool,
    input: UpdateProviderInput,
    actorId: string | Types.ObjectId
  ): Promise<ProviderResponseDto> {
    const doc = await AIProviderModel.findOne({ code, pool });
    if (!doc) {
      throw AppError.notFound(`Provider '${code}' not found in pool '${pool}'`);
    }

    const oldValue = {
      priority: doc.priority,
      modelId: doc.modelId,
      status: doc.status,
      rateLimitRpm: doc.rateLimitRpm,
      dailyLimit: doc.dailyLimit,
      maskedApiKey: doc.maskedApiKey,
    };

    if (input.priority !== undefined) {
      doc.priority = input.priority;
      this.router.setPriority(pool, code, input.priority);
    }

    if (input.modelId !== undefined) {
      doc.modelId = input.modelId;
    }

    if (input.status !== undefined) {
      doc.status = input.status;
      this.router.setHealthState(pool, code, input.status);
    }

    if (input.rateLimitRpm !== undefined) {
      doc.rateLimitRpm = input.rateLimitRpm;
    }

    if (input.dailyLimit !== undefined) {
      doc.dailyLimit = input.dailyLimit;
    }

    if (input.apiKey) {
      doc.encryptedApiKey = encryptSecret(input.apiKey);
      doc.maskedApiKey = maskApiKey(input.apiKey);
    }

    await doc.save();

    const newValue = {
      priority: doc.priority,
      modelId: doc.modelId,
      status: doc.status,
      rateLimitRpm: doc.rateLimitRpm,
      dailyLimit: doc.dailyLimit,
      maskedApiKey: doc.maskedApiKey,
    };

    // Write audit log
    await this.auditService.record({
      actorId,
      actorRole: 'AI_MANAGER',
      action: 'AI_PROVIDER_UPDATE',
      targetType: 'AIProvider',
      targetId: doc._id,
      oldValue,
      newValue,
      reason: input.reason,
    });

    return this.toDto(doc);
  }

  /**
   * Enable a provider
   */
  async enableProvider(
    code: AIProvider,
    pool: AIPool,
    actorId: string | Types.ObjectId,
    reason: string
  ): Promise<ProviderResponseDto> {
    return this.updateProvider(code, pool, { status: 'HEALTHY', reason }, actorId);
  }

  /**
   * Disable a provider
   */
  async disableProvider(
    code: AIProvider,
    pool: AIPool,
    actorId: string | Types.ObjectId,
    reason: string
  ): Promise<ProviderResponseDto> {
    return this.updateProvider(code, pool, { status: 'DISABLED', reason }, actorId);
  }

  /**
   * Remove a provider
   */
  async removeProvider(
    code: AIProvider,
    pool: AIPool,
    actorId: string | Types.ObjectId,
    reason: string
  ): Promise<{ success: boolean; removedCode: AIProvider; pool: AIPool }> {
    const doc = await AIProviderModel.findOne({ code, pool });
    if (!doc) {
      throw AppError.notFound(`Provider '${code}' not found in pool '${pool}'`);
    }

    const oldValue = {
      code: doc.code,
      name: doc.name,
      pool: doc.pool,
      priority: doc.priority,
      maskedApiKey: doc.maskedApiKey,
    };

    await AIProviderModel.deleteOne({ _id: doc._id });
    this.router.removeAdapter(pool, code);

    await this.auditService.record({
      actorId,
      actorRole: 'AI_MANAGER',
      action: 'AI_PROVIDER_DELETE',
      targetType: 'AIProvider',
      targetId: doc._id,
      oldValue,
      newValue: null,
      reason,
    });

    return { success: true, removedCode: code, pool };
  }

  /**
   * Diagnostic test / health ping of a provider
   */
  async testProvider(
    code: AIProvider,
    pool: AIPool
  ): Promise<{ success: boolean; latencyMs: number; status: string; errorMessage?: string }> {
    let adapter = this.router.getAdapter(pool, code);
    if (!adapter) {
      const doc = await AIProviderModel.findOne({ code, pool }).select('+encryptedApiKey');
      if (doc) {
        const apiKey = doc.encryptedApiKey ? decryptSecret(doc.encryptedApiKey) : undefined;
        try {
          adapter = createDefaultAdapter(code, apiKey, doc.modelId || undefined);
          this.router.registerAdapter(pool, adapter, doc.priority);
        } catch (err) {
          logger.warn(
            `[AIManager] Failed to instantiate adapter on-the-fly for '${code}': ${(err as Error).message}`
          );
        }
      }
    }
    if (!adapter) {
      throw AppError.notFound(`Adapter for provider '${code}' not found in pool '${pool}'`);
    }

    const startTime = Date.now();
    let isHealthy = false;
    let errorMessage: string | undefined;

    try {
      isHealthy = await this.healthTracker.probeAndRecover(pool, adapter);
    } catch (err) {
      isHealthy = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Date.now() - startTime;

    return {
      success: isHealthy,
      latencyMs,
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      errorMessage,
    };
  }

  /**
   * View consolidated health, diagnostics logs, and usage summary
   * Accessible by AI_MANAGER and ADMIN
   */
  async getHealthAndUsage(pool?: AIPool): Promise<{
    providers: ProviderResponseDto[];
    recentHealthLogs: unknown[];
    recentResponses: unknown[];
    queueStats: QueueStatsDto;
  }> {
    const providers = await this.listProviders(pool);
    const healthLogFilter = pool ? { pool } : {};

    const recentHealthLogs = await AIHealthLogModel.find(healthLogFilter)
      .sort({ timestamp: -1 })
      .limit(50);

    const recentResponses = await AIResponseLogModel.find({}).sort({ createdAt: -1 }).limit(50);

    const jobFilter = pool ? { pool } : {};
    const [pending, retrying, processing, waitingForProvider, completed, failed, total] =
      await Promise.all([
        AIJobModel.countDocuments({ ...jobFilter, status: 'PENDING' }),
        AIJobModel.countDocuments({ ...jobFilter, status: 'RETRYING' }),
        AIJobModel.countDocuments({ ...jobFilter, status: 'PROCESSING' }),
        AIJobModel.countDocuments({ ...jobFilter, status: 'WAITING_FOR_PROVIDER' }),
        AIJobModel.countDocuments({ ...jobFilter, status: 'COMPLETED' }),
        AIJobModel.countDocuments({ ...jobFilter, status: 'FAILED' }),
        AIJobModel.countDocuments(jobFilter),
      ]);

    const queueStats: QueueStatsDto = {
      depth: pending + retrying + processing,
      pending,
      retrying,
      processing,
      waitingForProvider,
      completed,
      failed,
      total,
    };

    return {
      providers,
      recentHealthLogs,
      recentResponses,
      queueStats,
    };
  }

  /**
   * Idempotently seeds the DEMO pool providers from environment variables (GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY).
   * Called during server bootstrap to ensure DEMO pool reflects .env configurations.
   */
  async seedDemoPoolFromEnv(
    adapterFactory?: (code: AIProvider, apiKey?: string, modelId?: string) => ProviderAdapter
  ): Promise<ProviderResponseDto[]> {
    const defaultConfigs: Array<{
      code: AIProvider;
      name: string;
      modelId: string;
      priority: number;
      rateLimitRpm: number;
      dailyLimit: number;
      apiKey?: string;
    }> = [
      {
        code: 'gemini',
        name: 'Google Gemini Pro',
        modelId: 'gemini-2.5-flash',
        priority: 1,
        rateLimitRpm: 60,
        dailyLimit: 10000,
        apiKey: env.GEMINI_API_KEY,
      },
      {
        code: 'openai',
        name: 'OpenAI GPT-4o Mini',
        modelId: 'gpt-4o-mini',
        priority: 2,
        rateLimitRpm: 60,
        dailyLimit: 10000,
        apiKey: env.OPENAI_API_KEY,
      },
      {
        code: 'groq',
        name: 'Groq Llama 3.3 70B',
        modelId: 'llama-3.3-70b-versatile',
        priority: 3,
        rateLimitRpm: 30,
        dailyLimit: 14400,
        apiKey: env.GROQ_API_KEY,
      },
    ];

    const seeded: ProviderResponseDto[] = [];
    const factory = adapterFactory ?? createDefaultAdapter;

    for (const config of defaultConfigs) {
      const trimmedKey = config.apiKey?.trim();
      if (!trimmedKey) {
        continue;
      }

      let doc = await AIProviderModel.findOne({
        code: config.code,
        pool: 'DEMO',
      }).select('+encryptedApiKey');

      if (!doc) {
        const encryptedApiKey = encryptSecret(trimmedKey);
        const maskedApiKey = maskApiKey(trimmedKey);

        doc = await AIProviderModel.create({
          code: config.code,
          name: config.name,
          priority: config.priority,
          pool: 'DEMO',
          status: 'HEALTHY',
          modelId: config.modelId,
          encryptedApiKey,
          maskedApiKey,
          rateLimitRpm: config.rateLimitRpm,
          dailyLimit: config.dailyLimit,
          dailyRequests: 0,
          consecutiveFailures: 0,
          totalRequests: 0,
          totalFailures: 0,
          averageLatencyMs: 0,
        });

        logger.info(`[AIManager] Seeded provider '${config.code}' into DEMO pool from environment`);
      }

      // Always register adapter into ProviderRouter
      try {
        const adapter = factory(config.code, trimmedKey, doc.modelId || config.modelId);
        this.router.registerAdapter('DEMO', adapter, doc.priority);
      } catch (err) {
        logger.warn(
          `[AIManager] Failed to register adapter for '${config.code}' in DEMO pool: ${(err as Error).message}`
        );
      }

      seeded.push(this.toDto(doc));
    }

    return seeded;
  }
}
