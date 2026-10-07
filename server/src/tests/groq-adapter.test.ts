/**
 * GroqAdapter Unit & Integration Tests (TASK P3.4)
 *
 * Covers:
 *   - HTTP layer mocked with vi.spyOn(globalThis, 'fetch')
 *   - Successful Chat Completion generation and content mapping
 *   - Structured JSON output mapping with json_schema response_format
 *   - Structured output validation & parse error handling
 *   - Token usage calculation from usage object (prompt_tokens, completion_tokens, total_tokens)
 *   - Configurable timeout and AbortError -> TIMEOUT category mapping
 *   - Rate limiting (HTTP 429 / rate_limit_exceeded) -> RATE_LIMIT
 *   - Server errors (500, 502, 504 -> PROVIDER_ERROR; 503 -> UNAVAILABLE)
 *   - Authentication failures (401, 403 -> AUTH_CONFIG, non-retryable)
 *   - Client errors (400, 404 -> INVALID_REQUEST, non-retryable)
 *   - Network connection drops -> NETWORK category
 *   - Dynamic model ID and API key configuration
 *   - Health check against GET https://api.groq.com/openai/v1/models/{model}
 *   - Security: API key in Authorization: Bearer header, never in query string
 *   - Optional live smoke test (skipped unless GROQ_API_KEY is defined)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GroqAdapter } from '../ai/adapters/groq.adapter.js';
import type { AIRequest } from '../ai/types.js';
import { AIError } from '../ai/types.js';

describe('GroqAdapter', () => {
  const TEST_MODEL = 'llama-3.3-70b-versatile';
  const TEST_API_KEY = 'gsk_test_groq_secret_api_key_12345';

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
      systemInstruction: 'You are an elite code evaluation engine.',
      userInput: 'Generate a scenario task for a principal AI engineer.',
      ...overrides,
    };
  }

  // Helper for mock successful Groq Chat Completion response
  function createGroqResponse(
    content: string,
    usage: { prompt?: number; completion?: number; total?: number } = {}
  ) {
    return {
      id: 'chatcmpl-groq-test-12345',
      object: 'chat.completion',
      created: 1720000000,
      model: TEST_MODEL,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: usage.prompt ?? 40,
        completion_tokens: usage.completion ?? 95,
        total_tokens: usage.total ?? 135,
      },
    };
  }

  // -------------------------------------------------------------------------
  // 1. Instantiation & Dynamic Configuration
  // -------------------------------------------------------------------------
  describe('Configuration & Initialization', () => {
    it('should throw if modelId is missing or empty in constructor', () => {
      expect(() => new GroqAdapter({ modelId: '' })).toThrow('GroqAdapter requires a modelId');
    });

    it('should support static modelId and apiKey', () => {
      const adapter = new GroqAdapter({
        modelId: 'llama-3.3-70b-versatile',
        apiKey: 'gsk_test',
      });
      expect(adapter.name).toBe('groq');
      expect(adapter.getModelId()).toBe('llama-3.3-70b-versatile');
      expect(adapter.getTimeoutMs()).toBe(15000);
    });

    it('should support dynamic modelId function accessor', () => {
      let currentModel = 'llama-3.3-70b-versatile';
      const adapter = new GroqAdapter({
        modelId: () => currentModel,
        apiKey: 'gsk_test',
      });

      expect(adapter.getModelId()).toBe('llama-3.3-70b-versatile');
      currentModel = 'mixtral-8x7b-32768';
      expect(adapter.getModelId()).toBe('mixtral-8x7b-32768');
    });

    it('should support dynamic timeout accessor with default fallback', () => {
      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
        timeoutMs: 12000,
      });
      expect(adapter.getTimeoutMs()).toBe(12000);
    });

    it('should throw AIError AUTH_CONFIG if apiKey is not provided anywhere', async () => {
      const originalEnv = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        const adapter = new GroqAdapter({
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
          expect(aiError.provider).toBe('groq');
          expect(aiError.message).toContain('API key is not configured');
        }
      } finally {
        if (originalEnv) process.env.GROQ_API_KEY = originalEnv;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful Generation & Payload Mapping
  // -------------------------------------------------------------------------
  describe('Successful Request & Response Mapping', () => {
    it('should map AIRequest to Groq chat completions format and return AIResponse', async () => {
      const mockBody = createGroqResponse('Generated high-throughput RAG pipeline task.');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const request = createTestRequest({
        temperature: 0.4,
        maxTokens: 1024,
      });

      const response = await adapter.generate(request);

      // Verify AIResponse contract
      expect(response.success).toBe(true);
      expect(response.provider).toBe('groq');
      expect(response.model).toBe(TEST_MODEL);
      expect(response.content).toBe('Generated high-throughput RAG pipeline task.');
      expect(response.structuredData).toBeUndefined();
      expect(response.requestId).toBe('chatcmpl-groq-test-12345');
      expect(typeof response.latencyMs).toBe('number');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify token usage
      expect(response.usage).toEqual({
        inputTokens: 40,
        outputTokens: 95,
        totalTokens: 135,
      });

      // Verify HTTP call details
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(calledUrl).toBe('https://api.groq.com/openai/v1/chat/completions');

      // Header auth check
      const headers = calledInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
      expect(headers['Content-Type']).toBe('application/json');

      // Body payload check
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.model).toBe(TEST_MODEL);
      expect(sentPayload.temperature).toBe(0.4);
      expect(sentPayload.max_tokens).toBe(1024);
      expect(sentPayload.messages).toEqual([
        {
          role: 'system',
          content: 'You are an elite code evaluation engine.',
        },
        {
          role: 'user',
          content: 'Generate a scenario task for a principal AI engineer.',
        },
      ]);
    });

    it('should serialize context into user message when present', async () => {
      const mockBody = createGroqResponse('Context parsed.');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const request = createTestRequest({
        context: { domain: 'AI_ENGINEERING', seniority: 'PRINCIPAL' },
        userInput: 'Evaluate the inference benchmark design.',
      });

      await adapter.generate(request);

      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      const userMessage = sentPayload.messages[1].content;

      expect(userMessage).toContain('Context:');
      expect(userMessage).toContain('"domain": "AI_ENGINEERING"');
      expect(userMessage).toContain('User Input:\nEvaluate the inference benchmark design.');
    });

    it('should omit system message if systemInstruction is empty', async () => {
      const mockBody = createGroqResponse('No system prompt.');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      await adapter.generate(createTestRequest({ systemInstruction: '' }));

      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.messages).toHaveLength(1);
      expect(sentPayload.messages[0].role).toBe('user');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Structured Output & Schema Support
  // -------------------------------------------------------------------------
  describe('Structured JSON Output', () => {
    const evaluationSchema = {
      type: 'object',
      properties: {
        score: { type: 'number' },
        strengths: { type: 'array', items: { type: 'string' } },
      },
      required: ['score', 'strengths'],
      additionalProperties: false,
    };

    it('should pass json_schema response_format and parse structuredData', async () => {
      const structuredResult = {
        score: 95,
        strengths: ['Ultra-low latency', 'Scalable architecture'],
      };

      const mockBody = createGroqResponse(JSON.stringify(structuredResult));
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(
        createTestRequest({ outputSchema: evaluationSchema })
      );

      expect(response.success).toBe(true);
      expect(response.structuredData).toEqual(structuredResult);
      expect(response.content).toBe(JSON.stringify(structuredResult));

      // Verify response_format sent to Groq
      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: evaluationSchema,
        },
      });
    });

    it('should throw AIError INVALID_REQUEST if output is not valid JSON', async () => {
      const mockBody = createGroqResponse('Invalid JSON text output');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest({ outputSchema: evaluationSchema }));
        expect.fail('Expected AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.retryable).toBe(false);
        expect(aiError.provider).toBe('groq');
        expect(aiError.message).toContain('Failed to parse Groq structured JSON output');
      }
    });

    it('should throw AIError INVALID_REQUEST if content is empty when schema requested', async () => {
      const mockBody = createGroqResponse('');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest({ outputSchema: evaluationSchema }));
        expect.fail('Expected AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.message).toContain('empty content');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. Token Counting & Usage Mapping
  // -------------------------------------------------------------------------
  describe('Token Counting', () => {
    it('should map prompt_tokens, completion_tokens, and total_tokens', async () => {
      const mockBody = createGroqResponse('Result', {
        prompt: 110,
        completion: 70,
        total: 180,
      });

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest());
      expect(response.usage).toEqual({
        inputTokens: 110,
        outputTokens: 70,
        totalTokens: 180,
      });
    });

    it('should default token counts to 0 if usage is missing from response', async () => {
      const mockBody = {
        id: 'chatcmpl-no-usage',
        choices: [{ message: { content: 'No usage metadata' } }],
      };

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new GroqAdapter({
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

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
        timeoutMs: 4500,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected timeout AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError).toBeInstanceOf(AIError);
        expect(aiError.category).toBe('TIMEOUT');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('groq');
        expect(aiError.message).toContain('timed out after 4500ms');
      }
    });

    // 5.2 Rate Limit (429 / rate_limit_exceeded)
    it('should map HTTP 429 rate limit to RATE_LIMIT category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'Rate limit reached for requests per minute (RPM).',
          type: 'rate_limit_exceeded',
          code: 'rate_limit_exceeded',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      const adapter = new GroqAdapter({
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
        expect(aiError.provider).toBe('groq');
        expect(aiError.message).toContain('Rate limit reached');
      }
    });

    // 5.3 Server Errors (500, 502, 504 -> PROVIDER_ERROR; 503 -> UNAVAILABLE)
    it('should map HTTP 500 to PROVIDER_ERROR category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'Groq internal server error occurred.',
          type: 'internal_server_error',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const adapter = new GroqAdapter({
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
        expect(aiError.provider).toBe('groq');
      }
    });

    it('should map HTTP 503 to UNAVAILABLE category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'Groq service is currently unavailable.',
          type: 'service_unavailable',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 503,
          statusText: 'Service Unavailable',
        })
      );

      const adapter = new GroqAdapter({
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
      }
    });

    // 5.4 Authentication & Credential Errors (401, 403 -> AUTH_CONFIG, non-retryable)
    it('should map HTTP 401 to AUTH_CONFIG category (retryable: false)', async () => {
      const errorBody = {
        error: {
          message: 'Invalid Groq API Key provided.',
          type: 'invalid_api_key',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      const adapter = new GroqAdapter({
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
        expect(aiError.provider).toBe('groq');
        expect(aiError.message).toContain('Invalid Groq API Key');
      }
    });

    it('should map HTTP 403 to AUTH_CONFIG category (retryable: false)', async () => {
      const errorBody = {
        error: {
          message: 'Unauthorized caller.',
          type: 'unauthorized',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 403,
          statusText: 'Forbidden',
        })
      );

      const adapter = new GroqAdapter({
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
          message: 'Failed to deserialize JSON body.',
          type: 'invalid_request_error',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 400,
          statusText: 'Bad Request',
        })
      );

      const adapter = new GroqAdapter({
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
        expect(aiError.provider).toBe('groq');
      }
    });

    it('should map HTTP 404 to INVALID_REQUEST category (retryable: false)', async () => {
      const errorBody = {
        error: {
          message: 'Model not found: llama-bogus',
          type: 'model_not_found',
          code: 'model_not_found',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 404,
          statusText: 'Not Found',
        })
      );

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected 404 AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.retryable).toBe(false);
      }
    });

    // 5.6 Network Disconnection
    it('should map network transport failures to NETWORK category (retryable: true)', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));

      const adapter = new GroqAdapter({
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
        expect(aiError.provider).toBe('groq');
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
        new Response(JSON.stringify({ id: TEST_MODEL, object: 'model' }), {
          status: 200,
        })
      );

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(
        `https://api.groq.com/openai/v1/models/${encodeURIComponent(TEST_MODEL)}`
      );
      expect(calledInit.method).toBe('GET');
      const headers = calledInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
    });

    it('should return false when model endpoint responds with non-200', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false when network throws during healthCheck', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Connection reset'));

      const adapter = new GroqAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false immediately without network call if apiKey is missing', async () => {
      const originalEnv = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        const adapter = new GroqAdapter({
          modelId: TEST_MODEL,
          apiKey: undefined,
        });

        const healthy = await adapter.healthCheck();
        expect(healthy).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        if (originalEnv) process.env.GROQ_API_KEY = originalEnv;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. Optional Live Smoke Test
  // -------------------------------------------------------------------------
  describe('Live Groq API Smoke Test', () => {
    const liveApiKey = process.env.GROQ_API_KEY;
    const isLiveKeyAvailable = Boolean(liveApiKey && liveApiKey.trim().length > 0);

    it.skipIf(!isLiveKeyAvailable)(
      'should successfully execute live Chat Completion against Groq API',
      async () => {
        fetchSpy.mockRestore();

        const liveAdapter = new GroqAdapter({
          modelId: 'llama-3.3-70b-versatile',
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
        expect(response.provider).toBe('groq');
        expect(response.content.length).toBeGreaterThan(0);
        expect(response.usage.totalTokens).toBeGreaterThan(0);
      },
      20000
    );
  });
});
