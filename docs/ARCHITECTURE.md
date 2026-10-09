# CorpVerse — Architecture Blueprint & Technical Specification

## 1. System Overview & Core Principles

CorpVerse is designed around a decoupled, highly resilient, and strictly authoritative client-server architecture.

```
┌────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                │
│    (Pure Presentation Layer — Displays Server State)   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON) + Cookie
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Node.js / Express Backend              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Routes & Middlewares (Auth, Roles, Rate Limits)  │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Controllers (Zod Input Validation)               │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Services (Authoritative Rules & Business Logic)  │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ AI Gateway > Provider Router > Adapters          │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Repositories & Mongoose Models                   │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────┬─────────────┘
                │                          │
                ▼                          ▼
   ┌────────────────────────┐   ┌────────────────────────┐
   │ MongoDB Data & GridFS  │   │ External AI APIs       │
   │ • Collections & State  │   │ • Google Gemini        │
   │ • EXP / Coin Ledgers   │   │ • OpenAI               │
   │ • Audit Logs & Queue   │   │ • Groq                 │
   │ • Binary Resume Files  │   └────────────────────────┘
   └────────────────────────┘
```

### Non-Negotiable Core Principles

1. **The Backend is Authoritative:**
   The frontend is an untrusted presentation layer. It displays values but never computes or directly mutates balances (EXP, CorpCoin), employee levels, warnings, company financial health, roles, or permissions. All decisions and validations happen on the backend.
2. **AI Recommends, Backend Decides:**
   AI models generate scores, unstructured or structured evaluations, and scenario narratives. The backend inspects these outputs, validates them against strict Zod schemas, clamps numeric outputs within safe boundaries, and executes database mutations. Under no circumstances does an LLM prompt or response directly write to user balances or trigger role changes.
3. **Decoupled AI Gateway & Provider Adapters:**
   Business services never directly import or invoke vendor SDKs (Google GenAI, OpenAI, Groq). All AI requests flow through `AIGateway` -> `ProviderRouter` -> `ProviderAdapter`. Companies and bots are provider-agnostic.
4. **Immutable Transaction Ledgers:**
   Balances for EXP and CorpCoin cannot be incremented or decremented without an accompanying entry in `expTransactions` or `corpCoinTransactions`. Every ledger record requires `userId`, `amount`, `balanceAfter`, `type`, `referenceId` / `sourceId`, and a timestamp.
5. **Universal Audit Logging:**
   Every sensitive administrative action (Admin or AI Manager) writes an immutable record to `auditLogs` containing actor identity, action type, target ID, previous state, new state, timestamp, and justification.
6. **Zero Magic Numbers (Centralized PlatformConfig):**
   All business thresholds, economic rates, level boundaries, task limits, and retry policies are defined in a centralized `PlatformConfig` entity. Business logic consumes these values dynamically.
7. **Absolute Credential Isolation:**
   All external API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, JWT secrets) reside exclusively in server-side environment configurations. They are never transmitted to clients or exposed in response payloads.

---

## 2. Layered Monorepo & Backend Structure

The repository is structured with `/server` and `/client` workspaces:

```
server/src/
├── config/             # PlatformConfig, DB connection, environment schema
├── routes/             # Express route definitions grouped by domain
├── controllers/        # Request parsing, Zod validation, HTTP response dispatch
├── services/           # Authoritative business logic, state transitions, ledgers
│   ├── ai/             # AI Gateway, Provider Router, Provider Adapters
│   ├── career/         # Applications, Hiring Engine, Interviews
│   ├── employee/       # Tasks, Evaluations, Warnings, Reviews
│   ├── founder/        # Company Creation, Bot Shop, Daily Scenarios
│   └── economy/        # EXP Ledger, CorpCoin Ledger, Balances
├── repositories/       # Data access abstractions and complex aggregation queries
├── models/             # Mongoose schemas and model definitions
├── middleware/         # Authentication, RBAC, rate-limiting, error handling
├── ai/                 # AI Gateway, Router, Provider adapters
├── jobs/               # Asynchronous queue workers and scheduled jobs
├── utils/              # Helper utilities (magic bytes validation, clamping, hashing)
└── tests/              # Vitest test suite and Supertest integration tests
```

The frontend client structure:

```
client/src/
├── pages/              # Routed view containers
├── components/         # Reusable UI primitives
├── features/           # Domain-specific feature modules
├── api/                # API client definitions
├── hooks/              # Custom React hooks (Auth, Theme)
├── store/              # Context providers and client state
└── styles/             # Design tokens, CSS Modules, global styling
```

---

## 3. Dual-Role Architecture & Access Control

Users possess two orthogonal role dimensions:

```typescript
type CareerRole = 'JOB_SEEKER' | 'EMPLOYEE' | 'FOUNDER' | 'NONE';
type PlatformRole = 'NONE' | 'ADMIN' | 'AI_MANAGER';
```

### Role Separation Matrix

| Role Attribute | Valid Values | Description                                                                    |
| -------------- | ------------ | ------------------------------------------------------------------------------ |
| `careerRole`   | `JOB_SEEKER` | Active job applicant; can apply to jobs (max 5 active), attend interviews.     |
|                | `EMPLOYEE`   | Employed at a platform or founder company; receives daily tasks.               |
|                | `FOUNDER`    | Company owner; manages company, bots, and strategic decisions.                 |
|                | `NONE`       | Assigned to dedicated administrative or system accounts.                       |
| `platformRole` | `NONE`       | Standard user participating in the simulation.                                 |
|                | `ADMIN`      | System administrator with full oversight, configuration rights, and demo mode. |
|                | `AI_MANAGER` | LLM infrastructure operator; manages provider routing, health, and fallbacks.  |

---

## 4. AI Subsystem Architecture

### 4.1 Request & Response Flow

```
Client / Service ──► AIGateway.execute(AIRequest)
                          │
                          ▼
                   ProviderRouter.selectProvider()
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
       GeminiAdapter OpenAIAdapter GroqAdapter
             │            │            │
             ▼            ▼            ▼
         Gemini API   OpenAI API   Groq API
             │            │            │
             └────────────┼────────────┘
                          ▼
            Adapter Normalization Layer
                          │
                          ▼
                  Normalized AIResponse
```

### 4.2 Standard Internal AIRequest Contract

```typescript
interface AIRequest {
  taskType:
    | 'RESUME_PARSING'
    | 'ATS_EVALUATION'
    | 'INTERVIEW_QUESTION'
    | 'INTERVIEW_EVALUATION'
    | 'STAGE_FEEDBACK'
    | 'FINAL_REVIEW_SUMMARY'
    | 'OFFER_NEGOTIATION'
    | 'TASK_GENERATION'
    | 'TASK_EVALUATION'
    | 'SCENARIO_GENERATION'
    | 'SCENARIO_EVALUATION';
  systemInstruction: string;
  userInput: string;
  context?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>; // JSON Schema for structured output
  temperature?: number;
  maxTokens?: number;
}
```

### 4.3 Normalized AIResponse Contract

```typescript
interface AIResponse {
  success: boolean;
  provider: 'gemini' | 'openai' | 'groq';
  model: string;
  requestId: string;
  content: string;
  structuredData?: Record<string, unknown>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

### 4.4 Provider Health States & Circuit Breaking

- **Health States:** `HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`.
- **Retry Policy:** Up to **3 attempts per provider** before tripping fallback.
- **Fallback Trigger Invariants:** Only retryable transient faults trigger fallback:
  - Timeouts (`ETIMEDOUT`, deadline exceeded)
  - HTTP 429 (Rate Limited)
  - HTTP 500, 502, 503, 504 (Server / Service Unavailable)
  - Network dropped connections
- **Fast-Fail Errors (No Fallback):**
  - Authentication / Bad API Key (401/403)
  - Malformed payload or validation schema error (400)
- **AI Queue Buffer:** If all providers in the fallback list fail or are degraded, the request enters the `aiJobs` collection with status `WAITING_FOR_PROVIDER`.
- **AI Job Status Lifecycle:** `PENDING` -> `PROCESSING` -> `COMPLETED` | `FAILED` | `RETRYING` | `WAITING_FOR_PROVIDER` | `CANCELLED`.

---

## 5. Economic & Ledger Subsystem

### 5.1 EXP Ledger Invariant

- EXP tracks accumulated personal career mastery.
- EXP is **permanent**: it is never deducted due to task failure, demotion, termination, or company bankruptcy.
- Schema (`expTransactions`):
  ```typescript
  interface ExpTransaction {
    userId: ObjectId;
    amount: number; // Strictly positive in gameplay awards
    balanceAfter: number;
    type: 'TASK_COMPLETION' | 'ADMIN_ADJUSTMENT';
    sourceId: ObjectId; // e.g. taskSubmissionId
    reason: string;
    createdAt: Date;
  }
  ```

### 5.2 CorpCoin Ledger Invariant

- CorpCoin tracks corporate capital and founder liquidity.
- One-time starter allocation: 1,000 CorpCoin upon unlocking Founder Mode (`founderStarterCoinGranted = true`).
- Schema (`corpCoinTransactions`):
  ```typescript
  interface CorpCoinTransaction {
    userId: ObjectId;
    companyId?: ObjectId;
    amount: number; // Positive (income/grant) or negative (expense/purchase)
    balanceAfter: number;
    type:
      | 'FOUNDER_STARTER_GRANT'
      | 'COMPANY_CREATION'
      | 'BOT_PURCHASE'
      | 'BUSINESS_REVENUE'
      | 'BUSINESS_EXPENSE'
      | 'ADMIN_ADJUSTMENT';
    referenceId?: ObjectId; // e.g. botId, companyId, scenarioId
    reason: string;
    createdAt: Date;
  }
  ```

---

## 6. Resume Ingestion & Storage Architecture (GridFS)

1. **Upload & Binary Verification:**
   - Client sends multipart file (`POST /api/profile/resume/upload` under field `resume` or `file`).
   - Max file size dynamically validated against `PlatformConfig.security.resumeMaxSizeBytes` (default 10 MB); oversized files reject with HTTP 413.
   - Backend authoritative validation (`validateResumeFile` in `utils/fileValidation.ts`):
     - Magic-byte verification (`%PDF-` for PDF, `PK\x03\x04` with OOXML parts for DOCX).
     - Corrupt file rejection (missing `%%EOF` for PDF, missing `PK\x05\x06` EOCD for DOCX).
     - Password protection rejection (PDF `/Encrypt` trailer dictionary, DOCX zip encryption flags or OLE `EncryptedPackage`).
     - Filename sanitization against path traversal (`..`, `/`, `\`) and illegal characters.
2. **GridFS Storage Subsystem:**
   - Raw binary stream is written directly into MongoDB GridFS bucket `resumes` (`resumes.files` and `resumes.chunks`).
3. **Decoupled Entities & Collections:**
   - `resumes` (`ResumeFile` model): Metadata record containing `_id`, `userId`, `gridFsFileId`, `gridFsId`, `filename`, `mimeType`, `sizeBytes`, `sha256`, `status` (`UPLOADED`, `PROCESSING`, `ANALYZED`, `FAILED`, `ARCHIVED`), `createdAt`, and `updatedAt`.
   - `resumeAnalyses`: Asynchronous parsed representation containing extracted technical skills, years of experience, education, domain classification.
   - `profiles`: User profile document referencing `resumeId` and `resumeAnalysisId`. Binary data is never embedded in user documents.
4. **Lifecycle & Streamed Download Authorization (ADR-040):**
   - **Archive & Preserve:** Re-uploading a new resume marks prior resumes for that candidate as `status: 'ARCHIVED'`. Prior GridFS binaries and records are retained for historical audit trails and prior application fidelity. The profile's active `resumeId` is updated to the newest upload.
   - **Streamed Downloads:** `GET /api/profile/resume/:id/download` streams raw file binary directly from GridFS. Strictly restricted to the resume owner (`userId`) and users with `platformRole === 'ADMIN'`. Unauthorized requests reject with HTTP 403 `AUTHORIZATION_ERROR`.
5. **Resume Processing Pipeline & Text Extraction (ADR-041):**
   - **Text Extraction Engine:** `TextExtractionService` (`server/src/services/resume/textExtraction.service.ts`) extracts plain text from GridFS binaries using `pdf-parse` v2 for PDFs and `mammoth` for DOCX files.
   - **Scanned PDF & Blank Document Detection:** An alphanumeric character threshold (< 40 characters) detects scanned PDFs without an OCR layer; sets `status: 'SCANNED_UNREADABLE'` and `failureReason: 'SCANNED_PDF_NO_TEXT'`, immediately halting pipeline execution to strictly prevent AI hallucination or synthetic fabrication.
   - **Zero-Fabrication System Prompt:** A non-invention prompt explicitly forbids the LLM from inventing, assuming, inferring, or extrapolating candidate details. Omitted fields are left null or empty.
   - **Strict Zod Output Validation:** Canonical schema `resumeAnalysisOutputSchema` validates name, contact, skills, education, experience, projects, certifications, domain classification (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), and non-negative experience years.
   - **Queue Retry Integration & Zero-Dirty-Data Guarantee:** `AIWorker` executes task validation before marking jobs complete; on failure, triggers retries up to 3 times before cascading or transitioning to `WAITING_FOR_PROVIDER`. Unvalidated data is never stored in `resumeAnalyses`.
   - **Profile Linkage & Status Telemetry:** Upon success, updates candidate `Profile.resumeAnalysisId`. Endpoints `GET /api/profile/resume/analysis` and `GET /api/profile/resume/:id/analysis` provide full status lifecycle (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `SCANNED_UNREADABLE`, `WAITING_FOR_PROVIDER`).

---

## 7. Unified Hiring Engine & State Machine

The Hiring Engine powers both live company job recruitment and the Admin Demo Mode.

```
APPLIED ──► ATS_SCREENING ──► SCREENING ──► ASSESSMENT ──► INTERVIEW ──► FINAL_REVIEW ──► OFFER ──► ACCEPTED
  │               │               │             │             │              │            │
  └───────────────┴───────────────┴─────────────┴─────────────┴──────────────┴────────────┴──► REJECTED / WITHDRAWN
