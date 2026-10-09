import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroqAdapter } from '../ai/adapters/groq.adapter.js';
import { ProviderRouter } from '../ai/provider-router.js';
import { MockAdapter } from '../ai/adapters/mock.adapter.js';
import { AIWorker } from '../ai/worker.js';
import { HealthTracker } from '../ai/health-tracker.js';
import type { AIRequest } from '../ai/types.js';

describe('Dedicated Groq Resume Key Isolation and Routing Suite', () => {
  const originalGroqApiKey = process.env.GROQ_API_KEY;
  const originalGroqResumeApiKey = process.env.GROQ_RESUME_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk_primary_general_key_12345';
    process.env.GROQ_RESUME_API_KEY = 'gsk_dedicated_resume_key_99999';
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalGroqApiKey;
    process.env.GROQ_RESUME_API_KEY = originalGroqResumeApiKey;
  });

  it('1. GroqAdapter selects GROQ_RESUME_API_KEY for RESUME_ANALYSIS tasks and GROQ_API_KEY for other tasks', async () => {
    const adapter = new GroqAdapter({
      modelId: 'llama-3.3-70b-versatile',
    });

    let capturedAuthHeader: string | undefined;

    // Spy on global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      capturedAuthHeader = headers?.Authorization || headers?.authorization;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test-groq-id',
          model: 'llama-3.3-70b-versatile',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  name: 'Test Candidate',
                  domainClassification: 'SOFTWARE_ENGINEERING',
                  skills: ['TypeScript', 'Node.js'],
                  yearsOfExperience: 3,
                }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      } as unknown as Response;
    });

    // 1. Task: RESUME_ANALYSIS -> MUST use dedicated GROQ_RESUME_API_KEY
    const resumeRequest: AIRequest = {
      taskType: 'RESUME_ANALYSIS',
      userInput: 'Candidate text',
      systemInstruction: 'Extract info',
    };

    await adapter.generate(resumeRequest);
    expect(capturedAuthHeader).toBe('Bearer gsk_dedicated_resume_key_99999');

    // 2. Task: INTERVIEW -> MUST use primary GROQ_API_KEY
    const interviewRequest: AIRequest = {
      taskType: 'INTERVIEW',
      userInput: 'Question response',
      systemInstruction: 'Interview instructions',
    };

    await adapter.generate(interviewRequest);
    expect(capturedAuthHeader).toBe('Bearer gsk_primary_general_key_12345');

    fetchSpy.mockRestore();
  });

  it('2. ProviderRouter prioritizes preferredProvider when requested and available', () => {
    const router = new ProviderRouter();
    const geminiMock = new MockAdapter({ provider: 'gemini' });
    const groqMock = new MockAdapter({ provider: 'groq' });

    // Priority 1: Gemini, Priority 2: Groq
    router.registerAdapter('PIPELINE', geminiMock, 1);
    router.registerAdapter('PIPELINE', groqMock, 2);

    // Default selection selects highest priority (Gemini)
    const defaultSelected = router.selectProvider('PIPELINE');
    expect(defaultSelected?.provider).toBe('gemini');

    // With preferredProvider: 'groq', selects Groq
    const preferredSelected = router.selectProvider('PIPELINE', 'groq');
    expect(preferredSelected?.provider).toBe('groq');

    // If preferredProvider is DISABLED, falls back to highest priority available (Gemini)
    router.setHealthState('PIPELINE', 'groq', 'DISABLED');
    const fallbackSelected = router.selectProvider('PIPELINE', 'groq');
    expect(fallbackSelected?.provider).toBe('gemini');
  });

  it('3. AIWorker prioritizes job.preferredProvider over default router priority', async () => {
    const router = new ProviderRouter();
    const tracker = new HealthTracker(router);
    const worker = new AIWorker(router, tracker, { pools: ['PIPELINE'] });

    let invokedProvider: string | null = null;

    const geminiMock = new MockAdapter({
      provider: 'gemini',
      delayMs: 0,
    });

    const groqMock = new MockAdapter({
      provider: 'groq',
      delayMs: 0,
    });

    vi.spyOn(geminiMock, 'generate').mockImplementation(async () => {
      invokedProvider = 'gemini';
      return {
        success: true,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        requestId: 'mock-gemini-id',
        content: 'OK',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        latencyMs: 10,
      };
    });

    vi.spyOn(groqMock, 'generate').mockImplementation(async () => {
      invokedProvider = 'groq';
      return {
        success: true,
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        requestId: 'mock-groq-id',
        content: 'OK',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        latencyMs: 10,
      };
    });

    router.registerAdapter('PIPELINE', geminiMock, 1);
    router.registerAdapter('PIPELINE', groqMock, 2);

    // Create simulated job document with preferredProvider: 'groq'
    const jobDoc = {
      _id: 'test-job-preferred-groq',
      taskType: 'RESUME_ANALYSIS' as const,
      pool: 'PIPELINE' as const,
      preferredProvider: 'groq' as const,
      attempts: 0,
      maxAttempts: 3,
      attemptsPerProvider: new Map<string, number>(),
      payload: {
        taskType: 'RESUME_ANALYSIS' as const,
        userInput: 'Sample resume',
        systemInstruction: 'Extract info',
      },
      save: vi.fn(),
    };

    // Spy on claimJob to return our simulated job
    vi.spyOn(worker, 'claimJob').mockResolvedValue(jobDoc as unknown as import('../models/AIJob.js').IAIJobDocument);

    await worker.processNextJob('PIPELINE');

    expect(invokedProvider).toBe('groq');
  });
});
