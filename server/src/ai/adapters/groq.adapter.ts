/**
 * GroqAdapter — ProviderAdapter implementation for Groq API
 *
 * Implements:
 *   - ProviderAdapter interface (Spec Section 19, Decision D16, ADR-023)
 *   - Mapping AIRequest to Groq Chat Completions payload (POST https://api.groq.com/openai/v1/chat/completions)
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

export interface GroqAdapterOptions {
  /**
   * Model ID for Groq (e.g. 'llama-3.3-70b-versatile', or from PlatformConfig).
   * Can be a static string or dynamic accessor function.
   * Never hardcoded.
   */
  modelId: string | (() => string);

  /**
   * API key for Groq API.
   * Can be a static string or dynamic accessor function.
   * If omitted, falls back to process.env.GROQ_API_KEY.
   */
  apiKey?: string | (() => string | undefined);

  /**
   * Request timeout in milliseconds. Default: 15000 ms.
   */
  timeoutMs?: number | (() => number);

  /**
   * Base URL for Groq API. Default: 'https://api.groq.com/openai/v1'
   */
  baseUrl?: string;
}

interface GroqChoice {
  message?: {
    role?: string;
    content?: string | null;
  };
  finish_reason?: string;
}

interface GroqUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface GroqCompletionResponse {
  id?: string;
  model?: string;
  choices?: GroqChoice[];
  usage?: GroqUsage;
}

export class GroqAdapter implements ProviderAdapter {
  readonly name: AIProvider = 'groq';

  private readonly modelIdAccessor: () => string;
  private readonly apiKeyAccessor: () => string | undefined;
  private readonly timeoutMsAccessor: () => number;
  private readonly baseUrl: string;

  constructor(options: GroqAdapterOptions) {
    if (!options.modelId) {
      throw new Error('GroqAdapter requires a modelId');
    }

    this.modelIdAccessor =
      typeof options.modelId === 'function' ? options.modelId : () => options.modelId as string;

    const rawApiKey = options.apiKey;
    if (typeof rawApiKey === 'function') {
      this.apiKeyAccessor = rawApiKey;
    } else {
      this.apiKeyAccessor = () => rawApiKey ?? process.env.GROQ_API_KEY;
    }

    const rawTimeout = options.timeoutMs;
    if (typeof rawTimeout === 'function') {
      this.timeoutMsAccessor = rawTimeout;
    } else {
      this.timeoutMsAccessor = () => (typeof rawTimeout === 'number' ? rawTimeout : 15000);
    }

    this.baseUrl = (options.baseUrl ?? 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  }

  /**
   * Resolves the configured model ID
   */
  getModelId(): string {
    const model = this.modelIdAccessor();
    if (!model || model.trim().length === 0) {
      throw new AIError('Groq model ID is not configured', 'INVALID_REQUEST', 'groq');
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
   * Executes an AI completion request via Groq Chat Completions API
   */
  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey.trim().length === 0) {
      throw new AIError('Groq API key is not configured', 'AUTH_CONFIG', 'groq');
    }

    const modelId = this.getModelId();
    const timeoutMs = this.getTimeoutMs();

    // Construct Groq Chat Completions payload
    const payload = this.buildGroqPayload(request, modelId);

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
    let data: GroqCompletionResponse;
    try {
      data = (await response.json()) as GroqCompletionResponse;
    } catch (err) {
      throw new AIError(
        `Failed to parse Groq API JSON response: ${err instanceof Error ? err.message : String(err)}`,
        'PROVIDER_ERROR',
        'groq'
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
          'Groq returned empty content when structured data was expected',
          'INVALID_REQUEST',
          'groq'
        );
      }

      try {
        structuredData = JSON.parse(textContent);
      } catch (err) {
        throw new AIError(
          `Failed to parse Groq structured JSON output: ${err instanceof Error ? err.message : String(err)}`,
          'INVALID_REQUEST',
          'groq'
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
      provider: 'groq',
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
   * Maps AIRequest to Groq's Chat Completions body format
   */
  private buildGroqPayload(request: AIRequest, modelId: string): Record<string, unknown> {
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
      return new AIError(`Groq request timed out after ${timeoutMs}ms`, 'TIMEOUT', 'groq');
    }

    // Network / connection drop
    return new AIError(`Groq network error: ${errorMessage}`, 'NETWORK', 'groq');
  }

  /**
   * Handles non-2xx HTTP responses from Groq API
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let groqType: string | undefined;
    let groqCode: string | undefined;

    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
      if (errData?.error?.type) {
        groqType = errData.error.type;
      }
      if (errData?.error?.code) {
        groqCode = errData.error.code;
      }
    } catch {
      // Body was not JSON; use default status text
    }

    const status = response.status;

    // Spec Section 21.1 / 33 fallback mapping:
    // 429 -> RATE_LIMIT
    if (
      status === 429 ||
      groqType === 'rate_limit_exceeded' ||
      groqCode === 'rate_limit_exceeded'
    ) {
      throw new AIError(`Groq rate limit exceeded: ${errorMessage}`, 'RATE_LIMIT', 'groq');
    }

    // 401, 403 -> AUTH_CONFIG (fast-fail, non-retryable)
    if (
      status === 401 ||
      status === 403 ||
      groqType === 'invalid_api_key' ||
      groqType === 'unauthorized'
    ) {
      throw new AIError(`Groq authentication error: ${errorMessage}`, 'AUTH_CONFIG', 'groq');
    }

    // 400, 404 -> INVALID_REQUEST (fast-fail, non-retryable)
    if (
      status === 400 ||
      status === 404 ||
      groqType === 'invalid_request_error' ||
      groqType === 'model_not_found' ||
      groqCode === 'model_not_found'
    ) {
      throw new AIError(`Groq invalid request: ${errorMessage}`, 'INVALID_REQUEST', 'groq');
    }

    // 503 -> UNAVAILABLE (retryable, fallback)
    if (status === 503 || groqType === 'service_unavailable') {
      throw new AIError(`Groq service unavailable: ${errorMessage}`, 'UNAVAILABLE', 'groq');
    }

    // 500, 502, 504 -> PROVIDER_ERROR (retryable, fallback)
    if (status >= 500) {
      throw new AIError(`Groq server error (${status}): ${errorMessage}`, 'PROVIDER_ERROR', 'groq');
    }

    // Catch-all for other 4xx
    throw new AIError(
      `Groq request failed (${status}): ${errorMessage}`,
      'INVALID_REQUEST',
      'groq'
    );
  }
}
