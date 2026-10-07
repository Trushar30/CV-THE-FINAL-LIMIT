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
   │ • Audit Logs & Queue   │   │ • xAI Grok             │
   │ • Binary Resume Files  │   └────────────────────────┘
   └────────────────────────┘
```

### Non-Negotiable Core Principles
1. **The Backend is Authoritative:**
   The frontend is an untrusted presentation layer. It displays values but never computes or directly mutates balances (EXP, CorpCoin), employee levels, warnings, company financial health, roles, or permissions. All decisions and validations happen on the backend.
2. **AI Recommends, Backend Decides:**
   AI models generate scores, unstructured or structured evaluations, and scenario narratives. The backend inspects these outputs, validates them against strict Zod schemas, clamps numeric outputs within safe boundaries, and executes database mutations. Under no circumstances does an LLM prompt or response directly write to user balances or trigger role changes.
3. **Decoupled AI Gateway & Provider Adapters:**
   Business services never directly import or invoke vendor SDKs (Google GenAI, OpenAI, Grok). All AI requests flow through `AIGateway` -> `ProviderRouter` -> `ProviderAdapter`. Companies and bots are provider-agnostic.
4. **Immutable Transaction Ledgers:**
   Balances for EXP and CorpCoin cannot be incremented or decremented without an accompanying entry in `expTransactions` or `corpCoinTransactions`. Every ledger record requires `userId`, `amount`, `balanceAfter`, `type`, `referenceId` / `sourceId`, and a timestamp.
5. **Universal Audit Logging:**
   Every sensitive administrative action (Admin or AI Manager) writes an immutable record to `auditLogs` containing actor identity, action type, target ID, previous state, new state, timestamp, and justification.
6. **Zero Magic Numbers (Centralized PlatformConfig):**
   All business thresholds, economic rates, level boundaries, task limits, and retry policies are defined in a centralized `PlatformConfig` entity. Business logic consumes these values dynamically.
7. **Absolute Credential Isolation:**
   All external API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROK_API_KEY`, JWT secrets) reside exclusively in server-side environment configurations. They are never transmitted to clients or exposed in response payloads.

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
| Role Attribute | Valid Values | Description |
|---|---|---|
| `careerRole` | `JOB_SEEKER` | Active job applicant; can apply to jobs (max 5 active), attend interviews. |
| | `EMPLOYEE` | Employed at a platform or founder company; receives daily tasks. |
| | `FOUNDER` | Company owner; manages company, bots, and strategic decisions. |
| | `NONE` | Assigned to dedicated administrative or system accounts. |
| `platformRole`| `NONE` | Standard user participating in the simulation. |
| | `ADMIN` | System administrator with full oversight, configuration rights, and demo mode. |
| | `AI_MANAGER` | LLM infrastructure operator; manages provider routing, health, and fallbacks. |

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
       GeminiAdapter OpenAIAdapter GrokAdapter
             │            │            │
             ▼            ▼            ▼
         Gemini API   OpenAI API   Grok API
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
  taskType: 'RESUME_PARSING' | 'ATS_EVALUATION' | 'INTERVIEW_QUESTION' | 
            'INTERVIEW_EVALUATION' | 'TASK_GENERATION' | 'TASK_EVALUATION' | 
            'SCENARIO_GENERATION' | 'SCENARIO_EVALUATION';
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
  provider: 'gemini' | 'openai' | 'grok';
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
    amount: number;             // Strictly positive in gameplay awards
    balanceAfter: number;
    type: 'TASK_COMPLETION' | 'ADMIN_ADJUSTMENT';
    sourceId: ObjectId;         // e.g. taskSubmissionId
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
    amount: number;             // Positive (income/grant) or negative (expense/purchase)
    balanceAfter: number;
    type: 'FOUNDER_STARTER_GRANT' | 'COMPANY_CREATION' | 'BOT_PURCHASE' | 
          'BUSINESS_REVENUE' | 'BUSINESS_EXPENSE' | 'ADMIN_ADJUSTMENT';
    referenceId?: ObjectId;     // e.g. botId, companyId, scenarioId
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
- `aiProviders`: Configured LLM providers (Gemini, OpenAI, Grok) with health, priority, and credentials references.
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

## 12. Centralized PlatformConfig Schema

The default `platformConfigs` record seeds all fixed V1 limits:
```json
{
  "version": 1,
  "founder": {
    "unlockExp": 12000,
    "starterCorpCoin": 1000
  },
  "company": {
    "creationCost": 100,
    "maxEmployees": 20,
    "bankruptcyThreshold": -1000
  },
  "bots": {
    "basicHiring": 250,
    "basicTask": 250,
    "basicEvaluation": 250,
    "advancedHiring": 400,
    "advancedTask": 400,
    "advancedEvaluation": 400
  },
  "employee": {
    "dailyPrimaryLimit": 1,
    "dailyBonusLimit": 1,
    "warningThreshold": 4,
    "warningExpirationDays": 30,
    "taskMaxExp": {
      "EASY": 30,
      "MEDIUM": 60,
      "HARD": 100
    }
  },
  "applications": {
    "maxActive": 5
  },
  "ai": {
    "retryPerProvider": 3,
    "providerPriority": ["gemini", "openai", "grok"],
    "timeoutMs": 30000
  },
  "security": {
    "maxLoginAttempts": 5,
    "lockoutDurationMinutes": 15,
    "resumeMaxSizeBytes": 10485760
  }
}
```
