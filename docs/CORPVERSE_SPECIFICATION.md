# CorpVerse v1.0 — Master Technical & Functional Specification

> **NO-INVENTION RULE:** If a behavior, limit, formula, permission, state transition, API behavior, or configuration value is not defined in this CorpVerse specification or `PlatformConfig`, the implementation must not invent it. The coding AI must mark it as `TODO` and ask for a decision.

---

## 1. Product Definition

**CorpVerse** is an interactive, gamified virtual corporate simulation designed to bridge the gap between academic computer science education and practical corporate software engineering. By synthesizing simulated corporate governance, dual-currency economic mechanics, and a multi-provider artificial intelligence ecosystem, CorpVerse provides students and fresh graduates with an authentic, consequence-driven professional sandbox.

### 1.1 Core Subsystems

The system is partitioned into three decoupled, collaborating backend subsystems:

```
┌────────────────────────────────────────────────────────┐
│                       CORPVERSE                        │
└───────────────────────────┬────────────────────────────┘
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   Career System   │ │     AI System     │ │  Economy System   │
├───────────────────┤ ├───────────────────┤ ├───────────────────┤
│ • Job Seeker      │ │ • Gemini Adapter  │ │ • EXP Ledger      │
│ • Employee        │ │ • OpenAI Adapter  │ │ • CorpCoin Ledger │
│ • Founder         │ │ • Groq Adapter    │ │ • Levels & Rank   │
│ • State Machines  │ │ • Gateway & Queue │ │ • P&L Simulation  │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

1. **Career System:** Governs the user progression lifecycle (Job Seeker $\rightarrow$ Employee $\rightarrow$ Founder), job applications, hiring pipelines, on-demand daily task issuance, performance warnings, reviews, demotions, and promotions.
2. **AI System:** Powers automated ATS evaluations, conversational technical interviews, contextual task creation, submission scoring, transparent feedback delivery, and founder business scenarios across multiple external LLM providers (Google Gemini, OpenAI, Groq).
3. **Economy System:** Maintains immutable double-entry ledgers for personal career mastery (EXP) and corporate capital (CorpCoin), computing levels, company balance sheets, deterministic business simulations, and bankruptcy liquidation.

### 1.2 Problems Addressed

- **The Graduate Reality Gap:** Fresh graduates lack hands-on exposure to corporate workflows, scenario-based debugging, and organizational accountability.
- **Opaque ATS and Bot Rejections:** Real-world candidate filtering bots reject applicants without actionable diagnostic feedback. CorpVerse mandates rich, constructive feedback across all rejection stages.
- **Lack of Structured Practice:** Traditional puzzle platforms lack realistic corporate consequences (such as warnings, performance reviews, demotions, promotions, and company bankruptcies).

---

## 2. User Roles

User authorization is governed by two orthogonal database fields, ensuring system administration remains separate from in-game progression:

- `careerRole`: In-game simulation progression role.
- `platformRole`: Privileged system management role.

```typescript
type CareerRole = 'JOB_SEEKER' | 'EMPLOYEE' | 'FOUNDER' | 'NONE';
type PlatformRole = 'NONE' | 'ADMIN' | 'AI_MANAGER';
```

### 2.1 Career Roles (`careerRole`)

- **`JOB_SEEKER`:** The default role upon registration. Can create/edit profiles, upload resumes, browse company directories, and submit up to 5 concurrent job applications.
- **`EMPLOYEE`:** Activated upon accepting a job offer. Can access daily engineering tasks (1 primary + 1 bonus), receive AI task evaluations, accumulate EXP, receive performance warnings, and earn promotions.
- **`FOUNDER`:** Unlocked at 12,000 total accumulated EXP upon explicit user confirmation. Can establish a company (cost: 100 CorpCoin), purchase AI bots, recruit employees, and make daily strategic business decisions.
- **`NONE`:** Assigned to dedicated system or administrative accounts not participating in the career progression loop.

### 2.2 Platform Roles (`platformRole`)

- **`NONE`:** Assigned to all regular simulation users.
- **`ADMIN`:** Full platform oversight ("God Mode"). Can inspect, edit, suspend, and restore any user or company; reconfigure `PlatformConfig`; run Hiring Engine Demo simulations; and inspect system audit logs.
- **`AI_MANAGER`:** AI infrastructure oversight. Controls provider priority order, monitors real-time API latency and health states, toggles providers, inspects token usage, and manages fallback policies.

---

## 3. Career State Machine

The progression of a user's `careerRole` is strictly authoritative and governed by backend rules.

### 3.1 Career Role State Machine Table

| Current State  | Allowed Next States | Triggered By     | Pre-conditions                                         | Authoritative Side Effects                                                                                                                                                                        |
| -------------- | ------------------- | ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Unregistered_ | `JOB_SEEKER`        | User             | Successful registration & email verification           | Creates `users`, `profiles`, `resumes` records. Sets `careerRole: 'JOB_SEEKER'`.                                                                                                                  |
| `JOB_SEEKER`   | `EMPLOYEE`          | User             | Accepting job offer (`OFFER` $\rightarrow$ `ACCEPTED`) | Sets `careerRole: 'EMPLOYEE'`, associates `companyEmployees` record, auto-withdraws other active applications.                                                                                    |
| `EMPLOYEE`     | `JOB_SEEKER`        | System / Company | 4 active warnings lead to Termination                  | Sets `careerRole: 'JOB_SEEKER'`, sets `companyEmployees.status: 'TERMINATED'`, preserves personal EXP and career history.                                                                         |
| `EMPLOYEE`     | `FOUNDER`           | User             | Reaching $\ge 12,000$ total EXP + User Confirmation    | Terminates prior employment (`companyEmployees.status: 'TERMINATED'`), sets `careerRole: 'FOUNDER'`, sets `founderModeUnlockedAt`, grants 1,000 CorpCoin if `founderStarterCoinGranted == false`. |
| `FOUNDER`      | `JOB_SEEKER`        | System           | Company bankruptcy (Financial Health $\le -1000$)      | Liquidates company, releases employees to `JOB_SEEKER`, sets `careerRole: 'JOB_SEEKER'`, retains personal EXP.                                                                                    |
| Any            | Any                 | Admin            | Admin emergency intervention                           | Writes immutable `auditLogs` entry with actor, old role, new role, and reason.                                                                                                                    |

---

## 4. Authentication Flow

1. **Registration:**
   - User submits email and password.
   - Password is encrypted using **Argon2id**.
   - Input validated with Zod schemas.
2. **Email Verification:**
   - User must verify email before profile creation.
   - **Development Environment:** Mock verification is exposed via `DEV_VERIFICATION_URL`.
   - **Production Environment:** Real email verification OTP/token service.
   - User record maintains `isEmailVerified: boolean`.
3. **Login & Session Management:**
   - Password verified against stored Argon2id hash.
   - On success: Returns a short-lived JWT access token in the response body and sets a cryptographically signed, httpOnly refresh cookie.
   - **Access Token Lifetime:** 15 minutes.
   - **Refresh Token Cookie Lifetime:** 7 days.
4. **Brute-Force & Lockout Policy:**
   - Maximum 5 failed login attempts within a 15-minute sliding window triggers temporary account lockout for 15 minutes (`lockoutUntil`).
5. **Public Endpoint Protection:**
   - Rate limiting applied to `/api/v1/auth/*` endpoints.

---

## 5. Profile and Resume System

### 5.1 Profile Data Requirements

- **Mandatory Fields:** Email, Password, Display Name, Career Domain (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), Skills array, Resume upload.
- **Optional Fields:** GitHub URL, LinkedIn URL, Portfolio URL, Projects list, Certifications list. _Optional fields are strictly not mandatory._

### 5.2 Resume Upload & Ingestion Pipeline

```
Upload (PDF/DOCX max 10MB) ──► Magic Byte Verification ──► Stream into MongoDB GridFS
                                                                     │
                                                                     ▼
User Review Screen ◄── Store ResumeAnalysis ◄── AI Parsing ◄── Text Extraction
```

1. **Validation:** Binary magic bytes verified using `file-type` (`%PDF-` for PDF, `PK\x03\x04` for DOCX). Extensions are never trusted on their own. Maximum file size: 10 MB.
2. **Storage:** Streamed directly into MongoDB GridFS (`resumes.files` and `resumes.chunks`).
3. **Text Extraction:** Processed server-side using `pdf-parse` for PDFs and `mammoth` for DOCX files.
4. **Decoupled Architecture:**
   - `resumes`: GridFS metadata pointer.
   - `resumeAnalyses`: Asynchronously extracted structured data (skills, experience, education, domain classification).
   - `profiles`: User document referencing `resumeId` and `resumeAnalysisId`.
5. **Visual Review:** A profile review screen visualizes parsed resume entities, enabling the user to confirm accuracy prior to final registration.

---

## 6. Job and Company System

### 6.1 Platform vs Founder Companies

- **3 Initial Platform Companies:** Pre-seeded at launch, AI-driven, and maintained by the AI Manager to provide immediate employment opportunities.
- **Founder Companies:** Created by qualified players for 100 CorpCoin. Restricted to 1 active company per founder and a maximum of 20 employees.

### 6.2 Company Status State Machine Table

| Current State | Allowed Next States | Triggered By | Pre-conditions                 | Side Effects                                                                                 |
| ------------- | ------------------- | ------------ | ------------------------------ | -------------------------------------------------------------------------------------------- |
| _Uncreated_   | `ACTIVE`            | Founder      | Founder has $\ge 100$ CorpCoin | Deducts 100 CorpCoin via ledger, creates company record, sets founder ID.                    |
| `ACTIVE`      | `BANKRUPT`          | System       | Financial Health $\le -1000$   | Marks company bankrupt, founder reverts to `JOB_SEEKER`, employees released to `JOB_SEEKER`. |
| `ACTIVE`      | `SUSPENDED`         | Admin        | Administrative shutdown        | Company marked suspended, audit log written, employees released.                             |

### 6.3 Job Postings

Each company advertises open requisitions in `companyJobs` detailing domain (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), seniority target, required skills, and simulated compensation.

---

## 7. Hiring State Machine

Job seekers can maintain a **maximum of 5 active job applications simultaneously**. Re-application is unlocked once an application reaches a terminal state.

### 7.1 The 8-Stage Pipeline

```
APPLIED ──► ATS_SCREENING ──► SCREENING ──► ASSESSMENT ──► INTERVIEW ──► FINAL_REVIEW ──► OFFER ──► ACCEPTED
```

- **Terminal States:** `REJECTED`, `WITHDRAWN`, `EXPIRED`, `ACCEPTED`.

### 7.2 ATS Evaluation Rules

- **Score Range:** 0–100.
- **Passing Threshold:** 70.
- **Category Weights:**
  - Domain Relevance: 40%
  - Technical Skill Match: 35%
  - Projects / Experience: 15%
  - Resume Clarity / Formatting: 10%
- **Evaluation Gate:**
  - ATS Score $\ge 70$: Advances to `SCREENING`.
  - ATS Score $< 70$: Transitions to `REJECTED` and delivers actionable diagnostic feedback.

### 7.3 Application State Machine Table

| Current State    | Allowed Next States                            | Triggered By       | Pre-conditions                    | Side Effects                                                                                                       |
| ---------------- | ---------------------------------------------- | ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `APPLIED`        | `ATS_SCREENING`                                | System             | Application submitted             | Job seeker active applications count $+1$ ($\le 5$). Enqueues ATS AI task.                                         |
| `ATS_SCREENING`  | `SCREENING`, `REJECTED`                        | System             | ATS evaluation completed          | If score $\ge 70 \rightarrow$ `SCREENING`. If score $< 70 \rightarrow$ `REJECTED` + generates diagnostic feedback. |
| `SCREENING`      | `ASSESSMENT`, `REJECTED`                       | System / Bot       | Recruiter bot screening completed | Advances to technical assessment or triggers rejection feedback.                                                   |
| `ASSESSMENT`     | `INTERVIEW`, `REJECTED`                        | System / Candidate | Technical challenge submitted     | Evaluates solution. Passes advance to chat interview; failures generate feedback.                                  |
| `INTERVIEW`      | `FINAL_REVIEW`, `REJECTED`                     | System / Candidate | Chat interview completed          | Transcript evaluated by Hiring Bot. Generates comprehensive interview score.                                       |
| `FINAL_REVIEW`   | `OFFER`, `REJECTED`                            | System             | Hiring Bot final evaluation       | Creates formal offer terms or delivers final rejection critique.                                                   |
| `OFFER`          | `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED` | Candidate / System | Offer issued                      | If `ACCEPTED` $\rightarrow$ User becomes `EMPLOYEE`, sets company link, auto-withdraws other active applications.  |
| Any non-terminal | `WITHDRAWN`                                    | Candidate          | Voluntary candidate withdrawal    | Releases 1 active application slot.                                                                                |

---

## 8. Interview System

1. **Conversational Multi-Turn Chat:**
   Technical interviews are conducted in an interactive chat room between the candidate and the company's AI Hiring Bot.
2. **Contextual Grounding:**
   Interview questions are synthesized dynamically using the candidate's verified `ResumeAnalysis`, target job domain, and company profile.
3. **Transport Protocol:**
   Standard REST endpoint: `POST /applications/:id/interview/messages`.
   - Request: Candidate answer text.
   - Response: AI interviewer reply + current interview state.
   - No WebSockets or streaming in v1 to guarantee auditability, persistence, and replayability.
4. **Authoritative Evaluation:**
   Upon interview conclusion, the AI generates a multi-dimensional scorecard. The backend validates and clamps scores, making the final progression decision.

---

## 9. Employee Task System

1. **Daily Task Quotas:**
   - **1 Primary Task per day** (Mandatory core engineering problem).
   - **1 Bonus Task per day** (Optional extra credit problem).
   - Maximum 2 tasks/day.
2. **On-Demand Generation:**
   Tasks are generated on-demand when the employee opens their dashboard (`GET /employee/tasks/today`). If today's task exists, it is returned; if not, the system creates an AI job, generates, stores, and returns the task.
3. **Difficulty Tiers & Ceilings:**
   - **Easy:** Maximum 30 EXP.
   - **Medium:** Maximum 60 EXP.
   - **Hard:** Maximum 100 EXP.

### 9.1 Employee Status State Machine Table

| Current State  | Allowed Next States | Triggered By | Pre-conditions                                  | Side Effects                                                                                             |
| -------------- | ------------------- | ------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ACTIVE`       | `UNDER_REVIEW`      | System       | Active warnings reach threshold (4)             | Suspends normal promotion eligibility, triggers Employment Review.                                       |
| `ACTIVE`       | `ACTIVE`            | System       | Level promotion criteria satisfied              | Level $+1$, updates position and simulated salary.                                                       |
| `UNDER_REVIEW` | `ACTIVE`            | System       | Review outcome: Demotion or Warning remediation | If demoted: Level $-1$ (down to min L1), active warnings reset to 0, EXP preserved, returns to `ACTIVE`. |
| `UNDER_REVIEW` | `TERMINATED`        | System       | Review outcome: Firing                          | Role resets to `JOB_SEEKER`, company link severed, EXP preserved.                                        |

---

## 10. EXP System

1. **Permanent Personal Career Capital:**
   Total accumulated EXP is immutable and cannot be deducted. Demotions, firings, task failures, or company liquidations never reduce accumulated EXP.
2. **Levels (Total Accumulated EXP Required):**
   - **L1 Intern:** 0 EXP
   - **L2 Junior:** 500 EXP
   - **L3 Junior+:** 1,200 EXP
   - **L4 Associate:** 2,000 EXP
   - **L5 Mid-Level:** 3,000 EXP
   - **L6 Mid-Level+:** 4,500 EXP
   - **L7 Senior:** 6,500 EXP
   - **L8 Senior+:** 9,000 EXP
   - **L9 Lead:** 12,000 EXP _(Unlocks Founder Mode)_
   - **L10 Principal:** 16,000 EXP _(Maximum Level)_
3. **Authoritative EXP Calculation:**
   The AI evaluates submissions and returns a performance score ($0 \le \text{aiScore} \le 100$).
   The backend deterministically calculates awarded EXP:
   $$\text{awardedExp} = \text{round}\left(\frac{\text{aiScore}}{100} \times \text{task.maxExp}\right)$$
   Clamped strictly: $0 \le \text{awardedExp} \le \text{task.maxExp}$.
4. **EXP Transaction Ledger & Cached Balance:**
   Every EXP award writes an immutable entry to `expTransactions`. The user document maintains a synchronized `totalExpCached` field for query performance.

---

## 11. Warning / Promotion / Demotion System

### 11.1 Performance Score Bands

- **90–100:** Excellent
- **75–89:** Good
- **60–74:** Acceptable / Normal
- **40–59:** Needs Improvement (Performance Issue logged)
- **0–39:** Poor (Warning Candidate)

### 11.2 Warning State Machine Table

| Current State | Allowed Next States | Triggered By  | Pre-conditions                               | Side Effects                                                                             |
| ------------- | ------------------- | ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| _None_        | `ACTIVE`            | System        | Task score $0 \le \text{score} \le 39$       | Creates warning in `warnings` with 30-day expiration date. Checks active warnings total. |
| `ACTIVE`      | `EXPIRED`           | System (Time) | Current time $>$ warning creation $+30$ days | Warning marked `EXPIRED`. No longer counts toward review threshold.                      |
| `ACTIVE`      | `ESCALATED`         | System        | Active warnings count reaches 4              | Triggers Employment Review.                                                              |
| `ACTIVE`      | `RESOLVED`          | Admin         | Administrative pardon                        | Warning resolved, audit log created.                                                     |

### 11.3 Promotion Rules Matrix

Promotion requires satisfying ALL four criteria:

1. Accumulated EXP reaches target level threshold.
2. Minimum completed tasks in current role:
   - L1 $\rightarrow$ L2: 5 completed tasks
   - L2 $\rightarrow$ L3: 10 completed tasks
   - L3 $\rightarrow$ L4: 10 completed tasks
   - L4 $\rightarrow$ L5: 10 completed tasks
   - L5 $\rightarrow$ L6: 10 completed tasks
   - L6 $\rightarrow$ L7: 15 completed tasks
   - L7 $\rightarrow$ L8: 15 completed tasks
   - L8 $\rightarrow$ L9: 15 completed tasks
   - L9 $\rightarrow$ L10: 15 completed tasks
3. Average task performance score $\ge 70$.
4. Active warnings $\le 1$.

### 11.4 Demotion & Firing Mechanics

- **Demotion:** Drops current level by 1. Reduces compensation simulation. Resets active warnings to 0. Accumulated EXP remains strictly unchanged.
- **Firing / Termination:** User `careerRole` reverts to `JOB_SEEKER`. User keeps all personal EXP, profile skills, resume, and career history. User loses company position, active salary, and employee status.

---

## 12. Founder System

1. **Founder Mode Unlock:**
   - Unlocked when user reaches **12,000 total accumulated EXP** (Level 9 Lead).
   - Progression does not occur automatically: an explicit confirmation modal requires user approval.
   - Upon unlock, active employment at prior company is terminated.
2. **Starter Capital Grant:**
   - Founder receives a one-time grant of **1,000 CorpCoin**.
   - Tracked by flags: `founderStarterCoinGranted = true` and `founderModeUnlockedAt`.
3. **Company Creation:**
   - Creation fee: 100 CorpCoin.
   - Operating limits: Exactly 1 active company per founder in v1; maximum 20 employees.
4. **Bankruptcy Execution:**
   - Bankruptcy threshold: Company financial health $\le -1000$.
   - On bankruptcy: Company marked `BANKRUPT`, employees released to `JOB_SEEKER`, founder returns to `JOB_SEEKER`.
   - The founder retains all personal EXP and historical career records.

---

## 13. CorpCoin Economy

1. **Currency Segregation:**
   CorpCoin represents corporate capital and liquidity. It is strictly separated from EXP and cannot be exchanged for EXP.
2. **AI Bot Store (V1 Costs):**
   - **Basic Hiring Bot:** 250 CorpCoin
   - **Basic Task Bot:** 250 CorpCoin
   - **Basic Evaluation Bot:** 250 CorpCoin
   - Total for all 3 basic bots + company creation = 850 CorpCoin (leaves 150 CorpCoin buffer from initial 1,000).
   - **Advanced Bots:** 400 CorpCoin each in config. Displayed in storefront as **"LOCKED — COMING SOON"**; unpurchasable in v1.
3. **Double-Entry Transaction Ledger & Cached Balance:**
   Every mutation to CorpCoin requires an immutable entry in `corpCoinTransactions`. User and company records maintain cached balances.

---

## 14. Company Simulation Engine

1. **Daily Business Scenarios:**
   Each calendar day, an active Founder receives **1 strategic business scenario** stored in the `companyScenarios` collection (`ACTIVE`, `DECIDED`, `EXPIRED`).
2. **Deterministic Mathematical Formulas:**
   The AI generates the scenario narrative and structured options. Upon founder selection, the backend computes outcomes deterministically:
   - **Daily Revenue:**
     $$\text{dailyRevenue} = 100 + (\text{employeeCount} \times \text{averageProductivity} \times 5) + (\text{companyRating} \times 2)$$
     where $\text{productivity} = \text{recent average task score} / 100 \in [0, 1]$ and $\text{companyRating} \in [0, 100]$.
   - **Daily Expenses:**
     $$\text{dailyExpenses} = 50 + (\text{employeeCount} \times 10) + (\text{botCount} \times 10)$$
   - **Daily Profit & Balance Update:**
     $$\text{profit} = \text{dailyRevenue} - \text{dailyExpenses}$$
     $$\text{companyFinancialHealth} += \text{profit}$$
   - Under no circumstances does an LLM directly modify financial balances.

---

## 15. Ranking System

Leaderboards are calculated deterministically from stored backend database records, never from AI claims or self-reported client state. All rankings reflect `'ALL_TIME'` cumulative metrics in v1.

### 15.1 Individual User Leaderboards

- Highest Accumulated EXP
- Highest Job Level
- Highest CorpCoin Capital
- Best Task Evaluation Performance Average
- Top Ranked Founder

### 15.2 Company Leaderboards

- Highest Net Profit
- Highest Cumulative Revenue
- Largest Active Workforce
- Best Employee Retention Rate
- Highest Company Reputation Rating
- Fastest Growing Company

---

## 16. AI Gateway

All AI interactions flow through a three-layer decoupled architecture:
`AIGateway` $\rightarrow$ `ProviderRouter` $\rightarrow$ `ProviderAdapter`.

```
┌────────────────────────────────────────────────────────┐
│                   CorpVerse Backend                    │
│    (HiringService / TaskService / SimulationService)   │
└───────────────────────────┬────────────────────────────┘
                            │ AIRequest
                            ▼
┌────────────────────────────────────────────────────────┐
│                   CorpVerse AI Gateway                 │
├────────────────────────────────────────────────────────┤
│                    Provider Router                     │
└─────┬─────────────────────┼──────────────────────┬─────┘
      ▼                     ▼                      ▼
┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│Gemini Adapter│     │OpenAI Adapter│      │ Groq Adapter │
└──────┬───────┘     └──────┬───────┘      └──────┬───────┘
       ▼                    ▼                     ▼
  Gemini API            OpenAI API             Groq API
```

### 16.1 Provider Pools Note: DEMO Pool vs PIPELINE Pool (Decision D11)

- **`DEMO` Pool:** Dedicated provider credentials, quotas, and rate limits reserved exclusively for Admin Demo Mode simulations.
- **`PIPELINE` Pool:** Provider credentials and rate limits allocated to live job seeker hiring, daily employee tasks, evaluations, and founder simulations.
- Ensures demo presentations never exhaust production quotas or disrupt active users.

### 16.2 Standard Internal AIRequest Contract

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
  pool: 'PIPELINE' | 'DEMO';
  systemInstruction: string;
  userInput: string;
  context?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}
```

### 16.3 Normalized AIResponse Contract

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

### 16.4 AI Boundary Rule: What AI Can vs Cannot Do

- **AI CAN:** Generate interview questions, evaluate answers, generate qualitative feedback, analyze resumes, generate task scenarios, score task submissions (0–100), generate business scenarios, explain decisions, recommend promotions.
- **AI CANNOT DIRECTLY DECIDE:** EXP balance, CorpCoin balance, user roles, promotions, demotions, terminations, company financial health, bankruptcy, permissions, provider routing configuration.

---

## 17. Gemini Adapter

- **SDK/Integration:** Google Generative AI integration using server-side `GEMINI_API_KEY`.
- **Model ID:** Configured dynamically via `PlatformConfig` (not hardcoded into architecture).
- **Contract:** Implements `AIProviderAdapter` interface (`generate`, `healthCheck`, `getUsage`). Translates internal request to Gemini format and normalizes responses.

---

## 18. OpenAI Adapter

- **SDK/Integration:** OpenAI API integration using server-side `OPENAI_API_KEY`.
- **Model ID:** Configured dynamically via `PlatformConfig` (not hardcoded into architecture).
- **Contract:** Implements `AIProviderAdapter` interface (`generate`, `healthCheck`, `getUsage`). Translates internal request to Chat Completions format with JSON schema mode.

---

## 19. Groq Adapter

- **SDK/Integration:** Groq Cloud API integration using server-side `GROQ_API_KEY`.
- **Model ID:** Configured dynamically via `PlatformConfig` (not hardcoded into architecture).
- **Contract:** Implements `AIProviderAdapter` interface (`generate`, `healthCheck`, `getUsage`). Translates internal request to Groq format and captures usage.

---

## 20. AI Manager

The **`AI_MANAGER`** platform role provides runtime operational governance over the multi-provider AI infrastructure.

### 20.1 Capabilities & Controls

- Manage providers (priority sequence, status, rate limits).
- Default Priority Sequence: 1. Gemini, 2. OpenAI, 3. Groq (configurable at runtime).
- Inspect real-time provider health, average latency, and failure logs.
- Trigger diagnostic health pings.
- _Constraint: AI Manager does not possess general Admin permissions._

### 20.2 Provider Health States

- **`HEALTHY`:** Normal operation; latency within nominal thresholds.
- **`DEGRADED`:** Elevated latency or intermittent retryable errors.
- **`RATE_LIMITED`:** HTTP 429 triggered; temporarily bypassed until backoff expires.
- **`TEMPORARILY_FAILED`:** 3 consecutive failed requests; traffic routed to fallback provider.
- **`DISABLED`:** Manually disabled by AI Manager.

---

## 21. AI Queue and Retry System

### 21.1 Retry & Fallback Rules

1. **Attempts:** Up to **3 attempts per provider** before falling back to the next provider in configured priority list.
2. **Fallback Triggers (Transient Errors):** Timeouts, HTTP 429 (Rate Limit), HTTP 5xx (Server Unavailable), network disconnects.
3. **Non-Fallback Errors (Fast Fail):** HTTP 400 (Invalid input / Schema violation), HTTP 401/403 (Invalid credentials).
4. **Queue Buffer:** If all providers fail, the job status transitions to `WAITING_FOR_PROVIDER` in the MongoDB-backed queue.

### 21.2 Custom MongoDB Worker

- In-process background runner polling MongoDB every **2 seconds**.
- Claims jobs atomically using `findOneAndUpdate` on `status: 'PENDING'`.

### 21.3 AI Job State Machine Table

| Current State                      | Allowed Next States    | Triggered By     | Pre-conditions                        | Side Effects                                              |
| ---------------------------------- | ---------------------- | ---------------- | ------------------------------------- | --------------------------------------------------------- |
| _Created_                          | `PENDING`              | System           | Async AI task created                 | Document written to `aiJobs`.                             |
| `PENDING`                          | `PROCESSING`           | Queue Worker     | Worker claims job via optimistic lock | Increments attempt count, records worker heartbeat.       |
| `PROCESSING`                       | `COMPLETED`            | Provider Adapter | Normalized AIResponse received        | Updates job result, records token usage, notifies caller. |
| `PROCESSING`                       | `RETRYING`             | Queue Worker     | Transient error & attempts $< 3$      | Schedules exponential backoff retry on same provider.     |
| `PROCESSING`                       | `WAITING_FOR_PROVIDER` | Queue Worker     | Attempts $\ge 3$ on all providers     | Holds job until provider health recovers.                 |
| `PROCESSING`                       | `FAILED`               | Queue Worker     | Fatal non-retryable error             | Marks job permanently failed with error diagnosis.        |
| `PENDING` / `WAITING_FOR_PROVIDER` | `CANCELLED`            | Admin / System   | User cancels or timeout exceeded      | Releases job resources.                                   |

---

## 22. Admin System

The **`ADMIN`** platform role provides full administrative governance ("God Mode").

### 22.1 Permissions & Capabilities

- User Management: View, edit, suspend, or restore accounts.
- Domain & Taxonomy Management: Add/modify career domains and skill catalogs.
- Company & Job Oversight: Inspect, edit, or suspend companies and listings.
- Economy & Config Controls: Modify `PlatformConfig` values.
- Observability: View system analytics, audit logs, AI health logs, and queue metrics.
- Confirmation Safety Gate: Destructive operations (suspending companies, wiping accounts, resetting economies) strictly require an explicit confirmation challenge.

---

## 23. Demo System

1. **Unified Engine:**
   Admin Demo Mode runs on the **exact same underlying Hiring Engine** as production. No separate mock engine is permitted.
2. **Configurable Parameters:**
   The Admin can parameterize the demo session:
   - Target Domain (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
   - Question Count (e.g., 3, 5, 10).
   - Difficulty Level (Junior, Mid, Senior).
   - Interview Style (Technical Deep Dive, Architecture, System Design).
3. **Resource Isolation:**
   Demo sessions execute against the `DEMO` provider pool (decision D11) to avoid disrupting live player workloads.

---

## 24. Notification System

In-app notification records are generated in `notifications` to alert users to critical game events:

- **Hiring Updates:** Application stage advancement, chat interview invitations, formal job offers, rejection feedback available.
- **Employee Lifecycle:** Daily task assignments, task evaluation scores, performance warnings issued/expired, promotion announcements.
- **Founder Alerts:** Daily business scenario ready for review, low company balance warning, bankruptcy liquidation notification.
- **System Announcements:** Platform maintenance, economy adjustments.

---

## 25. Audit Logging

Every sensitive mutation performed by an `ADMIN` or `AI_MANAGER` writes an immutable document to `auditLogs`.

### 25.1 Schema Fields

- `actorId`: ObjectId of acting administrator.
- `actorRole`: `'ADMIN'` | `'AI_MANAGER'`.
- `action`: Specific operation performed (e.g., `'CONFIG_UPDATE'`, `'PROVIDER_DISABLED'`, `'USER_SUSPENDED'`).
- `targetCollection`: Name of modified collection.
- `targetId`: ObjectId of targeted entity.
- `oldValue`: Snapshot of modified fields before mutation.
- `newValue`: Snapshot of fields after mutation.
- `reason`: Mandatory text justification supplied by the actor.
- `createdAt`: ISO UTC timestamp.

---

## 26. MongoDB Data Model

### 1. `users`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `email`: `String`, required, unique, indexed.
  - `passwordHash`: `String`, required (Argon2id hash).
  - `careerRole`: `String`, enum (`'JOB_SEEKER'`, `'EMPLOYEE'`, `'FOUNDER'`, `'NONE'`), required, default: `'JOB_SEEKER'`.
  - `platformRole`: `String`, enum (`'NONE'`, `'ADMIN'`, `'AI_MANAGER'`), required, default: `'NONE'`.
  - `isEmailVerified`: `Boolean`, required, default: `false`.
  - `isSuspended`: `Boolean`, required, default: `false`.
  - `failedLoginAttempts`: `Number`, required, default: `0`.
  - `lockoutUntil`: `Date`, optional.
  - `totalExpCached`: `Number`, required, default: `0`.
  - `corpCoinBalanceCached`: `Number`, required, default: `0`.
  - `founderModeUnlockedAt`: `Date`, optional.
  - `founderStarterCoinGranted`: `Boolean`, required, default: `false`.
  - `createdAt`: `Date`, required, default: `Date.now`.
  - `updatedAt`: `Date`, required, default: `Date.now`.
- **Indexes:** `{ email: 1 }` (unique), `{ careerRole: 1 }`, `{ platformRole: 1 }`.
- **Relationships:** Referenced by `profiles.userId`, `expTransactions.userId`, `corpCoinTransactions.userId`.

### 2. `profiles`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, unique, ref: `users`, indexed.
  - `displayName`: `String`, required.
  - `domain`: `String`, enum (`'SOFTWARE_ENGINEERING'`, `'CLOUD_ENGINEERING'`, `'AI_ENGINEERING'`), required.
  - `skills`: `[String]`, required.
  - `resumeId`: `ObjectId`, required, ref: `resumes`.
  - `resumeAnalysisId`: `ObjectId`, optional, ref: `resumeAnalyses`.
  - `bio`: `String`, optional.
  - `githubUrl`: `String`, optional.
  - `linkedinUrl`: `String`, optional.
  - `portfolioUrl`: `String`, optional.
  - `projects`: `[Object]`, optional.
  - `certifications`: `[Object]`, optional.
  - `createdAt`: `Date`, required.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ userId: 1 }` (unique), `{ domain: 1 }`.
- **Relationships:** Belongs to `users`. References `resumes` and `resumeAnalyses`.

### 3. `resumes`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `gridFsFileId`: `ObjectId`, required (pointer to `resumes.files`).
  - `filename`: `String`, required.
  - `mimeType`: `String`, required (`application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
  - `sizeBytes`: `Number`, required (max 10,485,760).
  - `sha256`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ userId: 1 }`, `{ gridFsFileId: 1 }`.
- **Relationships:** Belongs to `users`. Points to GridFS bucket.

### 4. `resumeAnalyses`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `resumeId`: `ObjectId`, required, unique, ref: `resumes`, indexed.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `parsedSkills`: `[String]`, required.
  - `yearsOfExperience`: `Number`, required.
  - `education`: `[Object]`, optional.
  - `workHistory`: `[Object]`, optional.
  - `extractedSummary`: `String`, optional.
  - `domainClassification`: `String`, required.
  - `confidenceScore`: `Number`, required.
  - `rawAiOutput`: `Object`, optional.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ resumeId: 1 }` (unique), `{ userId: 1 }`.
- **Relationships:** Belongs to `resumes` and `users`.

### 5. `domains`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `code`: `String`, required, unique, indexed (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`).
  - `name`: `String`, required.
  - `description`: `String`, required.
  - `isActive`: `Boolean`, required, default: `true`.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ code: 1 }` (unique).
- **Relationships:** Referenced by `profiles`, `companyJobs`, `employeeTasks`.

### 6. `skills`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `name`: `String`, required, unique, indexed.
  - `domainCode`: `String`, required, indexed.
  - `category`: `String`, optional.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ name: 1 }` (unique), `{ domainCode: 1 }`.
- **Relationships:** Categorized under `domains`.

### 7. `companies`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `name`: `String`, required, unique, indexed.
  - `description`: `String`, required.
  - `founderId`: `ObjectId`, optional, ref: `users`, indexed.
  - `isPlatformCompany`: `Boolean`, required, default: `false`.
  - `status`: `String`, enum (`'ACTIVE'`, `'BANKRUPT'`, `'SUSPENDED'`), required, default: `'ACTIVE'`.
  - `financialHealth`: `Number`, required, default: `0`.
  - `employeeCount`: `Number`, required, default: `0` (max 20).
  - `companyRating`: `Number`, required, default: `50` (0–100).
  - `createdAt`: `Date`, required.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ name: 1 }` (unique), `{ founderId: 1 }`, `{ status: 1 }`.
- **Relationships:** Belongs to founder `users`. Has many `companyEmployees`, `companyJobs`, `companyBots`, `companyScenarios`.

### 8. `companyEmployees`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `userId`: `ObjectId`, required, unique, ref: `users`, indexed.
  - `level`: `Number`, required, default: `1` (1–10).
  - `jobTitle`: `String`, required.
  - `domain`: `String`, required.
  - `salarySimulated`: `Number`, required.
  - `status`: `String`, enum (`'ACTIVE'`, `'UNDER_REVIEW'`, `'TERMINATED'`), required, default: `'ACTIVE'`.
  - `joinedAt`: `Date`, required.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ companyId: 1 }`, `{ userId: 1 }` (unique).
- **Relationships:** Links `users` to `companies`.

### 9. `companyBots`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `botType`: `String`, enum (`'HIRING_BOT'`, `'TASK_BOT'`, `'EVALUATION_BOT'`), required.
  - `tier`: `String`, enum (`'BASIC'`, `'ADVANCED'`), required, default: `'BASIC'`.
  - `purchaseCost`: `Number`, required.
  - `isActive`: `Boolean`, required, default: `true`.
  - `purchasedAt`: `Date`, required.
- **Indexes:** `{ companyId: 1, botType: 1 }` (unique compound index).
- **Relationships:** Belongs to `companies`.

### 10. `companyJobs`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `title`: `String`, required.
  - `domain`: `String`, required, indexed.
  - `targetLevel`: `Number`, required (1–10).
  - `requiredSkills`: `[String]`, required.
  - `description`: `String`, required.
  - `isOpen`: `Boolean`, required, default: `true`.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ companyId: 1 }`, `{ domain: 1 }`, `{ isOpen: 1 }`.
- **Relationships:** Belongs to `companies`. Referenced by `applications`.

### 11. `applications`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `jobId`: `ObjectId`, required, ref: `companyJobs`, indexed.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `currentStage`: `String`, enum (`'APPLIED'`, `'ATS_SCREENING'`, `'SCREENING'`, `'ASSESSMENT'`, `'INTERVIEW'`, `'FINAL_REVIEW'`, `'OFFER'`, `'ACCEPTED'`), required, default: `'APPLIED'`.
  - `status`: `String`, enum (`'ACTIVE'`, `'REJECTED'`, `'WITHDRAWN'`, `'EXPIRED'`, `'ACCEPTED'`), required, default: `'ACTIVE'`.
  - `atsScore`: `Number`, optional.
  - `interviewScore`: `Number`, optional.
  - `createdAt`: `Date`, required.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ userId: 1, status: 1 }`, `{ jobId: 1 }`, `{ companyId: 1 }`.
- **Relationships:** Links `users` to `companyJobs`. Has many `evaluations`, `feedbacks`.

### 12. `interviews`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `applicationId`: `ObjectId`, required, unique, ref: `applications`, indexed.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `companyId`: `ObjectId`, required, ref: `companies`.
  - `domain`: `String`, required.
  - `status`: `String`, enum (`'IN_PROGRESS'`, `'COMPLETED'`, `'ABANDONED'`), required, default: `'IN_PROGRESS'`.
  - `overallScore`: `Number`, optional.
  - `startedAt`: `Date`, required.
  - `completedAt`: `Date`, optional.
- **Indexes:** `{ applicationId: 1 }` (unique), `{ userId: 1 }`.
- **Relationships:** Belongs to `applications`. Has many `questions`, `answers`.

### 13. `questions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `interviewId`: `ObjectId`, required, ref: `interviews`, indexed.
  - `sequenceNumber`: `Number`, required.
  - `content`: `String`, required.
  - `expectedCriteria`: `String`, optional.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ interviewId: 1, sequenceNumber: 1 }`.
- **Relationships:** Belongs to `interviews`.

### 14. `answers`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `questionId`: `ObjectId`, required, unique, ref: `questions`, indexed.
  - `interviewId`: `ObjectId`, required, ref: `interviews`, indexed.
  - `candidateResponse`: `String`, required.
  - `submittedAt`: `Date`, required.
- **Indexes:** `{ questionId: 1 }` (unique), `{ interviewId: 1 }`.
- **Relationships:** Responds to `questions`.

### 15. `evaluations`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `applicationId`: `ObjectId`, required, ref: `applications`, indexed.
  - `stage`: `String`, required.
  - `score`: `Number`, required (0–100).
  - `scoreBreakdown`: `Object`, optional.
  - `summary`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ applicationId: 1, stage: 1 }`.
- **Relationships:** Belongs to `applications`.

### 16. `feedbacks`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `applicationId`: `ObjectId`, required, ref: `applications`, indexed.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `rejectionStage`: `String`, required.
  - `strengths`: `[String]`, required.
  - `weaknesses`: `[String]`, required.
  - `actionableSuggestions`: `[String]`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ applicationId: 1 }`, `{ userId: 1 }`.
- **Relationships:** Belongs to `applications` and `users`.

### 17. `employeeTasks`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `taskType`: `String`, enum (`'PRIMARY'`, `'BONUS'`), required.
  - `difficulty`: `String`, enum (`'EASY'`, `'MEDIUM'`, `'HARD'`), required.
  - `maxExp`: `Number`, required (30, 60, or 100).
  - `title`: `String`, required.
  - `description`: `String`, required.
  - `instructions`: `String`, required.
  - `date`: `String`, required, indexed (YYYY-MM-DD).
  - `status`: `String`, enum (`'ASSIGNED'`, `'SUBMITTED'`, `'EVALUATED'`, `'EXPIRED'`), required, default: `'ASSIGNED'`.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ userId: 1, date: 1, taskType: 1 }` (unique compound index), `{ companyId: 1 }`.
- **Relationships:** Belongs to employee `users` and `companies`.

### 18. `taskSubmissions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `taskId`: `ObjectId`, required, unique, ref: `employeeTasks`, indexed.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `content`: `String`, required.
  - `submittedAt`: `Date`, required.
- **Indexes:** `{ taskId: 1 }` (unique), `{ userId: 1 }`.
- **Relationships:** Belongs to `employeeTasks`.

### 19. `performanceRecords`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `taskSubmissionId`: `ObjectId`, required, unique, ref: `taskSubmissions`, indexed.
  - `taskId`: `ObjectId`, required, ref: `employeeTasks`.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `aiScore`: `Number`, required (0–100).
  - `scoreBand`: `String`, enum (`'POOR'`, `'NEEDS_IMPROVEMENT'`, `'ACCEPTABLE'`, `'GOOD'`, `'EXCELLENT'`), required.
  - `awardedExp`: `Number`, required (clamped to `0 <= awardedExp <= task.maxExp`).
  - `feedback`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ taskSubmissionId: 1 }` (unique), `{ userId: 1 }`.
- **Relationships:** Belongs to `taskSubmissions` and `users`.

### 20. `warnings`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `sourcePerformanceRecordId`: `ObjectId`, required, ref: `performanceRecords`.
  - `status`: `String`, enum (`'ACTIVE'`, `'EXPIRED'`, `'RESOLVED'`, `'ESCALATED'`), required, default: `'ACTIVE'`, indexed.
  - `reason`: `String`, required.
  - `issuedAt`: `Date`, required.
  - `expiresAt`: `Date`, required (issuedAt $+30$ days), indexed.
- **Indexes:** `{ userId: 1, status: 1 }`, `{ expiresAt: 1 }`.
- **Relationships:** Belongs to `users` and `companies`.

### 21. `promotions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `companyId`: `ObjectId`, required, ref: `companies`.
  - `previousLevel`: `Number`, required.
  - `newLevel`: `Number`, required.
  - `totalExpSnapshot`: `Number`, required.
  - `reason`: `String`, required.
  - `promotedAt`: `Date`, required.
- **Indexes:** `{ userId: 1 }`.
- **Relationships:** Belongs to `users`.

### 22. `demotions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `companyId`: `ObjectId`, required, ref: `companies`.
  - `previousLevel`: `Number`, required.
  - `newLevel`: `Number`, required.
  - `activeWarningCount`: `Number`, required.
  - `demotedAt`: `Date`, required.
- **Indexes:** `{ userId: 1 }`.
- **Relationships:** Belongs to `users`.

### 23. `founders`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, unique, ref: `users`, indexed.
  - `companyId`: `ObjectId`, optional, ref: `companies`, indexed.
  - `unlockedAt`: `Date`, required.
  - `status`: `String`, enum (`'ACTIVE'`, `'BANKRUPT'`, `'RETIRED'`), required, default: `'ACTIVE'`.
- **Indexes:** `{ userId: 1 }` (unique), `{ companyId: 1 }`.
- **Relationships:** Links `users` to `companies`.

### 24. `companyScenarios`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `founderId`: `ObjectId`, required, ref: `users`, indexed.
  - `date`: `String`, required, indexed (YYYY-MM-DD).
  - `scenarioPrompt`: `String`, required.
  - `options`: `[Object]`, required.
  - `status`: `String`, enum (`'ACTIVE'`, `'DECIDED'`, `'EXPIRED'`), required, default: `'ACTIVE'`, indexed.
  - `chosenOptionId`: `String`, optional.
  - `calculatedDelta`: `Object`, optional.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ companyId: 1, date: 1 }` (unique), `{ status: 1 }`.
- **Relationships:** Belongs to `companies` and `users`.

### 25. `companyDecisions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `founderId`: `ObjectId`, required, ref: `users`, indexed.
  - `scenarioId`: `ObjectId`, required, unique, ref: `companyScenarios`, indexed.
  - `date`: `String`, required, indexed (YYYY-MM-DD).
  - `chosenOptionId`: `String`, required.
  - `calculatedDelta`: `Object`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ companyId: 1, date: 1 }`.
- **Relationships:** Belongs to `companies`, `users`, and `companyScenarios`.

### 26. `companyFinancials`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `companyId`: `ObjectId`, required, ref: `companies`, indexed.
  - `revenue`: `Number`, required.
  - `expenses`: `Number`, required.
  - `profit`: `Number`, required.
  - `financialHealth`: `Number`, required.
  - `employeeRetentionRate`: `Number`, required, default: `100`.
  - `recordedAt`: `Date`, required.
- **Indexes:** `{ companyId: 1, recordedAt: -1 }`.
- **Relationships:** Belongs to `companies`.

### 27. `expTransactions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `amount`: `Number`, required (strictly positive in gameplay awards).
  - `balanceAfter`: `Number`, required.
  - `type`: `String`, enum (`'TASK_COMPLETION'`, `'ADMIN_ADJUSTMENT'`), required.
  - `sourceId`: `ObjectId`, required (ref `taskSubmissions` or `auditLogs`).
  - `reason`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ userId: 1, createdAt: -1 }`.
- **Relationships:** Belongs to `users`.

### 28. `corpCoinTransactions`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `companyId`: `ObjectId`, optional, ref: `companies`, indexed.
  - `amount`: `Number`, required (negative for debits, positive for credits).
  - `balanceAfter`: `Number`, required.
  - `type`: `String`, enum (`'FOUNDER_STARTER_GRANT'`, `'COMPANY_CREATION'`, `'BOT_PURCHASE'`, `'BUSINESS_REVENUE'`, `'BUSINESS_EXPENSE'`, `'ADMIN_ADJUSTMENT'`), required.
  - `referenceId`: `ObjectId`, optional (ref `companies`, `companyBots`, `companyDecisions`).
  - `reason`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ userId: 1, createdAt: -1 }`, `{ companyId: 1 }`.
- **Relationships:** Belongs to `users`.

### 29. `aiProviders`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `code`: `String`, enum (`'gemini'`, `'openai'`, `'groq'`), required, unique, indexed.
  - `name`: `String`, required.
  - `priority`: `Number`, required.
  - `pool`: `String`, enum (`'PIPELINE'`, `'DEMO'`), required, default: `'PIPELINE'`.
  - `status`: `String`, enum (`'HEALTHY'`, `'DEGRADED'`, `'RATE_LIMITED'`, `'TEMPORARILY_FAILED'`, `'DISABLED'`), required, default: `'HEALTHY'`, indexed.
  - `rateLimitRpm`: `Number`, required.
  - `consecutiveFailures`: `Number`, required, default: `0`.
  - `lastCheckedAt`: `Date`, optional.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ code: 1 }` (unique), `{ status: 1 }`, `{ pool: 1 }`.

### 30. `aiModels`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `providerCode`: `String`, required, ref: `aiProviders`, indexed.
  - `modelId`: `String`, required.
  - `displayName`: `String`, required.
  - `isDefault`: `Boolean`, required, default: `false`.
  - `contextWindowTokens`: `Number`, required.
- **Indexes:** `{ providerCode: 1, modelId: 1 }` (unique).

### 31. `aiRequests`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `taskType`: `String`, required, indexed.
  - `pool`: `String`, enum (`'PIPELINE'`, `'DEMO'`), required.
  - `providerCode`: `String`, required, indexed.
  - `modelId`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ taskType: 1 }`, `{ providerCode: 1 }`, `{ createdAt: -1 }`.

### 32. `aiResponses`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `requestId`: `ObjectId`, required, unique, ref: `aiRequests`, indexed.
  - `providerCode`: `String`, required.
  - `latencyMs`: `Number`, required.
  - `inputTokens`: `Number`, required.
  - `outputTokens`: `Number`, required.
  - `totalTokens`: `Number`, required.
  - `success`: `Boolean`, required.
  - `errorCode`: `String`, optional.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ requestId: 1 }` (unique).

### 33. `aiJobs`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `taskType`: `String`, required, indexed.
  - `pool`: `String`, enum (`'PIPELINE'`, `'DEMO'`), required, default: `'PIPELINE'`.
  - `status`: `String`, enum (`'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'`, `'RETRYING'`, `'WAITING_FOR_PROVIDER'`, `'CANCELLED'`), required, default: `'PENDING'`, indexed.
  - `attempts`: `Number`, required, default: `0`.
  - `maxAttempts`: `Number`, required, default: `3`.
  - `currentProvider`: `String`, optional.
  - `payload`: `Object`, required.
  - `result`: `Object`, optional.
  - `error`: `Object`, optional.
  - `lockedUntil`: `Date`, optional.
  - `createdAt`: `Date`, required.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ status: 1, lockedUntil: 1 }`, `{ createdAt: 1 }`.

### 34. `aiHealthLogs`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `providerCode`: `String`, required, indexed.
  - `status`: `String`, required.
  - `latencyMs`: `Number`, required.
  - `errorMessage`: `String`, optional.
  - `timestamp`: `Date`, required, default: `Date.now`.
- **Indexes:** `{ providerCode: 1, timestamp: -1 }`.

### 35. `leaderboards`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `category`: `String`, required, indexed (e.g. `'USER_EXP'`, `'COMPANY_PROFIT'`).
  - `period`: `String`, enum (`'ALL_TIME'`), required, default: `'ALL_TIME'`.
  - `rankings`: `[Object]`, required.
  - `calculatedAt`: `Date`, required.
- **Indexes:** `{ category: 1, period: 1 }` (unique).

### 36. `notifications`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `userId`: `ObjectId`, required, ref: `users`, indexed.
  - `type`: `String`, required.
  - `title`: `String`, required.
  - `message`: `String`, required.
  - `isRead`: `Boolean`, required, default: `false`.
  - `link`: `String`, optional.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ userId: 1, isRead: 1 }`.

### 37. `auditLogs`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `actorId`: `ObjectId`, required, ref: `users`, indexed.
  - `actorRole`: `String`, enum (`'ADMIN'`, `'AI_MANAGER'`), required.
  - `action`: `String`, required, indexed.
  - `targetCollection`: `String`, required.
  - `targetId`: `ObjectId`, required.
  - `oldValue`: `Object`, optional.
  - `newValue`: `Object`, optional.
  - `reason`: `String`, required.
  - `createdAt`: `Date`, required.
- **Indexes:** `{ actorId: 1 }`, `{ action: 1 }`, `{ createdAt: -1 }`.

### 38. `platformConfigs`

- **Fields:**
  - `_id`: `ObjectId`, required, primary key.
  - `version`: `Number`, required, unique.
  - `config`: `Object`, required (adhering to Section 30 schema).
  - `updatedBy`: `ObjectId`, required, ref: `users`.
  - `updatedAt`: `Date`, required.
- **Indexes:** `{ version: 1 }` (unique).

---

## 27. API Specification

All endpoints are prefixed with `/api/v1`. Authentication verified via JWT Bearer token in the `Authorization` header.

### 27.1 Authentication (`/auth`)

- **`POST /auth/register`**
  - **Role Allowed:** Public
  - **Request:** `{ email: string, password: string }`
  - **Response (201):** `{ success: true, data: { user: { id: string, email: string, careerRole: string, platformRole: string, isEmailVerified: boolean }, devVerificationUrl?: string } }`
  - **Errors:** 400 (Validation failed), 409 (Email already registered)
- **`POST /auth/verify-email`**
  - **Role Allowed:** Public
  - **Request:** `{ token: string }`
  - **Response (200):** `{ success: true, message: "Email verified successfully" }`
  - **Errors:** 400 (Invalid/expired token)
- **`POST /auth/login`**
  - **Role Allowed:** Public
  - **Request:** `{ email: string, password: string }`
  - **Response (200):** `{ success: true, data: { accessToken: string, user: { id: string, email: string, careerRole: string, platformRole: string } } }` (Sets httpOnly refresh token cookie)
  - **Errors:** 400 (Bad input), 401 (Invalid credentials), 423 (Account locked out)
- **`POST /auth/refresh`**
  - **Role Allowed:** Public (valid refresh cookie required)
  - **Request:** Empty
  - **Response (200):** `{ success: true, data: { accessToken: string } }`
  - **Errors:** 401 (Invalid/expired refresh token)
- **`POST /auth/logout`**
  - **Role Allowed:** Authenticated
  - **Request:** Empty
  - **Response (200):** `{ success: true, message: "Logged out" }` (Clears refresh cookie)

### 27.2 Profile & Resume (`/profile`, `/domains`, `/skills`)

- **`GET /domains`**
  - **Role Allowed:** Public / Authenticated
  - **Response (200):** `{ success: true, data: { domains: Domain[] } }`
- **`GET /skills`**
  - **Role Allowed:** Authenticated
  - **Query:** `?domainCode=...`
  - **Response (200):** `{ success: true, data: { skills: Skill[] } }`
- **`GET /profile/me`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { user: Object, profile: Object, totalExp: number, corpCoin: number } }`
  - **Errors:** 401 (Unauthorized), 404 (Profile not found)
- **`POST /profile/setup`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Request:** `{ displayName: string, domain: string, skills: string[], bio?: string, githubUrl?: string, linkedinUrl?: string, portfolioUrl?: string }`
  - **Response (200):** `{ success: true, data: { profile: Object } }`
  - **Errors:** 400 (Invalid fields), 409 (Profile already setup)
- **`POST /profile/resume/upload`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Request:** Multipart form data (`resume`: File, max 10MB)
  - **Response (202):** `{ success: true, data: { resumeId: string, jobId: string, message: "Resume uploaded, processing started" } }`
  - **Errors:** 400 (Invalid magic bytes / unsupported type), 413 (File too large)
- **`GET /profile/resume/analysis`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Response (200):** `{ success: true, data: { analysis: Object, status: string } }`
  - **Errors:** 404 (No analysis found)

### 27.3 Companies & Jobs (`/companies`, `/jobs`)

- **`GET /companies`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { companies: Company[] } }`
- **`GET /companies/:id`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { company: Company, openJobs: Job[], bots?: CompanyBot[] } }`
  - **Errors:** 404 (Company not found)
- **`GET /jobs`**
  - **Role Allowed:** Authenticated
  - **Query:** `?domain=...&level=...`
  - **Response (200):** `{ success: true, data: { jobs: Job[] } }`
- **`GET /jobs/:id`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { job: Job } }`
  - **Errors:** 404 (Job not found)

### 27.4 Applications & Hiring (`/applications`)

- **`POST /applications`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Request:** `{ jobId: string }`
  - **Response (201):** `{ success: true, data: { application: Application } }`
  - **Errors:** 400 (Active application limit reached: max 5), 404 (Job not found), 409 (Already applied)
- **`GET /applications`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Response (200):** `{ success: true, data: { applications: Application[] } }`
- **`GET /applications/:id`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Response (200):** `{ success: true, data: { application: Application, evaluations: Evaluation[], feedback?: Feedback } }`
  - **Errors:** 403 (Forbidden), 404 (Application not found)
- **`POST /applications/:id/withdraw`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Request:** Empty
  - **Response (200):** `{ success: true, data: { application: Application } }`
  - **Errors:** 400 (Cannot withdraw terminal application)
- **`POST /applications/:id/offer/accept`**
  - **Role Allowed:** `JOB_SEEKER`
  - **Request:** Empty
  - **Response (200):** `{ success: true, data: { careerRole: "EMPLOYEE", companyId: string } }`
  - **Errors:** 400 (Application not in OFFER stage)

### 27.5 Interview Session (`/applications/:id/interview`)

- **`GET /applications/:id/interview`**
  - **Role Allowed:** Candidate (`JOB_SEEKER`)
  - **Response (200):** `{ success: true, data: { interview: Interview, messages: { role: string, content: string }[], isCompleted: boolean } }`
- **`POST /applications/:id/interview/messages`**
  - **Role Allowed:** Candidate (`JOB_SEEKER`)
  - **Request:** `{ answer: string }`
  - **Response (200):** `{ success: true, data: { response: string, currentInterviewState: Object, isCompleted: boolean } }`
  - **Errors:** 400 (Interview already completed), 503 (AI Provider temporarily unavailable)

### 27.6 Employee Tasks & Performance (`/employee`)

- **`GET /employee/tasks/today`**
  - **Role Allowed:** `EMPLOYEE`
  - **Response (200):** `{ success: true, data: { primaryTask: Task, bonusTask?: Task } }`
- **`POST /employee/tasks/:id/submit`**
  - **Role Allowed:** `EMPLOYEE`
  - **Request:** `{ content: string }`
  - **Response (202):** `{ success: true, data: { submissionId: string, status: "SUBMITTED" } }`
  - **Errors:** 400 (Task already submitted / expired)
- **`GET /employee/tasks/:id/evaluation`**
  - **Role Allowed:** `EMPLOYEE`
  - **Response (200):** `{ success: true, data: { evaluation: PerformanceRecord, awardedExp: number } }`
  - **Errors:** 404 (Evaluation pending or not found)
- **`GET /employee/warnings`**
  - **Role Allowed:** `EMPLOYEE`
  - **Response (200):** `{ success: true, data: { activeWarningsCount: number, warnings: Warning[] } }`
- **`GET /employee/career-history`**
  - **Role Allowed:** `EMPLOYEE`
  - **Response (200):** `{ success: true, data: { promotions: Promotion[], demotions: Demotion[] } }`

### 27.7 Founder Mode (`/founder`)

- **`POST /founder/unlock`**
  - **Role Allowed:** `EMPLOYEE`
  - **Request:** `{ confirm: true }`
  - **Response (200):** `{ success: true, data: { careerRole: "FOUNDER", starterCorpCoinGranted: 1000 } }`
  - **Errors:** 400 (Insufficient EXP: requires 12,000)
- **`POST /founder/company`**
  - **Role Allowed:** `FOUNDER`
  - **Request:** `{ name: string, description: string }`
  - **Response (201):** `{ success: true, data: { company: Company } }`
  - **Errors:** 400 (Insufficient CorpCoin / already owns active company)
- **`GET /founder/company/employees`**
  - **Role Allowed:** `FOUNDER`
  - **Response (200):** `{ success: true, data: { employees: CompanyEmployee[] } }`
- **`GET /founder/bots`**
  - **Role Allowed:** `FOUNDER`
  - **Response (200):** `{ success: true, data: { bots: CompanyBot[] } }`
- **`POST /founder/bots/purchase`**
  - **Role Allowed:** `FOUNDER`
  - **Request:** `{ botType: "HIRING_BOT" | "TASK_BOT" | "EVALUATION_BOT" }`
  - **Response (201):** `{ success: true, data: { bot: CompanyBot, balanceAfter: number } }`
  - **Errors:** 400 (Insufficient CorpCoin / already owned)
- **`GET /founder/scenario/today`**
  - **Role Allowed:** `FOUNDER`
  - **Response (200):** `{ success: true, data: { scenario: Object } }`
- **`POST /founder/scenario/decide`**
  - **Role Allowed:** `FOUNDER`
  - **Request:** `{ choiceId: string }`
  - **Response (200):** `{ success: true, data: { outcome: Object, newFinancialHealth: number } }`
- **`GET /founder/economy/transactions`**
  - **Role Allowed:** `FOUNDER`
  - **Response (200):** `{ success: true, data: { transactions: CorpCoinTransaction[] } }`

### 27.8 Economy & Notifications (`/economy`, `/notifications`)

- **`GET /economy/exp/history`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { transactions: ExpTransaction[] } }`
- **`GET /notifications`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { notifications: Notification[] } }`
- **`PATCH /notifications/:id/read`**
  - **Role Allowed:** Authenticated
  - **Response (200):** `{ success: true, data: { notification: Notification } }`

### 27.9 Leaderboards (`/leaderboards`)

- **`GET /leaderboards`**
  - **Role Allowed:** Authenticated
  - **Query:** `?category=USER_EXP|COMPANY_PROFIT`
  - **Response (200):** `{ success: true, data: { rankings: Object[] } }`

### 27.10 Admin Console (`/admin`)

- **`GET /admin/users`**
  - **Role Allowed:** `ADMIN`
  - **Response (200):** `{ success: true, data: { users: User[] } }`
- **`PATCH /admin/users/:id`**
  - **Role Allowed:** `ADMIN`
  - **Request:** `{ careerRole?: string, platformRole?: string, isSuspended?: boolean, reason: string }`
  - **Response (200):** `{ success: true, data: { user: User } }`
- **`POST /admin/domains`**
  - **Role Allowed:** `ADMIN`
  - **Request:** `{ code: string, name: string, description: string, reason: string }`
  - **Response (201):** `{ success: true, data: { domain: Domain } }`
- **`GET /admin/config`**
  - **Role Allowed:** `ADMIN`
  - **Response (200):** `{ success: true, data: { config: PlatformConfig } }`
- **`PUT /admin/config`**
  - **Role Allowed:** `ADMIN`
  - **Request:** `{ config: PlatformConfig, reason: string }`
  - **Response (200):** `{ success: true, data: { config: PlatformConfig } }`
- **`POST /admin/demo/hiring`**
  - **Role Allowed:** `ADMIN`
  - **Request:** `{ domain: string, questionsCount: number, difficulty: string }`
  - **Response (200):** `{ success: true, data: { demoSessionId: string } }`
- **`GET /admin/demo/hiring/:sessionId`**
  - **Role Allowed:** `ADMIN`
  - **Response (200):** `{ success: true, data: { session: Object } }`
- **`GET /admin/queues`**
  - **Role Allowed:** `ADMIN`
  - **Response (200):** `{ success: true, data: { pendingJobs: number, jobs: AIJob[] } }`
- **`GET /admin/audit-logs`**
  - **Role Allowed:** `ADMIN`
  - **Response (200):** `{ success: true, data: { logs: AuditLog[] } }`

### 27.11 AI Manager Console (`/ai-manager`)

- **`GET /ai-manager/providers`**
  - **Role Allowed:** `AI_MANAGER`
  - **Response (200):** `{ success: true, data: { providers: AIProvider[] } }`
- **`PATCH /ai-manager/providers/:code`**
  - **Role Allowed:** `AI_MANAGER`
  - **Request:** `{ status?: string, priority?: number, rateLimitRpm?: number, reason: string }`
  - **Response (200):** `{ success: true, data: { provider: AIProvider } }`
- **`POST /ai-manager/providers/:code/test`**
  - **Role Allowed:** `AI_MANAGER`
  - **Response (200):** `{ success: true, data: { healthy: boolean, latencyMs: number } }`
- **`GET /ai-manager/models`**
  - **Role Allowed:** `AI_MANAGER`
  - **Response (200):** `{ success: true, data: { models: AIModel[] } }`
- **`GET /ai-manager/jobs`**
  - **Role Allowed:** `AI_MANAGER`
  - **Response (200):** `{ success: true, data: { jobs: AIJob[] } }`
- **`GET /ai-manager/analytics`**
  - **Role Allowed:** `AI_MANAGER`
  - **Response (200):** `{ success: true, data: { tokenUsage: Object, errorRates: Object } }`

---

## 28. Frontend Pages

Built using **React + Vite + TypeScript**, styled with **Vanilla CSS design tokens + CSS Modules**:

1. **Authentication & Landing:**
   - Landing page explaining simulation mechanics.
   - Login & Register views with client-side Zod validation.
   - Email verification screen (supports dev mock URL).
2. **Onboarding & Profile Setup:**
   - Profile setup wizard (display name, domain selector, skill tagger).
   - Drag-and-drop resume uploader with client file validation.
   - Resume Analysis Review page visualizing parsed skills, experience, and classification before final confirmation.
3. **Job Seeker Career Hub:**
   - Platform & Founder Company directory with tech domain job filters.
   - Application tracker board displaying the 8-stage pipeline progression across active applications (max 5).
   - Rejection diagnostics screen displaying constructive AI feedback.
4. **Interactive Interview Room:**
   - Structured multi-turn REST chat interface with question chronology and answer submission input.
5. **Employee Workplace Dashboard:**
   - Daily Tasks portal displaying on-demand Primary Task and optional Bonus Task.
   - Solution editor/uploader for daily task submissions.
   - Scorecard modal displaying AI score (0–100), awarded clamped EXP, and qualitative feedback.
   - Performance Warning Tracker displaying active warnings count and 30-day countdown timers.
6. **Founder Executive Headquarters:**
   - Company Dashboard displaying workforce metrics, daily P&L, and financial health balance.
   - Bot Marketplace for acquiring Hiring, Task, and Evaluation bots (Advanced bots badged as "LOCKED — COMING SOON").
   - Daily Business Scenario Decision Terminal with consequence impact forecasts.
7. **Global Leaderboards:**
   - Rankings for EXP, Level, CorpCoin, Company Profit, and Company Growth.
8. **Admin Control Console:**
   - User and Company directory with emergency actions modal (suspend, role override).
   - PlatformConfig interactive editor with audit reason prompt.
   - Demo Hiring Simulator testing console.
   - System Audit Log explorer.
9. **AI Manager Infrastructure Console:**
   - Provider matrix with live status indicators, fallback order drag-and-drop, rate limit gauges, and diagnostic test triggers.

---

## 29. Permission Matrix

| System Action                 | `JOB_SEEKER` |     `EMPLOYEE`      |   `FOUNDER`   |   `ADMIN`   | `AI_MANAGER` |
| ----------------------------- | :----------: | :-----------------: | :-----------: | :---------: | :----------: |
| Register / Login              |     Yes      |         Yes         |      Yes      |     Yes     |     Yes      |
| Setup / Edit Profile          |     Yes      |         Yes         |      Yes      |  Read Only  |  Read Only   |
| Upload Resume                 |     Yes      |         No          |      No       |     No      |      No      |
| Browse Companies & Jobs       |     Yes      |         Yes         |      Yes      |     Yes     |  Read Only   |
| Apply to Jobs (max 5 active)  |     Yes      |         No          |      No       |     No      |      No      |
| Participate in Interview Chat |     Yes      |         No          |      No       |  Demo Only  |      No      |
| View Rejection Feedback       |     Yes      |    Yes (History)    | Yes (History) |     Yes     |      No      |
| Accept Job Offer              |     Yes      |         No          |      No       |     No      |      No      |
| View Daily Tasks              |      No      |         Yes         |      No       |     Yes     |      No      |
| Submit Daily Tasks            |      No      |         Yes         |      No       |     No      |      No      |
| View Warning Status           |      No      |         Yes         |      No       |     Yes     |      No      |
| Unlock Founder Mode           |      No      | Yes ($\ge 12k$ EXP) |      No       |     No      |      No      |
| Create Company                |      No      |         No          |      Yes      |     Yes     |      No      |
| Purchase AI Bots              |      No      |         No          |      Yes      |     No      |      No      |
| Decide Daily Scenario         |      No      |         No          |      Yes      |     No      |      No      |
| View Global Leaderboards      |     Yes      |         Yes         |      Yes      |     Yes     |     Yes      |
| Edit Any User Record          |      No      |         No          |      No       | Yes (Audit) |      No      |
| Add / Edit Career Domains     |      No      |         No          |      No       | Yes (Audit) |      No      |
| Edit PlatformConfig           |      No      |         No          |      No       | Yes (Audit) |      No      |
| Run Demo Hiring Engine        |      No      |         No          |      No       |     Yes     |      No      |
| View System Audit Logs        |      No      |         No          |      No       |     Yes     |      No      |
| Manage AI Providers           |      No      |         No          |      No       |     No      | Yes (Audit)  |
| Change AI Priority & Fallback |      No      |         No          |      No       |     No      | Yes (Audit)  |
| Test AI Provider Health       |      No      |         No          |      No       |     No      |     Yes      |

---

## 30. PlatformConfig

The authoritative system configuration schema is stored as a single document in `platformConfigs` and cached server-side:

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

---

## 31. Error Handling

### 31.1 Standardized API Error Response

All API errors return a uniform JSON format:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested application was not found.",
    "details": {}
  }
}
```

### 31.2 Error Codes & Categories

- `VALIDATION_ERROR` (400): Request payload failed Zod schema parsing.
- `AUTHENTICATION_ERROR` (401): Missing, invalid, or expired JWT.
- `AUTHORIZATION_ERROR` (403): User role lacks sufficient permissions.
- `RESOURCE_NOT_FOUND` (404): Target document does not exist.
- `BUSINESS_RULE_VIOLATION` (409): E.g., exceeding 5 active applications, duplicate company name.
- `ACCOUNT_LOCKED` (423): Exceeded 5 failed login attempts.
- `RATE_LIMIT_EXCEEDED` (429): Endpoint rate limit tripped.
- `AI_GATEWAY_ERROR` (503): All AI providers temporarily unreachable; task queued.

---

## 32. Security

1. **Argon2id Encryption:** Password security using memory-hard Argon2id parameters before database storage.
2. **Account Lockout:** 5 consecutive failed login attempts within 15 minutes locks account for 15 minutes.
3. **Session Hardening:** Short-lived JWT access tokens (15m) paired with httpOnly, Secure, SameSite refresh cookies (7d).
4. **Zero Client Secrets:** External AI API keys reside exclusively in server-side environment variables.
5. **Magic Byte Verification:** Uploaded files verified at binary level (`file-type`) for `%PDF-` and `PK\x03\x04`.
6. **Input Validation:** Every API endpoint validates all body, query, and path parameters with Zod schemas.

---

## 33. MVP Scope (V1)

- npm workspaces monorepo with strict TypeScript.
- Authentication (Argon2id, JWT + httpOnly cookie, lockout, email verification).
- User Profiles, Resume Upload (PDF/DOCX max 10MB, GridFS), Magic Byte Validation, AI text extraction.
- 3 Initial Platform Companies pre-seeded with jobs in Software, Cloud, and AI Engineering.
- 8-stage Hiring Pipeline (max 5 active applications) with ATS score threshold (70) and stage-by-stage AI feedback.
- Interactive conversational REST Chat Interview engine.
- Employee On-Demand Daily Tasks (1 primary + 1 bonus), AI scoring (0–100), backend clamping, EXP ledger.
- Warning system (30-day expiration, 4 active warnings trigger review) and Demotion/Firing logic.
- Founder Mode unlock (12,000 EXP + confirmation), 1,000 CorpCoin starter grant, Company Creation (100 CorpCoin), Bot Store (3 basic bots at 250 CorpCoin each; advanced bots locked).
- Founder Daily Scenario (`companyScenarios`) and deterministic simulation engine.
- AI Gateway with Multi-Provider Adapters (Gemini, OpenAI, Groq) and custom MongoDB-backed worker (2s polling).
- Admin Console with God Mode and unified Hiring Engine Demo Mode.
- AI Manager Console with provider priority, health monitors, and fallback routing.
- Double-entry ledgers for EXP and CorpCoin, and system audit logging.
- Vitest + Supertest testing suite for backend services and endpoints.

---

## 34. Future Scope (Post-V1)

- Advanced AI Bots (400 CorpCoin) runtime implementations.
- Multiple active companies per founder.
- Additional career domains (Data Science, Cybersecurity, Mobile Engineering).
- Real-time WebSockets / streaming for interview chat and live simulation events.
- Redis-backed high-throughput distributed task queues.
- Inter-company employee hiring and poaching mechanics.

---

## 35. Explicit DO NOT INVENT Rules

1. **No Invented Business Rules:** Every progression requirement, EXP boundary, CorpCoin price, warning count, formula, and state transition must originate from this specification or `PlatformConfig`.
2. **The React Frontend is Never Authoritative:** The client displays state; it never decides EXP awards, levels, warnings, company balances, or role transitions.
3. **AI Never Mutates Database State Directly:** LLMs generate scores, critiques, and scenario texts. Backend code validates against Zod schemas, clamps numbers to allowed ranges, and executes database mutations.
4. **No Direct Provider SDK Imports in Business Logic:** Services must never call Gemini, OpenAI, or Groq SDKs directly. All calls flow strictly through `AIGateway` $\rightarrow$ `ProviderRouter` $\rightarrow$ `ProviderAdapter`.
5. **No Mutation Without a Ledger Record:** EXP and CorpCoin balances must never be modified in-place without creating a corresponding entry in `expTransactions` or `corpCoinTransactions`.
6. **No Silent Changes to Stack or Structure:** The locked technology stack, database schemas, and folder structures must not be altered without an accepted Architecture Decision Record in `docs/DECISIONS.md`.
