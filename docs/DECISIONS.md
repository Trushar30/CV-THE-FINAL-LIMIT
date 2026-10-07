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
- **Decision:** Do not freeze static model IDs into code. Model IDs for Gemini, OpenAI, and Grok are stored in `PlatformConfig` and configurable at runtime. Default provider priority: Gemini $\rightarrow$ OpenAI $\rightarrow$ Grok (max 3 retries per provider).

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
