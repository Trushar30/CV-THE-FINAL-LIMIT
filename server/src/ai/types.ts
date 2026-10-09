/**
 * AI Gateway Internal Types
 *
 * Spec Section 16: AI Gateway contracts (AIRequest, AIResponse)
 * Spec Section 21: AI Queue and Retry System (error categories, retryability)
 * Decision D11: Provider Pools Isolation (DEMO vs PIPELINE)
 *
 * Business code must only import AIGateway; these types flow through it.
 */

import type { AIProvider, ProviderHealthState } from '../types/enums.js';

// Re-export for convenience within ai module consumers
export type { AIProvider, ProviderHealthState };

// ---------------------------------------------------------------------------
// AI Task Types (Spec Section 16.2)
// ---------------------------------------------------------------------------

export type AITaskType =
  | 'RESUME_ANALYSIS'
  | 'RESUME_PARSING'
  | 'ATS_SCREEN'
  | 'ATS_EVALUATION'
  | 'INTERVIEW_QUESTION'
  | 'INTERVIEW_EVALUATION'
  | 'STAGE_FEEDBACK'
  | 'TASK_GENERATION'
  | 'TASK_EVALUATION'
  | 'SCENARIO_GENERATION'
  | 'SCENARIO_EVALUATION'
  | 'FINAL_REVIEW_SUMMARY'
  | 'OFFER_NEGOTIATION';

export const AI_TASK_TYPES: readonly AITaskType[] = [
  'RESUME_ANALYSIS',
  'RESUME_PARSING',
  'ATS_SCREEN',
  'ATS_EVALUATION',
  'INTERVIEW_QUESTION',
  'INTERVIEW_EVALUATION',
  'STAGE_FEEDBACK',
  'TASK_GENERATION',
  'TASK_EVALUATION',
  'SCENARIO_GENERATION',
  'SCENARIO_EVALUATION',
  'FINAL_REVIEW_SUMMARY',
  'OFFER_NEGOTIATION',
] as const;

// ---------------------------------------------------------------------------
// Provider Pool (Decision D11)
// ---------------------------------------------------------------------------

export type AIPool = 'DEMO' | 'PIPELINE';

export const AI_POOLS: readonly AIPool[] = ['DEMO', 'PIPELINE'] as const;

// ---------------------------------------------------------------------------
// Standard Internal AIRequest Contract (Spec Section 16.2)
// Pool is specified via AIGatewayOptions, not embedded in the request.
// ---------------------------------------------------------------------------

export interface AIRequest {
  taskType: AITaskType;
  systemInstruction: string;
  userInput: string;
  context?: Record<string, unknown>;
  /** JSON Schema object for structured output validation */
  outputSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Token Usage Metrics
// ---------------------------------------------------------------------------

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Normalized AIResponse Contract (Spec Section 16.3)
// ---------------------------------------------------------------------------

export interface AIResponse {
  success: boolean;
  provider: AIProvider;
  model: string;
  requestId: string;
  content: string;
  structuredData?: Record<string, unknown>;
  usage: AIUsage;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Normalized AI Error (Spec Section 21.1)
// ---------------------------------------------------------------------------

export type AIErrorCategory =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'AUTH_CONFIG'
  | 'INVALID_REQUEST';

export const AI_ERROR_CATEGORIES: readonly AIErrorCategory[] = [
  'TIMEOUT',
  'RATE_LIMIT',
  'PROVIDER_ERROR',
  'UNAVAILABLE',
  'NETWORK',
  'AUTH_CONFIG',
  'INVALID_REQUEST',
] as const;

/**
 * Categories that trigger retry/fallback per Spec Section 21.1:
 *   Timeouts, HTTP 429 (Rate Limit), HTTP 5xx, network disconnects.
 * Non-retryable (fast-fail): AUTH_CONFIG (401/403), INVALID_REQUEST (400).
 */
const RETRYABLE_CATEGORIES: ReadonlySet<AIErrorCategory> = new Set<AIErrorCategory>([
  'TIMEOUT',
  'RATE_LIMIT',
  'PROVIDER_ERROR',
  'UNAVAILABLE',
  'NETWORK',
]);

/**
 * Normalized AIError — thrown by ProviderAdapters and the AIGateway on failure.
 *
 * `retryable` is derived automatically from `category` per Spec Section 21.1.
 */
export class AIError extends Error {
  public readonly category: AIErrorCategory;
  public readonly retryable: boolean;
  public readonly provider?: AIProvider;

  constructor(message: string, category: AIErrorCategory, provider?: AIProvider) {
    super(message);
    this.name = 'AIError';
    this.category = category;
    this.retryable = RETRYABLE_CATEGORIES.has(category);
    this.provider = provider;
    Error.captureStackTrace(this, this.constructor);
  }

  /** Check whether a given error category is retryable */
  static isRetryable(category: AIErrorCategory): boolean {
    return RETRYABLE_CATEGORIES.has(category);
  }
}

// ---------------------------------------------------------------------------
// Provider Adapter Interface (Spec Sections 17, 18, 19)
// ---------------------------------------------------------------------------

/**
 * Every AI provider (Gemini, OpenAI, Groq) must implement this interface.
 * Business code NEVER calls adapters directly — only via AIGateway.
 */
export interface ProviderAdapter {
  /** The provider this adapter handles */
  readonly name: AIProvider;

  /**
   * Generate an AI response for the given request.
   * @throws AIError on failure with a normalized error category
   */
  generate(request: AIRequest): Promise<AIResponse>;

  /**
   * Perform a lightweight health check on the provider.
   * @returns true if the provider is reachable, false otherwise
   */
  healthCheck(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Gateway Options
// ---------------------------------------------------------------------------

export interface AIGatewayExecuteOptions {
  pool: AIPool;
  timeoutMs?: number;
  requestorReference?: string;
  preferredProvider?: AIProvider;
}

export type AIGatewayOptions = AIGatewayExecuteOptions;

export interface AIGatewaySubmitOptions {
  pool: AIPool;
  requestorReference?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
  preferredProvider?: AIProvider;
}