```

- **Max Active Applications:** 5 active applications per user at any time.
- **Rejection Feedback:** When transitioning to `REJECTED`, an AI-generated audit explanation with actionable improvement recommendations is stored in `feedback`.
- **Demo Mode Isolation:** Admin can trigger simulations specifying domain, question count, and difficulty. It invokes the exact same state machine logic with a mock flag, preserving engine integrity.

---

## 8. Employee Task & Review Lifecycle

1. **Daily Allocation:** 1 Primary Task + 1 Bonus Task per active employee per day.
2. **Difficulty Tiers & Max EXP:**
   - Easy: Max 30 EXP
   - Medium: Max 60 EXP
   - Hard: Max 100 EXP
3. **Deterministic Clamping Formula:**
   $$\text{awardedExp} = \text{round}\left(\frac{\text{aiScore}}{100} \times \text{task.maxExp}\right)$$
   Clamped strictly: $0 \le \text{awardedExp} \le \text{task.maxExp}$.
4. **Warning & Review System:**
   - AI score 0–39 triggers a warning.
   - Warnings have a 30-day expiration window.
   - $\ge 4$ ACTIVE warnings triggers an automatic **Employment Review**.
   - Employment review evaluates whether to demote (level drops by 1, EXP preserved) or terminate (role resets to `JOB_SEEKER`).

### 8.1 Level and EXP Engine Architecture (TASK P7.1, ADR-055)

- **Pure Functions Engine (`services/economy/expEngine.ts`):**
  - `levelForExp(totalExp, levelTable)`: Resolves career level (1–10) deterministically from cumulative EXP against `PlatformConfig.career.levelTable`.
  - `calculateTaskExp(score, maxExp)`: Implements $\text{round}((\text{score} / 100) \times \text{maxExp})$, strictly clamped to $[0, \text{maxExp}]$, handling strings, negative values, and non-finite numbers safely.
  - `performanceBand(score)`: Maps scores into canonical bands: `POOR` (0–39), `NEEDS_IMPROVEMENT` (40–59), `ACCEPTABLE` (60–74), `GOOD` (75–89), `EXCELLENT` (90–100).
  - `getLevelDetails(totalExp, levelTable, founderUnlockExp)`: Computes progress percentages, title, next level threshold, and Founder Mode eligibility ($12,000$ EXP).
- **Service Layer (`services/economy/level.service.ts`):**
  - Authoritative calculation without stale persisted level columns.
  - All EXP awards route through `ExpService.awardExp` with immutable ledger transaction creation in `expTransactions`. Zero direct writes to `totalExp`.
  - Handles 0-EXP outcomes safely without creating zero-amount transactions.
  - Telemetry and level-up detection (`leveledUp: boolean`).

---

## 9. Founder Simulation Engine

- **Unlock Requirements:** 12,000 total accumulated EXP + explicit confirmation modal.
- **Company Constraints:** Exactly 1 active company per founder; maximum 20 employees.
- **Daily Decision Scenarios:**
  - AI generates a realistic contextual business scenario with multiple structured choices.
  - Founder submits a choice.
  - The deterministic simulation engine calculates:
    $$\Delta \text{Revenue}, \Delta \text{Expenses}, \Delta \text{Satisfaction}, \Delta \text{Productivity}, \Delta \text{Reputation}$$
  - Company financial health updates accordingly.
- **Bankruptcy Execution:**
  - Bankruptcy occurs when company financial health $\le -1,000$.
  - Company status marks `BANKRUPT`, employees released, founder returns to `JOB_SEEKER`.
  - Founder retains full personal EXP and historical career record.

---

## 10. Security Architecture

1. **Password Security:** Argon2id with memory-hard parameters.
2. **Brute-Force Protection:** Account lockout after 5 consecutive failed login attempts within 15 minutes.
3. **Session Management:** Short-lived JWT access token passed via Authorization header + long-lived cryptographically signed httpOnly refresh cookie.
4. **Rate Limiting:** IP and user-based sliding window rate limits on public endpoints (auth, file uploads, AI generation requests).
5. **Audit Logging:** Admin and AI Manager mutations require an audit trail record:
   ```typescript
   interface AuditLog {
     actorId: ObjectId;
     actorRole: 'ADMIN' | 'AI_MANAGER';
     action: string;
     targetCollection: string;
     targetId: ObjectId;
     oldValue: Record<string, unknown>;
     newValue: Record<string, unknown>;
     reason: string;
     createdAt: Date;
   }
   ```

---

## 11. Complete MongoDB Data Model Catalog

The MongoDB database contains the following collections across bounded contexts:

### Identity & Profiles

- `users`: Core credentials, `careerRole`, `platformRole`, lock status, timestamps.
- `profiles`: Display name, bio, target domain, skills, links (GitHub, LinkedIn, portfolio).
- `resumes`: GridFS file pointer, mime type, size, upload timestamp.
- `resumeAnalyses`: Extracted skills, summary, structured work history, ATS parsing tokens.

### Taxonomy & Master Data

- `domains`: Career domains (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
- `skills`: Predefined and user-submitted skill catalog with domain tags.
- `platformConfigs`: Single-document configuration store with system-wide parameters.

### Companies & Bots

- `companies`: Company name, description, founder ID, financial health, employee count, status.
- `companyEmployees`: Mapping of employees to companies with current level, salary, joined date.
- `companyBots`: Purchased bot instances (`HIRING_BOT`, `TASK_BOT`, `EVALUATION_BOT`).
- `companyJobs`: Open job postings, requirements, target domain, seniority level.

### Hiring Pipeline

- `applications`: Application state machine record, candidate ID, job ID, current stage, status.
- `assessments`: Assigned technical assessments and scoring sheets.
- `interviews`: Chat interview sessions, transcript pointers, round status.
- `questions`: Generated or curated interview questions.
- `answers`: Candidate answers during interview chat.
- `evaluations`: Stage evaluations with scores and rationale.
- `feedbacks`: Actionable constructive feedback records delivered to candidates.

### Employee Lifecycle

- `employeeTasks`: Assigned daily primary and bonus tasks.
- `taskSubmissions`: User submitted code/answers for tasks.
- `performanceRecords`: Historical performance scores, task aggregates.
- `warnings`: Active and expired performance warnings with 30-day expiration timestamps.
- `promotions`: Historical promotion log.
- `demotions`: Historical demotion log.

### Founder & Simulation

- `founders`: Founder metadata, unlock date, company link.
- `companyDecisions`: Log of founder decisions against daily scenarios.
- `companyFinancials`: Balance sheet history, revenue/expense breakdowns.

### Economy Ledgers

- `expTransactions`: Double-entry transaction ledger for EXP awards.
- `corpCoinTransactions`: Double-entry transaction ledger for CorpCoin movements.

### AI Infrastructure

- `aiProviders`: Configured LLM providers (Gemini, OpenAI, Groq) with health, priority, and credentials references.
- `aiModels`: Model definitions, context windows, default pricing/token costs.
- `aiRequests`: Internal requests logged for observability and debugging.
- `aiResponses`: Normalized responses with token usage and latency.
- `aiJobs`: Persistent queue items for async or buffered AI operations.
- `aiHealthLogs`: Heartbeat and error diagnostics logs for provider circuit breakers.

### System & Operations

- `leaderboards`: Materialized rankings for performance and economy.
- `notifications`: User notification inbox.
- `auditLogs`: Administrative and AI Manager audit trail.

---

## 12. Centralized PlatformConfig Schema & ConfigService

The authoritative system configuration schema is stored as a versioned document in `platformConfigs` (single active document enforced via partial unique index on `{ isActive: 1 }` where `{ isActive: true }`) and cached in-memory with zero-latency typed access:

```json
{
  "version": 1,
  "career": {
    "founderUnlockExp": 12000,
    "maxLevel": 10
  },
  "employee": {
    "primaryTasksPerDay": 1,
    "bonusTasksPerDay": 1,
    "warningThreshold": 4,
    "warningExpirationDays": 30,
    "minimumPromotionScore": 70
  },
  "applications": {
    "maxActive": 5
  },
  "founder": {
    "starterCorpCoin": 1000,
    "companyCreationCost": 100,
    "maxActiveCompanies": 1
  },
  "company": {
    "maxEmployees": 20,
    "bankruptcyThreshold": -1000
  },
  "bots": {
    "hiring": 250,
    "task": 250,
    "evaluation": 250,
    "advancedHiring": 400,
    "advancedTask": 400,
    "advancedEvaluation": 400
  },
  "ats": {
    "passingScore": 70,
    "domainWeight": 40,
    "skillWeight": 35,
    "experienceWeight": 15,
    "formattingWeight": 10
  },
  "ai": {
    "retryPerProvider": 3,
    "timeoutMs": 30000,
    "demoPool": {
      "providerPriority": ["gemini", "openai", "groq"],
      "geminiModel": "configured-demo-gemini-model",
      "openaiModel": "configured-demo-openai-model",
      "groqModel": "configured-demo-groq-model"
    },
    "pipelinePool": {
      "providerPriority": ["gemini", "openai", "groq"],
      "geminiModel": "configured-pipeline-gemini-model",
      "openaiModel": "configured-pipeline-openai-model",
      "groqModel": "configured-pipeline-groq-model"
    }
  },
  "security": {
    "accessTokenMinutes": 15,
    "refreshTokenDays": 7,
    "maxLoginAttempts": 5,
    "lockoutMinutes": 15,
    "resumeMaxSizeBytes": 10485760
  }
}
```

### 12.1 ConfigService Architecture

- **In-Memory Cache:** Parses and validates config on startup/first-read via Zod, storing a clean immutable plain object in memory.
- **Typed Getters:** Direct domain access (`getCareerConfig()`, `getEmployeeConfig()`, `getAtsConfig()`, `getAiConfig()`, etc.).
- **Atomic Cache Invalidation:** `invalidateCache()` wipes the memory cache; `updateConfig()` archives previous version, increments version number, sets new active record, refreshes memory cache, and logs to `IAuditService`.

---

## 13. Audit Logging & Economic Ledger Architecture

### 13.1 Append-Only Audit Logging (`auditLogs`)

- **Purpose:** Immutable audit trail for all administrative, AI manager, and sensitive operational mutations.
- **Model Hooks:** Mongoose schema pre-hooks explicitly intercept and reject `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `deleteOne`, `deleteMany`, `findOneAndDelete`, and modifying `.save()` operations.
- **Service API (`AuditService`):** Exposes `record()` to persist audit events; provides read/query methods (`findById`, `findByActor`, `findByTarget`) with zero update or delete methods exposed.
- **Wiring:** Wired directly into `ConfigService` to record all configuration mutations.

