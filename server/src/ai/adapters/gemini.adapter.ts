/**
 * GeminiAdapter — ProviderAdapter implementation for Google Gemini API
 *
 * Implements:
 *   - ProviderAdapter interface (Spec Section 17, Decision D16)
 *   - Mapping AIRequest to Gemini v1beta generateContent payload
 *   - Header-based authentication via `x-goog-api-key` (never logged, never in query params)
 *   - Structured output support via `generationConfig.responseSchema` & `responseMimeType`
 *   - Token counting via `usageMetadata` (promptTokenCount, candidatesTokenCount, totalTokenCount)
 *   - Canonical AIError categorization per Spec Section 21.1 / 33 fallback taxonomy
 *   - Configurable timeout via AbortSignal / AbortController
 *   - Dynamic model ID resolution from configuration (never hardcoded)
 */

import { randomUUID } from 'crypto';

import type { AIProvider, AIRequest, AIResponse, AIUsage, ProviderAdapter } from '../types.js';
import { AIError } from '../types.js';

export interface GeminiAdapterOptions {
  /**
   * Model ID for Gemini (e.g. 'gemini-2.5-flash', 'gemini-1.5-flash').
   * Can be a static string or a dynamic accessor function (e.g. reading from PlatformConfig).
   * Never hardcoded.
   */
  modelId: string | (() => string);

  /**
   * API key for Google Generative Language API.
   * Can be a static string or dynamic accessor function.
   * If omitted, falls back to process.env.GEMINI_API_KEY.
   */
  apiKey?: string | (() => string | undefined);

  /**
   * Request timeout in milliseconds. Default: 15000 ms.
   */
  timeoutMs?: number | (() => number);

  /**
   * Base URL for Gemini REST API. Default: 'https://generativelanguage.googleapis.com/v1beta'
   */
  baseUrl?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
    role?: string;
  };
  finishReason?: string;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiResponsePayload {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
}

export class GeminiAdapter implements ProviderAdapter {
  readonly name: AIProvider = 'gemini';

  private readonly modelIdAccessor: () => string;
  private readonly apiKeyAccessor: () => string | undefined;
  private readonly timeoutMsAccessor: () => number;
  private readonly baseUrl: string;

  constructor(options: GeminiAdapterOptions) {
    if (!options.modelId) {
      throw new Error('GeminiAdapter requires a modelId');
    }

    this.modelIdAccessor =
      typeof options.modelId === 'function' ? options.modelId : () => options.modelId as string;

    const rawApiKey = options.apiKey;
    if (typeof rawApiKey === 'function') {
      this.apiKeyAccessor = rawApiKey;
    } else {
      this.apiKeyAccessor = () => rawApiKey ?? process.env.GEMINI_API_KEY;
    }

    const rawTimeout = options.timeoutMs;
    if (typeof rawTimeout === 'function') {
      this.timeoutMsAccessor = rawTimeout;
    } else {
      this.timeoutMsAccessor = () => (typeof rawTimeout === 'number' ? rawTimeout : 15000);
    }

    this.baseUrl = (options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/+$/,
      ''
    );
  }

