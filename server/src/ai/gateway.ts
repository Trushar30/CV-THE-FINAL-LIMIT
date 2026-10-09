/**
 * AIGateway — the single authoritative entry point for all AI operations.
 *
 * Spec Section 16:  All AI interactions flow through AIGateway → ProviderRouter → Adapter.
 * Spec Section 16.4: AI boundary rules (AI recommends, backend decides).
 * Spec Section 21:  AI Queue, retry rules, fallback, and health tracking.
 * Decision D11:     Pool isolation (DEMO vs PIPELINE).
 *
 * Business services must ONLY import AIGateway. Never call adapters directly.
 */

import { randomUUID } from 'crypto';

import type { AIRequest, AIResponse, AIGatewayOptions, AIGatewaySubmitOptions } from './types.js';
import { AIError } from './types.js';
import type { ProviderRouter } from './provider-router.js';
import { HealthTracker } from './health-tracker.js';
import { AIJobModel } from '../models/AIJob.js';

// ---------------------------------------------------------------------------
// Lightweight JSON Schema Validator
// ---------------------------------------------------------------------------

/**
 * Validate `data` against a JSON-Schema-like descriptor.
 *
 * Supported keywords: type (string | number | integer | boolean | object | array),
 * required, properties (recursive), items (for arrays).
 *
 * Returns an array of human-readable error strings (empty = valid).
 */
