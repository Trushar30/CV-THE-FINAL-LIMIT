# CorpVerse — Phase 3 Comprehensive Architectural & Specification Review

- **Review Date:** 2026-10-07
- **Scope:** Phase 3 AI Gateway, Provider Adapters & AI Operations:
  - `TASK P3.1`: AI Gateway Core, Normalized Types (`AIRequest`, `AIResponse`, `AIError`), Pool Isolation (`DEMO` vs `PIPELINE`), ProviderRouter, Schema Validation, Zero Direct SDK Rule.
  - `TASK P3.2`: Google Gemini Provider Adapter (`GeminiAdapter`), REST API Integration, `x-goog-api-key` Auth, Structured JSON Schemas, Error Taxonomy Mapping.
  - `TASK P3.3`: OpenAI Provider Adapter (`OpenAIAdapter`), Chat Completions REST API Integration, Bearer Auth, `json_schema` Structured Outputs, Token Usage Accounting, Error Taxonomy Mapping.
  - `TASK P3.4`: Groq Provider Adapter (`GroqAdapter`), Chat Completions REST API Integration, Bearer Auth, `json_schema` Structured Outputs, Token Usage Accounting, Error Taxonomy Mapping.
  - `TASK P3.5`: AI Reliability Layer, Asynchronous Queue (`AIJobModel`), In-Process Leased Polling Worker (`AIWorker`), Circuit Breaking & Health Tracking (`HealthTracker`), Observability Logs (`aiRequests`, `aiResponses`, `aiHealthLogs`).
  - `TASK P3.6`: AI Manager Backend, Cryptographic Key Vault (AES-256-GCM), API Key Masking (`sk-••••••••1234`), Strict RBAC Separation (`AI_MANAGER` vs `ADMIN`), Immutable Audit Logging with Mandatory Reasons.
  - `TASK P3.7`: Frontend for AI Operations, AI Manager Console (`AiManagerPage.tsx`) with Queue Meters & Priority Reordering, Admin Read-Only Health Dashboard (`AdminAiHealthPage.tsx`), Scoped Cyber-Corporate UI (`AiOps.module.css`).
- **Status:** PENDING USER APPROVAL (Zero modifications made pending signoff).

---

## 1. Specification Compliance & Gap Analysis

Comparison of implemented Phase 3 codebase against `docs/CORPVERSE_SPECIFICATION.md` sections relevant to this phase (Sections 16, 17, 18, 19, 20, 21, 21.1, 21.2, 21.3, 30, 31, 32, 33):

### 1.1 AI Gateway Core & Types (Spec Section 16 & Decision D11, D16)

- **Spec Requirements:**
  - AI Gateway is the authoritative single point of entry for generative and evaluation workloads.
  - Business services never call Gemini, OpenAI, or Groq directly.
  - Standardized payloads: `taskType`, `systemInstruction`, `userInput`, `context`, `outputSchema`, `temperature`, `maxTokens`.
  - Structured output validated against JSON schema when `outputSchema` is defined.
  - Architectural guard enforcing zero direct SDK imports outside `server/src/ai/`.
- **Codebase Implementation:** `server/src/ai/types.ts`, `server/src/ai/gateway.ts`, `server/src/ai/provider-router.ts`, `server/src/tests/ai-gateway.test.ts`.
- **Match Status:** **PERFECT MATCH**. Architectural test (`Provider SDK Import Guard`) enforces zero SDK imports across the workspace.

### 1.2 Multi-Provider Adapters (Spec Sections 17, 18, 19 & Decision D16)

- **Spec Requirements:**
  - Gemini: Official Generative Language REST API (`gemini-2.5-flash`), `x-goog-api-key` header auth (never in query params or logs), structured JSON schemas, token counts via `usageMetadata`.
  - OpenAI: Official Chat Completions REST API (`gpt-4o-mini`), Bearer token auth, `json_schema` structured outputs, token counts via `usage`.
  - Groq: Official Chat Completions REST API (`llama-3.3-70b-versatile`), Bearer token auth, `json_schema` structured outputs, token counts via `usage`.
  - Canonical error categorization: `TIMEOUT`, `RATE_LIMIT`, `PROVIDER_ERROR`, `UNAVAILABLE`, `NETWORK`, `AUTH_CONFIG`, `INVALID_REQUEST`.
  - Lightweight, zero-generation-cost `healthCheck()` for each provider.
- **Codebase Implementation:** `server/src/ai/adapters/gemini.adapter.ts`, `server/src/ai/adapters/openai.adapter.ts`, `server/src/ai/adapters/groq.adapter.ts`, docs in `docs/ai/`.
- **Match Status:** **PERFECT MATCH**. All adapters use native `fetch`, eliminating heavy SDK dependencies, resolving model IDs dynamically, and mapping errors to the canonical taxonomy.

