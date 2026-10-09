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
- [ADR-035: AI Operations Frontend Architecture, AI Manager Console, and Admin Health Telemetry](#adr-035-ai-operations-frontend-architecture-ai-manager-console-and-admin-health-telemetry)
- [ADR-037: Domains and Skills Catalogs, Admin Domain Management, Case-Insensitive Display Names, and Authoritative Onboarding State Transitions](#adr-037-domains-and-skills-catalogs-admin-domain-management-case-insensitive-display-names-and-authoritative-onboarding-state-transitions)
- [ADR-038: Gamified Learning Color System & Apple-Level Polish Tokens (Dark & Light)](#adr-038-gamified-learning-color-system--apple-level-polish-tokens-dark--light)
- [ADR-039: Native Vector Iconography, Illustrations & Apple Fluid Spring Animations](#adr-039-native-vector-iconography-illustrations--apple-fluid-spring-animations)
- [ADR-040: Resume Binary Storage in MongoDB GridFS, Magic-Byte Integrity Verification, and Archive & Preserve Lifecycle Policy](#adr-040-resume-binary-storage-in-mongodb-gridfs-magic-byte-integrity-verification-and-archive--preserve-lifecycle-policy)
- [ADR-041: Server-Side Text Extraction, AI Resume Parsing Pipeline, Zero-Fabrication Guardrails & Output Validation](#adr-041-server-side-text-extraction-ai-resume-parsing-pipeline-zero-fabrication-guardrails--output-validation)
- [ADR-042: Guided Candidate Profile Setup Flow, Resume Dropzone Ingestion, Polling Telemetry & Side-by-Side Review Screen](#adr-042-guided-candidate-profile-setup-flow-resume-dropzone-ingestion-polling-telemetry--side-by-side-review-screen)
- [ADR-043: Companies, Job Postings and Employee Roster Data Models, Startup Seeding and REST Operations](#adr-043-companies-job-postings-and-employee-roster-data-models-startup-seeding-and-rest-operations)
- [ADR-044: Enterprise Directory and Job Board Presentation Architecture, Domain & Seniority Filters, and Apply Quota UX](#adr-044-enterprise-directory-and-job-board-presentation-architecture-domain--seniority-filters-and-apply-quota-ux)
- [ADR-045: Job Application Data Model, Authoritative 8-Stage Pipeline State Machine, and Lifecycle REST APIs](#adr-045-job-application-data-model-authoritative-8-stage-pipeline-state-machine-and-lifecycle-rest-apis)
- [ADR-046: ATS Screening Evaluation Engine, Output Schema Enforcement & Authoritative Backend Decisions](#adr-046-ats-screening-evaluation-engine-output-schema-enforcement--authoritative-backend-decisions)
- [ADR-047: Dedicated Groq Resume Parsing Pipeline, Task-Specific Quota Isolation & Strict Schema Compliance](#adr-047-dedicated-groq-resume-parsing-pipeline-task-specific-quota-isolation--strict-schema-compliance)
- [ADR-048: Reusable Multi-Stage Chat Engine (SCREENING, ASSESSMENT, INTERVIEW)](#adr-048-reusable-multi-stage-chat-engine-screening-assessment-interview)
- [ADR-049: Final Review Multi-Stage Synthesis, Offer Negotiation Chat with Authoritative Clamping, and Atomic Acceptance Lifecycle](#adr-049-final-review-multi-stage-synthesis-offer-negotiation-chat-with-authoritative-clamping-and-atomic-acceptance-lifecycle)
- [ADR-050: Design Token Canonical Spacing Scale and CSS Variable Backward-Compatibility Aliasing](#adr-050-design-token-canonical-spacing-scale-and-css-variable-backward-compatibility-aliasing)

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

### ADR-036: Automated Seeding and Live Monitoring of DEMO Pool Providers from Environment Variables

- **Status:** ACCEPTED
- **Decision:**
  - Automated Startup Seeding: When the server boots and connects to MongoDB (`server/src/server.ts`), `AIManagerService.seedDemoPoolFromEnv()` inspects `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `GROQ_API_KEY` defined in `server/.env`.
  - Idempotent Database Registration: For each present key, if no corresponding provider exists in the `aiProviders` collection for `pool: 'DEMO'`, a record is created with initial status `HEALTHY`, encrypted API key in the AES-256-GCM vault, masked API key (`sk-••••••••1234` or `••••••••1234`), default priorities (`gemini: 1`, `openai: 2`, `groq: 3`), and default model IDs (`gemini-2.5-flash`, `gpt-4o-mini`, `llama-3.3-70b-versatile`). Subsequent server restarts execute idempotently without duplicating entries.
  - Active Adapter Registration: Instantiates and registers corresponding provider adapters in `ProviderRouter` for the `DEMO` pool immediately upon boot and dynamically on-the-fly if missing during test pings, ensuring the AI Operations Console **Demo Pool (ENV)** tab provides immediate monitoring, live health status pills, test pings, and telemetry without requiring manual provider re-entry.

### ADR-037: Domains and Skills Catalogs, Admin Domain Management, Case-Insensitive Display Names, and Authoritative Onboarding State Transitions

- **Status:** ACCEPTED
- **Decision:**
  - **Domains & Skills Collections:** Stored in separate MongoDB collections `domains` (Spec Section 20, Collection 5) and `skills` (Collection 6). The `domains` collection is seeded on boot idempotently with exactly the 3 v1 domains (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`). Skills are seeded with domain associations and queryable via `GET /api/skills?domainCode=...`.
  - **Admin Domain CRUD:** Protected by `authenticateJwt` and `requirePlatformRole('ADMIN')`. Supports creation (`POST /api/admin/domains`), querying, updates (`PATCH /api/admin/domains/:id`), and deactivation (`DELETE /api/admin/domains/:id`). All administrative domain mutations write immutable records to `auditLogs` with mandatory justification reasons.
  - **Decoupled Profiles & Case-Insensitive Display Names:** The `profiles` collection (Collection 2) maintains a strict 1-to-1 linkage via indexed `userId`. Case-insensitive uniqueness for `displayName` is enforced via MongoDB collation index (`{ locale: 'en', strength: 2 }`) and regex validation in `ProfileService.isDisplayNameAvailable()`, rejecting collisions (e.g. "Elena Rostova" vs "elena rostova") with 409 Conflict.
  - **Onboarding Step Tracking:** Candidates advance through explicit sequential onboarding stages: `EMAIL_VERIFIED` $\rightarrow$ `NAME` $\rightarrow$ `DOMAIN` $\rightarrow$ `SKILLS` $\rightarrow$ `RESUME` $\rightarrow$ `REVIEW` $\rightarrow$ `COMPLETE` via `PATCH /api/profile/step`.
  - **Mandatory vs Optional Field Enforcement:** Per Spec Section 5.1, `displayName`, `domain`, and `skills` (at least 1) are mandatory. All links (`githubUrl`, `linkedinUrl`, `portfolioUrl`), `bio`, `projects`, `certifications`, and `resumeId` are strictly optional. Candidates can complete onboarding without supplying optional fields.
  - **Authoritative Single-Method Role Transition:** Promotion to `careerRole = 'JOB_SEEKER'` happens exclusively within the single backend service method `completeOnboarding()` upon validating mandatory fields. Any client request attempting to supply or mutate `careerRole` (via `POST /api/profile/setup`, `PUT /api/profile/me`, or `PATCH /api/profile/step`) is strictly stripped and ignored.

### ADR-038: Gamified Learning Color System & Apple-Level Polish Tokens (Dark & Light)

- **Status:** ACCEPTED
- **Context:** The frontend required an evolution toward a modern, unique gamified design language with Apple-level visual polishing, continuous squircle curvature, specular glass highlights, and fatigue-free contrast across both dark and light display modes.
- **Decision:**
  - Adopted the 6-swatch Gamified Learning canonical color palette:
    - `#EFF4F8` (_Child of Light_): Light mode canvas and dark mode primary text.
    - `#C5D0CF` (_Winter Garden_): Soft sage/frosted sea-glass for borders, badge highlights, and secondary text in dark mode.
    - `#A1A19C` (_Charon_): Mineral slate/neutral stone for dividers and muted elements.
    - `#706255` (_Smokehouse_): Warm roasted mocha for grounding brand accents, tags, and gamified badges.
    - `#273E41` (_Cascades_): Hero Nordic pine spruce teal anchor for primary brand ramps, high-contrast actions, and focus states.
    - `#020101` (_Vantablack_): Absolute obsidian black for crisp light mode text and deep dark mode foundation.
  - Implemented Apple-grade design system refinements in `client/src/styles/tokens.css` and `themes.css`:
    - SF Pro / Inter typography stack with tighter tracking (`-0.01em` to `-0.02em`) and enhanced font rendering.
    - Multi-stop diffused ambient + key shadows avoiding harsh single-drop shadows.
    - Specular glass top highlights (`inset 0 1px 0 rgba(255, 255, 255, ...)`) across cards, modals, and buttons.
    - Apple squircle corner radii (`--cv-radius-md: 10px`, `--cv-radius-lg: 16px`, `--cv-radius-xl: 22px`, `--cv-radius-2xl: 30px`).
    - Smooth Apple spring curve transitions (`cubic-bezier(0.16, 1, 0.3, 1)`).
    - Slim discrete scrollbars with smooth rounded thumbs and customized non-jarring text selection highlights.

### ADR-039: Native Vector Iconography, Illustrations & Apple Fluid Spring Animations

- **Status:** ACCEPTED
- **Context:** System emojis (`✨`, `🏆`, `💼`, `📋`, `🏢`, `⚡`, `🚀`, `🤖`, `🪙`, `☀️`, `🌙`, etc.) suffered from operating-system fragmentation, visual inconsistency, and lack of thematic harmony with the Gamified Learning palette. An Apple-grade vector icon and animation system was required to replace all emojis across navigation, economic pills, action buttons, onboarding wizards, and empty states.
- **Decision:**
  - Implemented a zero-dependency native SVG icon and vector illustration library (`client/src/components/ui/Icon/Icon.tsx`):
    - 24×24 pixel-grid vector symbols: `BriefcaseIcon`, `ClipboardListIcon`, `BuildingIcon`, `ZapIcon`, `TrophyIcon`, `SparklesIcon`, `RocketIcon`, `BotIcon`, `ShieldCheckIcon`, `BrainCircuitIcon`, `CoinIcon`, `SunIcon`, `MoonIcon`, `BarChartIcon`, `FolderEmptyIcon`, `MenuIcon`, `CloseIcon`, `CheckIcon`, `ActivityIcon`, `LaptopIcon`, and `CloudIcon`.
    - Dynamic sizing, theme-reactive `currentColor` binding, and smooth SVG hover micro-interactions.
    - Vector Illustrations: `EmptyApplicationIllustration` (layered frosted desk document with soft teal shadows) and `FounderBadgeIllustration` (3D squircle metallic badge with golden amber laurel and Cascades spruce sheen).
  - Implemented Apple Fluid Spring Animations in `client/src/styles/globals.css`:
    - `@keyframes cv-spring-press`: Tactile spring compression on button and control clicks (`scale(0.96) -> scale(1)`).
    - `@keyframes cv-float-ambient`: Gentle ambient floating animation (`.cv-float`).
    - `.cv-spring-interactive`: Interactive hover elevate and active scale spring transform utility.
  - Replaced all emojis in [Sidebar.tsx](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/client/src/components/layout/Sidebar.tsx), [Topbar.tsx](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/client/src/components/layout/Topbar.tsx), [EmptyState.tsx](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/client/src/components/ui/EmptyState/EmptyState.tsx), [ProfileSetupPage.tsx](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/client/src/pages/ProfileSetupPage.tsx), and [ShowcasePage.tsx](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/client/src/pages/ShowcasePage.tsx).

### ADR-040: Resume Binary Storage in MongoDB GridFS, Magic-Byte Integrity Verification, and Archive & Preserve Lifecycle Policy

- **Status:** ACCEPTED
- **Context:** Candidate resume documents represent core simulation artifacts used for ATS screening, conversational AI interviews, and skill verification. Files must be verified at the binary level, stored in MongoDB GridFS, protected by strict download authorization, and governed by an explicit replace/delete policy.
- **Decision:**
  - **Storage Subsystem:** Raw binary files are stored in MongoDB GridFS using bucket `resumes` (`resumes.files` and `resumes.chunks`), with metadata stored in the `resumes` collection (`ResumeFile` model) referencing `gridFsFileId`, `userId`, `filename`, `mimeType`, `sizeBytes`, `sha256`, and `status`.
  - **Magic-Byte & Content Validation:** File extensions and client MIME headers are strictly untrusted. The backend inspects binary magic bytes (`%PDF-` for PDF, `PK\x03\x04` with OOXML parts for DOCX). Corrupted files missing end-of-file markers (`%%EOF` for PDF, EOCD `PK\x05\x06` for DOCX) are rejected with HTTP 400 (`CORRUPT_FILE`). Password-protected/encrypted files (PDF `/Encrypt` dictionaries, DOCX zip encryption flags or OLE `EncryptedPackage`) are rejected with HTTP 400 (`PASSWORD_PROTECTED_FILE`). Oversized files exceeding `PlatformConfig.security.resumeMaxSizeBytes` (default 10 MB) are rejected with HTTP 413.
  - **Filename Sanitization:** All incoming filenames are stripped of path traversal patterns (`..`, `/`, `\`), quotes, and special characters, retaining only `[a-zA-Z0-9_\-.]` and appending the verified canonical extension (`.pdf` or `.docx`).
  - **Archive & Preserve Lifecycle Policy:** When a candidate uploads a new resume, previous `ResumeFile` records for that user are marked `status: 'ARCHIVED'`. The underlying GridFS binary files are preserved to maintain an immutable audit trail and historical record for prior job applications. The active candidate profile (`profile.resumeId`) is updated to the newest resume ID.
  - **Streamed Download Authorization:** Streamed downloads (`GET /api/profile/resume/:id/download`) are restricted strictly to the document owner (`userId`) and users with `platformRole === 'ADMIN'`. Non-owners receive HTTP 403 `AUTHORIZATION_ERROR`, and unauthenticated requests receive HTTP 401 `AUTHENTICATION_ERROR`.

### ADR-041: Server-Side Text Extraction, AI Resume Parsing Pipeline, Zero-Fabrication Guardrails & Output Validation

- **Status:** ACCEPTED
- **Context:** Following binary resume upload and GridFS ingestion, raw candidate resumes must be transformed into structured profile data (contact, technical skills, employment history, education, certifications, and domain classification) to power automated ATS screening and dynamic AI interviews. Scanned image PDFs without text layers and LLM hallucination risks necessitate strict safeguards against data fabrication.
- **Decision:**
  - **Verified Extraction Engine:** Integrated verified npm packages `pdf-parse` (v2.4.5) for PDF text streams and `mammoth` (v1.13.0) for DOCX OpenXML payloads in `TextExtractionService`. Pagination artifacts (e.g., `-- 1 of 1 --`) and excess whitespace are normalized.
  - **Scanned PDF & Blank Detection:** Enforced an alphanumeric character threshold of 40 characters. Documents yielding fewer than 40 alphanumeric characters are immediately flagged as `status: 'SCANNED_UNREADABLE'` with `failureReason: 'SCANNED_PDF_NO_TEXT'`. The system strictly halts further pipeline execution, avoiding any AI calls and preventing synthetic or fabricated information from entering candidate records.
  - **Zero-Fabrication Prompting:** Engineered a strict system instruction explicitly forbidding the LLM from inventing, assuming, inferring, or extrapolating candidate details. Any attribute missing from the source text must be omitted or returned as null/empty.
  - **Strict Zod Output Validation:** Implemented canonical Zod schema `resumeAnalysisOutputSchema` validating all extracted attributes (name, contact, skills, education, experience, projects, certifications, domain classification clamped to `CAREER_DOMAINS`, and non-negative years of experience).
  - **Queue Retry Integration & Zero-Dirty-Data Guarantee:** Enhanced `AIWorker` with a task validator hook. If LLM output fails Zod validation, `AIWorker` throws a retryable `PROVIDER_ERROR`, incrementing attempts and triggering provider retries (up to 3 attempts) or fallback priority cascading. Unvalidated or malformed AI data is never written to `resumeAnalyses`.
  - **Decoupled Collection 4 Model:** Stored parsed results in `ResumeAnalysis` (`resumeAnalyses` collection) referencing `resumeId` and `userId`. Upon successful completion, the candidate's `Profile.resumeAnalysisId` is automatically linked.
  - **Secure Telemetry & Results Endpoints:** Exposed `GET /api/profile/resume/analysis` (caller's active resume analysis) and `GET /api/profile/resume/:id/analysis` (by resume ID). Restricted strictly to document owner and users with `platformRole === 'ADMIN'`. Returns clear status representations (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `SCANNED_UNREADABLE`, and `WAITING_FOR_PROVIDER`).

### ADR-042: Guided Candidate Profile Setup Flow, Resume Dropzone Ingestion, Polling Telemetry & Side-by-Side Review Screen

- **Status:** ACCEPTED
- **Context:** Spec Sections 4, 5, 28 mandate a guided multi-step candidate onboarding flow in the React frontend. Candidates must verify their email, register a unique display name, select from the 3 canonical engineering tracks, tag technical competencies, drag-and-drop their resume for GridFS upload, observe AI Gateway analysis progress, compare their entered profile data against AI-extracted resume records in a side-by-side review screen, and complete profile activation. Page refresh must seamlessly resume from the saved backend step.
- **Decision:**
  - **Sequential Step Model with Backend Invariant Parity:** Configured 6 onboarding steps matching the authoritative backend progression (`NAME` -> `DOMAIN` -> `SKILLS` -> `RESUME` -> `ANALYSIS` -> `REVIEW` -> `COMPLETE` / Celebration). Backward navigation across reached steps is permitted, while forward jumps beyond the current step are strictly disabled.
  - **State Restoration on Mount:** On initial page load, `ProfileSetupPage` executes a single restoration lifecycle (`hasRestoredRef`) calling `onboardingApi.getProfile()` to prefill form fields and mapping `user.onboardingStep` to the appropriate active step (e.g., `DOMAIN` resumes at Skills, `RESUME` resumes at Analysis/Review).
  - **Unverified Email Notification:** Displayed an amber warning banner if `user.emailVerified === false`, providing a one-click resend trigger calling `POST /api/auth/resend-verification` and displaying simulation dev links.
  - **Client-Side File Validation & Progress Telemetry:** Implemented drag-and-drop and file-picker dropzone accepting only `.pdf` and `.docx` within the 10 MB limit. Streaming progress is visualized using `ProgressBar`.
  - **Asynchronous Analysis Polling & Queue State Handling:** While on Step 5, the client polls `GET /api/profile/resume/analysis` at a 2-second interval. It handles all states: `WAITING_FOR_PROVIDER` (informational queue banner), `SCANNED_UNREADABLE` (advisory warning with manual progression option), `FAILED` (retry or re-upload options), and `COMPLETED` (automatic progression to Review).
  - **Side-by-Side Review Comparison:** Rendered a two-column responsive grid contrasting candidate-entered profile data (left) with AI-extracted entities from `ResumeAnalysis` (right), including contact details, domain classification, experience years, skills, education, and work history. All optional fields (bio, GitHub, LinkedIn, portfolio) are explicitly marked with `(Optional)` tags.
  - **Authoritative Activation:** Clicking "Create Profile & Activate Role" calls `onboardingApi.updateStep({ step: 'REVIEW', ... })` followed by `onboardingApi.completeOnboarding()`, which authoritatively sets `careerRole: 'JOB_SEEKER'` and `onboardingStep: 'COMPLETE'`, followed by session refresh and celebratory activation view.

### ADR-043: Companies, Job Postings and Employee Roster Data Models, Startup Seeding and REST Operations

- **Status:** ACCEPTED
- **Context:** Spec Section 6 and Decision D13 require modelling `Company`, `CompanyJob`, and `CompanyEmployee` entities, startup seeding of 3 PLATFORM companies using the PIPELINE AI provider pool, public querying and filtering of companies and open jobs, and admin-only mutation endpoints with append-only audit logging. Applications and founder company lifecycles remain strictly out of scope for P5.1.
- **Decision:**
  - **Data Models:**
    - `Company` (`companies` collection): `type` ('PLATFORM' | 'FOUNDER'), `isPlatformCompany` (boolean synchronized pre-save), `ownerId` (nullable, null for PLATFORM, ObjectId for FOUNDER), `name` (unique index), `domainsHired` (array of `CareerDomain`), `status` ('ACTIVE' | 'BANKRUPT' | 'SUSPENDED'), `ratings` (`overall`, `culture`, `workLife`, `technicalExcellence`, `reviewCount`), `companyRating` (mirrored bidirectionally with `ratings.overall`), `employeeCount`, `maxEmployees` (seeded from `PlatformConfig.company.maxEmployees`), `financialHealth` (default 0 for platform companies), `aiProviderPool: 'PIPELINE'`.
    - `CompanyJob` (`companyJobs` collection): `companyId`, `domain` (`CareerDomain`), level range (`minLevel`, `maxLevel` clamped 1-10), `title`, `description`, `requiredSkills`, `openings`, `status` ('OPEN' | 'CLOSED'), `isOpen` (boolean synchronized pre-save). Compound indexes on `(companyId, status)`, `(domain, status)`, and `(minLevel, maxLevel)`.
    - `CompanyEmployee` (`companyEmployees` collection): `userId`, `companyId`, `domain`, `level`, `positionTitle` (synchronized with canonical career level title), `status` ('ACTIVE' | 'TERMINATED' | 'DEMOTED' | 'UNDER_REVIEW'), `history` array recording timestamps, previous/new status, and reason, `startedAt`, `endedAt`. Compound index on `(companyId, status)` and `(userId, status)`.
  - **Startup Seeding (D13 Approved Baseline):**
    - Idempotently configured and seeded 3 PLATFORM companies on server bootstrap via `CompanyService.seedPlatformCompanies()`:
      1. `Nexus Enterprise Systems`: High-throughput enterprise backends, cloud workflows, and automated reasoning pipelines (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
      2. `CloudScale Infrastructure`: Distributed multi-cloud orchestration, site reliability engineering, and MLOps platforms (`CLOUD_ENGINEERING`, `SOFTWARE_ENGINEERING`, `AI_ENGINEERING`).
      3. `Synthetix AI Labs`: Next-generation generative agents, deep learning pipelines, and autonomous tooling (`AI_ENGINEERING`, `SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`).
    - Seeded at least 1 active job per hired domain for each platform company with level range, required skills, and openings.
    - Seeding is strictly idempotent: existing records are checked by company name and job title before insert.
  - **Public & Admin REST APIs:**
    - Public: `GET /api/companies`, `GET /api/companies/:id`, `GET /api/jobs` (with domain, minLevel, maxLevel, keyword search filters), `GET /api/jobs/:id`.
    - Admin mutations: `POST /api/admin/companies`, `PATCH /api/admin/companies/:id`, `POST /api/admin/jobs`, `PATCH /api/admin/jobs/:id`, `DELETE /api/admin/jobs/:id`.
    - Protected by `authenticateJwt` and `requirePlatformRole('ADMIN')`.
    - Every admin mutation requires an explicit `reason` string (min 10 characters) and creates an immutable audit record via `AuditService.record()` with action `ADMIN_MUTATION`.

### ADR-044: Enterprise Directory and Job Board Presentation Architecture, Domain & Seniority Filters, and Apply Quota UX

- **Status:** ACCEPTED
- **Context:** Following the implementation of backend company and job models and REST APIs in TASK P5.1, the frontend presentation layer requires polished, responsive views allowing candidates to explore enterprise organizations, review company profiles and culture ratings, filter job openings by engineering track and seniority level, inspect detailed position requirements, and view application quota states ahead of the full application engine in Phase 6.1.
- **Decision:**
  - **Client API Layer (`client/src/api/career.ts`):** Implemented strongly typed API client methods (`careerApi.getCompanies`, `careerApi.getCompany`, `careerApi.getJobs`, `careerApi.getJob`) wrapping public backend endpoints with query parameter serializations for search keywords, domain chips, and level ranges.
  - **Enterprise Directory (`/companies`):** Built `CompaniesPage.tsx` displaying cards with enterprise name, type badge (`Platform Enterprise` vs `Founder Startup`), domain tags (`Software`, `Cloud`, `AI & ML`), employee capacity (`employeeCount / maxEmployees`), overall rating (`★ 4.8 / 5.0`), and open positions badge. Includes responsive search and domain filter chips.
  - **Enterprise Profile Detail (`/companies/:id`):** Built `CompanyDetailPage.tsx` featuring an executive overview banner, multi-dimensional rating breakdown (Overall, Culture, Work-Life, Technical Excellence), employee count, and live list of open job requisitions linking directly to job details.
  - **Job Board & Filter Controls (`/jobs`):** Built `JobsPage.tsx` with keyword search, career domain filter chips, seniority level range dropdown (Junior L1-L3, Mid L4-L6, Senior & Lead L7-L10), and position cards displaying role title, employer name, level badge, openings count, and required skills chips.
  - **Position Detail & Application Quota UX (`/jobs/:id`):** Built `JobDetailPage.tsx` providing full role description, required technical competencies, progression and rewards summary, company profile card, and an **Apply Section**:
    - Displays active application quota indicator (`0 / 5 Active Applications`, conforming to `PlatformConfig.applications.maxActive`).
    - Prominent `Apply for Position` button explicitly set to `disabled={true}` with informational note stating application submission unlocks in Phase 6.1.
  - **Design System Polish & Responsive Behavior:** Utilized Gamified Learning design tokens, Apple squircle borders, native SVG icons (`SearchIcon`, `StarIcon`, `UsersIcon`, `ChevronRightIcon`), and responsive grid layouts tested across mobile, tablet, and desktop viewports.

### ADR-045: Job Applications Data Model, Single Authoritative State Machine & Lifecycle Endpoints

- **Status:** ACCEPTED
- **Context:** Spec Section 7, 26 Collection 11, and 27.4 define the 8-stage hiring pipeline, max 5 active applications per candidate, and terminal states. An authoritative state machine module was needed to ensure all transitions follow strict linear progression, forbid illegal state jumps, maintain immutable stage history records, and enforce mode-agnostic (`PRODUCTION` vs `DEMO`) and company-agnostic operations without separate code paths.
- **Decision:**
  - **Data Model (`ApplicationModel` in `applications` collection):**
    - Fields: `userId`, `jobId`, `companyId`, `mode` (`'PRODUCTION' | 'DEMO'`, default `'PRODUCTION'`), `currentStage` (`ApplicationStage`, default `'APPLIED'`), `status` (`ApplicationStatus`, default `'ACTIVE'`), `resumeAnalysisId`, `resumeAnalysisSnapshot` (immutable copy of skills, domain, education, projects, certifications at application time), `stageHistory` array (`stage`, `enteredAt`, `exitedAt`, `result`), `atsScore`, `atsBreakdown`, `atsFeedback`, `interviewScore`, `rejectionReason`, `withdrawalReason`, `expiryReason`, timestamps.
    - Compound indexes: `{ userId: 1, status: 1 }` (for fast quota counting), `{ userId: 1, jobId: 1, status: 1 }` (for uniqueness on active applications), `{ companyId: 1, currentStage: 1 }`, `{ jobId: 1, status: 1 }`.
  - **Single Authoritative State Machine (`ApplicationStateMachine`):**
    - Implemented `server/src/services/career/applicationStateMachine.ts` through which all stage and status changes must execute.
    - Allowed linear forward transitions: `APPLIED` -> `ATS_SCREENING` -> `SCREENING` -> `ASSESSMENT` -> `INTERVIEW` -> `FINAL_REVIEW` -> `OFFER` -> `ACCEPTED`.
    - Allowed terminal transitions:
      - `REJECTED`: permitted from any non-terminal stage.
      - `WITHDRAWN`: permitted from any non-terminal stage upon candidate action.
      - `EXPIRED`: permitted from any non-terminal stage upon staleness.
      - `ACCEPTED`: only permitted from `OFFER` stage upon candidate acceptance.
    - Strictly throws on: any transition from terminal status (`REJECTED`, `WITHDRAWN`, `EXPIRED`, `ACCEPTED`), stage skipping (e.g. `APPLIED` -> `SCREENING`), backward transitions, self-transitions without status change, and invalid stage/status inputs.
    - Authoritatively maintains `stageHistory`, timestamping `exitedAt` on preceding open entries and recording transition outcomes.
  - **Service & REST APIs:**
    - `POST /api/applications`: Requires `careerRole === 'JOB_SEEKER'`, completed profile, completed `ResumeAnalysis`, checks active applications $< 5$ (`PlatformConfig.applications.maxActive`), rejects duplicate active application for same job (409 Conflict), checks job is `OPEN` and company is `ACTIVE`.
    - `POST /api/applications/:id/withdraw`: Transitions active application to `WITHDRAWN`, releasing the candidate's active application quota.
    - `GET /api/applications` and `GET /api/applications/:id`: Query and retrieve application details with populated company and job references.
    - `runApplicationExpiryJob` / `expireStaleApplications(staleDays)`: Background job discovering stale active applications older than cutoff date and marking them `EXPIRED`.

### ADR-046: ATS Screening Evaluation Engine, Output Schema Enforcement & Authoritative Backend Decisions

- **Status:** ACCEPTED
- **Context:** Spec Sections 7, 8, 26 (Collections 15 & 16), and 27.4 mandate the ATS Screening stage. A dedicated AI job (`ATS_SCREEN` / `ATS_EVALUATION`) must be submitted with contextual grounding referencing the candidate's verified resume and profile. Crucially, per Architecture Principles, AI only recommends (PASS/FAIL) while backend authoritatively decides progression using `PlatformConfig.ats.passingScore` (default 70). Rejections must store actionable, grounded feedback in `feedbacks`, and all evaluations must be recorded in `evaluations`.
- **Decision:**
  - **AI Task Type & Strict Schema:** Added `ATS_SCREEN` to `AITaskType` and `AI_TASK_TYPES` in `server/src/ai/types.ts`. Created `atsScreeningOutputSchema` and `atsScreeningJsonSchema` enforcing strict fields: `matchScore` (0-100), `matchedSkills`, `missingSkills`, `strengths` (min 1, grounded in resume), `weaknesses`, `improvementSuggestions` (min 1), and `recommendation` (`PASS` | `FAIL`).
  - **Models (`evaluations` & `feedbacks`):**
    - `EvaluationModel` (`evaluations` collection per Spec 26.15): `applicationId`, `stage: 'ATS_SCREENING'`, `score` (0-100), `scoreBreakdown`, `summary`, indexed on `{ applicationId: 1, stage: 1 }`.
    - `FeedbackModel` (`feedbacks` collection per Spec 26.16): `applicationId`, `userId`, `rejectionStage: 'ATS_SCREENING'`, `strengths`, `weaknesses`, `actionableSuggestions`, indexed on `{ applicationId: 1 }`, `{ userId: 1 }`.
    - `ApplicationModel`: Added `aiJobId` reference to track the associated AIJob.
  - **Authoritative Backend Decision:**
    - Loads `passingScore` from `configService.getAtsConfig()` (default 70).
    - Clamps `matchScore` to `0..100`.
    - `isPassing = clampedScore >= passingScore`. The backend decision overrides the AI's `recommendation`.
    - If `isPassing`: advances stage to `SCREENING` via `ApplicationStateMachine.advanceStage`, sets `application.atsScore`, persists `Evaluation` record.
    - If `!isPassing`: transitions to `REJECTED` via `ApplicationStateMachine.reject`, sets `application.atsScore`, formats detailed feedback string in `application.atsFeedback`, persists `Evaluation` record, and creates `Feedback` record.
  - **Worker Hooks & Queue Resilience:**
    - Registered strict Zod validator on `AIWorker` for `ATS_SCREEN` and `ATS_EVALUATION`.
    - Registered completion handler on `AIWorker` triggering authoritative evaluation upon AI job success.
    - Registered state change handler: when jobs enter `WAITING_FOR_PROVIDER` during provider downtime, the application remains in `ATS_SCREENING` stage, status `ACTIVE`, waiting safely in queue without failing or rejecting.
  - **API Endpoints:**
### ADR-047: Dedicated Groq Resume Parsing Pipeline, Task-Specific Quota Isolation & Strict Schema Compliance

- **Status:** ACCEPTED
- **Context:** Resume parsing is a foundational onboarding utility that should not consume or risk exhausting the platform's primary AI tokens (reserved for multi-turn interview simulations, daily engineering tasks, and company simulation). A user can provide a dedicated `GROQ_RESUME_API_KEY` specifically for resume parsing to ensure zero quota depletion on primary keys, fast extraction (< 3s), and high accuracy.
- **Decision:**
  - **Environment & Key Isolation:** Added `GROQ_RESUME_API_KEY` to `server/src/config/env.ts` and `server/.env.example`. When present, `GroqAdapter` specifically uses `GROQ_RESUME_API_KEY` for `taskType === 'RESUME_ANALYSIS'`. All other platform tasks continue using primary provider keys.
  - **Gateway Preference Routing:** Added `preferredProvider?: AIProvider` to `AIGatewayExecuteOptions`, `AIGatewaySubmitOptions`, and `AIJobModel`. `ResumeAnalysisService` requests `preferredProvider: 'groq'` whenever `GROQ_RESUME_API_KEY` is configured.
  - **Startup Seeding in Both Pools:** Updated `seedDemoPoolFromEnv` in `aiManager.service.ts` to idempotently seed both `DEMO` and `PIPELINE` pools from environment variables at server bootstrap, ensuring pipeline jobs immediately find active adapters.
  - **Strict JSON Schema Compliance:** Updated `resumeAnalysisJsonSchema` in `resumeAnalysis.schema.ts` to strictly require `additionalProperties: false` across all objects, explicit `required` lists, and nullable types (`type: ['string', 'null']`) for optional properties, fulfilling strict OpenAI/Groq structured output constraints.
  - **Live Verification:** Verified with live Groq execution on model `openai/gpt-oss-120b` and `openai/gpt-oss-20b`, achieving full entity extraction and Zod schema compliance in ~2.5s.

### ADR-048: Reusable Multi-Stage Chat Engine (SCREENING, ASSESSMENT, INTERVIEW)

- **Status:** ACCEPTED
- **Context:** Specification Sections 7, 8, 26 (Collections 12-14), 27.5, and Decision D12 context dictate three multi-turn conversational stages: `SCREENING`, `ASSESSMENT`, and `INTERVIEW`. Rather than creating three disjointed systems, the platform requires one unified, reusable `StageEngine` configured per stage and per application mode (`PRODUCTION` vs `DEMO`), backed by authoritative backend scoring and AI-powered question synthesis, turn evaluation, and diagnostic feedback on rejection.
- **Decision:**
  - **PlatformConfig Extension:** Added `stageSettingsSchema` and `stagesConfigSchema` (`PlatformConfig.stages`) configuring `questionCount`, `difficulty` (`EASY` | `MEDIUM` | `HARD`), `passingScore` (0-100), `demoQuestionCount`, and `demoDifficulty` for each chat stage (`screening`: 3 Qs / MEDIUM / 70; `assessment`: 3 Qs / HARD / 70; `interview`: 5 Qs / HARD / 75; demo defaults: 1 Q / EASY).
  - **Mongoose Data Models:**
    - `InterviewModel` (`interviews` collection per Spec 26.12): tracks session metadata, stage, current question index, total questions, difficulty, passing score, status (`IN_PROGRESS`, `WAITING_AI`, `COMPLETED`, `ABANDONED`), and final overall score. Unique index on `{ applicationId: 1, stage: 1 }`.
    - `QuestionModel` (`questions` collection per Spec 26.13): records each dynamically synthesized question, sequence number, expected key points, and difficulty. Unique index on `{ interviewId: 1, sequenceNumber: 1 }`.
    - `AnswerModel` (`answers` collection per Spec 26.14): stores candidate responses alongside AI evaluations (clamped score 0-100, strengths, weaknesses, notes). Unique index on `{ questionId: 1 }`.
  - **AI Task Types & Strict Schemas (`stageChat.schema.ts`):**
    - `INTERVIEW_QUESTION`: forced output schema `{ question, type, difficulty, expectedPoints }`.
    - `INTERVIEW_EVALUATION`: forced output schema `{ score: number (0-100), strengths: string[], weaknesses: string[], notes: string }`.
    - `STAGE_FEEDBACK`: forced output schema `{ whatToImprove: string[], whatToAdd: string[], skillsToWorkOn: string[], summary: string }`.
  - **Contextual Grounding & Conversation Trimming:**
    - Questions are dynamically synthesized using candidate profile skills, resume summary, job title, and verified prior QA history.
    - History is trimmed to a strict token/character budget (`MAX_HISTORY_CHAR_BUDGET = 8000`), preserving the most recent Q&A turns to stay within provider context limits.
  - **Authoritative Backend Scoring & Progression:**
    - AI only provides recommendations (turn scores and critique).
    - Upon answering the final question, the backend calculates the arithmetic average of all stored turn scores.
    - If `averageScore >= stageSettings.passingScore`: advances stage via `ApplicationStateMachine.advanceStage` (`SCREENING` $\rightarrow$ `ASSESSMENT` $\rightarrow$ `INTERVIEW` $\rightarrow$ `FINAL_REVIEW`), records `Evaluation` document, and marks interview `COMPLETED`.
    - If `averageScore < stageSettings.passingScore`: transitions application to `REJECTED` via `ApplicationStateMachine.reject`, invokes AI for structured diagnostic feedback, persists `Feedback` and `Evaluation` documents, and marks interview `COMPLETED`.
  - **Sequence & Concurrency Guards:**
    - Strictly prevents duplicate answers for the same question (`409 Conflict`).
    - Strictly prevents out-of-order submissions or question skipping (`400 Business Rule Violation`).
    - Prevents answers on completed sessions or when an AI evaluation is currently processing (`WAITING_AI`).
  - **Chat-Shaped REST APIs:**
    - `GET /api/applications/:id/stage` (and alias `GET /api/applications/:id/interview`): returns current stage state, active question, and history.
    - `POST /api/applications/:id/stage/messages` (and alias `POST /api/applications/:id/interview/messages`): accepts `{ candidateResponse, questionSequence? }`, evaluates turn, and returns either `{ evaluation, nextQuestion }` or final completion outcome `{ evaluation, isCompleted: true, passed, overallScore, nextStage?, feedback? }`.

### ADR-049: Final Review Multi-Stage Synthesis, Offer Negotiation Chat with Authoritative Clamping, and Atomic Acceptance Lifecycle

- **Status:** ACCEPTED
- **Context:** Spec Section 7, Decision D12, and verified platform rules dictate the final hiring progression stages: `FINAL_REVIEW`, `OFFER`, and `ACCEPTED`. After completing chat stages, the pipeline must:
  1. Aggregate stage scores (`ATS_SCREENING`, `SCREENING`, `ASSESSMENT`, `INTERVIEW`) into an authoritative weighted final score using `PlatformConfig` weights, with advisory AI executive summary synthesis.
  2. Generate a formal employment offer using simulated salary bands for the job's level from `PlatformConfig.career.salaryBands`.
  3. Support a conversational negotiation chat where candidate requests adjustments, advisory AI responds, backend authoritatively clamps final salary to the level band, and limits rounds per config (`maxNegotiationRounds: 3`, demo: 1). EXP is non-negotiable.
  4. Perform atomic acceptance: checks company capacity (`< maxEmployees`), creates `CompanyEmployee` document, updates candidate `User.careerRole = 'EMPLOYEE'`, increments `Company.employeeCount`, sets application to `ACCEPTED`, and automatically withdraws competing active applications.
- **Decision:**
  - **PlatformConfig Extensions:**
    - `salaryBands` in `PlatformConfig.career`: array of 10 level bands (L1 $45k–$60k through L10 $340k–$420k).
    - `finalReview` in `PlatformConfig.stages`: `atsWeight: 15`, `screeningWeight: 20`, `assessmentWeight: 30`, `interviewWeight: 35`, `passingScore: 70`.
    - `offer` in `PlatformConfig.stages`: `maxNegotiationRounds: 3`, `demoMaxNegotiationRounds: 1`, `declineStatus: 'WITHDRAWN'`.
    - Typed getters added to `configService`: `getSalaryBands()`, `getSalaryBandForLevel(level)`, `getFinalReviewSettings()`, `getOfferSettings()`.
  - **AI Task Types & Schemas (`offer.schema.ts`):**
    - `FINAL_REVIEW_SUMMARY`: forced output schema `{ summary: string (min 10), recommendations: string[] }`.
    - `OFFER_NEGOTIATION`: forced output schema `{ aiResponse: string, counterOfferSalary?: number }`.
    - Endpoint request schemas: `negotiateOfferBodySchema` (`{ message, requestedSalary? }`) and `declineOfferBodySchema` (`{ reason? }`).
  - **Application Model Extensions (`Application.ts`):**
    - `finalReview` subdocument: stores stage scores, weights, finalScore, passingScore, isPassing, summary, recommendations, evaluatedAt.
    - `offer` subdocument: stores positionTitle, level, salarySimulated, salaryMin, salaryMax, negotiationRoundsLeft, maxNegotiationRounds, negotiationHistory (`[{ round, candidateMessage, requestedSalary?, aiResponse, counterOfferSalary?, timestamp }]`), status (`OFFERED`, `ACCEPTED`, `DECLINED`, `EXPIRED`), offeredAt, acceptedAt, declinedAt, declineReason.
  - **Authoritative Service (`FinalReviewOfferService`):**
    - `executeFinalReview`: aggregates stage scores from `EvaluationModel` / `InterviewModel` / `Application` via formula: `finalScore = round((ats*15 + scr*20 + ass*30 + int*35) / 100)`. Invokes AI for summary. If `finalScore >= 70`: advances stage to `OFFER`, generates initial offer at midpoint of salary band, initializes negotiation rounds from config. If `< 70`: rejects application (`REJECTED`) with diagnostic feedback stored in `feedbacks` and `evaluations`.
    - `getOffer`: returns active offer terms and remaining negotiation rounds.
    - `negotiateOffer`: checks rounds left $> 0$, executes AI turn, calculates counter-offer, strictly clamps to `[salaryMin, salaryMax]`, records round in negotiation history, decrements rounds remaining. EXP remains non-negotiable.
    - `acceptOffer`: runs within MongoDB session/transaction when replica sets are enabled (graceful fallback in test environments); checks company capacity (`employeeCount < maxEmployees`), fails with clear error `Company has reached its maximum employee capacity (20 employees)` if full; prevents double acceptance; creates `CompanyEmployee` with status `ACTIVE`; updates user `careerRole = 'EMPLOYEE'`; increments `company.employeeCount`; transitions application to `ACCEPTED`; and withdraws competing active applications with `WITHDRAWN_ACCEPTED_OTHER_OFFER`.
    - `declineOffer`: transitions application to `WITHDRAWN` (or `REJECTED` per config), freeing active application quota.
  - **REST API Endpoints:**
    - `POST /api/applications/:id/final-review`
    - `GET /api/applications/:id/offer`
    - `POST /api/applications/:id/offer/negotiate`
    - `POST /api/applications/:id/offer/accept`
    - `POST /api/applications/:id/offer/decline`

### ADR-050: Design Token Canonical Spacing Scale and CSS Variable Backward-Compatibility Aliasing

- **Status:** ACCEPTED
- **Context:** In `JobsPage` and `CompaniesPage`, filter controls and search inputs displayed overlapping content and collapsed padding. Investigation revealed that `Career.module.css` referenced `var(--cv-spacing-*)` while `tokens.css` defined the 4px-base spacing scale as `var(--cv-space-*)`. Under CSS specification rules for custom properties, declarations referencing undefined CSS variables are invalid at computed-value time and revert to initial values (`0`), which collapsed padding and gaps.
- **Decision:**
  - Enforce `--cv-space-*` as the canonical design token convention across all client CSS modules.
  - Corrected all 36 occurrences of `var(--cv-spacing-*)` in `Career.module.css` and `CompanyDetailPage.tsx` to `var(--cv-space-*)`.
  - Added backward-compatible CSS alias variables in `tokens.css` (`--cv-spacing-1: var(--cv-space-1);` through `--cv-spacing-16: var(--cv-space-16);`) to safeguard against naming drift and prevent regressions.
  - Enforced `min-height: 40px` and structured flex alignment on `.searchInput` and `.selectInput` in `Career.module.css` matching design system form standards.

### ADR-051: In-App Notification Foundation and Hiring Lifecycle Event Dispatch

- **Status:** ACCEPTED
- **Context:** Spec Section 24 and Section 26.36 dictate that in-app notification records are generated in `notifications` to alert users to critical game events across hiring updates, employee lifecycle, founder alerts, and system announcements. TASK P6.5 requires establishing the notification foundation model, service, and endpoints (`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`), and wiring automated event notifications for the 5 hiring events:
  1. `STAGE_ADVANCED`: emitted when application passes ATS screening or chat-based interview stages.
  2. `APPLICATION_REJECTED`: emitted when an application fails ATS, interview, or final review stages, containing a direct link to `/applications/:id/feedback`.
  3. `OFFER_RECEIVED`: emitted when an application passes final review and advances to the `OFFER` stage, containing a direct link to `/applications/:id/offer`.
  4. `HIRED`: emitted when a candidate accepts an employment offer and is created as a `CompanyEmployee`.
  5. `APPLICATION_EXPIRED`: emitted when stale inactive applications are swept by the background expiry job.
  Additionally, an owner-restricted feedback detail endpoint (`GET /api/applications/:id/feedback`) must return stored feedback for rejected applications.
- **Decision:**
  - **Data Model (`notifications` collection):**
    - Conforms to Spec Section 26.36: `_id`, `userId` (indexed), `type` (enum `NOTIFICATION_TYPES`), `title`, `message`, `isRead` (default `false`), `link` (optional route), `createdAt` (default `Date.now`).
    - Compound indexes: `{ userId: 1, isRead: 1 }` and `{ userId: 1, createdAt: -1 }`.
  - **Service Architecture (`NotificationService`):**
    - `create(params)`: creates notification and logs structured metadata.
    - `list(userId, options)`: paginated listing sorted by `{ createdAt: -1, _id: -1 }`, returning `notifications`, `total`, and `unreadCount`.
    - `markRead(notificationId, userId)`: strictly enforces owner authorization (`403` / `404`) and sets `isRead = true`.
    - `markAllRead(userId)`: atomically marks all unread notifications for a user as read.
  - **REST Endpoints:**
    - `GET /api/notifications` (and `/api/v1/notifications`): paginated notifications list for authenticated user.
    - `PATCH /api/notifications/:id/read` (and `/api/v1/notifications/:id/read`): marks single notification as read (owner-only).
    - `PATCH /api/notifications/read-all` (and `/api/v1/notifications/read-all`): marks all unread as read.
    - `GET /api/applications/:id/feedback`: strictly returns stored feedback for `REJECTED` applications belonging to the requesting user (`403` for non-owners, `400` if not rejected, `404` if not found).
  - **Lifecycle Hook Points:**
    - `AtsScreeningService.applyAtsEvaluation`: dispatches `STAGE_ADVANCED` (pass) or `APPLICATION_REJECTED` with link `/applications/:id/feedback` (fail).
    - `StageEngineService.evaluateStageCompletion`: dispatches `STAGE_ADVANCED` (pass) or `APPLICATION_REJECTED` with link `/applications/:id/feedback` (fail).
    - `FinalReviewOfferService.executeFinalReview`: dispatches `OFFER_RECEIVED` with link `/applications/:id/offer` (pass) or `APPLICATION_REJECTED` with link `/applications/:id/feedback` (fail).
    - `FinalReviewOfferService.acceptOffer`: dispatches `HIRED` with link `/employee`.
    - `ApplicationService.expireStaleApplications`: dispatches `APPLICATION_EXPIRED` with link `/applications/:id`.

### ADR-052: Unified Hiring Engine Admin Demo Mode and Production Isolation

- **Status:** ACCEPTED
- **Context:** Spec Sections 23, 27.10, and 42 dictate that Admin Demo Mode must run on the exact same underlying Hiring Engine as production (`AtsScreeningService`, `StageEngineService`, `FinalReviewOfferService`). No separate mock hiring engine is permitted. Demo applications must execute with `mode: 'DEMO'`, route through the isolated `DEMO` provider pool, run against a designated demo company, produce standard structured feedback, and NEVER create real employees, alter user career roles, mutate EXP or CorpCoin ledgers, or contaminate platform rankings. Administrators must be able to parameterize sessions (domain, question count, difficulty, interview type), inspect all stage evaluations and AI telemetry, interact with or simulate the interview lifecycle, and clean up demo records via audited admin operations.
- **Decision:**
  - **Data Model (`DemoSessionModel` in `demoSessions` collection):**
    - Tracks `createdBy`, `applicationId`, `companyId`, `jobId`, `candidateUserId`, `domain`, `difficulty` (`EASY` | `MEDIUM` | `HARD`), `questionsCount` (1–10), `interviewType`, `currentStage`, and `status` (`INITIALIZED` | `IN_PROGRESS` | `COMPLETED` | `FAILED` | `CLEANED_UP`).
    - Compound indexes on `{ createdBy: 1, createdAt: -1 }` and `{ applicationId: 1, status: 1 }`.
  - **Zero Production Contamination Invariants:**
    - Dedicated demo company (`CorpVerse Demo Corporation`) configured with `aiProviderPool: 'DEMO'` and `isPlatformCompany: true`.
    - `ApplicationModel` instantiated with `mode: 'DEMO'`, automatically directing all AI tasks to `pool: 'DEMO'`.
    - In `FinalReviewOfferService.acceptOffer`: if `application.mode === 'DEMO'`, transitions application status to `ACCEPTED` but strictly skips `CompanyEmployee` creation, user `careerRole` changes, company `employeeCount` mutation, and economy ledger calls.
    - Production ranking and leaderboard queries filter by `mode: 'PRODUCTION'` and exclude demo companies.
  - **Admin REST API Endpoints:**
    - `POST /api/admin/demo/hiring`: creates parameterized session with domain, questionsCount, difficulty, and interviewType.
    - `GET /api/admin/demo/hiring/:sessionId`: aggregates all stage results (ATS evaluation/feedback, chat questions/answers, final review, offer) and AI request logs (`AIJob`, latency, tokens).
    - `POST /api/admin/demo/hiring/:sessionId/step`: advances one stage action using authoritative services.
    - `POST /api/admin/demo/hiring/:sessionId/answer`: submits an answer to the active chat question on behalf of candidate.
    - `POST /api/admin/demo/hiring/:sessionId/simulate`: executes full end-to-end automated demo simulation.
    - `DELETE /api/admin/demo/hiring/:sessionId`: deletes demo artifacts for session and records immutable audit log (`DEMO_DATA_CLEANUP`).
    - `DELETE /api/admin/demo/hiring`: purges all demo applications and sessions system-wide, recording audit log (`BULK_DEMO_DATA_PURGE`).

### ADR-053: Hiring Journey Candidate Experience & Chat Interface Architecture

- **Status:** ACCEPTED
- **Context:** Spec Sections 7, 8, 24, 27.4, 28, and 41 require candidate frontend views for navigating the end-to-end recruitment lifecycle:
  1. Application status tracking with quota monitoring (max 5 active applications).
  2. Multi-turn conversational interview simulation for `SCREENING`, `ASSESSMENT`, and `INTERVIEW` stages with real-time AI evaluation.
  3. Structured diagnostic feedback inspection for rejected applications.
  4. Formal employment offer review, interactive compensation negotiation within level bands, and atomic acceptance.
  5. Topbar notifications bell alerting candidates to stage progressions, offers, and hiring events.
- **Decision:**
  - **Authoritative Presentation Layer:** Frontend maintains zero business logic, never calculates passing thresholds or salary bounds, and strictly queries `/api/applications`, `/api/applications/:id/stage`, `/api/applications/:id/offer`, and `/api/notifications`.
  - **Applications Tracker Page (`/applications`):**
    - Active applications quota counter (`x/5`) with visual meter bar reflecting `PlatformConfig.applications.maxActive`.
    - 8-stage visual pipeline stepper (`APPLIED` through `ACCEPTED`) per application card with stage checkmarks, pulse indicators for active stages, and failure indicators for rejected stages.
    - Status badges (`ACTIVE`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`).
    - Voluntary withdrawal action with modal confirmation dialog and optional reason.
  - **Stage Chat Interface (`/applications/:id/stage`):**
    - Conversational bubble dialogue between AI Interviewer Bot and candidate.
    - Question sequence progress meter (`Question X of Y`).
    - Turn evaluation cards attached to candidate responses displaying score pills, strengths, weaknesses, and notes.
    - Pulsing 3-dot typing / waiting indicator during AI turn generation.
    - Strict anti-duplicate submission lock: input and submit button disabled when awaiting AI or during network transit.
  - **Feedback Viewer Modal (`FeedbackModal`):**
    - Consumes `GET /api/applications/:id/feedback` (owner-restricted).
    - Visual tag cloud for missing requisition competencies.
    - Categorized diagnostic lists for demonstrated strengths, improvement areas, and actionable recommendations.
  - **Offer Review & Negotiation Page (`/applications/:id/offer`):**
    - Displays position title, level, simulated annual salary, and visual level salary band indicator.
    - Interactive negotiation chat with round limit counter (`X of Y rounds remaining`).
    - Atomic offer acceptance modal triggering promotion to Employee and withdrawal of competing active applications, followed by workplace transition celebration screen.
    - Offer decline modal transitioning application to Withdrawn.
  - **Topbar Notification Bell (`NotificationBell`):**
    - Real-time unread badge counter in Topbar.
    - Dropdown popover with categorized icon badges (`STAGE_ADVANCED`, `APPLICATION_REJECTED`, `OFFER_RECEIVED`, `HIRED`, `APPLICATION_EXPIRED`), relative timestamps, click-to-read navigation, and "Mark all read" action.

### ADR-054: Admin Demo Hiring Console Architecture

- **Status:** ACCEPTED
- **Context:** Spec Sections 23, 27.10, and 42 require an administrative console enabling platform administrators to run, inspect, and evaluate hiring simulations across all three engineering career domains without contaminating production data, modifying real user roles or balances, or impacting leaderboards.
- **Decision:**
  - **Single Surface Admin Console (`/admin/demo`):**
    - Mount `/admin/demo` in `App.tsx` guarded strictly under `RoleRoute` with `allowedPlatformRoles={['ADMIN']}`.
    - Add navigation entry `Hiring Demo Simulator` in `Sidebar.tsx` under Platform Administration.
  - **Five Core Functional Modules:**
    1. **Parameter Configuration Form:** Allows selection of career domain (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), question count (1–10), difficulty tier (`EASY`, `MEDIUM`, `HARD`), and interview type (`CONCEPTUAL`, `CODING`, `ARCHITECTURE`, `BEHAVIORAL`). Initialized with one-click POST to `/api/admin/demo/hiring`.
    2. **Interactive Candidate Runner:** Implements turn-by-turn chat interface against AI Interviewer Bot questions with candidate answer input (`POST /api/admin/demo/hiring/:sessionId/answer`), stage stepping (`POST /api/admin/demo/hiring/:sessionId/step`), and one-click end-to-end simulation (`POST /api/admin/demo/hiring/:sessionId/simulate`).
    3. **Results Synthesis Dashboard:** Displays stage scores (ATS score, interview turn evaluations, weighted final review calculation, and formal offer compensation terms).
    4. **AI Telemetry & Execution Inspector:** Displays live per-call telemetry including task type, AI provider (`GEMINI`, `OPENAI`, `GROQ`), model ID, latency in milliseconds, token counts (prompt and completion), and execution status.
    5. **Session Management & Audited Cleanup:** Displays past and active demo sessions, single session deletion (`DELETE /api/admin/demo/hiring/:sessionId`), and system-wide bulk purge modal (`DELETE /api/admin/demo/hiring`) requiring mandatory audit justification reasons recorded in the append-only `auditLogs` collection.
  - **Zero Production Mutation Guarantee:** Enforced at backend service level; all demo runs target dedicated demo company (`Nexus Demo Systems`), demo users, and `aiProviderPool: 'DEMO'`.