### 13.2 Double-Entry Economic Ledgers (`expTransactions`, `corpCoinTransactions`)

- **Authoritative Ledgers:** All changes to `users.totalExpCached` and `users.corpCoinBalanceCached` MUST correspond to an immutable transaction record.
- **Mongoose Immutability Hooks:** `ExpTransaction` and `CorpCoinTransaction` schemas enforce pre-hooks blocking update and delete operations.
- **Atomic Operations:**
  - `ExpService.awardExp` / `ExpService.adjustExp`: Executes atomic `$inc` updates on `users.totalExpCached` paired with immutable `expTransactions` entry creation. EXP cannot be negative.
  - `CorpCoinService.credit` / `CorpCoinService.debit`: Debits execute an atomic conditional update `{ _id: userObjectId, corpCoinBalanceCached: { $gte: amount } }` with `$inc: { corpCoinBalanceCached: -amount }`. If balance is insufficient, the query returns `null` and throws `AppError.businessRuleViolation`, preventing race conditions and overdrafts.
- **Verification Aggregations:**
  - `recomputeTotalExp(userId)` and `recomputeCorpCoinBalance(userId)` aggregate ledger transactions via MongoDB aggregation pipelines (`$match`, `$group: { _id: null, total: { $sum: '$amount' } }`) to verify ledger integrity against cached balances.

---

## 14. Client Design System, Component Architecture & Routing

### 14.1 Design System & CSS Foundation