### 1.3 AI Infrastructure & Collections (Spec Section 20, Collections 29–33)

- **Spec Requirements:**
  - Collection 29 `aiProviders`: provider code, model ID, priority, status, pool, rate limits, daily quotas, credentials.
  - Collection 30 `aiJobs`: task type, payload, status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `WAITING_FOR_PROVIDER`, `CANCELLED`), attempts, error tracking, idempotency key, result.
  - Collection 31 `aiRequests`: prompt truncation, token estimates, provider, model ID, job reference.
  - Collection 32 `aiResponses`: latency, tokens used, status, error category, request reference.
  - Collection 33 `aiHealthLogs`: old status, new status, reason, latency, timestamp.
- **Codebase Implementation:** `server/src/models/AIProvider.ts`, `server/src/models/AIJob.ts`, `server/src/models/AIRequestLog.ts`, `server/src/models/AIResponseLog.ts`, `server/src/models/AIHealthLog.ts`.
- **Mismatches / Observations:**
  - _Field Naming in AIJob:_ Spec Section 20 Collection 30 names the per-provider attempts tracking `providerAttempts: Map<string, number>`. In `AIJob.ts`, the field was declared as `attemptsPerProvider: Map<string, number>`. Both represent identical data; will add a getter alias if strict spec name parity is desired.
  - _Field Naming in AIProvider:_ Spec Section 20 Collection 29 names the health status field `healthStatus`. In `AIProvider.ts`, the field is named `status`.
  - _Leased Locks in AIJob:_ Added `lockedUntil: Date` and `lockedBy: string` to `AIJob.ts` to implement atomic worker leasing and crash recovery without requiring Redis (Decision D6).

### 1.4 AI Reliability, Worker & Circuit Breaking (Spec Section 21 & Section 33)

- **Spec Requirements:**
  - Fallback triggers: Only retryable transient faults (`TIMEOUT`, `RATE_LIMIT`, `PROVIDER_ERROR`, `UNAVAILABLE`, `NETWORK`) trigger provider fallback.
  - Fast-fail non-retryable errors: `AUTH_CONFIG` and `INVALID_REQUEST` fail immediately without cascading to other providers.
  - Max retries: Up to 3 attempts per provider before moving to next priority provider.
  - Queue hold & auto-resume: When all providers are exhausted, job transitions to `WAITING_FOR_PROVIDER`. Jobs in this state automatically resume when any provider recovers.
  - Worker: Polling worker processing queue with atomic claiming so two workers never claim the same job.
- **Codebase Implementation:** `server/src/ai/health-tracker.ts`, `server/src/ai/worker.ts`, `server/src/tests/ai-reliability.test.ts`.
- **Match Status:** **PERFECT MATCH**. Atomic `findOneAndUpdate` claiming prevents duplicate worker processing; exponential backoffs and zero-token probes (`probeAndRecover()`) safely manage circuit breaking.

### 1.5 AI Manager Backend, Key Vault & RBAC (Spec Section 20 & Decision D10, D11)

- **Spec Requirements:**
  - Key Vault: AES-256-GCM encryption with server master key (`AI_KEY_VAULT_SECRET`); raw keys never returned in API responses or logs; masked keys in UI/API (`sk-••••••••1234`).
  - Dynamic Priority: Updating priority alters routing fallback order; disabled providers are skipped.
  - RBAC Separation: Mutations restricted to `platformRole === 'AI_MANAGER'`; `ADMIN` has read-only access to health and usage telemetry; `AI_MANAGER` cannot access `/api/admin/*`.
  - Two Pools: `DEMO` (env-configured) and `PIPELINE` (db-configured).
  - Audit Logging: Every mutation records an immutable `AuditLog` entry with mandatory `reason`.
- **Codebase Implementation:** `server/src/utils/crypto.ts`, `server/src/services/ai/aiManager.service.ts`, `server/src/controllers/aiManager.controller.ts`, `server/src/routes/aiManager.routes.ts`, `server/src/routes/admin.routes.ts`, `server/src/tests/ai-manager.test.ts`.
- **Match Status:** **PERFECT MATCH**. Authenticated encryption and decryption pass round-trip and tamper tests; Mongoose `select: false` and `toJSON` transforms prevent credential leakage.

### 1.6 AI Operations Frontend (Spec Section 20 & ADR-035)

