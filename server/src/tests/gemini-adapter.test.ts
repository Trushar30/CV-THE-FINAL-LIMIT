/**
 * GeminiAdapter Unit & Integration Tests (TASK P3.2)
 *
 * Covers:
 *   - HTTP layer mocked with vi.spyOn(globalThis, 'fetch')
 *   - Successful completion and content mapping
 *   - Structured JSON output mapping & validation failure handling
 *   - Token usage calculation from usageMetadata
 *   - Configurable timeout and AbortError -> TIMEOUT category mapping
 *   - Rate limiting (HTTP 429 / RESOURCE_EXHAUSTED) -> RATE_LIMIT category
 *   - Server errors (500, 502, 504 -> PROVIDER_ERROR; 503 -> UNAVAILABLE)
 *   - Authentication failures (401, 403 -> AUTH_CONFIG, non-retryable)
 *   - Client errors (400, 404 -> INVALID_REQUEST, non-retryable)
 *   - Network connection drops -> NETWORK category
 *   - Dynamic model ID and API key configuration
 *   - Health check behavior
 *   - Security: API key in x-goog-api-key header, never in URL query string
 *   - Optional live smoke test (skipped unless GEMINI_API_KEY is defined)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GeminiAdapter, sanitizeSchemaForGemini } from '../ai/adapters/gemini.adapter.js';
import type { AIRequest } from '../ai/types.js';
import { AIError } from '../ai/types.js';

describe('GeminiAdapter', () => {
  const TEST_MODEL = 'gemini-2.5-flash';
  const TEST_API_KEY = 'test-gemini-secret-api-key';

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to build standard test request
  function createTestRequest(overrides: Partial<AIRequest> = {}): AIRequest {
    return {
      taskType: 'TASK_GENERATION',
      systemInstruction: 'You are an elite software architect evaluator.',
      userInput: 'Generate a task for an associate backend engineer.',
      ...overrides,
    };
  }

  // Helper for mock successful Gemini API response
  function createGeminiResponse(
    text: string,
    usage: { prompt?: number; candidates?: number; total?: number } = {}
  ) {
    return {
      candidates: [
        {
          content: {
            parts: [{ text }],
            role: 'model',
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: usage.prompt ?? 45,
        candidatesTokenCount: usage.candidates ?? 120,
        totalTokenCount: usage.total ?? 165,
      },
    };
  }

  // -------------------------------------------------------------------------
  // 1. Instantiation & Dynamic Configuration
  // -------------------------------------------------------------------------
  describe('Configuration & Initialization', () => {
    it('should throw if modelId is missing or empty in constructor', () => {
      expect(() => new GeminiAdapter({ modelId: '' })).toThrow('GeminiAdapter requires a modelId');
    });

    it('should support static modelId and apiKey', () => {
      const adapter = new GeminiAdapter({
        modelId: 'gemini-1.5-pro',
        apiKey: 'my-key',
      });
      expect(adapter.name).toBe('gemini');
      expect(adapter.getModelId()).toBe('gemini-1.5-pro');
      expect(adapter.getTimeoutMs()).toBe(15000);
    });

    it('should support dynamic modelId function accessor', () => {
      let currentModel = 'gemini-2.5-flash';
      const adapter = new GeminiAdapter({
        modelId: () => currentModel,
        apiKey: 'my-key',
      });

      expect(adapter.getModelId()).toBe('gemini-2.5-flash');
      currentModel = 'gemini-1.5-flash-updated';
      expect(adapter.getModelId()).toBe('gemini-1.5-flash-updated');
    });

    it('should support dynamic timeout accessor with default fallback', () => {
      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
        timeoutMs: 8000,
      });
      expect(adapter.getTimeoutMs()).toBe(8000);
    });

    it('should throw AIError AUTH_CONFIG if apiKey is not provided anywhere', async () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        const adapter = new GeminiAdapter({
          modelId: TEST_MODEL,
          apiKey: undefined,
        });

        await expect(adapter.generate(createTestRequest())).rejects.toThrow(AIError);

        try {
          await adapter.generate(createTestRequest());
        } catch (err) {
          const aiError = err as AIError;
          expect(aiError.category).toBe('AUTH_CONFIG');
          expect(aiError.retryable).toBe(false);
          expect(aiError.provider).toBe('gemini');
          expect(aiError.message).toContain('API key is not configured');
        }
      } finally {
        if (originalEnv) process.env.GEMINI_API_KEY = originalEnv;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful Generation & Payload Mapping
  // -------------------------------------------------------------------------
  describe('Successful Request & Response Mapping', () => {
    it('should map AIRequest to Gemini request format and return AIResponse', async () => {
      const mockBody = createGeminiResponse('Task description generated successfully.');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const request = createTestRequest({
        temperature: 0.7,
        maxTokens: 1024,
      });

      const response = await adapter.generate(request);

      // Verify AIResponse contract
      expect(response.success).toBe(true);
      expect(response.provider).toBe('gemini');
      expect(response.model).toBe(TEST_MODEL);
      expect(response.content).toBe('Task description generated successfully.');
      expect(response.structuredData).toBeUndefined();
      expect(response.requestId).toBeDefined();
      expect(typeof response.latencyMs).toBe('number');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify token usage
      expect(response.usage).toEqual({
        inputTokens: 45,
        outputTokens: 120,
        totalTokens: 165,
      });

      // Verify HTTP call details
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];

      // Endpoint URL check
      expect(calledUrl).toBe(
        `https://generativelanguage.googleapis.com/v1beta/models/${TEST_MODEL}:generateContent`
      );
      // Key must NOT be in URL query
      expect(calledUrl).not.toContain(TEST_API_KEY);

      // Header auth check
      const headers = calledInit.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe(TEST_API_KEY);
      expect(headers['Content-Type']).toBe('application/json');

      // Body payload check
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.system_instruction).toEqual({
        parts: [{ text: 'You are an elite software architect evaluator.' }],
      });
      expect(sentPayload.contents).toEqual([
        {
          role: 'user',
          parts: [{ text: 'Generate a task for an associate backend engineer.' }],
        },
      ]);
      expect(sentPayload.generationConfig).toEqual({
        temperature: 0.7,
        maxOutputTokens: 1024,
      });
    });

    it('should correctly serialize context when present in AIRequest', async () => {
      const mockBody = createGeminiResponse('Evaluated successfully.');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const request = createTestRequest({
        context: { candidateLevel: 'L4', domain: 'CLOUD_ENGINEERING' },
        userInput: 'Evaluate candidate response.',
      });

      await adapter.generate(request);

      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      const userText = sentPayload.contents[0].parts[0].text;

      expect(userText).toContain('Context:');
      expect(userText).toContain('"candidateLevel": "L4"');
      expect(userText).toContain('User Input:\nEvaluate candidate response.');
    });

    it('should omit system_instruction if empty in request', async () => {
      const mockBody = createGeminiResponse('No system prompt.');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      await adapter.generate(createTestRequest({ systemInstruction: '' }));

      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.system_instruction).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Structured Output & Schema Support
  // -------------------------------------------------------------------------
  describe('Structured JSON Output', () => {
    const taskSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        difficulty: { type: 'string' },
        maxExp: { type: 'number' },
      },
      required: ['title', 'difficulty', 'maxExp'],
    };

    it('should send responseMimeType and responseSchema and parse structuredData', async () => {
      const structuredResult = {
        title: 'Build Distributed Lock',
        difficulty: 'HARD',
        maxExp: 100,
      };

      const mockBody = createGeminiResponse(JSON.stringify(structuredResult));
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest({ outputSchema: taskSchema }));

      expect(response.success).toBe(true);
      expect(response.structuredData).toEqual(structuredResult);
      expect(response.content).toBe(JSON.stringify(structuredResult));

      // Verify generationConfig sent to Gemini
      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.generationConfig.responseMimeType).toBe('application/json');
      expect(sentPayload.generationConfig.responseSchema).toEqual(taskSchema);
    });

    it('should throw AIError INVALID_REQUEST if Gemini output cannot be parsed as JSON', async () => {
      const mockBody = createGeminiResponse('Not a valid JSON string');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      await expect(
        adapter.generate(createTestRequest({ outputSchema: taskSchema }))
      ).rejects.toThrow(AIError);

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      try {
        await adapter.generate(createTestRequest({ outputSchema: taskSchema }));
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.retryable).toBe(false);
        expect(aiError.provider).toBe('gemini');
        expect(aiError.message).toContain('Failed to parse Gemini structured JSON output');
      }
    });

    it('should throw AIError INVALID_REQUEST if Gemini returns empty text when schema requested', async () => {
      const mockBody = createGeminiResponse('');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest({ outputSchema: taskSchema }));
        expect.fail('Expected AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.message).toContain('empty content');
      }
    });

    it('should strip additionalProperties and unsupported numeric bounds when sending responseSchema', async () => {
      const openAiStyleSchema = {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 100 },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'tags'],
        additionalProperties: false,
      };

      const mockBody = createGeminiResponse(JSON.stringify({ score: 95, tags: ['ts'] }));
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      await adapter.generate(createTestRequest({ outputSchema: openAiStyleSchema }));

      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      const schemaSent = sentPayload.generationConfig.responseSchema;

      expect(schemaSent.additionalProperties).toBeUndefined();
      expect(schemaSent.properties.score.minimum).toBeUndefined();
      expect(schemaSent.properties.score.maximum).toBeUndefined();
      expect(schemaSent.properties.score.type).toBe('number');
      expect(schemaSent.required).toEqual(['score', 'tags']);
    });

    it('sanitizeSchemaForGemini should cleanly strip all disallowed properties recursively', () => {
      const complexSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              value: { type: 'string', minLength: 1, maxLength: 50 },
            },
            additionalProperties: false,
          },
          items: {
            type: 'array',
            items: { type: 'number', minimum: 10 },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      };

      const result = sanitizeSchemaForGemini(complexSchema) as Record<string, unknown>;
      expect(result.$schema).toBeUndefined();
      expect(result.additionalProperties).toBeUndefined();
      const nested = (result.properties as Record<string, unknown>).nested as Record<string, unknown>;
      expect(nested.additionalProperties).toBeUndefined();
      const nestedValue = (nested.properties as Record<string, unknown>).value as Record<string, unknown>;
      expect(nestedValue.minLength).toBeUndefined();
      expect(nestedValue.maxLength).toBeUndefined();
      expect(nestedValue.type).toBe('string');
      const items = (result.properties as Record<string, unknown>).items as Record<string, unknown>;
      expect(items.minItems).toBeUndefined();
      expect(items.uniqueItems).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Token Counting & Usage Metadata
  // -------------------------------------------------------------------------
  describe('Token Counting', () => {
    it('should map usageMetadata prompt, candidates, and total tokens', async () => {
      const mockBody = createGeminiResponse('Output', {
        prompt: 150,
        candidates: 75,
        total: 225,
      });

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest());
      expect(response.usage).toEqual({
        inputTokens: 150,
        outputTokens: 75,
        totalTokens: 225,
      });
    });

    it('should compute totalTokens if totalTokenCount is missing from usageMetadata', async () => {
      const mockBody = {
        candidates: [{ content: { parts: [{ text: 'Done' }] } }],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 30,
        },
      };

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest());
      expect(response.usage).toEqual({
        inputTokens: 50,
        outputTokens: 30,
        totalTokens: 80,
      });
    });

    it('should default token counts to 0 if usageMetadata is completely absent', async () => {
      const mockBody = {
        candidates: [{ content: { parts: [{ text: 'Done' }] } }],
      };

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest());
      expect(response.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Error Normalization & Fallback Taxonomy (Spec Section 21.1 / 33)
  // -------------------------------------------------------------------------
  describe('Error Mapping & Fallback Taxonomy', () => {
    // 5.1 Timeout
    it('should map AbortError to TIMEOUT category (retryable: true)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
        timeoutMs: 5000,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected timeout AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError).toBeInstanceOf(AIError);
        expect(aiError.category).toBe('TIMEOUT');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('gemini');
        expect(aiError.message).toContain('timed out after 5000ms');
      }
    });

    // 5.2 Rate Limit (429 / RESOURCE_EXHAUSTED)
    it('should map HTTP 429 to RATE_LIMIT category (retryable: true)', async () => {
      const errorBody = {
        error: {
          code: 429,
          message: 'Resource has been exhausted (quota exceeded).',
          status: 'RESOURCE_EXHAUSTED',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 429 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('RATE_LIMIT');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('gemini');
        expect(aiError.message).toContain('Resource has been exhausted');
      }
    });

    // 5.3 Server Errors (500, 502, 504 -> PROVIDER_ERROR; 503 -> UNAVAILABLE)
    it('should map HTTP 500 to PROVIDER_ERROR category (retryable: true)', async () => {
      const errorBody = {
        error: {
          code: 500,
          message: 'An internal error has occurred.',
          status: 'INTERNAL',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 500 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('PROVIDER_ERROR');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('gemini');
        expect(aiError.message).toContain('An internal error has occurred');
      }
    });

    it('should map HTTP 503 to UNAVAILABLE category (retryable: true)', async () => {
      const errorBody = {
        error: {
          code: 503,
          message: 'The service is currently unavailable.',
          status: 'UNAVAILABLE',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 503,
          statusText: 'Service Unavailable',
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 503 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('UNAVAILABLE');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('gemini');
      }
    });

    // 5.4 Authentication & Credential Errors (401, 403 -> AUTH_CONFIG, non-retryable)
    it('should map HTTP 401 to AUTH_CONFIG category (retryable: false)', async () => {
      const errorBody = {
        error: {
          code: 401,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'UNAUTHENTICATED',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 401 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('AUTH_CONFIG');
        expect(aiError.retryable).toBe(false);
        expect(aiError.provider).toBe('gemini');
        expect(aiError.message).toContain('API key not valid');
      }
    });

    it('should map HTTP 403 to AUTH_CONFIG category (retryable: false)', async () => {
      const errorBody = {
        error: {
          code: 403,
          message: "Method doesn't allow unregistered callers.",
          status: 'PERMISSION_DENIED',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 403,
          statusText: 'Forbidden',
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 403 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('AUTH_CONFIG');
        expect(aiError.retryable).toBe(false);
      }
    });

    // 5.5 Client / Bad Request Errors (400, 404 -> INVALID_REQUEST, non-retryable)
    it('should map HTTP 400 to INVALID_REQUEST category (retryable: false)', async () => {
      const errorBody = {
        error: {
          code: 400,
          message: 'Invalid JSON payload received.',
          status: 'INVALID_ARGUMENT',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 400,
          statusText: 'Bad Request',
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 400 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.retryable).toBe(false);
        expect(aiError.provider).toBe('gemini');
      }
    });

    // 5.6 Network Disconnection
    it('should map network transport failures to NETWORK category (retryable: true)', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected NETWORK AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('NETWORK');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('gemini');
        expect(aiError.message).toContain('fetch failed');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Health Check
  // -------------------------------------------------------------------------
  describe('healthCheck()', () => {
    it('should return true when model endpoint responds with 200 OK', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: `models/${TEST_MODEL}` }), {
          status: 200,
        })
      );

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(
        `https://generativelanguage.googleapis.com/v1beta/models/${TEST_MODEL}`
      );
      expect(calledInit.method).toBe('GET');
      const headers = calledInit.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe(TEST_API_KEY);
    });

    it('should return false when model endpoint responds with error', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false when network throws during healthCheck', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Connection reset'));

      const adapter = new GeminiAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false immediately without network call if apiKey is missing', async () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        const adapter = new GeminiAdapter({
          modelId: TEST_MODEL,
          apiKey: undefined,
        });

        const healthy = await adapter.healthCheck();
        expect(healthy).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        if (originalEnv) process.env.GEMINI_API_KEY = originalEnv;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. Optional Live Smoke Test
  // -------------------------------------------------------------------------
  describe('Live Gemini API Smoke Test', () => {
    const liveApiKey = process.env.GEMINI_API_KEY;
    const isLiveKeyAvailable = Boolean(liveApiKey && liveApiKey.trim().length > 0);

    it.skipIf(!isLiveKeyAvailable)(
      'should successfully execute live generateContent call against Gemini API',
      async () => {
        // Unmock fetch for live call
        fetchSpy.mockRestore();

        const liveAdapter = new GeminiAdapter({
          modelId: 'gemini-2.5-flash',
          apiKey: liveApiKey,
          timeoutMs: 15000,
        });

        const request: AIRequest = {
          taskType: 'TASK_GENERATION',
          systemInstruction: 'You are a test evaluator.',
          userInput: 'Output the single word: HELLO',
          maxTokens: 10,
        };

        const response = await liveAdapter.generate(request);
        expect(response.success).toBe(true);
        expect(response.provider).toBe('gemini');
        expect(response.content.length).toBeGreaterThan(0);
        expect(response.usage.totalTokens).toBeGreaterThan(0);
      },
      20000
    );
  });
});
