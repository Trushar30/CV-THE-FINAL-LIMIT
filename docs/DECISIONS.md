# CorpVerse — Architecture Decision Records (ADRs)

This document tracks all foundational architectural and technical decisions made in CorpVerse. All decisions recorded here are accepted and locked.

---

## Index of Decisions

- [ADR-001: Locked Core Technology Stack](#adr-001-locked-core-technology-stack)
- [ADR-002: Authoritative Backend & Advisory AI Model](#adr-002-authoritative-backend--advisory-ai-model)
- [ADR-003: AI Gateway, Provider Router, and Provider Adapters](#adr-003-ai-gateway-provider-router-and-provider-adapters)
- [ADR-004: Dual-Role Hierarchy Model](#adr-004-dual-role-hierarchy-model)
- [ADR-005: Double-Entry Immutable Ledger System for EXP and CorpCoin](#adr-005-double-entry-immutable-ledger-system-for-exp-and-corpcoin)
- [ADR-006: Centralized PlatformConfig (Zero Magic Numbers)](#adr-006-centralized-platformconfig-zero-magic-numbers)
- [ADR-007: MongoDB-Backed Asynchronous AI Job Queue](#adr-007-mongodb-backed-asynchronous-ai-job-queue)
- [ADR-008: GridFS Resume File Storage with Decoupled Analysis Records](#adr-008-gridfs-resume-file-storage-with-decoupled-analysis-records)
- [ADR-009: Unified Engine for Production Hiring and Admin Demo Mode](#adr-009-unified-engine-for-production-hiring-and-admin-demo-mode)
- [ADR-010: AI Provider Pool Isolation (DEMO Pool vs PIPELINE Pool)](#adr-010-ai-provider-pool-isolation-demo-pool-vs-pipeline-pool)
- [ADR-011: Strict TypeScript Across Monorepo](#adr-011-strict-typescript-across-monorepo)
- [ADR-012: npm Workspaces Monorepo Layout](#adr-012-npm-workspaces-monorepo-layout)
- [ADR-013: Vanilla CSS Design Tokens and CSS Modules](#adr-013-vanilla-css-design-tokens-and-css-modules)
- [ADR-014: React Context and Custom Hooks for Client State](#adr-014-react-context-and-custom-hooks-for-client-state)
- [ADR-015: Protected Routing via React Router](#adr-015-protected-routing-via-react-router)
- [ADR-016: In-Process MongoDB Worker Polling at 2-Second Cadence](#adr-016-in-process-mongodb-worker-polling-at-2-second-cadence)
- [ADR-017: Configurable Provider Model IDs in PlatformConfig](#adr-017-configurable-provider-model-ids-in-platformconfig)
- [ADR-018: ATS Evaluation Formula & Weights](#adr-018-ats-evaluation-formula--weights)
- [ADR-019: REST Architecture for Interview Communication](#adr-019-rest-architecture-for-interview-communication)
- [ADR-020: On-Demand Task Issuance and Deterministic Company Simulation](#adr-020-on-demand-task-issuance-and-deterministic-company-simulation)
- [ADR-021: Standardized Server Core Architecture and Uniform Error Format](#adr-021-standardized-server-core-architecture-and-uniform-error-format)
- [ADR-022: Versioned PlatformConfig Architecture and In-Memory Caching](#adr-022-versioned-platformconfig-architecture-and-in-memory-caching)
- [ADR-023: AI Provider Substitution — Groq API Replacing Grok API](#adr-023-ai-provider-substitution--groq-api-replacing-grok-api)
- [ADR-024: Append-Only Audit Logging and Double-Entry Economic Ledgers](#adr-024-append-only-audit-logging-and-double-entry-economic-ledgers)
- [ADR-025: Client Design System, Responsive App Shell, and Normalized API Client](#adr-025-client-design-system-responsive-app-shell-and-normalized-api-client)
- [ADR-026: User Registration, Argon2id Password Security, and Anti-Enumeration Verification Protocol](#adr-026-user-registration-argon2id-password-security-and-anti-enumeration-verification-protocol)
- [ADR-027: Session Management, Token Rotation, Reuse Detection, Brute-Force Lockout, and Authoritative Auth Middleware](#adr-027-session-management-token-rotation-reuse-detection-brute-force-lockout-and-authoritative-auth-middleware)
- [ADR-028: Candidate Profile Schema, Career Domain Selection, and Authoritative Role Activation](#adr-028-candidate-profile-schema-career-domain-selection-and-authoritative-role-activation)
- [ADR-029: AI Gateway Core Architecture, Normalized Types, Pool Isolation, and Zero Direct SDK Usage](#adr-029-ai-gateway-core-architecture-normalized-types-pool-isolation-and-zero-direct-sdk-usage)
- [ADR-030: Google Gemini Provider Adapter REST Protocol, Header Authentication, and Error Normalization](#adr-030-google-gemini-provider-adapter-rest-protocol-header-authentication-and-error-normalization)
- [ADR-031: OpenAI Provider Adapter Chat Completions Protocol, Bearer Authentication, and Structured Outputs](#adr-031-openai-provider-adapter-chat-completions-protocol-bearer-authentication-and-structured-outputs)
- [ADR-032: Groq Provider Adapter Chat Completions Protocol, Bearer Authentication, and Error Normalization](#adr-032-groq-provider-adapter-chat-completions-protocol-bearer-authentication-and-error-normalization)
- [ADR-033: AI Reliability Layer, Queue Model, Worker Atomic Claiming, and Provider Health Lifecycle](#adr-033-ai-reliability-layer-queue-model-worker-atomic-claiming-and-provider-health-lifecycle)
- [ADR-034: AI Manager Backend, Key Vault (AES-256-GCM), Two-Pool Configuration, and RBAC Separation](#adr-034-ai-manager-backend-key-vault-aes-256-gcm-two-pool-configuration-and-rbac-separation)

---

### ADR-001: Locked Core Technology Stack

- **Status:** ACCEPTED
- **Decision:** React (Vite) + Node.js (Express) + MongoDB (Mongoose) + GridFS + Zod + Argon2id.

### ADR-002: Authoritative Backend & Advisory AI Model

- **Status:** ACCEPTED
- **Decision:** Server is authoritative. AI recommends (0–100 scores); backend calculates, clamps, and mutates persistent state.

### ADR-003: AI Gateway, Provider Router, and Provider Adapters

- **Status:** ACCEPTED
- **Decision:** Three-tier AI Gateway pattern. Business logic never calls external vendor APIs directly.

### ADR-004: Dual-Role Hierarchy Model

- **Status:** ACCEPTED
- **Decision:** `careerRole` (`JOB_SEEKER`, `EMPLOYEE`, `FOUNDER`, `NONE`) and `platformRole` (`NONE`, `ADMIN`, `AI_MANAGER`) stored separately.

### ADR-005: Double-Entry Immutable Ledger System for EXP and CorpCoin

- **Status:** ACCEPTED
- **Decision:** Zero mutations without ledger records in `expTransactions` or `corpCoinTransactions`.

### ADR-006: Centralized PlatformConfig (Zero Magic Numbers)

- **Status:** ACCEPTED
- **Decision:** All gameplay values, thresholds, and limits reside in `PlatformConfig`.

### ADR-007: MongoDB-Backed Asynchronous AI Job Queue

- **Status:** ACCEPTED
- **Decision:** In-database `aiJobs` collection manages asynchronous and buffered operations without Redis.

### ADR-008: GridFS Resume File Storage with Decoupled Analysis Records

- **Status:** ACCEPTED
- **Decision:** Binary uploads streamed into GridFS. Separate documents: `resumes`, `resumeAnalyses`, `profiles`.

### ADR-009: Unified Engine for Production Hiring and Admin Demo Mode

- **Status:** ACCEPTED
- **Decision:** Admin Demo uses the identical production Hiring Engine pipeline.

### ADR-010: AI Provider Pool Isolation (DEMO Pool vs PIPELINE Pool)

- **Status:** ACCEPTED
- **Decision:** AI Gateway maintains separate provider pools with independent keys, quotas, and queues for `DEMO` vs `PIPELINE`.

### ADR-011: Strict TypeScript Across Monorepo

- **Status:** ACCEPTED (Decision D1)
- **Decision:** Enforce TypeScript with `"strict": true` across both frontend (`React + Vite`) and backend (`Node.js + Express`). No unnecessary `any`.

### ADR-012: npm Workspaces Monorepo Layout

- **Status:** ACCEPTED (Decision D2)
- **Decision:** Structure project as an npm workspaces monorepo with root workspaces `/server` (Node + Express) and `/client` (React + Vite). Shared definitions can be integrated either via workspace packages or direct internal imports.

### ADR-013: Vanilla CSS Design Tokens and CSS Modules

- **Status:** ACCEPTED (Decision D3)
- **Decision:** Global design tokens (`styles/tokens.css`, `styles/globals.css`, `styles/themes.css`) paired with component-scoped CSS Modules (`[Component].module.css`). No Tailwind in v1.

### ADR-014: React Context and Custom Hooks for Client State

- **Status:** ACCEPTED (Decision D4)
- **Decision:** Use React Context and custom hooks strictly for Auth, Session, Current user, and Theme. Server data remains server-controlled in MongoDB. No Redux.

### ADR-015: Protected Routing via React Router

- **Status:** ACCEPTED (Decision D5)
- **Decision:** Enforce React Router route guards based on dual permissions (`careerRole` and `platformRole`).

### ADR-016: In-Process MongoDB Worker Polling at 2-Second Cadence

- **Status:** ACCEPTED (Decision D6)
- **Decision:** Background queue runner polls MongoDB every 2 seconds with atomic job claiming (`findOneAndUpdate` on `PENDING`).

### ADR-017: Configurable Provider Model IDs in PlatformConfig

- **Status:** ACCEPTED (Decision D7)
- **Decision:** Do not freeze static model IDs into code. Model IDs for Gemini, OpenAI, and Groq are stored in `PlatformConfig` and configurable at runtime. Default provider priority: Gemini $\rightarrow$ OpenAI $\rightarrow$ Groq (max 3 retries per provider).

### ADR-018: ATS Evaluation Formula & Weights

- **Status:** ACCEPTED (Decision D8)
- **Decision:** ATS score range 0–100, passing threshold 70. Weights: Domain Relevance 40%, Technical Skill Match 35%, Projects/Experience 15%, Resume Clarity/Formatting 10%.

### ADR-019: REST Architecture for Interview Communication

- **Status:** ACCEPTED (Decision D9)
- **Decision:** Chat interview communication uses REST (`POST /applications/:id/interview/messages`). No WebSockets or streaming in v1 to ensure auditability and persistence.

### ADR-020: On-Demand Task Issuance and Deterministic Company Simulation

- **Status:** ACCEPTED (Decisions D10, D12, D17, D19)
- **Decision:**
  - Tasks generated on-demand when employee requests `GET /employee/tasks/today` (1 primary + 1 bonus).
  - Promotion requires EXP + completed task count + average score $\ge 70$ + active warnings $\le 1$.
  - Company simulation uses deterministic formulas:
    - $\text{dailyRevenue} = 100 + (\text{employeeCount} \times \text{averageProductivity} \times 5) + (\text{companyRating} \times 2)$
    - $\text{dailyExpenses} = 50 + (\text{employeeCount} \times 10) + (\text{botCount} \times 10)$
    - $\text{profit} = \text{revenue} - \text{expenses}$
  - Founder daily scenarios stored in dedicated `companyScenarios` collection (`ACTIVE`, `DECIDED`, `EXPIRED`).

### ADR-021: Standardized Server Core Architecture and Uniform Error Format

- **Status:** ACCEPTED
- **Decision:**
  - Express app factory (`createApp`) decoupled from HTTP listener (`server.ts`).
  - Strict Zod environment loading with fail-fast validation (`config/env.ts`).
  - Mongoose connection lifecycle with graceful process shutdown signals (`SIGINT`, `SIGTERM`).
  - Structured JSON logger with automated redaction of sensitive credentials (passwords, tokens, cookies, API keys).
  - Standardized JSON error response shape strictly matching Specification Section 31 (`{ success: false, error: { code, message, details } }`).
  - Generic Zod request validation middleware supporting async schemas across `body`, `query`, and `params`.
  - Security hardening with Helmet, CORS, JSON payload caps, IP rate limiting, and unique `x-request-id` tracking.
  - Health check endpoint at `GET /api/health` exposing service uptime and real-time database connection state.

### ADR-022: Versioned PlatformConfig Architecture and In-Memory Caching

- **Status:** ACCEPTED
- **Decision:**
  - `PlatformConfig` entity enforces zero magic numbers by serving all gameplay parameters, economic limits, ATS weights, provider models, and timeouts from a single authoritative source matching Specification Section 30 and 38.
  - Database schema (`platformConfigs` collection) enforces a single active configuration document using a MongoDB partial unique index on `{ isActive: 1 }` where `{ isActive: true }`.
  - Config updates archive previous records with `isActive: false`, increment `version`, insert a new document with `isActive: true`, and write an immutable audit log record via `IAuditService`.
  - `ConfigService` maintains an in-memory cached copy of the parsed configuration, providing zero-latency reads for business services with atomic invalidation on update.
  - Zod validation enforces boundary conditions: positive EXP/currency, positive task limits, `warningThreshold >= 1`, ATS weights summing to exactly 100, valid AI provider priorities, and security token expiration limits.

### ADR-023: AI Provider Substitution — Groq API Replacing Grok API

- **Status:** ACCEPTED
- **Decision:**
  - Replace xAI Grok with **Groq API** (Groq LPU Cloud) as the third supported AI provider alongside Google Gemini and OpenAI.
  - Server enum `AIProvider` is typed as `'gemini' | 'openai' | 'groq'`.
  - PlatformConfig schema and models track `groqModel` with default fallback `'configured-demo-groq-model'` and `'configured-pipeline-groq-model'`.
  - Server environment specifies `GROQ_API_KEY` with sensitive key logger redaction (`groq_api_key`).
  - Architecture specifications, priority lists (`['gemini', 'openai', 'groq']`), and future Phase 2 AI Gateway adapters align with Groq Cloud.

### ADR-024: Append-Only Audit Logging and Double-Entry Economic Ledgers

- **Status:** ACCEPTED
- **Decision:**
  - `AuditLog` model (`auditLogs` collection) is strictly append-only. Mongoose middleware pre-hooks reject `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `deleteOne`, `deleteMany`, `findOneAndDelete`, and mutating `save()` calls.
  - `AuditService.record()` provides the single entry point for recording audit events without any update or delete methods.
  - `ExpTransaction` (`expTransactions` collection) and `CorpCoinTransaction` (`corpCoinTransactions` collection) serve as immutable double-entry ledgers. Both models enforce Mongoose pre-hooks blocking update and delete operations.
  - `ExpService` executes atomic `$inc` updates on `users.totalExpCached` accompanied by an `expTransactions` entry. EXP is permanent career capital and can never decrease below zero.
  - `CorpCoinService` guarantees zero overdrawing by applying atomic conditional updates: `UserModel.findOneAndUpdate({ _id, corpCoinBalanceCached: { $gte: amount } }, { $inc: { corpCoinBalanceCached: -amount } })`. Race-condition concurrent debits are rejected with `BUSINESS_RULE_VIOLATION` (409) if the balance is insufficient.
  - Verification functions (`recomputeTotalExp`, `recomputeCorpCoinBalance`) aggregate historical ledger transactions via MongoDB aggregation pipelines (`$match`, `$group: { _id: null, total: { $sum: '$amount' } }`) and assert exact equality with the cached user balances.
  - Real `AuditService` is wired into `ConfigService` for production execution, while `IAuditService` interface permits lightweight stubs in unit tests.

### ADR-025: Client Design System, Responsive App Shell, and Normalized API Client

- **Status:** ACCEPTED
- **Decision:**
  - Client styling is implemented strictly with Vanilla CSS design tokens (`tokens.css`, `themes.css`, `globals.css`) and scoped CSS Modules (`[Component].module.css`) without external UI component libraries.
  - Dark theme is default with high-contrast cyber-corporate aesthetics (slate/indigo/cyan/emerald/gold/violet), toggleable to light theme via `ThemeContext` and persisted to `localStorage`.
  - Reusable UI component library created: `Button`, `Input`, `Card`, `Modal`, `Table`, `Badge`, `Toast` (with `ToastProvider`), `Spinner`, `EmptyState`, `ProgressBar`, `Tabs`.
  - Responsive `AppShell` combines sticky desktop Sidebar and collapsible mobile drawer (<1024px/768px/360px), Topbar with role switcher, balance pills, and theme toggle.
  - Route guards (`RoleRoute`, `ProtectedRoute`, `PublicOnlyRoute`) integrate with stub `AuthContext` supporting dual roles (`careerRole` and `platformRole`).
  - `ApiClient` wraps native `fetch` with base URL from environment and normalizes server responses and errors strictly according to Specification Section 31 into `ApiClientError`.

### ADR-026: User Registration, Argon2id Password Security, and Anti-Enumeration Verification Protocol

- **Status:** ACCEPTED
- **Decision:**
  - Password hashing is enforced using Argon2id (`argon2.argon2id`, memory cost 64 MB, time cost 3 iterations, 4 threads) via dedicated utility (`utils/password.ts`).
  - Input validation enforces password complexity: 8–128 characters, uppercase, lowercase, numeric, and special character required.
  - User model initializes uncompleted registrations with `careerRole: 'NONE'`, `platformRole: 'NONE'`, `status: 'ACTIVE'`, `emailVerified: false`, `onboardingStep: 'REGISTERED'`, and synchronized legacy fields (`totalExpCached`, `corpCoinBalanceCached`, `isEmailVerified`, `isSuspended`).
  - Single-use, expiring verification tokens (`EmailVerificationToken` model) store SHA-256 hashes of cryptographically random 32-byte hex strings with 24-hour expiration and `usedAt` replay protection.
  - Decoupled `IEmailService` provides `ConsoleEmailService` in dev/test (recording tokens in-memory and logging verification URLs) and `SmtpEmailService` via nodemailer in production.
  - Registration (`POST /api/auth/register`) and resend verification (`POST /api/auth/resend-verification`) enforce anti-enumeration per Spec Section 32: duplicate email registrations and resend requests for non-existent or verified emails return indistinguishable 200/201 success payloads, concealing account existence.
  - Endpoints are mounted at both `/api/auth` and `/api/v1/auth` with IP sliding-window rate limiters.

### ADR-027: Session Management, Token Rotation, Reuse Detection, Brute-Force Lockout, and Authoritative Auth Middleware

- **Status:** ACCEPTED
- **Decision:**
  - Short-lived Access JWTs (15 minutes, configurable via `PlatformConfig.security.accessTokenMinutes`) contain `{ userId, email, careerRole, platformRole }` signed with server `JWT_SECRET`.
  - Refresh tokens are cryptographically random 40-byte hex strings. Raw values exist only in client `httpOnly`, `Secure` (in prod), `SameSite: strict` (in prod) cookies; stored exclusively as SHA-256 hashes in MongoDB (`refreshTokens` collection) with `family` UUID tracking.
  - Token rotation: `POST /api/auth/refresh` marks the presented refresh token as `isRevoked: true` with `replacedByTokenHash` and issues a fresh rotated token in the same family with an updated cookie.
  - Replay / Reuse Detection: If a previously revoked refresh token is presented to `/refresh`, the entire session family is immediately revoked (`RefreshTokenModel.updateMany({ family }, { isRevoked: true })`), the cookie is cleared, and request rejected with 401.
  - Brute-Force Lockout: Failed login attempts increment `user.failedLoginAttempts`. After reaching `security.maxLoginAttempts` (default 5), `user.lockUntil` is set to `Date.now() + lockoutMinutes * 60 * 1000`. Login attempts during lockout are rejected with `423 ACCOUNT_LOCKED`. Generic error messages ("Invalid email or password") are returned on all failed password checks. Lockout counter resets to 0 upon successful authentication.
  - Authoritative `authenticateJwt` middleware validates Bearer token, fetches user document from MongoDB, and strictly rejects users with status `SUSPENDED` (403) or unverified email (403).
  - Client auth integration: `ApiClient` automatically injects `Authorization: Bearer <token>` when set; `AuthContext` provides real auth state, silent refresh on bootstrap, proactive token renewal, login, register, email verification, and cookie-clearing logout while preserving mock stubs for isolated component tests; dedicated responsive `LoginPage`, `RegisterPage`, and `VerifyEmailPage` replace P1.5 stubs.

### ADR-028: Candidate Profile Schema, Career Domain Selection, and Authoritative Role Activation

- **Status:** ACCEPTED
- **Decision:**
  - Profile entity (`profiles` collection) enforces unique 1-to-1 linkage with `users` collection via indexed `userId`.
  - Career domains locked to Specification Section 5 & 20: `'SOFTWARE_ENGINEERING' | 'CLOUD_ENGINEERING' | 'AI_ENGINEERING'`. Domain is selected during setup and immutable thereafter.
  - Mandatory fields: `displayName`, `domain`, and `skills` (non-empty array, 1-50 tags). Optional fields: `bio`, `githubUrl`, `linkedinUrl`, `portfolioUrl`, `projects`, `certifications`.
  - Endpoint `POST /api/profile/setup` executes authoritative state transition: upon successful profile insertion, user document is updated with `careerRole = 'JOB_SEEKER'` and `onboardingStep = 'PROFILE_COMPLETED'`.
  - Duplicate setup requests are rejected with `409 Conflict` (`BUSINESS_RULE_VIOLATION`).
  - Endpoint `GET /api/profile/domains` serves available domains and recommended skills metadata to power the client setup wizard.
  - Client wizard (`ProfileSetupPage.tsx`) provides 3-step guided flow: domain selector cards, dynamic skill tagger with suggested chips, and activation review. `RoleRoute` naturally redirects candidates with `careerRole: 'NONE'` accessing Job Seeker views to `/profile/setup`.

### ADR-029: AI Gateway Core Architecture, Normalized Types, Pool Isolation, and Zero Direct SDK Usage

- **Status:** ACCEPTED
- **Decision:**
  - Standardized internal AI data contracts: `AIRequest` (`taskType`, `systemInstruction`, `userInput`, `context`, `outputSchema`, `temperature`, `maxTokens`), `AIResponse` (`success`, `provider`, `model`, `requestId`, `content`, `structuredData`, `usage`, `latencyMs`), and `AIError` (`category`, `retryable`, `provider`, `details`).
  - Error normalization into 7 canonical categories: `TIMEOUT`, `RATE_LIMIT`, `PROVIDER_ERROR`, `UNAVAILABLE`, `NETWORK`, `AUTH_CONFIG`, and `INVALID_REQUEST`. Categories `TIMEOUT`, `RATE_LIMIT`, `PROVIDER_ERROR`, `UNAVAILABLE`, and `NETWORK` are marked retryable; `AUTH_CONFIG` and `INVALID_REQUEST` are non-retryable.
  - `IProviderAdapter` contract requiring `generate(request)` and `healthCheck()`.
  - `MockAdapter` provided for deterministic unit and integration testing with programmable errors, delays, structured responses, call histories, and health checks.
  - `ProviderRouter` maintains distinct priority queues and health states across isolated pools (`DEMO` and `PIPELINE`). Only providers in `DISABLED` state are skipped during selection.
  - `AIGateway` serves as the authoritative boundary: executes via highest-priority provider, times execution for `latencyMs`, generates gateway `requestId`, and validates structured output against JSON schema constraints using `validateAgainstSchema`.
  - Zero direct SDK rule enforced via automated architectural test (`Provider SDK Import Guard`), preventing direct imports of `@google/genai`, `openai`, or `groq-sdk` outside `server/src/ai/`.

### ADR-030: Google Gemini Provider Adapter REST Protocol, Header Authentication, and Error Normalization

- **Status:** ACCEPTED
- **Decision:**
  - Implemented `GeminiAdapter` implementing `ProviderAdapter` utilizing the Google Generative Language REST API (`v1beta/models/{model}:generateContent`) via native `fetch`, eliminating external SDK bundle dependencies and passing the SDK import guard.
  - Model ID is dynamically resolved via options/PlatformConfig (e.g., `gemini-2.5-flash`), never hardcoded.
  - API credentials are provided exclusively via the `x-goog-api-key` HTTP request header, completely preventing credential leakage in URL query parameters, proxy logs, and error strings.
  - Structured output is enforced via `generationConfig.responseMimeType = "application/json"` and `generationConfig.responseSchema = request.outputSchema`; responses are parsed into `structuredData`, and parse failures are mapped to `INVALID_REQUEST` AIError.
  - Token consumption is mapped from `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`) into normalized `AIResponse.usage`.
  - Errors are normalized to canonical `AIErrorCategory` per Spec Section 21.1 / 33: 429 -> `RATE_LIMIT` (retryable), AbortError -> `TIMEOUT` (retryable), 500/502/504 -> `PROVIDER_ERROR` (retryable), 503 -> `UNAVAILABLE` (retryable), network drops -> `NETWORK` (retryable), 401/403 -> `AUTH_CONFIG` (non-retryable fast-fail), 400/404 -> `INVALID_REQUEST` (non-retryable fast-fail).
  - Lightweight `healthCheck()` verifies connectivity against `GET v1beta/models/{model}` without executing billable generation tokens.

### ADR-031: OpenAI Provider Adapter Chat Completions Protocol, Bearer Authentication, and Structured Outputs

- **Status:** ACCEPTED
- **Decision:**
  - Implemented `OpenAIAdapter` implementing `ProviderAdapter` using the OpenAI Chat Completions REST API (`POST https://api.openai.com/v1/chat/completions`) via native `fetch`, eliminating third-party SDK dependencies and passing the SDK import guard.
  - Model ID is dynamically resolved from configuration/options (e.g., `gpt-4o-mini`), never hardcoded.
  - API credentials are provided exclusively via standard `Authorization: Bearer <token>` HTTP header, never logged and never in URL query strings.
  - Structured output is enforced via `response_format: { type: "json_schema", json_schema: { name: "structured_response", strict: true, schema: outputSchema } }`; parsed into `structuredData`, with parse failures or empty content mapped to `INVALID_REQUEST` AIError.
  - Token consumption is mapped from `usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`) into normalized `AIResponse.usage`.
  - Errors are normalized to canonical `AIErrorCategory` per Spec Section 21.1 / 33: 429 / `insufficient_quota` -> `RATE_LIMIT` (retryable), AbortError -> `TIMEOUT` (retryable), 500/502/504 -> `PROVIDER_ERROR` (retryable), 503 -> `UNAVAILABLE` (retryable), network drops -> `NETWORK` (retryable), 401/403 -> `AUTH_CONFIG` (non-retryable fast-fail), 400/404 -> `INVALID_REQUEST` (non-retryable fast-fail).
  - Lightweight `healthCheck()` verifies connectivity against `GET https://api.openai.com/v1/models/{model}` without consuming completion tokens.

### ADR-032: Groq Provider Adapter Chat Completions Protocol, Bearer Authentication, and Error Normalization

- **Status:** ACCEPTED
- **Decision:**
  - Implemented `GroqAdapter` implementing `ProviderAdapter` utilizing the Groq Chat Completions REST API (`POST https://api.groq.com/openai/v1/chat/completions`) via native `fetch`, eliminating third-party SDK dependencies (`groq-sdk`) and satisfying the automated architectural SDK import guard.
  - Model ID is dynamically configured via options/PlatformConfig (e.g., `llama-3.3-70b-versatile`), never hardcoded.
  - API credentials are provided exclusively via the `Authorization: Bearer <token>` HTTP header, never logged, and never included in URL query strings.
  - Structured output is enforced via `response_format: { type: "json_schema", json_schema: { name: "structured_response", strict: true, schema: outputSchema } }`; parsed into `structuredData`, with parse failures or empty content mapped to `INVALID_REQUEST` AIError.
  - Token consumption is mapped from `usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`) into normalized `AIResponse.usage`.
  - Errors are normalized to canonical `AIErrorCategory` per Spec Section 21.1 / 33: 429 (`rate_limit_exceeded`) -> `RATE_LIMIT` (retryable), AbortError -> `TIMEOUT` (retryable), 500/502/504 -> `PROVIDER_ERROR` (retryable), 503 -> `UNAVAILABLE` (retryable), network drops -> `NETWORK` (retryable), 401/403 -> `AUTH_CONFIG` (non-retryable fast-fail), 400/404 -> `INVALID_REQUEST` (non-retryable fast-fail).
  - Lightweight `healthCheck()` verifies connectivity against `GET https://api.groq.com/openai/v1/models/{model}` without consuming completion tokens.

### ADR-033: AI Reliability Layer, Queue Model, Worker Atomic Claiming, and Provider Health Lifecycle

- **Status:** ACCEPTED
- **Decision:**
  - Standardized asynchronous AI job management in `aiJobs` collection (`AIJobModel`) with statuses `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `WAITING_FOR_PROVIDER`, and `CANCELLED`.
  - Added sparse unique index on `idempotencyKey` ensuring duplicate `AIGateway.submit()` calls return the existing `jobId` without creating duplicate queue documents.
  - Implemented in-process background `AIWorker` with atomic MongoDB claiming via `findOneAndUpdate` on `{ pool, $or: [{ status: 'PENDING' }, { status: 'RETRYING' }, { status: 'PROCESSING', lockedUntil: { $lt: now } }] }`, supporting crash recovery via leased worker locks (`lockedUntil`, `lockedBy`).
  - Enforced retry & fallback rules per Spec Section 21.1: up to 3 attempts per provider (from `PlatformConfig`), fallback to next priority provider on retryable transient errors (`TIMEOUT`, `RATE_LIMIT`, `PROVIDER_ERROR`, `UNAVAILABLE`, `NETWORK`).
  - Fast-fail non-retryable errors (`AUTH_CONFIG`, `INVALID_REQUEST`): immediately fails job (`FAILED`), sets provider to `DEGRADED`, and prevents cascading attempts to other providers.
  - Jobs in `WAITING_FOR_PROVIDER` hold safely when all providers fail; automatically resume without loss or duplication when any provider recovers (`checkAndResumeWaitingJobs`).
  - Implemented `HealthTracker` managing provider lifecycle states in `aiProviders` (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`), logging telemetry to `aiRequests`, `aiResponses`, and `aiHealthLogs` with prompt truncation and strict credential protection.

### ADR-034: AI Manager Backend, Key Vault (AES-256-GCM), Two-Pool Configuration, and RBAC Separation

- **Status:** ACCEPTED
- **Decision:**
  - Role Separation: Implemented `requirePlatformRole` and `requireCareerRole` middleware. Provider mutation routes (`/api/ai-manager/providers/*`) are restricted strictly to `platformRole === 'AI_MANAGER'`. `ADMIN` is denied mutation access (403), but permitted read-only telemetry access (`/api/ai-manager/health`, `/api/ai-manager/usage`). Standard users (`NONE`) are rejected with 403 on all AI Manager endpoints. AI Managers cannot access Admin-only routes (`/api/admin/*` returns 403).
  - Key Vault & Secret Encryption: Provider API keys added or updated dynamically are encrypted using AES-256-GCM with a server-side master key (`AI_KEY_VAULT_SECRET`) before saving to `aiProviders.encryptedApiKey`. Decryption is performed strictly at runtime during provider adapter execution. Raw API keys are never returned by any endpoint and never logged; only masked strings preserving the last 4 characters (`sk-••••••••1234` or `••••••••1234`) are exposed via `maskedApiKey`. In Mongoose, `encryptedApiKey` is protected with `select: false` and explicitly deleted in `toJSON` transforms.
  - Two Pools (Decision D11): Segregated routing and configuration into `DEMO` pool (seeded from environment variables) and `PIPELINE` pool (managed dynamically in database by AI Manager).
  - Dynamic Routing & Provider Management: AI Manager can create, update, enable, disable, and delete providers, configure custom models, update rate and daily limits, trigger health test pings, and adjust priority orders. Updating priority immediately reorganizes routing order, and disabled providers are cleanly skipped during candidate selection.
  - Mandatory Audit Logging: Every provider mutation (creation, modification, enablement, disablement, deletion) mandates a `reason` parameter ($\ge 3$ characters) and records an immutable entry in `AuditLog` via `AuditService.record()` capturing actor, action, target entity, previous state, new state, and reason.

### ADR-035: AI Operations Frontend Architecture, AI Manager Console, and Admin Health Telemetry

- **Status:** ACCEPTED
- **Decision:**
  - Built dedicated AI Operations UI components and pages using Vanilla CSS design tokens (`AiOps.module.css`) matching the cyber-corporate aesthetic established in P1.5.
  - Implemented `AiManagerPage.tsx` mounted at `/ai-ops` strictly guarded for `platformRole === 'AI_MANAGER'`:
    - Pool switcher (`PIPELINE` vs `DEMO`).
    - Queue Depth meter and Waiting Jobs alert card displaying active asynchronous throughput (`depth`, `pending`, `processing`, `waitingForProvider`, `completed`, `failed`).
    - Dynamic priority reordering (Move Up / Move Down buttons) reflecting instant fallback precedence updates via `PATCH /api/ai-manager/providers/:id/priority`.
    - Modal workflows for Add Provider, Edit Configuration, Disable Provider, and Remove Provider with mandatory audit `reason` prompts.
    - Zero-token / low-cost test ping action (`POST /api/ai-manager/providers/:id/test`) with visual latency and status reporting.
    - Usage & failure telemetry bars with request volume, latency averages, and error counters.
    - Absolute credential masking: raw keys are never displayed or retrievable in the UI; form inputs use password masking, and backend responses only provide masked strings (`sk-••••••••1234`).
  - Implemented `AdminAiHealthPage.tsx` mounted at `/admin/ai-health` strictly guarded for `platformRole === 'ADMIN'`:
    - Read-only diagnostics dashboard with an amber Oversight Mode banner explaining AI Manager domain ownership.
    - Health and failure telemetry matrices across providers with real-time status badges (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`).
    - Zero mutation actions or destructive controls exposed to Admin.
  - Built typed API client module `client/src/api/aiOps.ts` wrapping `/api/ai-manager/*` routes.
  - Updated App router (`App.tsx`) and Sidebar navigation (`Sidebar.tsx`) with proper role guards.
  - Enriched `GET /api/ai-manager/health-usage` with `queueStats` aggregated from `AIJobModel` to power real-time queue depth visualizations.