- **Spec Requirements:**
  - AI Manager Console (`/ai-ops`): Provider list with status badges, priority drag/reorder, add/edit/disable/remove modals with confirmations, upstream test ping button, usage and failure charts, queue depth meter, and waiting jobs alerts.
  - Admin Read-Only AI Health (`/admin/ai-health`): Provider health matrix, queue telemetry, error logs, and zero mutation controls.
  - Credential masking: Masked keys displayed everywhere (`sk-••••••••1234` or `••••••••1234`), password-type inputs for new keys.
- **Codebase Implementation:** `client/src/pages/AiManagerPage.tsx`, `client/src/pages/AdminAiHealthPage.tsx`, `client/src/pages/AiOps.module.css`, `client/src/api/aiOps.ts`, `client/src/tests/aiOps.test.tsx`.
- **Match Status:** **PERFECT MATCH**. Real-time queue meters, accessible Move Up/Down priority reordering, mandatory audit reason prompts on all modals, and full design system token integration.

---

## 2. Test, Lint & Build Verification Report

Executed on local environment:

| Check                   | Workspace           | Command                      | Status     | Details                                                 |
| :---------------------- | :------------------ | :--------------------------- | :--------- | :------------------------------------------------------ |
| **Server Unit Tests**   | `@corpverse/server` | `npm run test`               | **PASSED** | 279 passed, 3 skipped (live smoke) across 14 suites     |
| **Client Unit Tests**   | `@corpverse/client` | `npm run test`               | **PASSED** | 52 passed across 8 suites                               |
| **Total Monorepo**      | Root                | `npm test --workspaces`      | **PASSED** | **331 passed**, 3 skipped (100% passing rate)           |
| **ESLint**              | Root                | `npm run lint`               | **PASSED** | 0 errors, 0 warnings across all files                   |
| **Prettier**            | Root                | `npm run format:check`       | **PASSED** | 100% code style compliance                              |
| **TypeScript (Server)** | `@corpverse/server` | `tsc -p tsconfig.build.json` | **PASSED** | 0 compilation errors                                    |
| **Vite Build (Client)** | `@corpverse/client` | `tsc && vite build`          | **PASSED** | Built production bundle in 6.61s (291 kB JS, 53 kB CSS) |

---

## 3. Hardcoded Numbers That Belong in PlatformConfig

During code inspection, the following hardcoded numbers and thresholds were identified in Phase 3 components that should ideally be sourced from `PlatformConfig`:

| Location                                 | Variable / Constant                | Current Value | Suggested PlatformConfig Path               | Rationale                                                         |
| :--------------------------------------- | :--------------------------------- | :------------ | :------------------------------------------ | :---------------------------------------------------------------- |
| `server/src/ai/worker.ts:45`             | `pollIntervalMs`                   | `2000` (2s)   | `platformConfig.ai.workerPollIntervalMs`    | Queue polling interval should be tunable in production.           |
| `server/src/ai/worker.ts:46`             | `leaseDurationMs`                  | `30000` (30s) | `platformConfig.ai.workerLeaseDurationMs`   | Worker crash-recovery lock lease duration.                        |
| `server/src/ai/worker.ts:48`             | `maxAttemptsPerProvider` (default) | `3`           | `platformConfig.ai.retryPerProvider`        | Worker currently defaults to 3; should directly read from config. |
| `server/src/ai/worker.ts:100`            | Batch drain limit per tick         | `5`           | `platformConfig.ai.workerBatchSize`         | Max jobs claimed in a single tick should be configurable.         |
| `server/src/ai/health-tracker.ts:26`     | `failureThreshold`                 | `3`           | `platformConfig.ai.circuitBreakerThreshold` | Consecutive failure count triggering temporary degradation.       |
| `server/src/ai/health-tracker.ts:27`     | `rateLimitBackoffMs`               | `60000` (60s) | `platformConfig.ai.rateLimitBackoffMs`      | Backoff duration when encountering HTTP 429.                      |
| `server/src/ai/health-tracker.ts:28`     | `tempFailInitialBackoffMs`         | `30000` (30s) | `platformConfig.ai.circuitBreakerBackoffMs` | Initial recovery backoff before health probing.                   |
| `server/src/ai/health-tracker.ts:34`     | `promptSummary` maxLen             | `200` chars   | `platformConfig.ai.maxPromptSummaryLength`  | Truncation length for logging prompts in `aiRequests`.            |
| `server/src/schemas/aiManager.schema.ts` | `priority` min/max                 | `1` – `100`   | `platformConfig.ai.priorityRange`           | Numerical priority bounds for fallback routing.                   |

---

## 4. Places Where AI Output Can Reach Persistent State Without Schema Validation & Backend Clamping

**Critical Rule Check:**