  /**
   * Resolves the configured model ID
   */
  getModelId(): string {
    const model = this.modelIdAccessor();
    if (!model || model.trim().length === 0) {
      throw new AIError('Gemini model ID is not configured', 'INVALID_REQUEST', 'gemini');
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
   * Executes an AI completion request via Gemini REST API
   */
  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey.trim().length === 0) {
      throw new AIError('Gemini API key is not configured', 'AUTH_CONFIG', 'gemini');
    }

    const modelId = this.getModelId();
    const timeoutMs = this.getTimeoutMs();

    // Construct Gemini REST payload
    const payload = this.buildGeminiPayload(request);

    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
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
    let data: GeminiResponsePayload;
    try {
      data = (await response.json()) as GeminiResponsePayload;
    } catch (err) {
      throw new AIError(
        `Failed to parse Gemini API JSON response: ${err instanceof Error ? err.message : String(err)}`,
        'PROVIDER_ERROR',
        'gemini'
      );
    }

    // Extract text content from candidate
    const candidate = data?.candidates?.[0];
    const textContent = candidate?.content?.parts?.[0]?.text ?? '';

    // Handle structured JSON output if schema requested
    let structuredData: Record<string, unknown> | undefined;
    if (request.outputSchema) {
      if (!textContent || textContent.trim().length === 0) {
        throw new AIError(
          'Gemini returned empty content when structured data was expected',
          'INVALID_REQUEST',
          'gemini'
        );
      }

      try {
        structuredData = JSON.parse(textContent);
      } catch (err) {
        throw new AIError(
          `Failed to parse Gemini structured JSON output: ${err instanceof Error ? err.message : String(err)}`,
          'INVALID_REQUEST',
          'gemini'
        );
      }
    }

    // Map token usage from usageMetadata
    const usage: AIUsage = {
      inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens:
        data?.usageMetadata?.totalTokenCount ??
        (data?.usageMetadata?.promptTokenCount ?? 0) +
          (data?.usageMetadata?.candidatesTokenCount ?? 0),
    };

    return {
      success: true,
      provider: 'gemini',
      model: modelId,
      requestId: randomUUID(),
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
          'x-goog-api-key': apiKey,
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
   * Maps AIRequest to Gemini's REST body format
   */
  private buildGeminiPayload(request: AIRequest): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    // 1. System instruction
    if (request.systemInstruction && request.systemInstruction.trim().length > 0) {
      payload.system_instruction = {
        parts: [{ text: request.systemInstruction }],
      };
    }

    // 2. User content (including context if provided)
    let promptText = request.userInput;
    if (request.context && Object.keys(request.context).length > 0) {
      promptText = `Context:\n${JSON.stringify(request.context, null, 2)}\n\nUser Input:\n${request.userInput}`;
    }

    payload.contents = [
      {
        role: 'user',
        parts: [{ text: promptText }],
      },
    ];

    // 3. Generation configuration
    const generationConfig: Record<string, unknown> = {};
    if (typeof request.temperature === 'number') {
      generationConfig.temperature = request.temperature;
    }
    if (typeof request.maxTokens === 'number') {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    // Structured output schema
    if (request.outputSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = request.outputSchema;
    }

    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
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
      return new AIError(`Gemini request timed out after ${timeoutMs}ms`, 'TIMEOUT', 'gemini');
    }

    // Network / connection drop
    return new AIError(`Gemini network error: ${errorMessage}`, 'NETWORK', 'gemini');
  }

  /**
   * Handles non-2xx HTTP responses from Gemini API
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let geminiStatus: string | undefined;

    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
      if (errData?.error?.status) {
        geminiStatus = errData.error.status;
      }
    } catch {
      // Body was not JSON; use default status text
    }

    const status = response.status;

    // Spec Section 21.1 / 33 fallback mapping:
    // 429 -> RATE_LIMIT
    if (status === 429 || geminiStatus === 'RESOURCE_EXHAUSTED') {
      throw new AIError(`Gemini rate limit exceeded: ${errorMessage}`, 'RATE_LIMIT', 'gemini');
    }

    // 401, 403 -> AUTH_CONFIG (fast-fail, non-retryable)
    if (
      status === 401 ||
      status === 403 ||
      geminiStatus === 'UNAUTHENTICATED' ||
      geminiStatus === 'PERMISSION_DENIED'
    ) {
      throw new AIError(`Gemini authentication error: ${errorMessage}`, 'AUTH_CONFIG', 'gemini');
    }

    // 400, 404 -> INVALID_REQUEST (fast-fail, non-retryable)
    if (
      status === 400 ||
      status === 404 ||
      geminiStatus === 'INVALID_ARGUMENT' ||
      geminiStatus === 'NOT_FOUND'
    ) {
      throw new AIError(`Gemini invalid request: ${errorMessage}`, 'INVALID_REQUEST', 'gemini');
    }

    // 503 -> UNAVAILABLE (retryable, fallback)
    if (status === 503 || geminiStatus === 'UNAVAILABLE') {
      throw new AIError(`Gemini service unavailable: ${errorMessage}`, 'UNAVAILABLE', 'gemini');
    }

    // 500, 502, 504 -> PROVIDER_ERROR (retryable, fallback)
    if (status >= 500) {
      throw new AIError(
        `Gemini server error (${status}): ${errorMessage}`,
        'PROVIDER_ERROR',
        'gemini'
      );
    }

    // Catch-all for other 4xx
    throw new AIError(
      `Gemini request failed (${status}): ${errorMessage}`,
      'INVALID_REQUEST',
      'gemini'
    );
  }
}
