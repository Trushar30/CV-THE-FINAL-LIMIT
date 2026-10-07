/**
 * OpenAIAdapter — ProviderAdapter implementation for OpenAI API
 *
 * Implements:
 *   - ProviderAdapter interface (Spec Section 18, Decision D16)
 *   - Mapping AIRequest to OpenAI Chat Completions payload (POST /v1/chat/completions)
 *   - Bearer authentication via `Authorization: Bearer <key>` header (never logged)
 *   - Structured Outputs via `response_format: { type: "json_schema", json_schema: { strict: true, ... } }`
 *   - Token counting via `usage` (prompt_tokens, completion_tokens, total_tokens)
 *   - Canonical AIError categorization per Spec Section 21.1 / 33 fallback taxonomy
 *   - Configurable timeout via AbortController / AbortSignal
 *   - Dynamic model ID resolution from configuration (never hardcoded)
 */

import { randomUUID } from 'crypto';

import type { AIProvider, AIRequest, AIResponse, AIUsage, ProviderAdapter } from '../types.js';
import { AIError } from '../types.js';

export interface OpenAIAdapterOptions {
  /**
   * Model ID for OpenAI (e.g. 'gpt-4o', 'gpt-4o-mini', or from PlatformConfig).
   * Can be a static string or dynamic accessor function.
   * Never hardcoded.
   */
  modelId: string | (() => string);

  /**
   * API key for OpenAI API.
   * Can be a static string or dynamic accessor function.
   * If omitted, falls back to process.env.OPENAI_API_KEY.
   */
  apiKey?: string | (() => string | undefined);

  /**
   * Request timeout in milliseconds. Default: 15000 ms.
   */
  timeoutMs?: number | (() => number);

  /**
   * Base URL for OpenAI API. Default: 'https://api.openai.com/v1'
   */
  baseUrl?: string;
}

