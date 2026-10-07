import { apiClient } from './client';

export type AIProvider = 'gemini' | 'openai' | 'groq';
export type ProviderHealthState =
  'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'TEMPORARILY_FAILED' | 'DISABLED';
export type AIPool = 'DEMO' | 'PIPELINE';

export interface ProviderDto {
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
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
  lastCheckedAt?: string | null;
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

export interface HealthLogDto {
  _id: string;
  provider: AIProvider;
  pool: AIPool;
  status: ProviderHealthState;
  previousStatus?: ProviderHealthState;
  latencyMs: number;
  errorMessage?: string | null;
  timestamp: string;
}

export interface ResponseLogDto {
  _id: string;
  provider: AIProvider;
  pool: AIPool;
  model: string;
  durationMs: number;
  tokensTotal?: number;
  createdAt: string;
}

export interface HealthAndUsageDto {
  providers: ProviderDto[];
  recentHealthLogs: HealthLogDto[];
  recentResponses: ResponseLogDto[];
  queueStats: QueueStatsDto;
}

export interface CreateProviderPayload {
  code: AIProvider;
  name: string;
  priority: number;
  pool: AIPool;
  modelId?: string;
  apiKey?: string;
  rateLimitRpm?: number;
  dailyLimit?: number;
  reason: string;
}

export interface UpdateProviderPayload {
  priority?: number;
  modelId?: string;
  apiKey?: string;
  status?: ProviderHealthState;
  rateLimitRpm?: number;
  dailyLimit?: number;
  reason: string;
}

export interface TestResultDto {
  success: boolean;
  latencyMs: number;
  status: string;
  errorMessage?: string;
}

export const aiOpsApi = {
  /**
   * Fetch list of configured providers
   */
  async listProviders(pool?: AIPool): Promise<{ providers: ProviderDto[] }> {
    return apiClient.get<{ providers: ProviderDto[] }>('/ai-manager/providers', {
      params: pool ? { pool } : undefined,
    });
  },

  /**
   * Fetch consolidated health, usage logs, and queue metrics
   */
  async getHealthAndUsage(pool?: AIPool): Promise<HealthAndUsageDto> {
    return apiClient.get<HealthAndUsageDto>('/ai-manager/health-usage', {
      params: pool ? { pool } : undefined,
    });
  },

  /**
   * Add a new runtime AI provider
   */
  async createProvider(data: CreateProviderPayload): Promise<{ provider: ProviderDto }> {
    return apiClient.post<{ provider: ProviderDto }>('/ai-manager/providers', data);
  },

  /**
   * Update existing provider settings
   */
  async updateProvider(
    code: AIProvider,
    data: UpdateProviderPayload,
    pool: AIPool = 'PIPELINE'
  ): Promise<{ provider: ProviderDto }> {
    return apiClient.patch<{ provider: ProviderDto }>(`/ai-manager/providers/${code}`, data, {
      params: { pool },
    });
  },

  /**
   * Enable a provider
   */
  async enableProvider(
    code: AIProvider,
    reason: string,
    pool: AIPool = 'PIPELINE'
  ): Promise<{ provider: ProviderDto }> {
    return apiClient.post<{ provider: ProviderDto }>(
      `/ai-manager/providers/${code}/enable`,
      { reason },
      { params: { pool } }
    );
  },

  /**
   * Disable a provider
   */
  async disableProvider(
    code: AIProvider,
    reason: string,
    pool: AIPool = 'PIPELINE'
  ): Promise<{ provider: ProviderDto }> {
    return apiClient.post<{ provider: ProviderDto }>(
      `/ai-manager/providers/${code}/disable`,
      { reason },
      { params: { pool } }
    );
  },

  /**
   * Delete a provider
   */
  async removeProvider(
    code: AIProvider,
    reason: string,
    pool: AIPool = 'PIPELINE'
  ): Promise<{ success: boolean; removedCode: AIProvider; pool: AIPool }> {
    return apiClient.delete<{ success: boolean; removedCode: AIProvider; pool: AIPool }>(
      `/ai-manager/providers/${code}`,
      {
        params: { pool },
        body: JSON.stringify({ reason }),
      }
    );
  },

  /**
   * Diagnostic test health ping
   */
  async testProvider(code: AIProvider, pool: AIPool = 'PIPELINE'): Promise<TestResultDto> {
    return apiClient.post<TestResultDto>(`/ai-manager/providers/${code}/test`, undefined, {
      params: { pool },
    });
  },
};