> "React only displays values; it never decides EXP, CorpCoin, level, warnings, company balance, roles, or permissions. AI recommends; the backend decides. AI returns scores, text, and structured recommendations. Backend code calculates and writes EXP, CorpCoin, roles, promotion, demotion, termination, company finances, and permissions. AI output is always validated against a strict schema and clamped."

### Audit Results:

1. **Current State:**
   - In Phase 3, AI output is persisted **ONLY** in `aiJobs.result` (the raw completed asynchronous job outcome) and `aiResponses` (the telemetry observability log).
   - **Zero business collections** (`users`, `profiles`, `expTransactions`, `corpCoinTransactions`, `companies`, `jobApplications`, `taskSubmissions`) are modified by `AIGateway`, `AIWorker`, or `AIManagerService`.
2. **Schema Validation Enforcement:**
   - Both `AIGateway.execute()` and `AIWorker.tick()` execute `validateAgainstSchema(response.structuredData, outputSchema)` whenever `outputSchema` is provided in the request payload.
   - If the output does not conform to the schema, an `AIError` with category `INVALID_REQUEST` is thrown; the job is marked `FAILED` or retried, and invalid data is **never** accepted as a successful result.
3. **Freeform Text Considerations:**
   - For conversational requests without an `outputSchema`, freeform raw text is placed in `aiJobs.result.content`. This is expected for open-ended prompts, but no numerical ratings or career decisions are extracted from raw content without structured schemas.
4. **Prerequisite for Upcoming Phases (Phase 4 & Phase 5):**
   - When downstream services consume AI job results (e.g., ATS scoring in P4, interview evaluations in P4, task assessments in P5), they **must** pass Zod schemas to `AIGateway.submit()` and apply deterministic mathematical clamping (e.g. `Math.max(0, Math.min(task.maxExp, score))`) before writing ledger transactions.

---

## 5. Inventions Not in the Spec or Approved Decisions

The following implementation details were introduced during Phase 3 that were not explicitly predefined in `docs/CORPVERSE_SPECIFICATION.md`:

1. **`QueueStatsDto` in `GET /api/ai-manager/health-usage`:**
   - _Description:_ Enriched the health-usage telemetry endpoint to aggregate counts from `AIJobModel` (`depth`, `pending`, `processing`, `waitingForProvider`, `completed`, `failed`, `total`).
   - _Justification:_ Explicitly requested by user in prompt P3.7 ("queue depth and waiting jobs") and confirmed prior to implementation.
2. **Worker Lease Fields in `AIJobModel` (`lockedUntil`, `lockedBy`):**
   - _Description:_ Added leasing timestamps to the job document for atomic claiming and crash recovery.
   - _Justification:_ Required by Decision D6 (in-process MongoDB queue without Redis) to satisfy the spec invariant: "two workers never process one job."
3. **Field Naming Variations:**
   - `attemptsPerProvider` in `AIJobModel` vs `providerAttempts` in Spec Section 20 Collection 30.
   - `status` in `AIProvider` vs `healthStatus` in Spec Section 20 Collection 29.
4. **Button-Based Priority Reordering in UI:**
   - _Description:_ Implemented accessible "Move Up" and "Move Down" buttons with instant optimistic and server-synchronized priority updates rather than a third-party drag-and-drop library.
   - _Justification:_ Satisfies prompt P3.7 requirements while maintaining zero external UI dependencies and ensuring mobile touch compatibility.
5. **Admin Oversight Mode Warning Banner:**
   - _Description:_ Amber notification banner on `/admin/ai-health` explaining that Admin has read-only diagnostic visibility while mutation controls belong exclusively to the AI Manager.
   - _Justification:_ Enforces and visually reinforces Spec Section 20 RBAC separation.
6. **Mock Provider Adapter (`MockAdapter`):**
   - _Description:_ Fully programmable in-memory provider adapter (`server/src/ai/adapters/mock.adapter.ts`) with configurable failure simulations and call logs.
   - _Justification:_ Essential for fast, offline, and deterministic unit and reliability testing without calling live external APIs.

---

## 6. Recommendations for User Approval

Before proceeding to **TASK P2.4 (Resume Ingestion Engine)**, the following cleanup items are submitted for review:

1. **Config Binding:** Bind `AIWorker.pollIntervalMs`, `leaseDurationMs`, and `maxAttemptsPerProvider` directly to `ConfigService` / `PlatformConfig` rather than internal defaults.
2. **Schema Aliasing:** Add virtual getters or alias fields in `AIJobModel` (`providerAttempts` -> `attemptsPerProvider`) and `AIProvider` (`healthStatus` -> `status`) to ensure 100% strict spec naming parity.
3. **Commit & Push:** Commit all Phase 3 changes to Git and push to remote repository.
