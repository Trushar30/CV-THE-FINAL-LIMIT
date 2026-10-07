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

1. **Upload Handling:**
   - Client sends multipart file (PDF or DOCX, max 10 MB).
   - Middleware reads the first bytes (magic bytes) to verify genuine file signature (`%PDF-` for PDF, `PK\x03\x04` for DOCX). Extensions are never trusted on their own.
2. **GridFS Storage:**
   - Binary stream is piped into MongoDB GridFS bucket (`resumes.files` and `resumes.chunks`).
3. **Decoupled Entities:**
   - `resumes`: Metadata pointer containing `fileId`, `filename`, `mimeType`, `sizeBytes`, `checksum`.
   - `resumeAnalyses`: Asynchronous parsed representation containing extracted technical skills, years of experience, education, domain classification.
   - `profiles`: User profile document referencing `resumeId` and `resumeAnalysisId`. Binary data is never embedded in user documents.

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

- **Tokens & Themes:** Defined in `styles/tokens.css` and `styles/themes.css`. Dark theme is default cyber-corporate; light theme is clean high-contrast. Modular 4px spacing scale, semantic color palettes (EXP violet, CorpCoin gold, cyber cyan, status emerald/warning/danger/info), and typographic hierarchy.
- **Pure Vanilla CSS:** Scoped via CSS Modules (`[Component].module.css`) with zero third-party UI dependencies.

### 14.2 Reusable UI Component Library

- **Core Primitives:** `Button` (loading spinner, disabled, variants, icons), `Input` (labels, error states, prefixes/suffixes), `Card` (glassmorphism, elevation, hoverable), `Modal` (backdrop blur, accessibility, ESC key, scroll lock), `Table` (responsive wrapper, alignment, striped/hoverable), `Badge` (pill styling, dot indicators), `Toast` (`ToastProvider`, stacked floating notifications, auto-dismiss), `Spinner` (sizes, colors), `EmptyState` (action slot), `ProgressBar` (level progression, glow, shimmer animation), `Tabs` (pills and underline variants).

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
- **Locked Career Domains:** Enforced via TypeScript enum and Mongoose validation:
  - `SOFTWARE_ENGINEERING`
  - `CLOUD_ENGINEERING`
  - `AI_ENGINEERING`
  - _Domain is selected once during onboarding and is immutable thereafter._
- **Mandatory Profile Fields:**
  - `displayName`: 2–80 characters string.
  - `domain`: One of the 3 locked career domains.
  - `skills`: Array of 1 to 50 lowercase trimmed strings.
- **Optional Profile Fields:**
  - `bio`: Max 500 characters.
  - `githubUrl`, `linkedinUrl`, `portfolioUrl`: Validated URL strings.
  - `projects`: Subdocuments with `title`, `description`, `technologies`, `repositoryUrl`, `liveUrl`.
  - `certifications`: Subdocuments with `name`, `issuer`, `issueDate`, `credentialId`, `credentialUrl`.
  - `resumeFileId`: Reserved MongoDB ObjectId referencing `resumeFiles` collection (populated in TASK P2.4).

### 17.2 Authoritative Role Transition Lifecycle

The backend remains authoritative across all onboarding and career role progressions:

1. **Initial Registration:** User document initialized with `careerRole = 'NONE'` and `onboardingStep = 'REGISTERED'`.
2. **Email Verification:** User completes verification; `emailVerified = true`, `onboardingStep = 'EMAIL_VERIFIED'`.
3. **Profile Setup (`POST /api/profile/setup`):**
   - Requires verified, active session (`authenticateJwt`).
   - Checks if a profile already exists for `userId`; if so, rejects with `409 Conflict` (`BUSINESS_RULE_VIOLATION`).
   - Validates payload against `profileSetupSchema` with strict Zod constraints.
   - Atomically inserts profile document.
   - Authoritatively promotes user:
     - `user.careerRole = 'JOB_SEEKER'`
     - `user.onboardingStep = 'PROFILE_COMPLETED'`
   - Dispatches audit log recording `USER_PROFILE_SETUP`.
4. **Subsequent Profile Management:**
   - `GET /api/profile/me`: Retrieves candidate profile linked to current user.
   - `PUT /api/profile/me`: Allows updating optional details (`bio`, `skills`, URLs, projects, certifications) with strict Zod validation; `domain` and `userId` are protected against modification.
   - `GET /api/profile/domains`: Serves domain catalog, descriptions, and recommended skill tags.

### 17.3 Client Profile Wizard & Route Guard Navigation

- **Profile Wizard (`ProfileSetupPage.tsx`):** 3-step interactive onboarding flow:
  1. _Domain Selection:_ Interactive domain cards highlighting specialization and tech focus.
  2. _Skills & Details:_ Display name input, quick-add suggested skill chips, custom skill tagging, and optional bio/URLs.
  3. _Review & Activation:_ Summary review card with authoritative activation submission triggering transition to Job Seeker.
- **Route Guard Protection:**
  - `RoleRoute`: If a verified candidate with `careerRole: 'NONE'` attempts to access Job Seeker features (`/job-seeker/*`), the router gracefully redirects them to `/profile/setup`.
  - `Sidebar`: Dynamic navigation renders "Candidate Onboarding" link for candidates with `careerRole: 'NONE'`.