export function validateAgainstSchema(
  data: unknown,
  schema: Record<string, unknown>,
  path = ''
): string[] {
  const errors: string[] = [];
  const prefix = path ? `${path}: ` : '';

  // --- type check ---
  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type)
      ? (schema.type as string[])
      : [schema.type as string];
    const actual = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;

    const matches = expectedTypes.some((expected) => {
      if (expected === 'integer') {
        return typeof data === 'number' && Number.isInteger(data);
      }
      if (expected === 'object') {
        return typeof data === 'object' && data !== null && !Array.isArray(data);
      }
      return actual === expected;
    });

    if (!matches) {
      errors.push(`${prefix}Expected ${expectedTypes.join(' or ')}, got ${actual}`);
      return errors;
    }
  }

  // --- required ---
  if (
    schema.required &&
    Array.isArray(schema.required) &&
    typeof data === 'object' &&
    data !== null
  ) {
    const obj = data as Record<string, unknown>;
    for (const key of schema.required as string[]) {
      if (!(key in obj)) {
        errors.push(`${prefix}Missing required property '${key}'`);
      }
    }
  }

  // --- properties (recursive) ---
  if (
    schema.properties &&
    typeof schema.properties === 'object' &&
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data)
  ) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const obj = data as Record<string, unknown>;
    for (const [key, propSchema] of Object.entries(props)) {
      if (key in obj) {
        const childPath = path ? `${path}.${key}` : key;
        errors.push(...validateAgainstSchema(obj[key], propSchema, childPath));
      }
    }
  }

  // --- items (array element validation) ---
  if (schema.items && Array.isArray(data)) {
    const itemSchema = schema.items as Record<string, unknown>;
    for (let i = 0; i < data.length; i++) {
      const childPath = path ? `${path}[${i}]` : `[${i}]`;
      errors.push(...validateAgainstSchema(data[i], itemSchema, childPath));
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// AIGateway
// ---------------------------------------------------------------------------

export class AIGateway {
  private readonly healthTracker: HealthTracker;

  constructor(
    private readonly router: ProviderRouter,
    healthTracker?: HealthTracker
  ) {
    this.healthTracker = healthTracker ?? new HealthTracker(router);
  }

  /** Access underlying health tracker */
  getHealthTracker(): HealthTracker {
    return this.healthTracker;
  }

  /** Access underlying provider router */
  getRouter(): ProviderRouter {
    return this.router;
  }

  /**
   * Submit an asynchronous AI request to the MongoDB-backed queue.
   * If an idempotencyKey is provided and a job already exists, returns the existing jobId.
   *
   * @returns The unique jobId string
   */
  async submit(request: AIRequest, options: AIGatewaySubmitOptions): Promise<string> {
    const { pool, requestorReference, idempotencyKey, maxAttempts } = options;

    if (idempotencyKey) {
      const existing = await AIJobModel.findOne({ idempotencyKey });
      if (existing) {
        return existing._id.toString();
      }
    }

    try {
      const job = await AIJobModel.create({
        taskType: request.taskType,
        pool,
        preferredProvider: options.preferredProvider ?? null,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: maxAttempts ?? 3,
        attemptsPerProvider: new Map<string, number>(),
        currentProvider: null,
        payload: request,
        result: null,
        error: null,
        requestorReference: requestorReference ?? null,
        idempotencyKey: idempotencyKey ?? null,
      });

      return job._id.toString();
    } catch (err: unknown) {
      // Handle potential race condition on duplicate key index
      if (
        idempotencyKey &&
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        const existing = await AIJobModel.findOne({ idempotencyKey });
        if (existing) {
          return existing._id.toString();
        }
      }
      throw err;
    }
  }

  /**
   * Execute a synchronous AI request through the provider pipeline.
   *
   * 1. Selects the highest-priority non-DISABLED provider for the requested pool.
   * 2. Enforces bounded timeout (if timeoutMs specified).
   * 3. Calls the provider adapter's `generate()` method.
   * 4. Validates structured output against `request.outputSchema` if provided.
   * 5. Logs request, response, and provider health metrics.
   * 6. Returns a normalized AIResponse with gateway-generated requestId and latency.
   *
   * @throws AIError — UNAVAILABLE if no providers, TIMEOUT on timeout, or normalized adapter errors
   */
  async execute(request: AIRequest, options: AIGatewayOptions): Promise<AIResponse> {
    const { pool, timeoutMs, preferredProvider } = options;

    // 1. Select provider
    const entry = this.router.selectProvider(pool, preferredProvider);
    if (!entry) {
      throw new AIError(`No available providers in pool '${pool}'`, 'UNAVAILABLE');
    }

    const requestId = randomUUID();
    const startTime = Date.now();

    // Log request in aiRequests (non-blocking)
    const promptPreview = `${request.systemInstruction ? `[SYSTEM: ${request.systemInstruction}] ` : ''}${request.userInput}`;
    const logRequestIdPromise = this.healthTracker.logRequest({
      taskType: request.taskType,
      pool,
      providerCode: entry.provider,
      modelId: 'dynamic',
      promptSummary: promptPreview,
    });

    // 2. Call adapter with optional gateway-level timeout
    let response: AIResponse;
    let timerHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const adapterPromise = entry.adapter.generate(request);

      if (timeoutMs && timeoutMs > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerHandle = setTimeout(() => {
            reject(
              new AIError(
                `Gateway execution timed out after ${timeoutMs}ms`,
                'TIMEOUT',
                entry.provider
              )
            );
          }, timeoutMs);
        });

        response = await Promise.race([adapterPromise, timeoutPromise]);
      } else {
        response = await adapterPromise;
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      let aiError: AIError;

      if (err instanceof AIError) {
        aiError = err;
      } else {
        aiError = new AIError(
          `Unexpected error from provider '${entry.provider}': ${err instanceof Error ? err.message : String(err)}`,
          'PROVIDER_ERROR',
          entry.provider
        );
      }

      // Record failure and response log
      const logRequestId = await logRequestIdPromise;
      await this.healthTracker.recordFailure(
        pool,
        entry.provider,
        aiError.category,
        aiError.message
      );
      await this.healthTracker.logResponse({
        requestId: logRequestId,
        providerCode: entry.provider,
        latencyMs,
        success: false,
        errorCode: aiError.category,
      });

      throw aiError;
    } finally {
      if (timerHandle) {
        clearTimeout(timerHandle);
      }
    }

    const latencyMs = Date.now() - startTime;

    // 3. Validate structured output
    if (request.outputSchema) {
      if (!response.structuredData) {
        const schemaErr = new AIError(
          `Output schema specified but provider '${entry.provider}' returned no structured data`,
          'PROVIDER_ERROR',
          entry.provider
        );
        const logRequestId = await logRequestIdPromise;
        await this.healthTracker.recordFailure(
          pool,
          entry.provider,
          schemaErr.category,
          schemaErr.message
        );
        await this.healthTracker.logResponse({
          requestId: logRequestId,
          providerCode: entry.provider,
          latencyMs,
          success: false,
          errorCode: schemaErr.category,
        });
        throw schemaErr;
      }

      const validationErrors = validateAgainstSchema(response.structuredData, request.outputSchema);
      if (validationErrors.length > 0) {
        const valErr = new AIError(
          `Structured output validation failed: ${validationErrors.join('; ')}`,
          'PROVIDER_ERROR',
          entry.provider
        );
        const logRequestId = await logRequestIdPromise;
        await this.healthTracker.recordFailure(
          pool,
          entry.provider,
          valErr.category,
          valErr.message
        );
        await this.healthTracker.logResponse({
          requestId: logRequestId,
          providerCode: entry.provider,
          latencyMs,
          success: false,
          errorCode: valErr.category,
        });
        throw valErr;
      }
    }

    // 4. Record success and log response
    const logRequestId = await logRequestIdPromise;
    await this.healthTracker.recordSuccess(pool, entry.provider, latencyMs);
    await this.healthTracker.logResponse({
      requestId: logRequestId,
      providerCode: entry.provider,
      latencyMs,
      usage: response.usage,
      success: true,
    });

    // 5. Return normalized response
    return {
      success: true,
      provider: entry.provider,
      model: response.model,
      requestId,
      content: response.content,
      structuredData: response.structuredData,
      usage: response.usage,
      latencyMs,
    };
  }
}
