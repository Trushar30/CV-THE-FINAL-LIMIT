/**
 * MockAdapter — Test-only ProviderAdapter implementation
 *
 * Supports:
 *   - Configurable successful responses with optional structured data
 *   - Simulating every AIErrorCategory
 *   - Health check simulation
 *   - Call history tracking for test assertions
 */

import { randomUUID } from 'crypto';

import type {
  AIProvider,
  AIRequest,
  AIResponse,
  AIErrorCategory,
  ProviderAdapter,
} from '../types.js';
import { AIError } from '../types.js';

export interface MockAdapterConfig {
  /** Provider identity (default: 'gemini') */
  provider?: AIProvider;
  /** Model name returned in responses (default: 'mock-model') */
  defaultModel?: string;
  /** Simulated latency in ms returned in responses (default: 50) */
  defaultLatencyMs?: number;
  /** Real async delay in ms before resolving generate() (for timeout tests) */
  delayMs?: number;
}

export class MockAdapter implements ProviderAdapter {
  readonly name: AIProvider;
  private readonly defaultModel: string;
  private readonly defaultLatencyMs: number;
  private delayMs?: number;

  // Next-call overrides (consumed on use)
  private nextError?: AIErrorCategory;
  private nextResponse?: Partial<AIResponse>;
  private healthCheckResult = true;

  // Call tracking
  readonly callHistory: AIRequest[] = [];

  constructor(config: MockAdapterConfig = {}) {
    this.name = config.provider ?? 'gemini';
    this.defaultModel = config.defaultModel ?? 'mock-model';
    this.defaultLatencyMs = config.defaultLatencyMs ?? 50;
    this.delayMs = config.delayMs;
  }

  // ---------------------------------------------------------------------------
  // Configuration helpers (fluent API for test setup)
  // ---------------------------------------------------------------------------

  /** Configure async delay for generate() calls */
  setDelay(ms: number): this {
    this.delayMs = ms;
    return this;
  }

  /** Configure the next generate() call to throw an AIError of this category */
  simulateError(category: AIErrorCategory): this {
    this.nextError = category;
    return this;
  }

  /** Alias for simulateError */
  setError(category: AIErrorCategory): this {
    return this.simulateError(category);
  }

  /** Configure the next generate() call to return a custom partial response */
  simulateResponse(partial: Partial<AIResponse>): this {
    this.nextResponse = partial;
    return this;
  }

  /** Configure healthCheck() to return the given value */
  simulateHealthCheck(result: boolean): this {
    this.healthCheckResult = result;
    return this;
  }

  /** Reset all next-call overrides and call history */
  reset(): this {
    this.nextError = undefined;
    this.nextResponse = undefined;
    this.healthCheckResult = true;
    this.callHistory.length = 0;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Call tracking
  // ---------------------------------------------------------------------------

  /** Get all requests that were passed to generate() */
  getCalls(): readonly AIRequest[] {
    return this.callHistory;
  }

  /** Get the number of times generate() was called */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /** Get the most recent request passed to generate() */
  getLastCall(): AIRequest | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  // ---------------------------------------------------------------------------
  // ProviderAdapter implementation
  // ---------------------------------------------------------------------------

  async generate(request: AIRequest): Promise<AIResponse> {
    this.callHistory.push(request);

    // Simulate async delay if configured
    if (this.delayMs && this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // Simulate error if configured
    if (this.nextError) {
      const category = this.nextError;
      this.nextError = undefined;
      throw new AIError(`Mock ${category} error from ${this.name}`, category, this.name);
    }

    // Build default response
    const baseResponse: AIResponse = {
      success: true,
      provider: this.name,
      model: this.defaultModel,
      requestId: randomUUID(),
      content: `Mock response for ${request.taskType}`,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      latencyMs: this.defaultLatencyMs,
    };

    // Merge any custom overrides
    if (this.nextResponse) {
      const overrides = this.nextResponse;
      this.nextResponse = undefined;

      return {
        ...baseResponse,
        ...overrides,
        // Deep-merge usage if partially overridden
        usage: overrides.usage ? { ...baseResponse.usage, ...overrides.usage } : baseResponse.usage,
      };
    }

    return baseResponse;
  }

  async healthCheck(): Promise<boolean> {
    return this.healthCheckResult;
  }
}
