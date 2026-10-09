/**
 * AI Gateway module barrel exports.
 *
 * Business code should import only from this module:
 *   import { AIGateway, AIRequest, AIResponse, AIError } from '../ai/index.js';
 */

// Types, enums, and error class
export type {
  AITaskType,
  AIPool,
  AIRequest,
  AIUsage,
  AIResponse,
  AIErrorCategory,
  AIGatewayOptions,
  AIGatewayExecuteOptions,
  AIGatewaySubmitOptions,
  AIProvider,
  ProviderHealthState,
  ProviderAdapter,
} from './types.js';

export { AI_TASK_TYPES, AI_POOLS, AI_ERROR_CATEGORIES, AIError } from './types.js';

// Provider Router
export { ProviderRouter } from './provider-router.js';
export type { ProviderEntry } from './provider-router.js';

// Health Tracker
export { HealthTracker } from './health-tracker.js';
export type { HealthTrackerOptions } from './health-tracker.js';

// Worker
export { AIWorker } from './worker.js';
export type { AIWorkerOptions } from './worker.js';

// Gateway (primary public interface)
export { AIGateway, validateAgainstSchema } from './gateway.js';

// Adapters
export { MockAdapter } from './adapters/mock.adapter.js';
export type { MockAdapterConfig } from './adapters/mock.adapter.js';
export { GeminiAdapter, sanitizeSchemaForGemini } from './adapters/gemini.adapter.js';
export type { GeminiAdapterOptions } from './adapters/gemini.adapter.js';
export { OpenAIAdapter } from './adapters/openai.adapter.js';
export type { OpenAIAdapterOptions } from './adapters/openai.adapter.js';
export { GroqAdapter } from './adapters/groq.adapter.js';
export type { GroqAdapterOptions } from './adapters/groq.adapter.js';

// Default platform singletons
import { ProviderRouter } from './provider-router.js';
import { HealthTracker } from './health-tracker.js';
import { AIGateway } from './gateway.js';
import { AIWorker } from './worker.js';

export const defaultRouter = new ProviderRouter();
export const defaultTracker = new HealthTracker(defaultRouter);
export const defaultAIGateway = new AIGateway(defaultRouter, defaultTracker);
export const defaultAIWorker = new AIWorker(defaultRouter, defaultTracker, {
  pools: ['PIPELINE', 'DEMO'],
});
