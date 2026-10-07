/**
 * OpenAIAdapter Unit & Integration Tests (TASK P3.3)
 *
 * Covers:
 *   - HTTP layer mocked with vi.spyOn(globalThis, 'fetch')
 *   - Successful Chat Completion generation and content mapping
 *   - Structured JSON output mapping with json_schema response_format
 *   - Structured output validation & parse error handling
 *   - Token usage calculation from usage object (prompt_tokens, completion_tokens, total_tokens)
 *   - Configurable timeout and AbortError -> TIMEOUT category mapping
 *   - Rate limiting (HTTP 429 / rate_limit_error / insufficient_quota) -> RATE_LIMIT
 *   - Server errors (500, 502, 504 -> PROVIDER_ERROR; 503 -> UNAVAILABLE)
 *   - Authentication failures (401, 403 -> AUTH_CONFIG, non-retryable)
 *   - Client errors (400, 404 -> INVALID_REQUEST, non-retryable)
 *   - Network connection drops -> NETWORK category
 *   - Dynamic model ID and API key configuration
 *   - Health check against GET /v1/models/{model}
 *   - Security: API key in Authorization: Bearer header, never in query string
 *   - Optional live smoke test (skipped unless OPENAI_API_KEY is defined)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OpenAIAdapter } from '../ai/adapters/openai.adapter.js';
import type { AIRequest } from '../ai/types.js';
import { AIError } from '../ai/types.js';

describe('OpenAIAdapter', () => {
  const TEST_MODEL = 'gpt-4o-mini';
  const TEST_API_KEY = 'test-openai-secret-key-sk-12345';

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
      systemInstruction: 'You are an expert technical interviewer.',
      userInput: 'Generate a scenario task for a senior infrastructure engineer.',
      ...overrides,
    };
  }

  // Helper for mock successful OpenAI Chat Completion response
  function createOpenAIResponse(
    content: string,
    usage: { prompt?: number; completion?: number; total?: number } = {}
  ) {
    return {
      id: 'chatcmpl-test-id-12345',
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
        prompt_tokens: usage.prompt ?? 50,
        completion_tokens: usage.completion ?? 110,
        total_tokens: usage.total ?? 160,
      },
    };
  }

  // -------------------------------------------------------------------------
  // 1. Instantiation & Dynamic Configuration
  // -------------------------------------------------------------------------
  describe('Configuration & Initialization', () => {
    it('should throw if modelId is missing or empty in constructor', () => {
      expect(() => new OpenAIAdapter({ modelId: '' })).toThrow('OpenAIAdapter requires a modelId');
    });

    it('should support static modelId and apiKey', () => {
      const adapter = new OpenAIAdapter({
        modelId: 'gpt-4o',
        apiKey: 'sk-test',
      });
      expect(adapter.name).toBe('openai');
      expect(adapter.getModelId()).toBe('gpt-4o');
      expect(adapter.getTimeoutMs()).toBe(15000);
    });

    it('should support dynamic modelId function accessor', () => {
      let currentModel = 'gpt-4o-mini';
      const adapter = new OpenAIAdapter({
        modelId: () => currentModel,
        apiKey: 'sk-test',
      });

      expect(adapter.getModelId()).toBe('gpt-4o-mini');
      currentModel = 'gpt-4o-2024-08-06';
      expect(adapter.getModelId()).toBe('gpt-4o-2024-08-06');
    });

    it('should support dynamic timeout accessor with default fallback', () => {
      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
        timeoutMs: 9000,
      });
      expect(adapter.getTimeoutMs()).toBe(9000);
    });

    it('should throw AIError AUTH_CONFIG if apiKey is not provided anywhere', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        const adapter = new OpenAIAdapter({
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
          expect(aiError.provider).toBe('openai');
          expect(aiError.message).toContain('API key is not configured');
        }
      } finally {
        if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful Generation & Payload Mapping
  // -------------------------------------------------------------------------
  describe('Successful Request & Response Mapping', () => {
    it('should map AIRequest to OpenAI chat completions format and return AIResponse', async () => {
      const mockBody = createOpenAIResponse('Generated Kubernetes deployment task.');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const request = createTestRequest({
        temperature: 0.3,
        maxTokens: 512,
      });

      const response = await adapter.generate(request);

      // Verify AIResponse contract
      expect(response.success).toBe(true);
      expect(response.provider).toBe('openai');
      expect(response.model).toBe(TEST_MODEL);
      expect(response.content).toBe('Generated Kubernetes deployment task.');
      expect(response.structuredData).toBeUndefined();
      expect(response.requestId).toBe('chatcmpl-test-id-12345');
      expect(typeof response.latencyMs).toBe('number');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify token usage
      expect(response.usage).toEqual({
        inputTokens: 50,
        outputTokens: 110,
        totalTokens: 160,
      });

      // Verify HTTP call details
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions');

      // Header auth check
      const headers = calledInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
      expect(headers['Content-Type']).toBe('application/json');

      // Body payload check
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.model).toBe(TEST_MODEL);
      expect(sentPayload.temperature).toBe(0.3);
      expect(sentPayload.max_tokens).toBe(512);
      expect(sentPayload.messages).toEqual([
        {
          role: 'system',
          content: 'You are an expert technical interviewer.',
        },
        {
          role: 'user',
          content: 'Generate a scenario task for a senior infrastructure engineer.',
        },
      ]);
    });

    it('should serialize context into the user message when present', async () => {
      const mockBody = createOpenAIResponse('Evaluated.');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const request = createTestRequest({
        context: { role: 'LEAD', domain: 'AI_ENGINEERING' },
        userInput: 'Evaluate the system architecture design.',
      });

      await adapter.generate(request);

      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      const userMessage = sentPayload.messages[1].content;

      expect(userMessage).toContain('Context:');
      expect(userMessage).toContain('"role": "LEAD"');
      expect(userMessage).toContain('User Input:\nEvaluate the system architecture design.');
    });

    it('should omit system message if systemInstruction is empty', async () => {
      const mockBody = createOpenAIResponse('Simple output.');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
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
    const taskSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        score: { type: 'number' },
      },
      required: ['summary', 'score'],
      additionalProperties: false,
    };

    it('should pass json_schema response_format and parse structuredData', async () => {
      const structuredResult = {
        summary: 'Excellent architecture with solid decoupling.',
        score: 92,
      };

      const mockBody = createOpenAIResponse(JSON.stringify(structuredResult));
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest({ outputSchema: taskSchema }));

      expect(response.success).toBe(true);
      expect(response.structuredData).toEqual(structuredResult);
      expect(response.content).toBe(JSON.stringify(structuredResult));

      // Verify response_format sent to OpenAI
      const [, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const sentPayload = JSON.parse(calledInit.body as string);
      expect(sentPayload.response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: taskSchema,
        },
      });
    });

    it('should throw AIError INVALID_REQUEST if output is not valid JSON', async () => {
      const mockBody = createOpenAIResponse('Non-JSON response text');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest({ outputSchema: taskSchema }));
        expect.fail('Expected AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('INVALID_REQUEST');
        expect(aiError.retryable).toBe(false);
        expect(aiError.provider).toBe('openai');
        expect(aiError.message).toContain('Failed to parse OpenAI structured JSON output');
      }
    });

    it('should throw AIError INVALID_REQUEST if content is empty when schema requested', async () => {
      const mockBody = createOpenAIResponse('');
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
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
  });

  // -------------------------------------------------------------------------
  // 4. Token Counting & Usage Mapping
  // -------------------------------------------------------------------------
  describe('Token Counting', () => {
    it('should map prompt_tokens, completion_tokens, and total_tokens', async () => {
      const mockBody = createOpenAIResponse('Result', {
        prompt: 120,
        completion: 60,
        total: 180,
      });

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const response = await adapter.generate(createTestRequest());
      expect(response.usage).toEqual({
        inputTokens: 120,
        outputTokens: 60,
        totalTokens: 180,
      });
    });

    it('should default token counts to 0 if usage is missing from response', async () => {
      const mockBody = {
        id: 'chatcmpl-no-usage',
        choices: [{ message: { content: 'No usage metadata' } }],
      };

      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }));

      const adapter = new OpenAIAdapter({
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

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
        timeoutMs: 4000,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected timeout AIError');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError).toBeInstanceOf(AIError);
        expect(aiError.category).toBe('TIMEOUT');
        expect(aiError.retryable).toBe(true);
        expect(aiError.provider).toBe('openai');
        expect(aiError.message).toContain('timed out after 4000ms');
      }
    });

    // 5.2 Rate Limit (429 / rate_limit_error / insufficient_quota)
    it('should map HTTP 429 rate limit to RATE_LIMIT category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'Rate limit reached for requests per minute (RPM).',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      const adapter = new OpenAIAdapter({
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
        expect(aiError.provider).toBe('openai');
        expect(aiError.message).toContain('Rate limit reached');
      }
    });

    it('should map insufficient_quota to RATE_LIMIT category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'You exceeded your current quota.',
          type: 'insufficient_quota',
          code: 'insufficient_quota',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      try {
        await adapter.generate(createTestRequest());
        expect.fail('Expected RATE_LIMIT');
      } catch (err) {
        const aiError = err as AIError;
        expect(aiError.category).toBe('RATE_LIMIT');
        expect(aiError.retryable).toBe(true);
      }
    });

    // 5.3 Server Errors (500, 502, 504 -> PROVIDER_ERROR; 503 -> UNAVAILABLE)
    it('should map HTTP 500 to PROVIDER_ERROR category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'The server had an error while processing your request.',
          type: 'server_error',
          code: null,
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const adapter = new OpenAIAdapter({
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
        expect(aiError.provider).toBe('openai');
      }
    });

    it('should map HTTP 503 to UNAVAILABLE category (retryable: true)', async () => {
      const errorBody = {
        error: {
          message: 'The engine is currently overloaded.',
          type: 'service_unavailable',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 503,
          statusText: 'Service Unavailable',
        })
      );

      const adapter = new OpenAIAdapter({
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
          message: 'Incorrect API key provided.',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      const adapter = new OpenAIAdapter({
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
        expect(aiError.provider).toBe('openai');
        expect(aiError.message).toContain('Incorrect API key provided');
      }
    });

    it('should map HTTP 403 to AUTH_CONFIG category (retryable: false)', async () => {
      const errorBody = {
        error: {
          message: 'Country, region, or territory not supported.',
          type: 'permission_error',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 403,
          statusText: 'Forbidden',
        })
      );

      const adapter = new OpenAIAdapter({
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
          message: 'Unknown parameter: bogus_param',
          type: 'invalid_request_error',
          code: 'unknown_parameter',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 400,
          statusText: 'Bad Request',
        })
      );

      const adapter = new OpenAIAdapter({
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
        expect(aiError.provider).toBe('openai');
      }
    });

    it('should map HTTP 404 to INVALID_REQUEST category (retryable: false)', async () => {
      const errorBody = {
        error: {
          message: 'The model gpt-bogus does not exist',
          type: 'not_found_error',
          code: 'model_not_found',
        },
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 404,
          statusText: 'Not Found',
        })
      );

      const adapter = new OpenAIAdapter({
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

      const adapter = new OpenAIAdapter({
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
        expect(aiError.provider).toBe('openai');
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

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(`https://api.openai.com/v1/models/${encodeURIComponent(TEST_MODEL)}`);
      expect(calledInit.method).toBe('GET');
      const headers = calledInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
    });

    it('should return false when model endpoint responds with non-200', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false when network throws during healthCheck', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Connection dropped'));

      const adapter = new OpenAIAdapter({
        modelId: TEST_MODEL,
        apiKey: TEST_API_KEY,
      });

      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false immediately without network call if apiKey is missing', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        const adapter = new OpenAIAdapter({
          modelId: TEST_MODEL,
          apiKey: undefined,
        });

        const healthy = await adapter.healthCheck();
        expect(healthy).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. Optional Live Smoke Test
  // -------------------------------------------------------------------------
  describe('Live OpenAI API Smoke Test', () => {
    const liveApiKey = process.env.OPENAI_API_KEY;
    const isLiveKeyAvailable = Boolean(liveApiKey && liveApiKey.trim().length > 0);

    it.skipIf(!isLiveKeyAvailable)(
      'should successfully execute live Chat Completion against OpenAI API',
      async () => {
        fetchSpy.mockRestore();

        const liveAdapter = new OpenAIAdapter({
          modelId: 'gpt-4o-mini',
          apiKey: liveApiKey,
          timeoutMs: 15000,
        });

        const request: AIRequest = {
          taskType: 'TASK_GENERATION',
          systemInstruction: 'You are a testing assistant.',
          userInput: 'Output the single word: HELLO',
          maxTokens: 10,
        };

        const response = await liveAdapter.generate(request);
        expect(response.success).toBe(true);
        expect(response.provider).toBe('openai');
        expect(response.content.length).toBeGreaterThan(0);
        expect(response.usage.totalTokens).toBeGreaterThan(0);
      },
      20000
    );
  });
});