interface OpenAIChoice {
  message?: {
    role?: string;
    content?: string | null;
  };
  finish_reason?: string;
}

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAICompletionResponse {
  id?: string;
  model?: string;
  choices?: OpenAIChoice[];
  usage?: OpenAIUsage;
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly name: AIProvider = 'openai';

  private readonly modelIdAccessor: () => string;
  private readonly apiKeyAccessor: () => string | undefined;
  private readonly timeoutMsAccessor: () => number;
  private readonly baseUrl: string;

  constructor(options: OpenAIAdapterOptions) {
    if (!options.modelId) {
      throw new Error('OpenAIAdapter requires a modelId');
    }

    this.modelIdAccessor =
      typeof options.modelId === 'function' ? options.modelId : () => options.modelId as string;

    const rawApiKey = options.apiKey;
    if (typeof rawApiKey === 'function') {
      this.apiKeyAccessor = rawApiKey;
    } else {
      this.apiKeyAccessor = () => rawApiKey ?? process.env.OPENAI_API_KEY;
    }

    const rawTimeout = options.timeoutMs;
    if (typeof rawTimeout === 'function') {
      this.timeoutMsAccessor = rawTimeout;
    } else {
      this.timeoutMsAccessor = () => (typeof rawTimeout === 'number' ? rawTimeout : 15000);
    }

    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  /**
   * Resolves the configured model ID
   */
  getModelId(): string {
    const model = this.modelIdAccessor();
    if (!model || model.trim().length === 0) {
      throw new AIError('OpenAI model ID is not configured', 'INVALID_REQUEST', 'openai');
    }
    return model.trim();
  }

  /**
   * Resolves the API key securely
   */
  private getApiKey(): string | undefined {
    return this.apiKeyAccessor();
  }

  /**
   * Resolves the configured timeout in ms
   */
  getTimeoutMs(): number {
    return this.timeoutMsAccessor();
  }

  /**
   * Executes an AI completion request via OpenAI Chat Completions API
   */
  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey.trim().length === 0) {
      throw new AIError('OpenAI API key is not configured', 'AUTH_CONFIG', 'openai');
    }

    const modelId = this.getModelId();
    const timeoutMs = this.getTimeoutMs();

    // Construct OpenAI Chat Completions payload
    const payload = this.buildOpenAIPayload(request, modelId);

    const endpoint = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      throw this.normalizeTransportError(err, timeoutMs);
    } finally {
      clearTimeout(timer);
    }

    const latencyMs = Date.now() - startTime;

    // Handle non-2xx HTTP responses
    if (!response.ok) {
      await this.handleHttpError(response);
    }

    // Parse response body
    let data: OpenAICompletionResponse;
    try {
      data = (await response.json()) as OpenAICompletionResponse;
    } catch (err) {
      throw new AIError(
        `Failed to parse OpenAI API JSON response: ${err instanceof Error ? err.message : String(err)}`,
        'PROVIDER_ERROR',
        'openai'
      );
    }

    // Extract text content from primary choice
    const choice = data?.choices?.[0];
    const textContent = choice?.message?.content ?? '';

    // Handle structured JSON output if schema requested
    let structuredData: Record<string, unknown> | undefined;
    if (request.outputSchema) {
      if (!textContent || textContent.trim().length === 0) {
        throw new AIError(
          'OpenAI returned empty content when structured data was expected',
          'INVALID_REQUEST',
          'openai'
        );
      }

      try {
        structuredData = JSON.parse(textContent);
      } catch (err) {
        throw new AIError(
          `Failed to parse OpenAI structured JSON output: ${err instanceof Error ? err.message : String(err)}`,
          'INVALID_REQUEST',
          'openai'
        );
      }
    }

    // Map token usage from usage object
    const usage: AIUsage = {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens:
        data?.usage?.total_tokens ??
        (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0),
    };

    return {
      success: true,
      provider: 'openai',
      model: modelId,
      requestId: data?.id ?? randomUUID(),
      content: textContent,
      structuredData,
      usage,
      latencyMs,
    };
  }

  /**
   * Performs a lightweight health check against the configured model endpoint
   */
  async healthCheck(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    let modelId: string;
    try {
      modelId = this.getModelId();
    } catch {
      return false;
    }

    const timeoutMs = Math.min(this.getTimeoutMs(), 5000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = `${this.baseUrl}/models/${encodeURIComponent(modelId)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Maps AIRequest to OpenAI's Chat Completions body format
   */
  private buildOpenAIPayload(request: AIRequest, modelId: string): Record<string, unknown> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    // 1. System message
    if (request.systemInstruction && request.systemInstruction.trim().length > 0) {
      messages.push({
        role: 'system',
        content: request.systemInstruction,
      });
    }

    // 2. User message (incorporating context if present)
    let promptText = request.userInput;
    if (request.context && Object.keys(request.context).length > 0) {
      promptText = `Context:\n${JSON.stringify(request.context, null, 2)}\n\nUser Input:\n${request.userInput}`;
    }

    messages.push({
      role: 'user',
      content: promptText,
    });

    const payload: Record<string, unknown> = {
      model: modelId,
      messages,
    };

    // 3. Temperature & Token Limits
    if (typeof request.temperature === 'number') {
      payload.temperature = request.temperature;
    }
    if (typeof request.maxTokens === 'number') {
      payload.max_tokens = request.maxTokens;
    }

    // 4. Structured Output Format
    if (request.outputSchema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: request.outputSchema,
        },
      };
    }

    return payload;
  }

  /**
   * Normalizes transport-level errors (timeouts, network drops)
   */
  private normalizeTransportError(err: unknown, timeoutMs: number): AIError {
    if (err instanceof AIError) {
      return err;
    }

    const errorName = (err as { name?: string })?.name;
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Timeout via AbortSignal
    if (errorName === 'AbortError' || errorName === 'TimeoutError') {
      return new AIError(`OpenAI request timed out after ${timeoutMs}ms`, 'TIMEOUT', 'openai');
    }

    // Network / connection drop
    return new AIError(`OpenAI network error: ${errorMessage}`, 'NETWORK', 'openai');
  }

  /**
   * Handles non-2xx HTTP responses from OpenAI API
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let openAiType: string | undefined;
    let openAiCode: string | undefined;

    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
      if (errData?.error?.type) {
        openAiType = errData.error.type;
      }
      if (errData?.error?.code) {
        openAiCode = errData.error.code;
      }
    } catch {
      // Body was not JSON; use default status text
    }

    const status = response.status;

    // Spec Section 21.1 / 33 fallback mapping:
    // 429 -> RATE_LIMIT
    if (
      status === 429 ||
      openAiType === 'rate_limit_error' ||
      openAiCode === 'insufficient_quota'
    ) {
      throw new AIError(`OpenAI rate limit exceeded: ${errorMessage}`, 'RATE_LIMIT', 'openai');
    }

    // 401, 403 -> AUTH_CONFIG (fast-fail, non-retryable)
    if (
      status === 401 ||
      status === 403 ||
      openAiType === 'authentication_error' ||
      openAiType === 'permission_error'
    ) {
      throw new AIError(`OpenAI authentication error: ${errorMessage}`, 'AUTH_CONFIG', 'openai');
    }

    // 400, 404 -> INVALID_REQUEST (fast-fail, non-retryable)
    if (
      status === 400 ||
      status === 404 ||
      openAiType === 'invalid_request_error' ||
      openAiType === 'not_found_error' ||
      openAiCode === 'model_not_found'
    ) {
      throw new AIError(`OpenAI invalid request: ${errorMessage}`, 'INVALID_REQUEST', 'openai');
    }

    // 503 -> UNAVAILABLE (retryable, fallback)
    if (status === 503 || openAiType === 'service_unavailable') {
      throw new AIError(`OpenAI service unavailable: ${errorMessage}`, 'UNAVAILABLE', 'openai');
    }

    // 500, 502, 504 -> PROVIDER_ERROR (retryable, fallback)
    if (status >= 500) {
      throw new AIError(
        `OpenAI server error (${status}): ${errorMessage}`,
        'PROVIDER_ERROR',
        'openai'
      );
    }

    // Catch-all for other 4xx
    throw new AIError(
      `OpenAI request failed (${status}): ${errorMessage}`,
      'INVALID_REQUEST',
      'openai'
    );
  }
}
