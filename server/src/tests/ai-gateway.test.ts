/**
 * AI Gateway Core Tests (TASK P3.1)
 *
 * Verifies:
 *   - AIError retryability classification per Spec Section 21.1
 *   - MockAdapter error simulation, structured output, call tracking
 *   - ProviderRouter priority ordering, DISABLED skipping, pool isolation
 *   - AIGateway.execute() routing, normalization, schema validation
 *   - Schema validator correctness
 *   - Lint guard: no provider SDK imports outside server/src/ai/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  AIError,
  AIGateway,
  MockAdapter,
  ProviderRouter,
  validateAgainstSchema,
} from '../ai/index.js';
import type { AIRequest, AIErrorCategory } from '../ai/index.js';

// ---------------------------------------------------------------------------
// Helper: reusable base request
// ---------------------------------------------------------------------------

function baseRequest(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    taskType: 'TASK_GENERATION',
    systemInstruction: 'You are a task generator.',
    userInput: 'Generate a coding task.',
    ...overrides,
  };
}

// ===========================================================================
// 1. AIError
// ===========================================================================

describe('AIError', () => {
  const retryableCategories: AIErrorCategory[] = [
    'TIMEOUT',
    'RATE_LIMIT',
    'PROVIDER_ERROR',
    'UNAVAILABLE',
    'NETWORK',
  ];
  const nonRetryableCategories: AIErrorCategory[] = ['AUTH_CONFIG', 'INVALID_REQUEST'];

  it.each(retryableCategories)('should mark %s as retryable', (category) => {
    const err = new AIError(`test ${category}`, category, 'gemini');
    expect(err.retryable).toBe(true);
    expect(err.category).toBe(category);
    expect(err.provider).toBe('gemini');
    expect(err.name).toBe('AIError');
    expect(err.message).toContain(category);
  });

  it.each(nonRetryableCategories)('should mark %s as non-retryable', (category) => {
    const err = new AIError(`test ${category}`, category, 'openai');
    expect(err.retryable).toBe(false);
    expect(err.category).toBe(category);
    expect(err.provider).toBe('openai');
  });

  it('should work without a provider', () => {
    const err = new AIError('no provider', 'UNAVAILABLE');
    expect(err.provider).toBeUndefined();
    expect(err.retryable).toBe(true);
  });

  it('AIError.isRetryable() static helper should match instance retryable', () => {
    for (const cat of retryableCategories) {
      expect(AIError.isRetryable(cat)).toBe(true);
    }
    for (const cat of nonRetryableCategories) {
      expect(AIError.isRetryable(cat)).toBe(false);
    }
  });

  it('should be an instance of Error', () => {
    const err = new AIError('test', 'TIMEOUT');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AIError);
  });
});

// ===========================================================================
// 2. MockAdapter
// ===========================================================================

describe('MockAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter({ provider: 'openai', defaultModel: 'gpt-mock' });
  });

  it('should generate a default successful response', async () => {
    const response = await adapter.generate(baseRequest());

    expect(response.success).toBe(true);
    expect(response.provider).toBe('openai');
    expect(response.model).toBe('gpt-mock');
    expect(response.content).toContain('TASK_GENERATION');
    expect(response.usage.inputTokens).toBe(10);
    expect(response.usage.outputTokens).toBe(20);
    expect(response.usage.totalTokens).toBe(30);
    expect(typeof response.requestId).toBe('string');
    expect(response.requestId.length).toBeGreaterThan(0);
  });

  it.each<AIErrorCategory>([
    'TIMEOUT',
    'RATE_LIMIT',
    'PROVIDER_ERROR',
    'UNAVAILABLE',
    'NETWORK',
    'AUTH_CONFIG',
    'INVALID_REQUEST',
  ])('should simulate %s error', async (category) => {
    adapter.simulateError(category);

    await expect(adapter.generate(baseRequest())).rejects.toThrow(AIError);

    try {
      adapter.simulateError(category);
      await adapter.generate(baseRequest());
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      const aiErr = err as AIError;
      expect(aiErr.category).toBe(category);
      expect(aiErr.provider).toBe('openai');
    }
  });

  it('should consume error simulation after one call', async () => {
    adapter.simulateError('TIMEOUT');

    // First call throws
    await expect(adapter.generate(baseRequest())).rejects.toThrow(AIError);

    // Second call succeeds
    const response = await adapter.generate(baseRequest());
    expect(response.success).toBe(true);
  });

  it('should return structured data when configured', async () => {
    const structuredData = { score: 85, feedback: 'Good work' };
    adapter.simulateResponse({ structuredData });

    const response = await adapter.generate(baseRequest());
    expect(response.structuredData).toEqual(structuredData);
  });

  it('should track call history', async () => {
    expect(adapter.getCallCount()).toBe(0);

    const req1 = baseRequest({ taskType: 'ATS_EVALUATION' });
    const req2 = baseRequest({ taskType: 'INTERVIEW_QUESTION' });

    await adapter.generate(req1);
    await adapter.generate(req2);

    expect(adapter.getCallCount()).toBe(2);
    expect(adapter.getCalls()[0].taskType).toBe('ATS_EVALUATION');
    expect(adapter.getCalls()[1].taskType).toBe('INTERVIEW_QUESTION');
    expect(adapter.getLastCall()?.taskType).toBe('INTERVIEW_QUESTION');
  });

  it('should reset state and history', async () => {
    adapter.simulateError('TIMEOUT');
    await adapter.generate(baseRequest()).catch(() => {});

    adapter.reset();

    expect(adapter.getCallCount()).toBe(0);
    const response = await adapter.generate(baseRequest());
    expect(response.success).toBe(true);
  });

  it('should report configurable health check result', async () => {
    expect(await adapter.healthCheck()).toBe(true);

    adapter.simulateHealthCheck(false);
    expect(await adapter.healthCheck()).toBe(false);
  });

  it('should override usage when partially specified', async () => {
    adapter.simulateResponse({
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    });

    const response = await adapter.generate(baseRequest());
    expect(response.usage.inputTokens).toBe(100);
    expect(response.usage.outputTokens).toBe(200);
    expect(response.usage.totalTokens).toBe(300);
  });
});

// ===========================================================================
// 3. ProviderRouter
// ===========================================================================

describe('ProviderRouter', () => {
  let router: ProviderRouter;
  let geminiAdapter: MockAdapter;
  let openaiAdapter: MockAdapter;
  let groqAdapter: MockAdapter;

  beforeEach(() => {
    router = new ProviderRouter();
    geminiAdapter = new MockAdapter({ provider: 'gemini' });
    openaiAdapter = new MockAdapter({ provider: 'openai' });
    groqAdapter = new MockAdapter({ provider: 'groq' });
  });

  it('should select provider by priority order', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);
    router.registerAdapter('PIPELINE', groqAdapter, 3);

    const selected = router.selectProvider('PIPELINE');
    expect(selected).not.toBeNull();
    expect(selected!.provider).toBe('gemini');
  });

  it('should select second provider when first is DISABLED', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);
    router.registerAdapter('PIPELINE', groqAdapter, 3);

    router.setHealthState('PIPELINE', 'gemini', 'DISABLED');

    const selected = router.selectProvider('PIPELINE');
    expect(selected).not.toBeNull();
    expect(selected!.provider).toBe('openai');
  });

  it('should still select DEGRADED providers (only DISABLED is skipped)', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.setHealthState('PIPELINE', 'gemini', 'DEGRADED');

    const selected = router.selectProvider('PIPELINE');
    expect(selected).not.toBeNull();
    expect(selected!.provider).toBe('gemini');
  });

  it('should still select RATE_LIMITED providers (only DISABLED is skipped)', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.setHealthState('PIPELINE', 'gemini', 'RATE_LIMITED');

    const selected = router.selectProvider('PIPELINE');
    expect(selected).not.toBeNull();
    expect(selected!.provider).toBe('gemini');
  });

  it('should still select TEMPORARILY_FAILED providers (only DISABLED is skipped)', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.setHealthState('PIPELINE', 'gemini', 'TEMPORARILY_FAILED');

    const selected = router.selectProvider('PIPELINE');
    expect(selected).not.toBeNull();
    expect(selected!.provider).toBe('gemini');
  });

  it('should return null when all providers are DISABLED', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);

    router.setHealthState('PIPELINE', 'gemini', 'DISABLED');
    router.setHealthState('PIPELINE', 'openai', 'DISABLED');

    expect(router.selectProvider('PIPELINE')).toBeNull();
  });

  it('should return null for empty pool', () => {
    expect(router.selectProvider('PIPELINE')).toBeNull();
  });

  it('should return null for unregistered pool', () => {
    router.registerAdapter('DEMO', geminiAdapter, 1);
    expect(router.selectProvider('PIPELINE')).toBeNull();
  });

  it('should isolate DEMO and PIPELINE pools completely', () => {
    const demoGemini = new MockAdapter({ provider: 'gemini', defaultModel: 'demo-model' });
    const pipeGemini = new MockAdapter({ provider: 'gemini', defaultModel: 'pipeline-model' });

    router.registerAdapter('DEMO', demoGemini, 1);
    router.registerAdapter('PIPELINE', pipeGemini, 1);

    // Disable gemini in DEMO
    router.setHealthState('DEMO', 'gemini', 'DISABLED');

    // DEMO has no available providers
    expect(router.selectProvider('DEMO')).toBeNull();

    // PIPELINE is unaffected
    const pipeSelected = router.selectProvider('PIPELINE');
    expect(pipeSelected).not.toBeNull();
    expect(pipeSelected!.provider).toBe('gemini');
  });

  it('should track and return health states', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);

    expect(router.getHealthState('PIPELINE', 'gemini')).toBe('HEALTHY');

    router.setHealthState('PIPELINE', 'gemini', 'DEGRADED');
    expect(router.getHealthState('PIPELINE', 'gemini')).toBe('DEGRADED');
  });

  it('should return undefined health state for unregistered pool/provider', () => {
    expect(router.getHealthState('PIPELINE', 'gemini')).toBeUndefined();

    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    expect(router.getHealthState('PIPELINE', 'openai')).toBeUndefined();
  });

  it('should return available providers excluding DISABLED', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);
    router.registerAdapter('PIPELINE', groqAdapter, 3);

    router.setHealthState('PIPELINE', 'openai', 'DISABLED');

    const available = router.getAvailableProviders('PIPELINE');
    expect(available).toHaveLength(2);
    expect(available[0].provider).toBe('gemini');
    expect(available[1].provider).toBe('groq');
  });

  it('should return all providers including DISABLED', () => {
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);

    router.setHealthState('PIPELINE', 'openai', 'DISABLED');

    const all = router.getAllProviders('PIPELINE');
    expect(all).toHaveLength(2);
  });

  it('should replace existing adapter when re-registered', () => {
    const adapter1 = new MockAdapter({ provider: 'gemini', defaultModel: 'v1' });
    const adapter2 = new MockAdapter({ provider: 'gemini', defaultModel: 'v2' });

    router.registerAdapter('PIPELINE', adapter1, 1);
    router.registerAdapter('PIPELINE', adapter2, 2);

    const all = router.getAllProviders('PIPELINE');
    expect(all).toHaveLength(1);

    const selected = router.selectProvider('PIPELINE');
    expect(selected).not.toBeNull();
    // The replaced adapter should be adapter2
    expect(selected!.priority).toBe(2);
  });

  it('should maintain priority sort order after insertions', () => {
    router.registerAdapter('PIPELINE', groqAdapter, 3);
    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);

    const all = router.getAllProviders('PIPELINE');
    expect(all[0].provider).toBe('gemini');
    expect(all[1].provider).toBe('openai');
    expect(all[2].provider).toBe('groq');
  });
});

// ===========================================================================
// 4. Schema Validator
// ===========================================================================

describe('validateAgainstSchema', () => {
  it('should pass valid object with required properties', () => {
    const schema = {
      type: 'object',
      required: ['score', 'feedback'],
      properties: {
        score: { type: 'number' },
        feedback: { type: 'string' },
      },
    };
    const data = { score: 85, feedback: 'Good work' };

    expect(validateAgainstSchema(data, schema)).toEqual([]);
  });

  it('should fail when required property is missing', () => {
    const schema = {
      type: 'object',
      required: ['score', 'feedback'],
    };
    const data = { score: 85 };

    const errors = validateAgainstSchema(data, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('feedback');
  });

  it('should fail when type mismatches', () => {
    const schema = {
      type: 'object',
      properties: {
        score: { type: 'number' },
      },
    };
    const data = { score: 'not a number' };

    const errors = validateAgainstSchema(data, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Expected number');
  });

  it('should validate nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        result: {
          type: 'object',
          required: ['value'],
          properties: {
            value: { type: 'number' },
          },
        },
      },
    };
    const data = { result: { value: 'string' } };

    const errors = validateAgainstSchema(data, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('result.value');
  });

  it('should validate array items', () => {
    const schema = {
      type: 'array',
      items: { type: 'number' },
    };
    const data = [1, 2, 'three'];

    const errors = validateAgainstSchema(data, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('[2]');
  });

  it('should validate integer type', () => {
    const schema = { type: 'integer' };

    expect(validateAgainstSchema(42, schema)).toEqual([]);
    expect(validateAgainstSchema(42.5, schema).length).toBeGreaterThan(0);
  });

  it('should validate boolean type', () => {
    const schema = { type: 'boolean' };

    expect(validateAgainstSchema(true, schema)).toEqual([]);
    expect(validateAgainstSchema('true', schema).length).toBeGreaterThan(0);
  });

  it('should reject null for object type', () => {
    const schema = { type: 'object' };
    const errors = validateAgainstSchema(null, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('null');
  });

  it('should reject array for object type', () => {
    const schema = { type: 'object' };
    const errors = validateAgainstSchema([], schema);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should pass when no schema constraints are specified', () => {
    expect(validateAgainstSchema({ anything: 'goes' }, {})).toEqual([]);
  });
});

// ===========================================================================
// 5. AIGateway
// ===========================================================================

describe('AIGateway', () => {
  let router: ProviderRouter;
  let geminiAdapter: MockAdapter;
  let openaiAdapter: MockAdapter;
  let gateway: AIGateway;

  beforeEach(() => {
    router = new ProviderRouter();
    geminiAdapter = new MockAdapter({ provider: 'gemini', defaultModel: 'gemini-mock' });
    openaiAdapter = new MockAdapter({ provider: 'openai', defaultModel: 'gpt-mock' });

    router.registerAdapter('PIPELINE', geminiAdapter, 1);
    router.registerAdapter('PIPELINE', openaiAdapter, 2);

    gateway = new AIGateway(router);
  });

  it('should execute request through the highest-priority provider', async () => {
    const response = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });

    expect(response.success).toBe(true);
    expect(response.provider).toBe('gemini');
    expect(response.model).toBe('gemini-mock');
    expect(geminiAdapter.getCallCount()).toBe(1);
    expect(openaiAdapter.getCallCount()).toBe(0);
  });

  it('should generate a unique gateway requestId', async () => {
    const r1 = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
    const r2 = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });

    expect(r1.requestId).toBeTruthy();
    expect(r2.requestId).toBeTruthy();
    expect(r1.requestId).not.toBe(r2.requestId);
  });

  it('should measure latencyMs at gateway level', async () => {
    const response = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
    expect(typeof response.latencyMs).toBe('number');
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should normalize usage from adapter', async () => {
    geminiAdapter.simulateResponse({
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    });

    const response = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
    expect(response.usage).toEqual({
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
    });
  });

  it('should pass through structured data when no schema is specified', async () => {
    const structuredData = { score: 90, detail: 'Excellent' };
    geminiAdapter.simulateResponse({ structuredData });

    const response = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
    expect(response.structuredData).toEqual(structuredData);
  });

  it('should validate structured output against outputSchema', async () => {
    const structuredData = { score: 85, feedback: 'Good work' };
    geminiAdapter.simulateResponse({ structuredData });

    const request = baseRequest({
      outputSchema: {
        type: 'object',
        required: ['score', 'feedback'],
        properties: {
          score: { type: 'number' },
          feedback: { type: 'string' },
        },
      },
    });

    const response = await gateway.execute(request, { pool: 'PIPELINE' });
    expect(response.structuredData).toEqual(structuredData);
  });

  it('should throw when outputSchema specified but no structured data returned', async () => {
    // Default mock response has no structuredData
    const request = baseRequest({
      outputSchema: {
        type: 'object',
        required: ['score'],
      },
    });

    await expect(gateway.execute(request, { pool: 'PIPELINE' })).rejects.toThrow(AIError);

    try {
      await gateway.execute(request, { pool: 'PIPELINE' });
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      expect((err as AIError).category).toBe('PROVIDER_ERROR');
      expect((err as AIError).message).toContain('no structured data');
    }
  });

  it('should throw on schema validation failure', async () => {
    geminiAdapter.simulateResponse({
      structuredData: { score: 'not-a-number' },
    });

    const request = baseRequest({
      outputSchema: {
        type: 'object',
        required: ['score'],
        properties: {
          score: { type: 'number' },
        },
      },
    });

    await expect(gateway.execute(request, { pool: 'PIPELINE' })).rejects.toThrow(AIError);

    // Re-simulate for assertion
    geminiAdapter.simulateResponse({
      structuredData: { score: 'not-a-number' },
    });

    try {
      await gateway.execute(request, { pool: 'PIPELINE' });
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      const aiErr = err as AIError;
      expect(aiErr.category).toBe('PROVIDER_ERROR');
      expect(aiErr.message).toContain('validation failed');
      expect(aiErr.provider).toBe('gemini');
    }
  });

  it('should throw UNAVAILABLE when no providers exist in pool', async () => {
    await expect(gateway.execute(baseRequest(), { pool: 'DEMO' })).rejects.toThrow(AIError);

    try {
      await gateway.execute(baseRequest(), { pool: 'DEMO' });
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      expect((err as AIError).category).toBe('UNAVAILABLE');
      expect((err as AIError).message).toContain('DEMO');
    }
  });

  it('should throw UNAVAILABLE when all providers are DISABLED', async () => {
    router.setHealthState('PIPELINE', 'gemini', 'DISABLED');
    router.setHealthState('PIPELINE', 'openai', 'DISABLED');

    await expect(gateway.execute(baseRequest(), { pool: 'PIPELINE' })).rejects.toThrow(AIError);

    try {
      await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
    } catch (err) {
      expect((err as AIError).category).toBe('UNAVAILABLE');
    }
  });

  it('should propagate AIError from adapter', async () => {
    geminiAdapter.simulateError('RATE_LIMIT');

    try {
      await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      const aiErr = err as AIError;
      expect(aiErr.category).toBe('RATE_LIMIT');
      expect(aiErr.retryable).toBe(true);
      expect(aiErr.provider).toBe('gemini');
    }
  });

  it('should wrap unexpected non-AIError exceptions as PROVIDER_ERROR', async () => {
    // Monkey-patch generate to throw a plain Error
    const originalGenerate = geminiAdapter.generate.bind(geminiAdapter);
    geminiAdapter.generate = async () => {
      throw new TypeError('Unexpected internal crash');
    };

    try {
      await gateway.execute(baseRequest(), { pool: 'PIPELINE' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      const aiErr = err as AIError;
      expect(aiErr.category).toBe('PROVIDER_ERROR');
      expect(aiErr.message).toContain('Unexpected error');
      expect(aiErr.message).toContain('Unexpected internal crash');
      expect(aiErr.provider).toBe('gemini');
    }

    geminiAdapter.generate = originalGenerate;
  });

  it('should route to second provider when first is DISABLED', async () => {
    router.setHealthState('PIPELINE', 'gemini', 'DISABLED');

    const response = await gateway.execute(baseRequest(), { pool: 'PIPELINE' });

    expect(response.provider).toBe('openai');
    expect(response.model).toBe('gpt-mock');
    expect(geminiAdapter.getCallCount()).toBe(0);
    expect(openaiAdapter.getCallCount()).toBe(1);
  });

  it('should forward the correct request payload to the adapter', async () => {
    const request = baseRequest({
      taskType: 'ATS_EVALUATION',
      systemInstruction: 'Evaluate this resume.',
      userInput: 'My resume content...',
      context: { domain: 'SOFTWARE_ENGINEERING' },
      temperature: 0.3,
      maxTokens: 500,
    });

    await gateway.execute(request, { pool: 'PIPELINE' });

    const lastCall = geminiAdapter.getLastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall!.taskType).toBe('ATS_EVALUATION');
    expect(lastCall!.systemInstruction).toBe('Evaluate this resume.');
    expect(lastCall!.userInput).toBe('My resume content...');
    expect(lastCall!.context).toEqual({ domain: 'SOFTWARE_ENGINEERING' });
    expect(lastCall!.temperature).toBe(0.3);
    expect(lastCall!.maxTokens).toBe(500);
  });
});

// ===========================================================================
// 6. Provider SDK Import Guard
// ===========================================================================

describe('Provider SDK Import Guard', () => {
  it('should not import provider SDKs outside server/src/ai/', () => {
    const currentFile = fileURLToPath(import.meta.url);
    const srcDir = path.resolve(path.dirname(currentFile), '..');

    // Provider SDK package names that must never appear in imports outside ai/
    const providerSdks = [
      '@google/generative-ai',
      '@google-ai/generativelanguage',
      'openai',
      'groq-sdk',
    ];

    const violations: string[] = [];

    function scanDir(dir: string): void {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, dist, and the ai/ directory itself
          if (['node_modules', 'dist', 'ai'].includes(entry.name)) continue;
          scanDir(fullPath);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const sdk of providerSdks) {
            if (
              content.includes(`from '${sdk}'`) ||
              content.includes(`from "${sdk}"`) ||
              content.includes(`require('${sdk}')`) ||
              content.includes(`require("${sdk}")`)
            ) {
              violations.push(`${path.relative(srcDir, fullPath)} imports '${sdk}'`);
            }
          }
        }
      }
    }

    scanDir(srcDir);
    expect(violations).toEqual([]);
  });
});