- **Tokens & Themes:** Defined in `styles/tokens.css` and `styles/themes.css` (ADR-038). Canonical 6-swatch Gamified Learning palette: Child of Light (`#EFF4F8`), Winter Garden (`#C5D0CF`), Charon (`#A1A19C`), Smokehouse (`#706255`), Cascades (`#273E41`), and Vantablack (`#020101`). Apple-level visual polishing includes SF Pro / Inter typography, continuous squircle radii (`6px` to `30px`), tactile specular glass highlights (`inset 0 1px 0 ...`), diffused multi-stop ambient shadows, and smooth spring curves (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Pure Vanilla CSS:** Scoped via CSS Modules (`[Component].module.css`) with zero third-party UI dependencies.

### 14.2 Reusable UI Component Library

- **Core Primitives:** `Button` (loading spinner, disabled, variants, icons), `Input` (labels, error states, prefixes/suffixes), `Card` (glassmorphism, elevation, hoverable), `Modal` (backdrop blur, accessibility, ESC key, scroll lock), `Table` (responsive wrapper, alignment, striped/hoverable), `Badge` (pill styling, dot indicators), `Toast` (`ToastProvider`, stacked floating notifications, auto-dismiss), `Spinner` (sizes, colors), `EmptyState` (action slot, vector illustrations), `ProgressBar` (level progression, glow, shimmer animation), `Tabs` (pills and underline variants).
- **Vector Iconography & Illustrations:** Native SVG symbol library (`components/ui/Icon/Icon.tsx`, ADR-039) providing 20+ SF-style 24×24 vector symbols (`BriefcaseIcon`, `BuildingIcon`, `ZapIcon`, `TrophyIcon`, `SparklesIcon`, `RocketIcon`, `BotIcon`, `ShieldCheckIcon`, `BrainCircuitIcon`, `CoinIcon`, `SunIcon`, `MoonIcon`, etc.) and multi-layer vector illustrations (`EmptyApplicationIllustration`, `FounderBadgeIllustration`) replacing OS emojis with theme-reactive visual assets.

### 14.3 App Shell & Responsive Layout

- **AppShell:** Persistent container combining desktop sidebar (sticky, 260px) and topbar (64px) with main content viewport.
- **Dynamic Role Navigation:** Sidebar links render conditionally based on user's active `careerRole` (`JOB_SEEKER`, `EMPLOYEE`, `FOUNDER`) and `platformRole` (`ADMIN`, `AI_MANAGER`).
- **Mobile Adaptability:** Sidebar collapses into an off-canvas drawer with backdrop overlay at viewports below 1024px/768px/360px.
- **Topbar Control Bar:** Integrates real-time economic pills (Level, EXP, CorpCoin), runtime simulation role selector, theme toggle, and auth trigger.

### 14.4 API Client & Error Normalization

- **Fetch Abstraction:** `ApiClient` (`api/client.ts`) targets `VITE_API_URL` or `/api/v1` with JSON serialization and credentials inclusion.
- **Error Normalization:** Converts network failures into `NETWORK_ERROR` (status 0) and maps server errors matching Specification Section 31 into typed `ApiClientError` (`code`, `status`, `message`, `details`).

### 14.5 Store & Route Guards

- **Store Stubs:** `AuthContext` (dual roles, levels, balances, and testing role-switchers) and `ThemeContext` (dark/light persistence).
- **Route Guards:**
  - `ProtectedRoute`: Enforces active session, redirecting unauthenticated users to `/login`.
  - `RoleRoute`: Enforces `careerRole` or `platformRole` access permissions; `ADMIN` platformRole bypasses career restrictions.
  - `PublicOnlyRoute`: Prevents authenticated access to guest-only views.

---

## 15. User Registration, Argon2id & Email Verification Architecture

### 15.1 User Lifecycle & Onboarding Progression

- **Initial State:** Upon completing initial registration, the user document is created with:
  - `careerRole: 'NONE'` (transition to `'JOB_SEEKER'` occurs only after profile completion).
  - `platformRole: 'NONE'`.
  - `status: 'ACTIVE'`.
  - `emailVerified: false`.
  - `onboardingStep: 'REGISTERED'`.
  - `totalExp: 0`, `corpCoinBalance: 0`.
- **Synchronization Invariants:** Legacy fields (`totalExpCached`, `corpCoinBalanceCached`, `isEmailVerified`, `isSuspended`, `lockoutUntil`) remain strictly synchronized with their primary equivalents via schema pre-validation hooks and economic service mutations.

### 15.2 Password Security & Argon2id Hashing

- **Hashing Parameters:** Enforced using `argon2.argon2id` via `utils/password.ts`:
  - Memory cost: 65,536 KiB (64 MB).
  - Time cost: 3 iterations.
  - Parallelism: 4 threads.
- **Validation Rules:** Zod schema enforces 8–128 characters containing at least one lowercase letter, one uppercase letter, one digit, and one special character.
- **Plaintext Isolation:** Passwords never enter logs or database storage in unhashed form.

### 15.3 Single-Use Expiring Verification Tokens

- **Generation:** 32-byte cryptographically secure random tokens generated via `crypto.randomBytes()`.
- **Database Storage:** The raw token is hashed via SHA-256 before storage in `emailVerificationTokens` to guard against token harvesting in the event of database compromise.
- **Single-Use Replay Protection:** When consumed, the document records `usedAt = new Date()`. Subsequent verification attempts with the same token are immediately rejected.
- **Expiration:** Tokens carry a 24-hour expiration (`expiresAt`). Expired tokens are rejected.

### 15.4 Pluggable Email Service Layer

- **Interface (`IEmailService`):** Exposes `sendVerificationEmail({ to, token, verificationUrl })`.
- **`ConsoleEmailService`:** Development and testing adapter that logs tokens and verification URLs to structured output and maintains an in-memory queue for testing assertions.
- **`SmtpEmailService`:** Production adapter using `nodemailer` to dispatch branded responsive HTML emails with plaintext fallbacks.

### 15.5 Anti-Enumeration Security (Spec Section 32)

- **Registration (`POST /api/auth/register`):** Submitting an email that already exists returns an indistinguishable 201 Created generic success response. Duplicate user records are not created, and existing credentials remain intact.
- **Resend Verification (`POST /api/auth/resend-verification`):** Resend requests for unregistered or already verified emails return identical success messages without revealing account existence.
- **Rate Limiting:** Sliding-window rate limiters prevent brute-force probing and email flooding.

---

## 16. Authentication, Sessions & Authoritative Security Architecture

### 16.1 Dual Token Architecture (JWT + Refresh Cookie)

- **Access Token:** Short-lived JWT (15 minutes, configurable via `PlatformConfig.security.accessTokenMinutes`) signed with server `JWT_SECRET`. Contains claims `{ userId, email, careerRole, platformRole }`.
- **Refresh Token:** Cryptographically random 40-byte hex token dispatched via `httpOnly`, `Secure` (in prod), `SameSite: strict` (in prod) cookie named `refreshToken`.
- **Hash-Only Storage:** Refresh tokens are never stored in plaintext on the server. They are hashed using SHA-256 before storage in the `refreshTokens` collection with `family` (UUID), `expiresAt` (7 days by default), `isRevoked`, and `replacedByTokenHash`.

### 16.2 Token Rotation & Replay/Reuse Compromise Detection

- **Token Rotation:** Every call to `POST /api/auth/refresh` consumes the current refresh token by marking it `isRevoked: true`, setting `revokedAt`, and linking `replacedByTokenHash`. A fresh rotated token is issued in the same `family` and returned via a new cookie.
- **Compromise / Replay Reuse Detection:** If an attacker attempts to present an already-revoked refresh token, the server detects session replay. It immediately revokes the **entire token family** (`RefreshTokenModel.updateMany({ family }, { isRevoked: true })`), clears the client cookie, and returns 401 Unauthorized, invalidating all tokens derived from that session lineage.

### 16.3 Brute-Force Lockout & Anti-Enumeration

- **Brute-Force Protection:** Failed login attempts increment `user.failedLoginAttempts`. After reaching the threshold configured in `PlatformConfig.security.maxLoginAttempts` (default 5), `user.lockUntil` is set to `Date.now() + lockoutMinutes * 60 * 1000`.
- **Lockout Enforcement:** Requests during the lockout window fail immediately with HTTP `423 Locked` (`ACCOUNT_LOCKED`), even if the password is valid, protecting against online brute-force attacks.
- **Counter Reset:** Upon successful authentication with valid credentials, `failedLoginAttempts` resets to 0 and `lockUntil` is cleared.
- **Generic Anti-Enumeration Messages:** Failed logins return a uniform 401 error message ("Invalid email or password") whether the email is absent or the password is incorrect.

### 16.4 Authoritative Request Authentication (`authenticateJwt` Middleware)

- Validates `Authorization: Bearer <token>` against server secret.
- Loads the authoritative user document from MongoDB.
- Rejects requests from `SUSPENDED` users with HTTP `403 Forbidden`.
- Rejects requests from users whose email is not verified with HTTP `403 Forbidden`.
- Injects loaded user document into `req.user`.

### 16.5 Client State, Silent Refresh & Auth UI

- **ApiClient:** Automatically attaches `Authorization: Bearer <accessToken>` when set in memory; sends credentials (`credentials: 'include'`) to ensure refresh cookies are transmitted.
- **AuthContext:** Manages in-memory access token, user profile, silent refresh bootstrap on initial load, proactive token renewals via `useTokenRefresh`, and cookie-clearing logout.
- **Auth Pages:** Responsive `LoginPage`, `RegisterPage` (with real-time password criteria checklist and dev verification helper), and `VerifyEmailPage` (with automatic query-param parsing and token resend capability) built using Vanilla CSS tokens.

---

## 17. Candidate Profile Subsystem & Role Progression Architecture

### 17.1 Profile Data Model & 1-to-1 User Linkage

- **Collection:** `profiles` (Specification Section 20, Collection 2).
- **Unique Linkage:** A strict unique index on `{ userId: 1 }` guarantees exactly one profile document per authenticated user.
- **Case-Insensitive Display Name:** Case-insensitive uniqueness enforced via MongoDB collation index (`{ locale: 'en', strength: 2 }`) and regex pre-validation in `ProfileService.isDisplayNameAvailable()`, rejecting collisions (e.g., "Elena Rostova" vs "elena rostova") with 409 Conflict.
- **Locked Career Domains:** Enforced via TypeScript enum, `DomainModel` active validation, and Mongoose validation:
  - `SOFTWARE_ENGINEERING`
  - `CLOUD_ENGINEERING`
  - `AI_ENGINEERING`
  - _Domain is selected during onboarding and is immutable thereafter._
- **Mandatory Profile Fields:**
  - `displayName`: 2–80 characters string.
  - `domain`: One of the 3 locked career domains.
  - `skills`: Array of 1 to 50 lowercase trimmed strings.
- **Optional Profile Fields (Never made mandatory):**
  - `bio`: Max 500 characters.
  - `githubUrl`, `linkedinUrl`, `portfolioUrl`: Validated URL strings.
  - `projects`: Subdocuments with `title`, `description`, `technologies`, `repositoryUrl`, `liveUrl`.
  - `certifications`: Subdocuments with `name`, `issuer`, `issueDate`, `credentialId`, `credentialUrl`.
  - `resumeId`: Reserved MongoDB ObjectId referencing `resumes` collection.

### 17.2 Authoritative Role Transition Lifecycle & Onboarding Sequence

The backend remains authoritative across all onboarding and career role progressions:

1. **Initial Registration:** User document initialized with `careerRole = 'NONE'` and `onboardingStep = 'REGISTERED'`.
2. **Email Verification:** User completes verification; `emailVerified = true`, `onboardingStep = 'EMAIL_VERIFIED'`.
3. **Step-by-Step Onboarding Pipeline:**
   - Sequential progression: `EMAIL_VERIFIED` $\rightarrow$ `NAME` $\rightarrow$ `DOMAIN` $\rightarrow$ `SKILLS` $\rightarrow$ `RESUME` $\rightarrow$ `REVIEW` $\rightarrow$ `COMPLETE`.
   - Updated via `PATCH /api/profile/step` or all-in-one `POST /api/profile/setup`.
   - Optional steps (resume upload, links/bio) can be skipped without blocking onboarding completion.
4. **Authoritative Promotion via Single Service Method (`completeOnboarding`):**
   - Requires verified, active session (`authenticateJwt`).
   - Asserts mandatory fields: valid `displayName`, `domain`, and non-empty `skills`.
   - Promotes `user.careerRole = 'JOB_SEEKER'` and sets `user.onboardingStep = 'COMPLETE'`.
   - Guaranteed client isolation: client request payloads cannot directly set or alter `careerRole` (stripped/ignored on all client profile endpoints).
5. **Subsequent Profile Management:**
   - `GET /api/profile/me`: Retrieves candidate profile linked to current user.
   - `PUT /api/profile/me`: Allows updating optional details (`bio`, `skills`, URLs, projects, certifications) with strict Zod validation; `domain` and `userId` are protected against modification; `careerRole` client mutations are completely ignored.
   - `GET /api/profile/domains` and `GET /api/domains`: Serves active domain catalog.

### 17.3 Client Guided Onboarding Flow & Side-by-Side Review (TASK P4.4)

- **Profile Setup Stepper (`ProfileSetupPage.tsx`):** 6-step progressive onboarding sequence matching backend invariant rules:
  1. _Candidate Display Name:_ Input validation (2–50 chars, case-insensitive uniqueness check against backend).
  2. _Career Domain Selection:_ Interactive cards for the 3 canonical domains (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
  3. _Technical Competencies:_ Searchable multi-select catalog filtered by domain, suggested skill chips, custom tag entry, and chip removal.
  4. _Resume Dropzone Upload:_ Drag-and-drop and file-picker uploader validating PDF/DOCX (max 10MB), uploading to GridFS via `POST /api/profile/resume/upload` with streaming progress bar.
  5. _AI Verification & Polling:_ Asynchronous polling of `GET /api/profile/resume/analysis` every 2s with clear handling of `WAITING_FOR_PROVIDER` (queue notice), `SCANNED_UNREADABLE` (advisory warning with manual progression option), `FAILED` (retry/re-upload), and `COMPLETED`.
  6. _Side-by-Side Review Screen:_ Responsive comparison grid contrasting candidate profile entries (left) with AI-extracted resume entities (right, including contacts, domain classification, experience years, skills chips, education records, work history) with optional fields (bio, GitHub, LinkedIn, portfolio) clearly marked `(Optional)`.
  7. _Celebratory Activation:_ Authoritative activation via `onboardingApi.completeOnboarding()` promoting user to `careerRole = 'JOB_SEEKER'`, refreshing session, and presenting celebratory activation view.
- **State Restoration Lifecycle:** On initial mount, `ProfileSetupPage` executes a single restoration lifecycle (`hasRestoredRef`) fetching `onboardingApi.getProfile()` and mapping `user.onboardingStep` to the appropriate active step, allowing seamless resumption across page reloads.
- **Unverified Email Notification:** Displays amber warning banner when `user.emailVerified === false`, with a one-click resend trigger calling `POST /api/auth/resend-verification`.
- **Route Guard Protection:**
  - `RoleRoute`: If a verified candidate with `careerRole: 'NONE'` attempts to access Job Seeker features (`/job-seeker/*`), the router gracefully redirects them to `/profile/setup`.
  - `Sidebar`: Dynamic navigation renders "Candidate Onboarding" link for candidates with `careerRole: 'NONE'`.

### 17.4 Domains & Skills Taxonomy and Admin Management (TASK P4.1)

- **`domains` Collection (Spec Section 20, Collection 5):**
  - Schema: `code` (unique uppercase token), `name`, `description`, `isActive`, `createdAt`, `updatedAt`.
  - Idempotently seeded on boot with the 3 v1 domains (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
  - Public retrieval via `GET /api/domains` and `GET /api/v1/domains`.
  - Admin CRUD endpoints (`POST /api/admin/domains`, `GET /api/admin/domains`, `GET /api/admin/domains/:id`, `PATCH /api/admin/domains/:id`, `DELETE /api/admin/domains/:id`) protected by `authenticateJwt` and `requirePlatformRole('ADMIN')`.
  - All administrative domain mutations write immutable records to `auditLogs` with mandatory justification reasons.
- **`skills` Collection (Spec Section 20, Collection 6):**
  - Schema: `name` (unique), `domainCode` (indexed), `category`, `createdAt`, `updatedAt`.
  - Pre-seeded with curated skill taxonomy per domain.
  - Public retrieval via `GET /api/skills?domainCode=...`.

---

## 18. AI Gateway Core, Router & Adapter Architecture (TASK P3.1)

### 18.1 Normalized Contracts & AIError Taxonomy

All internal AI interactions are isolated from vendor-specific payloads through three standardized contracts in `server/src/ai/types.ts`:

- **`AIRequest`:** Encapsulates `taskType` (`RESUME_PARSING`, `ATS_EVALUATION`, `INTERVIEW_QUESTION`, `INTERVIEW_EVALUATION`, `TASK_GENERATION`, `TASK_EVALUATION`, `SCENARIO_GENERATION`, `SCENARIO_EVALUATION`), `systemInstruction`, `userInput`, optional `context`, optional JSON `outputSchema`, `temperature`, and `maxTokens`.
- **`AIResponse`:** Standardized payload providing `success`, `provider`, `model`, gateway-generated `requestId`, `content`, optional `structuredData`, token `usage` (`inputTokens`, `outputTokens`, `totalTokens`), and measured `latencyMs`.
- **`AIError`:** Normalized error class categorizing failures into 7 canonical types:
  - `TIMEOUT`, `RATE_LIMIT`, `PROVIDER_ERROR`, `UNAVAILABLE`, `NETWORK`: Transient faults marked `retryable: true`.
  - `AUTH_CONFIG`, `INVALID_REQUEST`: Permanent faults marked `retryable: false` (fast-fail, no retry or fallback).

### 18.2 Pool-Isolated Provider Routing (`ProviderRouter`)

- **Strict Pool Isolation:** Providers are registered independently to either `AIProviderPool.DEMO` or `AIProviderPool.PIPELINE`. Registration in one pool never affects or leaks into the other.
- **Priority-Ordered Selection:** In each pool, providers are evaluated in ascending priority order. The router picks the first provider whose health state is NOT `DISABLED`. Providers in `DEGRADED`, `RATE_LIMITED`, or `TEMPORARILY_FAILED` states remain eligible for attempts until explicitly disabled by circuit breakers.
- **Health Management:** Dynamic state tracking (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`) per pool and provider with programmatic status inspection and state transitions.

### 18.3 Authoritative Gateway Execution & Validation (`AIGateway`)

- **Centralized Dispatch:** `AIGateway.execute(request, { pool })` resolves the appropriate active provider via `ProviderRouter`.
- **Gateway Metrics & Tracking:** Generates a unique UUID `requestId` and records round-trip `latencyMs`.
- **Authoritative Schema Enforcement:** When an `outputSchema` is defined, the gateway enforces structural validation via `validateAgainstSchema()`, rejecting responses missing required properties or containing invalid primitive types before returning to business logic.
- **Provider SDK Isolation:** Business logic imports strictly from `server/src/ai/`. An automated Vitest architectural guard (`Provider SDK Import Guard`) enforces that no file outside `server/src/ai/` imports `@google/genai`, `openai`, or `groq-sdk`.

### 18.4 Google Gemini Provider Adapter (`GeminiAdapter` — TASK P3.2)

- **REST Protocol Architecture:** Connects to Google's official Generative Language API (`POST /v1beta/models/{model}:generateContent`) via native `fetch`, eliminating third-party SDK dependencies while complying strictly with architectural SDK import restrictions.
- **Header Authentication:** Passes API credentials via `x-goog-api-key` request header, preventing credential leakage in URL query parameters, proxy logs, and error strings.
- **Configurable Model & Timeout:** Model ID (`geminiModel`) is dynamically retrieved from PlatformConfig or options, never hardcoded. Timeout is managed via `AbortSignal` with configurable duration.
- **Structured JSON Output:** When `request.outputSchema` is provided, the adapter injects `generationConfig.responseMimeType: "application/json"` and `generationConfig.responseSchema`, parsing response text into `structuredData`.
- **Token Accounting:** Extracts input, output, and total token usage from top-level `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`).
- **Comprehensive Error Normalization:**
  - `429` / `RESOURCE_EXHAUSTED` -> `RATE_LIMIT` (retryable)
  - `AbortError` / `TimeoutError` -> `TIMEOUT` (retryable)
  - `500`, `502`, `504` -> `PROVIDER_ERROR` (retryable)
  - `503` / `UNAVAILABLE` -> `UNAVAILABLE` (retryable)
  - Transport failure / connection dropped -> `NETWORK` (retryable)
  - `401`, `403` -> `AUTH_CONFIG` (non-retryable fast-fail)
  - `400`, `404` -> `INVALID_REQUEST` (non-retryable fast-fail)

### 18.5 OpenAI Provider Adapter (`OpenAIAdapter` — TASK P3.3)

- **Chat Completions Protocol:** Interfaces with OpenAI Chat Completions endpoint (`POST https://api.openai.com/v1/chat/completions`) via native `fetch`, eliminating external SDK packages and maintaining zero direct SDK imports.
- **Bearer Authentication:** Injects API credentials via standard `Authorization: Bearer <token>` header, shielding keys from query logs and diagnostics.
- **Dynamic Model Resolution:** Model ID (`openaiModel`) is dynamically retrieved from PlatformConfig or constructor accessor, never hardcoded.
- **Structured Outputs via `json_schema`:** Uses `response_format: { type: "json_schema", json_schema: { name: "structured_response", strict: true, schema: outputSchema } }`, extracting content into `structuredData`.
- **Token Accounting:** Maps `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens` directly to `AIResponse.usage`.
- **Canonical Fallback Error Taxonomy:**
  - `429` / `rate_limit_error` / `insufficient_quota` -> `RATE_LIMIT` (retryable)
  - `AbortError` / `TimeoutError` -> `TIMEOUT` (retryable)
  - `500`, `502`, `504` / `server_error` -> `PROVIDER_ERROR` (retryable)
  - `503` / `service_unavailable` -> `UNAVAILABLE` (retryable)
  - Transport drops -> `NETWORK` (retryable)
  - `401`, `403` / `authentication_error`, `permission_error` -> `AUTH_CONFIG` (non-retryable fast-fail)
  - `400`, `404` / `invalid_request_error`, `not_found_error` -> `INVALID_REQUEST` (non-retryable fast-fail)

### 18.6 Groq Provider Adapter (`GroqAdapter` — TASK P3.4)

- **Chat Completions Protocol:** Interfaces with Groq's high-throughput Chat Completions endpoint (`POST https://api.groq.com/openai/v1/chat/completions`) via native `fetch`, eliminating third-party SDK dependencies (`groq-sdk`) and satisfying architectural SDK import restrictions.
- **Bearer Authentication:** Injects API credentials via standard `Authorization: Bearer <token>` header, shielding keys from query strings, server logs, and diagnostics.
- **Dynamic Model Resolution:** Model ID (`groqModel`) is dynamically retrieved from PlatformConfig or constructor accessor (e.g., `llama-3.3-70b-versatile`), never hardcoded.
- **Structured Outputs via `json_schema`:** Uses `response_format: { type: "json_schema", json_schema: { name: "structured_response", strict: true, schema: outputSchema } }`, extracting content into `structuredData`. Parse failures or empty payloads map to `INVALID_REQUEST`.
- **Token Accounting:** Maps `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens` directly to `AIResponse.usage`.
- **Canonical Fallback Error Taxonomy:**
  - `429` / `rate_limit_exceeded` -> `RATE_LIMIT` (retryable)
  - `AbortError` / `TimeoutError` -> `TIMEOUT` (retryable)
  - `500`, `502`, `504` / `internal_server_error` -> `PROVIDER_ERROR` (retryable)
  - `503` / `service_unavailable` -> `UNAVAILABLE` (retryable)
  - Transport drops / connection errors -> `NETWORK` (retryable)
  - `401`, `403` / `invalid_api_key`, `unauthorized` -> `AUTH_CONFIG` (non-retryable fast-fail)
  - `400`, `404` / `invalid_request_error`, `model_not_found` -> `INVALID_REQUEST` (non-retryable fast-fail)
- **Zero-Token Health Check:** `healthCheck()` verifies provider connectivity against `GET https://api.groq.com/openai/v1/models/{model}` without executing billable generation tokens.

### 18.7 AI Reliability Layer, Queue Model & Worker (TASK P3.5)

- **Asynchronous Queue Model (`AIJobModel`):**
  - Manages asynchronous AI workload in `aiJobs` collection with full lifecycle statuses (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `WAITING_FOR_PROVIDER`, `CANCELLED`).
  - Supports worker lease tracking with `lockedUntil` and `lockedBy` to guarantee atomic job processing and crash recovery.
  - Sparse unique index on `idempotencyKey` prevents duplicate job creation when clients or internal services re-submit with the same key.
- **Authoritative Gateway Submission (`AIGateway.submit`):**
  - Provides decoupled entrypoint for queue-based tasks, returning a unique `jobId`.
  - Preserves `AIGateway.execute` for bounded synchronous needs with configurable `timeoutMs` and telemetry logging.
- **Custom In-Process Queue Worker (`AIWorker`):**
  - Polls MongoDB at configurable cadence (default 2s) and claims jobs atomically via `findOneAndUpdate`.
  - Reclaims abandoned or crashed jobs when their lease (`lockedUntil`) expires without completion.
  - Enforces up to 3 attempts per provider (configurable in `PlatformConfig`) before cascading to the next priority provider.
  - Transitions jobs to `WAITING_FOR_PROVIDER` when all providers are exhausted.
  - Resumes waiting jobs automatically (`checkAndResumeWaitingJobs`) without loss or duplication when any provider recovers.
  - Fast-fails non-retryable errors (`AUTH_CONFIG`, `INVALID_REQUEST`), immediately marking jobs `FAILED` and providers `DEGRADED` without cascading.
- **Provider Health Lifecycle & Observability (`HealthTracker`):**
  - Tracks states in `aiProviders` (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`).
  - Implements backoff recovery checks via `probeAndRecover()`.
  - Records operational audit trail in `aiRequests`, `aiResponses`, and `aiHealthLogs`, ensuring prompts are truncated and credentials redacted.

### 18.8 AI Manager Console Backend, Key Vault & RBAC (TASK P3.6)

- **Role-Based Access Control (RBAC):**
  - AI Manager endpoints (`/api/ai-manager/*` and `/api/v1/ai-manager/*`) are guarded by `authenticateJwt` and `requirePlatformRole`.
  - Mutation endpoints (`POST /providers`, `PATCH /providers/:code`, `POST /providers/:code/enable`, `POST /providers/:code/disable`, `DELETE /providers/:code`, `POST /providers/:code/test`) strictly require `platformRole === 'AI_MANAGER'`.
  - Telemetry and list endpoints (`GET /health`, `GET /usage`, `GET /providers`) are accessible to both `AI_MANAGER` and `ADMIN`.
  - Non-privileged accounts (`platformRole: NONE`) are denied access with 403 Forbidden.
  - Strict boundary enforcement: AI Managers are prohibited from accessing Admin-only routes (`/api/admin/*` returns 403).
- **Key Vault Encryption Architecture:**
  - Runtime-added provider API keys are encrypted at rest using AES-256-GCM authenticated encryption (`encryptSecret`) with a unique 12-byte IV and 16-byte authentication tag per secret.
  - Master encryption key is derived server-side from `AI_KEY_VAULT_SECRET` via SHA-256.
  - Decryption (`decryptSecret`) occurs exclusively in-memory inside adapter calls when dispatching upstream AI requests.
  - Plaintext keys are never persisted, never returned in API responses, and never logged.
  - In MongoDB `aiProviders`, `encryptedApiKey` is configured with `select: false` and explicitly stripped from `toJSON` schema transforms. Only `maskedApiKey` (preserving the last 4 characters, e.g., `sk-••••••••1234` or `••••••••1234`) is exposed via API responses.
- **Two-Pool Isolation Architecture (Decision D11 & ADR-036):**
  - `DEMO` pool: Automatically seeded into `aiProviders` on server boot from `server/.env` (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`) via `AIManagerService.seedDemoPoolFromEnv()`. Encrypted with AES-256-GCM, masked, and registered into `ProviderRouter` for interactive demos, live health telemetry, and admin testing.
  - `PIPELINE` pool: Managed in the database by the AI Manager for background workflow tasks, candidate screening, and assessment evaluations.
- **Dynamic Routing & Health Management:**
  - Updating provider priority via `AIManagerService` dynamically reorganizes priority order within `ProviderRouter`.
  - Providers marked `DISABLED` are skipped during routing candidate selection.
  - On-the-fly adapter resolution: If a provider exists in the database but lacks an active adapter in `ProviderRouter` (e.g., following a worker restart), the adapter is instantiated and registered on-demand during test pings or routing.
  - Live health testing (`POST /providers/:code/test`) pings upstream adapters and returns latency and diagnostics without disrupting active priority order.
- **Mandatory Append-Only Audit Logging:**
  - Every provider mutation (creation, modification, enablement, disablement, deletion) requires a descriptive `reason` ($\ge 3$ characters) and records an immutable log in `AuditLog` via `AuditService.record()` capturing actor ID, actor role, action type, target ID, diff state, and reason.

### 18.9 AI Operations Frontend & Admin Health Telemetry (TASK P3.7)

- **AI Manager Console (`AiManagerPage.tsx` mounted at `/ai-ops`):**
  - Route guarded strictly for `platformRole === 'AI_MANAGER'`.
  - Multi-Pool Isolation: Interactive switcher between `PIPELINE` (database-managed runtime providers) and `DEMO` (env-configured bootstrap providers).
  - Queue Telemetry: Real-time asynchronous queue depth meter and waiting jobs alert card (`depth`, `pending`, `processing`, `waitingForProvider`, `completed`, `failed`).
  - Dynamic Priority Reordering: Instant priority reorganization via Move Up / Move Down buttons triggering `PATCH /api/ai-manager/providers/:id/priority`.
  - Modal Workflows: Dedicated modals for Add Provider, Edit Configuration (model ID, rate limit, daily token budget), Disable Provider, and Remove Provider, all requiring mandatory audit reason inputs ($\ge 3$ characters).
  - Upstream Connectivity Ping: Zero-token/low-cost test button triggering `POST /api/ai-manager/providers/:id/test` with visual latency indicators and failure diagnostics.
  - Usage & Failure Analytics: Telemetry cards and percentage-fill bar charts visualizing request volume, error counts, and latency across providers.
  - Credential Protection Invariant: Masked API keys (`sk-••••••••1234` or `••••••••1234`) displayed across all tables and cards; inputs default to `type="password"`.
- **Admin Read-Only AI Health (`AdminAiHealthPage.tsx` mounted at `/admin/ai-health`):**
  - Route guarded strictly for `platformRole === 'ADMIN'`.
  - Read-only diagnostics dashboard featuring an amber Oversight Mode banner explaining AI Manager domain ownership.
  - Multi-provider health matrix with real-time status badges (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`).
  - Usage telemetry, queue stats, and recent error incident logs.
  - Absolute omission of mutation actions, buttons, or configuration controls.
- **Client API Layer (`client/src/api/aiOps.ts`):**
  - Strongly typed DTOs matching backend schemas: `ProviderDto`, `QueueStatsDto`, `HealthAndUsageResponseDto`, `TestProviderResponseDto`.
  - Client methods wrapping all `/api/ai-manager/*` routes with normalized `ApiClientError` error handling.
- **Backend Queue Stats Telemetry:**
  - `GET /api/ai-manager/health-usage` enriched with `queueStats` aggregated from `AIJobModel` counting `depth`, `pending`, `processing`, `waitingForProvider`, `completed`, `failed`, and `total`.

---

## 19. Companies, Job Postings & Employee Roster Architecture (TASK P5.1)

### 19.1 Data Models & Schemas

- **Company Model (`CompanyModel` in `companies` collection):**
  - Schema: `type` (`PLATFORM` | `FOUNDER`), `isPlatformCompany` (boolean synchronized pre-save), `ownerId` (nullable, null for PLATFORM, ObjectId for FOUNDER), `name` (unique index), `domainsHired` (array of `CareerDomain`), `status` (`ACTIVE` | `BANKRUPT` | `SUSPENDED`), `ratings` (`overall`, `culture`, `workLife`, `technicalExcellence`, `reviewCount`), `companyRating` (mirrored bidirectionally with `ratings.overall`), `employeeCount` (defaults to 0), `maxEmployees` (seeded from `PlatformConfig.company.maxEmployees`), `financialHealth` (default 0 for platform companies), `aiProviderPool: 'PIPELINE'`.
- **Company Job Model (`CompanyJobModel` in `companyJobs` collection):**
  - Schema: `companyId` (ref `Company`), `domain` (`CareerDomain`), level range (`minLevel`, `maxLevel` clamped 1-10), `title`, `description`, `requiredSkills` (array of string), `openings` (integer $\ge 0$), `status` (`OPEN` | `CLOSED`), `isOpen` (boolean synchronized pre-save).
  - Indexes: `(companyId, status)`, `(domain, status)`, `(minLevel, maxLevel)`.
- **Company Employee Model (`CompanyEmployeeModel` in `companyEmployees` collection):**
  - Schema: `userId` (ref `User`), `companyId` (ref `Company`), `domain` (`CareerDomain`), `level` (1-10), `positionTitle` (synchronized with canonical career level title on level changes), `status` (`ACTIVE` | `TERMINATED` | `DEMOTED` | `UNDER_REVIEW`), `history` array recording state transitions (`previousStatus`, `newStatus`, `reason`, `changedAt`), `startedAt`, `endedAt`.
  - Indexes: `(companyId, status)`, `(userId, status)`.

### 19.2 Startup Seeding (Decision D13 Baseline)

- **Idempotent Seeding (`CompanyService.seedPlatformCompanies`):**
  - Integrated into server boot sequence (`server.ts`) before listening for HTTP traffic.
  - Seeds exactly 3 PLATFORM companies using the `PIPELINE` pool:
    1. `Nexus Enterprise Systems`: High-throughput enterprise backends, cloud workflows, and automated reasoning pipelines (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
    2. `CloudScale Infrastructure`: Distributed multi-cloud orchestration, site reliability engineering, and MLOps platforms (`CLOUD_ENGINEERING`, `SOFTWARE_ENGINEERING`, `AI_ENGINEERING`).
    3. `Synthetix AI Labs`: Next-generation generative agents, deep learning pipelines, and autonomous tooling (`AI_ENGINEERING`, `SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`).
  - Automatically provisions at least 1 open job posting for every domain hired by each platform company, with required skills and opening counts.
  - Idempotent execution: Checks for existing companies by name and existing jobs by title/companyId to avoid duplicate inserts on successive server restarts.

### 19.3 Public Query and Search APIs

- `GET /api/companies` (and `/api/v1/companies`): Lists active companies with optional filters (`type`, `domain`, `status`). Aggregates real-time `openJobCount` from `CompanyJobModel`.
- `GET /api/companies/:id`: Retrieves full company profile with ratings breakdown and open job postings.
- `GET /api/jobs` (and `/api/v1/jobs`): Search and filter open job postings by `domain`, `minLevel`, `maxLevel`, and keyword `search` (matching title, description, or required skills). Populates associated company details (`_id`, `name`, `type`, `companyRating`, `ratings`).
- `GET /api/jobs/:id`: Fetches detailed job posting and associated company profile.

### 19.4 Admin Management & Audit Trails

- **Endpoints:**
  - `POST /api/admin/companies`: Create platform or managed company.
  - `PATCH /api/admin/companies/:id`: Update company details, domains, status, ratings.
  - `POST /api/admin/jobs`: Create job posting for any company.
  - `PATCH /api/admin/jobs/:id`: Update job requirements, openings, status.
  - `DELETE /api/admin/jobs/:id`: Soft-close job posting (`status: 'CLOSED'`).
- **Authorization & Audit Logging:**
  - Guarded strictly by `authenticateJwt` and `requirePlatformRole('ADMIN')`.
  - Every admin mutation requires an explicit `reason` string ($\ge 10$ characters) validated by Zod.
  - All admin actions write immutable append-only records to `AuditLogModel` under action `ADMIN_MUTATION` capturing actor, target, diffs, and justification.

### 19.5 Frontend Company & Job Exploration Architecture (TASK P5.2)

- **Client API Layer (`client/src/api/career.ts`):** Strongly typed consumer wrappers around `/api/companies` and `/api/jobs` supporting parameter serialization (`domain`, `type`, `status`, `minLevel`, `maxLevel`, `search`).
- **Enterprise Directory (`/companies`):** Search input, track domain filter chips, organization type selector (`PLATFORM` vs `FOUNDER`), and enterprise cards displaying overall rating, employee capacity (`employeeCount / maxEmployees`), and open position badges.
- **Enterprise Profile Detail (`/companies/:id`):** Executive overview banner, multi-dimensional rating breakdown (Overall, Culture, Work-Life, Technical Excellence), team capacity bar, and live open requisitions card list linking directly to job details.
- **Job Board & Filter Controls (`/jobs`):** Keyword search box, engineering domain chips (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), and seniority level presets (Junior L1-L3, Mid L4-L6, Senior & Lead L7-L10).
- **Position Detail & Application Quota UX (`/jobs/:id`):** Role responsibilities, required skills chips, employer card, active application quota indicator (`0 / 5 Active Applications` matching `PlatformConfig.applications.maxActive`), and disabled Apply CTA button with Phase 6.1 unlocking note.

---

## 20. Job Applications & ATS Evaluation Engine Architecture (TASK P5.3 Blueprint)

### 20.1 Application Data Model (`ApplicationModel` in `applications` collection)

- **Schema Fields:**
  - `_id`: `ObjectId`, primary key.
  - `userId`: `ObjectId`, required, ref `users`, indexed.
  - `jobId`: `ObjectId`, required, ref `companyJobs`, indexed.
  - `companyId`: `ObjectId`, required, ref `companies`, indexed.
  - `mode`: `ApplicationMode` (`'PRODUCTION'`, `'DEMO'`), required, default: `'PRODUCTION'`.
  - `currentStage`: `ApplicationStage` (`'APPLIED'`, `'ATS_SCREENING'`, `'SCREENING'`, `'ASSESSMENT'`, `'INTERVIEW'`, `'FINAL_REVIEW'`, `'OFFER'`, `'ACCEPTED'`), required, default: `'APPLIED'`.
  - `status`: `ApplicationStatus` (`'ACTIVE'`, `'REJECTED'`, `'WITHDRAWN'`, `'EXPIRED'`, `'ACCEPTED'`), required, default: `'ACTIVE'`.
  - `resumeAnalysisId`: `ObjectId`, required, ref `resumeAnalyses`.
  - `resumeAnalysisSnapshot`: Embedded immutable snapshot of candidate parsed skills, domain, experience years, education, work history, projects, certifications at application submission.
  - `stageHistory`: Array of `{ stage, enteredAt, exitedAt, result }` capturing the full progression journey.
  - `atsScore`: `Number` (clamped 0–100), optional.
  - `atsBreakdown`: Embedded object containing sub-scores (`domainRelevance`, `skillMatch`, `experience`, `clarity`), optional.
  - `atsFeedback`: `String` (actionable diagnostic critique), optional.
  - `interviewScore`: `Number` (clamped 0–100), optional.
  - `rejectionReason`, `withdrawalReason`, `expiryReason`: Diagnostic rationale strings.
  - `createdAt`, `updatedAt`: Timestamps.
- **Database Indexes:**
  - `{ userId: 1, status: 1 }`: For rapid active application count checks (`PlatformConfig.applications.maxActive`).
  - `{ userId: 1, jobId: 1, status: 1 }`: To enforce uniqueness across active applications for the same job.
  - `{ companyId: 1, currentStage: 1 }`: For company recruitment analytics.
  - `{ jobId: 1, status: 1 }`: For job posting application tracking.

### 20.2 Concurrency & State Machine Invariants (`ApplicationStateMachine`)

- **Single Authoritative State Machine:** All stage and status transitions must flow through `ApplicationStateMachine`. Direct ad-hoc updates are strictly prohibited.
- **Allowed Linear Stages:** `APPLIED` -> `ATS_SCREENING` -> `SCREENING` -> `ASSESSMENT` -> `INTERVIEW` -> `FINAL_REVIEW` -> `OFFER` -> `ACCEPTED`.
- **Terminal States:** `REJECTED`, `WITHDRAWN`, `EXPIRED`, `ACCEPTED`. Applications in terminal states cannot be mutated further. Attempting any transition on a terminal application immediately throws `BUSINESS_RULE_VIOLATION`.
- **Maximum Active Applications:** Candidates cannot have more than 5 non-terminal (`status: 'ACTIVE'`) applications simultaneously (`PlatformConfig.applications.maxActive`). Attempting to submit a 6th rejects with `400 BUSINESS_RULE_VIOLATION`.
- **Duplicate Prevention:** A candidate cannot re-apply to a job while an active application exists for that job. Re-application is unlocked once the existing application transitions to a terminal state (`REJECTED`, `WITHDRAWN`, `EXPIRED`).
- **Mode and Company Agnosticism:** The state machine and application engine operate identically for both `PRODUCTION` and `DEMO` modes, and for both `PLATFORM` and `FOUNDER` companies, routing AI bot interactions through the unified AI Gateway without distinct code branches.

### 20.3 ATS Evaluation Engine & Scoring Invariants (`AtsScreeningService`)

- **Asynchronous AI Job Enqueuing:**
  - AI task type `ATS_SCREEN` (or `ATS_EVALUATION`) enqueued via `AIGateway.submit()` targeting `PIPELINE` pool (or `DEMO` pool if `application.mode === 'DEMO'`).
  - Context includes `CompanyJob` requisition, candidate `ResumeAnalysis`, and `Profile`.
  - **Grounding Mandate:** Prompts strictly instruct the evaluator that strengths, weaknesses, and improvement suggestions must reference verified candidate resume content only.
- **Strict Output Schema Enforcement (`atsScreeningOutputSchema`):**
  - Schema requires: `matchScore` (0-100), `matchedSkills` (string[]), `missingSkills` (string[]), `strengths` (string[], min 1), `weaknesses` (string[]), `improvementSuggestions` (string[], min 1), `recommendation` (`PASS` | `FAIL`).
  - Strict Zod validation registered via `AIWorker.registerValidator('ATS_SCREEN')`. Unvalidated output is rejected.
- **Authoritative Backend Decision (`applyAtsEvaluation`):**
  - Evaluator score clamped to integer $[0, 100]$.
  - Pass threshold retrieved from `configService.getAtsConfig()` (`passingScore`, default 70).
  - Decision is strictly authoritative: $score \ge passingScore \rightarrow \text{PASS}$; $score < passingScore \rightarrow \text{FAIL}$.
  - AI `recommendation` is advisory and stored in audit breakdown; backend decides progression.
- **Collections Persistence:**
  - `evaluations` collection: Record created for every completed screening with `applicationId`, `stage: 'ATS_SCREENING'`, `score`, `scoreBreakdown`, and `summary`.
  - `feedbacks` collection: On failure, structured feedback document created with `applicationId`, `userId`, `rejectionStage: 'ATS_SCREENING'`, `strengths`, `weaknesses`, `actionableSuggestions`.
- **Queue Resilience During Provider Outages:**
  - When providers are down or degraded, AI job transitions to `WAITING_FOR_PROVIDER`.
  - State change handler maintains application in `currentStage: 'ATS_SCREENING'`, `status: 'ACTIVE'`, waiting safely in queue without failing or rejecting.

### 20.4 REST Endpoints Surface (`/api/applications`)

- `POST /api/applications`: Submits application for a job ID (`careerRole === 'JOB_SEEKER'` required).
- `GET /api/applications`: Lists all applications for authenticated candidate with stage badges and timestamps.
- `GET /api/applications/:id`: Retrieves full application detail, populated with `evaluations` and `feedback` per Spec Section 27.4.
- `POST /api/applications/:id/withdraw`: Allows candidate to voluntarily withdraw an active application, releasing their quota slot.
- `POST /api/applications/:id/ats-screen`: Enqueues ATS screening AI evaluation, advancing `APPLIED` to `ATS_SCREENING`.
- `POST /api/applications/:id/offer/accept`: Unlocked at `OFFER` stage; transitions user to `careerRole: 'EMPLOYEE'` and auto-withdraws other active applications.

### 20.5 Multi-Stage Chat Engine (`StageEngineService`)

- **Single Reusable Engine:** Manages all multi-turn conversational stages (`SCREENING`, `ASSESSMENT`, `INTERVIEW`) without duplicate pipelines.
- **Stage & Mode Configuration (`PlatformConfig.stages`):**
  - Configurable parameters per stage: `questionCount`, `difficulty` (`EASY` | `MEDIUM` | `HARD`), `passingScore` (0-100), `demoQuestionCount`, and `demoDifficulty`.
  - Default production limits:
    - `SCREENING`: 3 questions, MEDIUM, passing score 70.
    - `ASSESSMENT`: 3 questions, HARD, passing score 70.
    - `INTERVIEW`: 5 questions, HARD, passing score 75.
  - Demo mode overrides: 1 question, EASY difficulty across all chat stages.
- **Data Models:**
  - `interviews` collection (`InterviewModel`): Session metadata, stage, current index, total questions, status (`IN_PROGRESS`, `WAITING_AI`, `COMPLETED`, `ABANDONED`), overall score. Indexed on `{ applicationId: 1, stage: 1 }`.
  - `questions` collection (`QuestionModel`): Dynamic questions, sequence number, expected points, difficulty. Indexed on `{ interviewId: 1, sequenceNumber: 1 }`.
  - `answers` collection (`AnswerModel`): Candidate responses, AI evaluation (score 0-100, strengths, weaknesses, notes). Indexed on `{ questionId: 1 }`.
- **Dynamic Context Generation & Trimming:**
  - Questions grounded in job requisition, candidate profile skills, resume extraction summary, and conversation history.
  - Prior conversation history trimmed to character budget (`MAX_HISTORY_CHAR_BUDGET = 8000`) keeping most recent turns to fit token limits.
- **Authoritative Backend Scoring:**
  - AI evaluates individual turns (schema: `{ score, strengths, weaknesses, notes }`).
  - Upon final answer submission, backend computes arithmetic mean of all turn scores.
  - If $averageScore \ge passingScore$: advances stage via `ApplicationStateMachine.advanceStage`, persists `Evaluation` record, completes interview.
  - If $averageScore < passingScore$: rejects via `ApplicationStateMachine.reject`, generates AI diagnostic feedback (`{ whatToImprove, whatToAdd, skillsToWorkOn, summary }`), persists `Feedback` and `Evaluation` records, completes interview.
- **Chat REST API Endpoints:**
  - `GET /api/applications/:id/stage` (alias `/interview`): Retrieves stage state, questions, prior answers, and waiting status.
  - `POST /api/applications/:id/stage/messages` (alias `/interview/messages`): Submits candidate answer, returns turn evaluation + next question or stage completion result.
- **Sequence Guards:** Strict validation prevents duplicate answers, out-of-order submissions, question skipping, and concurrent submissions.

### 9.7 Final Review, Offer Negotiation & Notification Dispatch (TASK P6.4, P6.5)

- **Final Review Engine (`FinalReviewOfferService`):**
  - Authoritatively aggregates weighted stage scores: ATS (15%), Screening (20%), Assessment (30%), Interview (35%).
  - Evaluates passing score against PlatformConfig (70 threshold). AI generates executive summary and key strengths/gaps only.
  - If passing: advances to `OFFER`, seeds initial offer at level band midpoint. If failing: rejects with comprehensive diagnostic feedback.
- **Conversational Offer Negotiation:**
  - Candidate requests adjustments; AI acts as HR negotiation advisor; backend strictly clamps counter-offers to level bounds and caps negotiation rounds.
- **Atomic Acceptance & In-App Notifications:**
  - Executes MongoDB ACID transaction creating `CompanyEmployee`, updating user `careerRole = 'EMPLOYEE'`, incrementing company `employeeCount`, and auto-withdrawing competing applications.
  - Notifications dispatched for `STAGE_ADVANCED`, `APPLICATION_REJECTED` (with `/feedback` link), `OFFER_RECEIVED`, `HIRED`, and `APPLICATION_EXPIRED`.

### 9.8 Admin Demo Hiring Simulator Architecture & Production Isolation (TASK P6.6)

- **Unified Hiring Engine Reuse:**
  - Runs on the exact same core services (`AtsScreeningService`, `StageEngineService`, `FinalReviewOfferService`).
  - Parameterized by domain, question count (1–10), difficulty (`EASY` | `MEDIUM` | `HARD`), and interview type.
  - Instantiates `Application` with `mode: 'DEMO'`, automatically directing all AI requests to `pool: 'DEMO'`.
- **Zero Production Contamination Guarantee:**
  - Dedicated demo company (`CorpVerse Demo Corporation`) with `aiProviderPool: 'DEMO'`.
  - In `FinalReviewOfferService.acceptOffer`: demo mode applications mark the offer as accepted but strictly skip `CompanyEmployee` document creation, user `careerRole` changes, company `employeeCount` mutation, and economy ledger writes.
  - Production leaderboards and rankings filter strictly on `mode: 'PRODUCTION'` and exclude demo companies.
- **Admin Control & Inspection Endpoints (`/api/admin/demo/hiring`):**
  - `POST /demo/hiring`: Initializes parameterized session in `demoSessions` collection.
  - `GET /demo/hiring/:sessionId`: Aggregates all stage evaluations, answers, questions, and AI telemetry (jobs, latency, tokens).
  - `POST /demo/hiring/:sessionId/step`: Steps through the current stage.
  - `POST /demo/hiring/:sessionId/answer`: Submits candidate answer to active chat question.
  - `POST /demo/hiring/:sessionId/simulate`: Automates entire lifecycle end-to-end for instant demonstration.
  - `DELETE /demo/hiring/:sessionId` & `DELETE /demo/hiring`: Purges demo data and records immutable audit log in `auditLogs`.

### 9.9 Candidate Hiring Journey Presentation Architecture (TASK P6.7)

- **Pure Presentation & Authoritative Backend Contract:**
  - The frontend React client displays state fetched directly from `/api/applications`, `/api/applications/:id/stage`, `/api/applications/:id/offer`, and `/api/notifications`. It executes zero scoring calculations, progression decisions, or salary bound clampings.
- **Application Tracker (`ApplicationsTrackerPage` at `/applications`):**
  - Displays concurrent application quota utilization (`x/5`) using an animated meter bar mapped to `PlatformConfig.applications.maxActive`.
  - Visual 8-stage linear stepper pipeline (`APPLIED` $\rightarrow$ `ATS_SCREENING` $\rightarrow$ `SCREENING` $\rightarrow$ `ASSESSMENT` $\rightarrow$ `INTERVIEW` $\rightarrow$ `FINAL_REVIEW` $\rightarrow$ `OFFER` $\rightarrow$ `ACCEPTED`) per application card with status checkmarks, active pulsing glowing indicators, and failure badges.
  - Contextual stage CTAs ("Enter Interview", "Review Offer & Negotiate", "View Rejection Feedback", and "Withdraw Application" with confirmation modal).
- **Stage Chat Interface (`StageChatPage` at `/applications/:id/stage`):**
  - Multi-turn conversational interface for `SCREENING`, `ASSESSMENT`, and `INTERVIEW` stages.
  - Bubble dialogue with AI interviewer prompts, question difficulty, and category tags.
  - Turn evaluation cards attached to candidate responses displaying score pills, strengths, weaknesses, and notes.
  - Pulsing 3-dot typing / waiting indicator when AI evaluation is queued.
  - Strict anti-duplicate submission lock preventing multiple submissions while awaiting AI.
- **Feedback Viewer Modal (`FeedbackModal`):**
  - Displays structured rejection diagnostics from `GET /api/applications/:id/feedback`.
  - Renders missing skills tag cloud, demonstrated strengths, weaknesses, and actionable recommendations.
- **Offer Review & Negotiation Interface (`OfferPage` at `/applications/:id/offer`):**
  - Executive summary showing position title, level, simulated annual compensation, and salary band range slider.
  - Conversational negotiation chat tracking remaining round counters (`x of y rounds`).
  - Atomic acceptance action promoting candidate to `EMPLOYEE` and auto-withdrawing competing applications, followed by workplace transition celebration view.
- **Topbar In-App Notification Bell (`NotificationBell`):**
  - Integrated into global `Topbar.tsx` with animated unread badge.
  - Dropdown popover listing notifications with category icons, relative timestamps, click-to-read navigation to target routes, and "Mark all read" action.

### 9.10 Admin Demo Hiring Console Architecture (TASK P6.8)

- **Dedicated Admin Console (`AdminDemoPage` at `/admin/demo`):**
  - Guarded strictly by `RoleRoute` with `allowedPlatformRoles={['ADMIN']}`.
  - Accessible via Sidebar navigation under Platform Administration (`Hiring Demo Simulator`).
- **Interactive Control Surface Modules:**
  1. **Demo Setup Form:** Configures career domain (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), question count (1–10), difficulty tier (`EASY`, `MEDIUM`, `HARD`), and interview type (`CONCEPTUAL`, `CODING`, `ARCHITECTURE`, `BEHAVIORAL`). Submits to `POST /api/admin/demo/hiring`.
  2. **Interactive Candidate Runner:** Embedded chat UI rendering AI interviewer prompts and turn-by-turn candidate response submission (`POST /api/admin/demo/hiring/:sessionId/answer`), single stage-step progression (`POST /api/admin/demo/hiring/:sessionId/step`), and one-click end-to-end simulation (`POST /api/admin/demo/hiring/:sessionId/simulate`).
  3. **Stage Results Synthesis Panels:** Renders stage scores including Stage 1 ATS screening score & summary, Final Review weighted multi-stage synthesis (ATS 15%, Screening 20%, Assessment 30%, Interview 35%), and Formal Employment Offer terms (simulated salary, position title, level band).
  4. **Per-Call AI Telemetry Inspector:** Displays comprehensive execution log of every AI gateway request including task type, AI provider (`GEMINI`, `OPENAI`, `GROQ`), model ID, round-trip latency in milliseconds, token counts (prompt & completion), and execution status.
  5. **Session Management & Audited Cleanup:** Historical sessions table with inspection, single-session cleanup (`DELETE /api/admin/demo/hiring/:sessionId`), and system-wide bulk purge modal (`DELETE /api/admin/demo/hiring`) requiring mandatory audit justification reasons recorded in the append-only `auditLogs` collection.

---

## 10. Employee Task System & Daily Work Engine Architecture (TASK P7.2)

### 10.1 Daily Task Data Model & Idempotency Invariants

- **`employeeTasks` Collection:**
  - `employeeId`: `Types.ObjectId` referencing `companyEmployees` (indexed).
  - `userId`: `Types.ObjectId` referencing `users` (indexed).
  - `companyId`: `Types.ObjectId` referencing `companies` (indexed).
  - `domain`: `CareerDomain` (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
  - `level`: Number (1–10).
  - `kind`: `TaskKind` (`'PRIMARY'` | `'BONUS'`).
  - `difficulty`: `TaskDifficulty` (`'EASY'` | `'MEDIUM'` | `'HARD'`).
  - `maxExp`: Number (30, 60, or 100), authoritatively derived from difficulty tier and `PlatformConfig.employee`.
  - `status`: `EmployeeTaskStatus` (`'ASSIGNED'`, `'IN_PROGRESS'`, `'SUBMITTED'`, `'EVALUATED'`, `'EXPIRED'`, `'WAITING_FOR_PROVIDER'`).
  - `scenario`: Structured scenario object (`title`, `scenario`, `requirements: string[]`, `difficulty`, `evaluationCriteria: string[]`).
  - `dayKey`: String (`YYYY-MM-DD` in UTC).
  - `dueAt`: UTC timestamp for end of calendar day (23:59:59.999 UTC).
  - `aiJobId`: Optional reference to background `AIJob` document during queue processing.
- **Compound Unique Index:**
  - `{ employeeId: 1, dayKey: 1, kind: 1 }` (unique: true).
  - Guarantees zero duplicate task issuance per employee per calendar day without background cron schedulers.

### 10.2 Authoritative Option A Difficulty & Max EXP Resolution

- **Option A (Graduated Stretch) Mapping:**
  - **L1–L3 (Intern, Junior, Junior+):** PRIMARY = `EASY` (30 maxExp), BONUS = `MEDIUM` (60 maxExp).
  - **L4–L6 (Associate, Mid, Mid+):** PRIMARY = `MEDIUM` (60 maxExp), BONUS = `HARD` (100 maxExp).
  - **L7–L10 (Senior, Senior+, Lead, Principal):** PRIMARY = `HARD` (100 maxExp), BONUS = `HARD` (100 maxExp).
- **Backend Authority Invariant:**
  - LLMs cannot set task difficulty or EXP rewards. Backend code strictly computes difficulty from employee level and resolves `maxExp` from `PlatformConfig.employee` limits (`easyMaxExp: 30`, `mediumMaxExp: 60`, `hardMaxExp: 100`).

### 10.3 Lazy, On-Demand Generation Protocol (`DailyTaskService`)

- **Cron-Free Design:**
  - When an employee opens their dashboard or queries `GET /api/employee/tasks/today`, `DailyTaskService.getOrCreateDailyTasks({ userId })` evaluates whether today's `PRIMARY` and `BONUS` tasks already exist for that employee and `dayKey`.
  - If both tasks exist, they are returned immediately with zero AI Gateway invocations or database mutations.
  - If tasks do not exist, missing kinds are generated on-demand and persisted.
  - Concurrent incoming requests are protected against race conditions by catching MongoDB duplicate key errors (`code: 11000`) and fetching the concurrently generated task.

### 10.4 AI Resilience, WAITING_FOR_PROVIDER Fallback & Background Queue Fulfillment

- **AI Gateway Integration:**
  - Calls `AIGateway.execute` with `taskType: 'TASK_GENERATION'` in the `PIPELINE` pool.
  - Prompts are grounded in the employer company's profile, domain, employee level, and target difficulty.
  - Output is strictly validated against `taskGenerationOutputSchema` (Zod) and `taskGenerationJsonSchema`.
- **Graceful Fallback:**
  - If all AI providers are unavailable, degraded, or encounter rate limits, the task document is still created with `status: 'WAITING_FOR_PROVIDER'` and placeholder scenario text so the employee sees their queued tasks.
  - An asynchronous background job is queued via `AIGateway.submit`.
  - An `AIWorker` handler automatically intercepts the completed job and updates the task from `WAITING_FOR_PROVIDER` to `ASSIGNED` with full scenario details.
  - Subsequent requests to `getOrCreateDailyTasks` also attempt synchronous re-generation if provider availability has recovered.

### 10.5 Employee RBAC & API Endpoints

- **`GET /api/employee/tasks/today` & `GET /api/v1/employee/tasks/today`:**
  - Authenticated via `authenticateJwt`.
  - Guarded by `requireCareerRole('EMPLOYEE')` (denies `JOB_SEEKER` or `NONE` with 403 Forbidden).
  - Returns array of today's tasks (PRIMARY first, then BONUS).
- **`GET /api/employee/tasks/:id` & `GET /api/v1/employee/tasks/:id`:**
  - Authenticated via `authenticateJwt`.
  - Guarded by `requireCareerRole('EMPLOYEE')` with employee ownership verification.

### 10.6 Task Submission, AI Evaluation & Authoritative EXP Awarding (TASK P7.3)

- **Mongoose Data Models:**
  - `TaskSubmissionModel` (`taskSubmissions` collection): `taskId`, `userId`, `content` (10–50,000 characters), `submittedAt`, timestamps. Compound unique index on `{ taskId: 1 }` prevents double submissions.
  - `PerformanceRecordModel` (`performanceRecords` collection): `taskSubmissionId`, `taskId`, `userId`, `companyId`, `aiScore`, `scoreBand`, `awardedExp`, `feedback`, `strengths`, `weaknesses`, `criteriaScores: [{ criterion, score, comment }]`, timestamps. Compound unique index on `{ taskSubmissionId: 1 }` guarantees idempotent evaluation.
- **Submission Protocol (`submitTask`):**
  - Asserts employee task ownership and active employment status in `CompanyEmployee`.
  - Enforces deadline strictly: if `Date.now() > task.dueAt` or `task.status === 'EXPIRED'`, the task transitions to `'EXPIRED'` and the submission is rejected with 400 (`Task deadline has passed`).
  - Transitions task status to `'SUBMITTED'`.
- **Authoritative AI Evaluation Protocol (`evaluateSubmission`):**
  - AI Gateway execution: Calls `AIGateway.execute` with `taskType: 'TASK_EVALUATION'` in `PIPELINE` pool, providing full employer context, domain, level, scenario requirements, rubric evaluation criteria, and candidate submission.
  - Schema validation: Validated against strict Zod schema `taskEvaluationOutputSchema` and JSON Schema `taskEvaluationJsonSchema`.
  - **Score Clamping & EXP Invariant:** Raw score from AI is clamped to $[0, 100]$ via `clampScore`. Awarded EXP is calculated via pure `calculateTaskExp(clampedScore, task.maxExp)` and bounded strictly to $[0, \text{maxExp}]$. Even if AI returns 150, negative values, NaN, or strings, awarded EXP never exceeds `maxExp` and user total EXP never decreases.
  - **Idempotency Guarantee:** If `PerformanceRecordModel.findOne({ taskSubmissionId })` exists, the service immediately returns the existing record without invoking the AI Gateway or awarding additional EXP.
  - **Double-Entry Ledger:** EXP is awarded via `LevelService.awardTaskExp` with `sourceId = submission._id`, recording an immutable `ExpTransaction` in `expTransactions`.
  - **Notification:** Sends an in-app notification of type `'TASK_EVALUATED'` with links to the evaluated task.

### 10.7 Employee Performance Statistics Aggregation

- **Aggregation Protocol (`getEmployeePerformanceStats`):**
  - `completedTasksCount`: Total number of performance records for the user.
  - `averageScore`: Running arithmetic mean of clamped AI scores across completed submissions.
  - `scoreBandsCount`: Frequency map across `POOR` (0–39), `NEEDS_IMPROVEMENT` (40–59), `ACCEPTABLE` (60–74), `GOOD` (75–89), and `EXCELLENT` (90–100).
  - Used for promotion eligibility checks per Spec Section 11.3 (D17: average score $\ge 70$, required completed tasks).
- **New Endpoints:**
  - `POST /api/employee/tasks/:id/submit`: Submits work, triggers evaluation, returns submission and performance record.
  - `GET /api/employee/tasks/:id/evaluation`: Retrieves evaluation and rubric scoring details.
  - `GET /api/employee/performance/stats`: Returns aggregated performance stats.

### 10.8 Discipline System, Warning Natural Decay & Employment Reviews (TASK P7.4)

- **Mongoose Data Models:**
  - `WarningModel` (`warnings` collection, Spec 26.20): `userId`, `companyId`, `taskSubmissionId`, `status` (`'ACTIVE'`, `'EXPIRED'`, `'RESOLVED'`, `'ESCALATED'`), `reason`, `issuedAt`, `expiresAt`. Compound indexes `{ userId: 1, companyId: 1, status: 1, expiresAt: 1 }`, and unique `{ taskSubmissionId: 1 }`.
  - `DemotionModel` (`demotions` collection, Spec 26.22): `employeeId`, `userId`, `companyId`, `previousLevel`, `newLevel`, `previousPositionTitle`, `newPositionTitle`, `previousSalarySimulated`, `newSalarySimulated`, `activeWarningCount`, `reason`, `demotedAt`.
  - `EmploymentReviewModel` (`employmentReviews` collection, Spec 26.21): `trigger`, `activeWarningCount`, `decision` (`'DEMOTION'`, `'TERMINATION'`), `reason`, `aiRecommendation`, `reviewedAt`.
- **Warning Natural Query Decay (Cron-Free Invariant):**
  - Active warnings are computed strictly as `{ userId, companyId, status: 'ACTIVE', expiresAt: { $gt: now } }`.
  - Stored `expiresAt = issuedAt + warningExpirationDays` (30 days from `PlatformConfig.employee`).
  - Naturally decays without needing any scheduled cron workers.
- **Rule D4 Warning Issuance:**
  - Issued automatically on Poor performance band ($0 \le \text{score} \le 39$) during task evaluation.
  - Idempotent: exactly one warning per evaluated task submission.
  - Dispatches `'WARNING_ISSUED'` in-app notification.
- **Rule D5 Authoritative Employment Review:**
  - Triggered automatically when active warnings reach or exceed `warningThreshold` (4 from `PlatformConfig.employee`).
  - AI may supply advisory commentary text only; backend authoritatively executes the business decision:
    - **Demotion Branch (`employee.level > 1`):** Decrements employee level by 1, recalculates position title and simulated salary from `PlatformConfig.career.levels`, logs to `demotions`, resets active warnings to `'RESOLVED'`, and leaves user total EXP untouched.
    - **Termination Branch (`employee.level === 1`):** At Level 1 Intern, further demotion is impossible. Transitions employee to `'TERMINATED'`, decrements `CompanyModel.employeeCount` by 1, reverts user to `'JOB_SEEKER'`, while permanently preserving accumulated EXP, level history, skills, resume, and profile.
- **Admin Force-Termination:**
  - Requires confirmation payload `confirmation: 'CONFIRM_FORCE_TERMINATE'` and minimum 10-character reason.
  - Generates immutable audit log in `auditLogs` with `actorRole: 'ADMIN'`, `action: 'ADMIN_MUTATION'`, `targetType: 'companyEmployees'`.
  - Preserves employee history and career EXP intact.
- **Endpoints:**
  - `GET /api/employee/warnings`: Returns employee's unexpired active warnings and active count (`requireCareerRole('EMPLOYEE')`).
  - `POST /api/admin/employees/:id/terminate`: Admin force-termination endpoint (`requirePlatformRole('ADMIN')`).

### 10.9 Employee Promotion Engine & Real-Time Progression Telemetry (TASK P7.5)

- **Mongoose Data Model (`promotions` collection, Spec 26.21):**
  - `PromotionModel`: `userId`, `companyId`, `employeeId`, `previousLevel`, `newLevel`, `previousPositionTitle`, `newPositionTitle`, `previousSalarySimulated`, `newSalarySimulated`, `totalExpSnapshot`, `reason`, `aiRecommendation`, `promotedAt`.
  - Indexed on `{ userId: 1, promotedAt: -1 }` and `{ companyId: 1, promotedAt: -1 }`.
- **PlatformConfig Rules Matrix (`PlatformConfig.employee.promotionRules`):**
  - Defines per-target-level thresholds for `minExp`, `requiredCompletedTasks`, `minAverageScore` (default 70), and `maxActiveWarnings` (default 1).
  - Encodes the canonical Spec Section 11.3 & D17 progression matrix (e.g. $L4 \rightarrow L5$: $3,000$ EXP, $10$ completed tasks, $\ge 70$ avg score, $\le 1$ active warning).
- **Authoritative Deterministic Evaluation (`PromotionService`):**
  - Evaluates all 4 criteria independently. All four criteria must evaluate to true simultaneously to qualify for promotion.
  - Automatically handles maximum level boundary ($L10$ Principal) with `isMaxLevel = true`.
  - When eligible, mutates `CompanyEmployee` (increments level, assigns new title and simulated salary from `PlatformConfig.career.levelTable` and `salaryBands`), writes immutable audit record to `promotions`, and dispatches `'PROMOTION'` in-app notification.
- **Advisory AI Non-Deciding Invariant:**
  - AI may supply optional qualitative commendation remarks (`aiRecommendation`), but possesses zero decision-making authority. If AI fails, times out, or is omitted, backend promotions execute deterministically based purely on quantitative criteria.
- **Post-Evaluation Trigger:**
  - Invoked automatically in `TaskEvaluationService.evaluateSubmission` following every daily task evaluation and EXP award.
- **Endpoints:**
  - `GET /api/employee/promotion/progress`: Returns real-time progression telemetry detailing met versus missing requirements (`requireCareerRole('EMPLOYEE')`).

### 10.10 Employee Workplace Frontend Architecture (TASK P7.6)

- **Presentation Pages:**
  - `WorkplaceDashboardPage` (`/workplace`, `/employee/dashboard`):
    - Company deployment header with simulated annual salary.
    - Founder Mode status banner highlighting locked/unlocked state with progress bar showing remaining EXP needed to reach the 12,000 EXP threshold.
    - Career Level card, total accumulated EXP meter, and active disciplinary warnings count.
    - Active Disciplinary Warnings section listing unexpired warnings with expiration dates and days-remaining countdowns.
    - Promotion Readiness panel displaying live status across all 4 criteria (EXP, tasks completed, average score, active warnings) with progress bars and missing requirements feedback.
    - Today's Daily Engineering Tasks grid with Primary and Bonus tasks, difficulty tier badges, maximum EXP rewards, and on-demand generation triggers.
  - `TaskWorkPage` (`/tasks/:id`):
    - Scenario brief containing title, domain level, technical narrative, core requirements, and rubric criteria.
    - Solution answer editor with minimum 10-character validation and client-side single-submission guard.
    - Post-evaluation score hero (aiScore / 100), performance score band badge, awarded EXP pill, and qualitative evaluator feedback.
    - Deficiencies, observed strengths, and criterion-by-criterion rubric scoring breakdown.
    - Disciplinary warning alert when score is in the Poor band ($\le 39$).
  - `TaskHistoryPage` (`/tasks/history`):
    - Tab 1: Evaluated tasks table showing date, title, kind, tier, score band, awarded EXP, and rubric drill-down link.
    - Tab 2: Double-entry EXP transaction ledger showing immutable timestamp, type, amount, balance after, and source justification.
- **AI Waiting States Telemetry:**
  - Surfaces purple `WAITING_FOR_PROVIDER` banner and status badge when tasks are queued during degraded provider conditions.
  - Interactive spinner indicator during active AI Evaluator scoring of submitted solutions.
- **Backend APIs:**
  - `GET /api/employee/company`: Returns authenticated employee's active company details.
  - `GET /api/employee/tasks/history`: Returns completed task history with performance records.
  - `GET /api/employee/ledger/exp`: Returns immutable double-entry EXP transaction ledger entries.





