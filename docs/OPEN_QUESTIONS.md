# CorpVerse — Decisions, Resolutions & Questions Log

This document records the definitive resolutions to all architectural, technical, and gameplay decisions (D1–D19) and source document conflicts (C1–C4) approved by the project lead.

Per the **No-Invention Rules** in [GEMINI.md](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/GEMINI.md), all specifications and implementations must adhere strictly to these locked decisions.

---

## 1. Architectural & Technical Decisions Log

### D1: Primary Development Language

- **Decision:** **TypeScript (Strict Mode)**
- **Rules:** `"strict": true` across both frontend (`React + Vite + TypeScript`) and backend (`Node.js + Express + TypeScript`). Zero unnecessary `any`.
- **Status:** **RESOLVED**

---

### D2: Repository Structure & Monorepo Architecture

- **Decision:** **npm workspaces monorepo**
- **Layout:**
  - `apps/client/` (React + Vite)
  - `apps/server/` (Node + Express)
  - `packages/shared/` (`schemas/`, `types/`, `constants/`, `config/`)
  - `docs/`
- **Status:** **RESOLVED**

---

### D3: Frontend Styling & Design System

- **Decision:** **Vanilla CSS + CSS Modules**
- **Rules:** Global design tokens (`styles/tokens.css`, `styles/globals.css`, `styles/themes.css`) + Component-scoped CSS Modules (`Button.module.css`, `Dashboard.module.css`, etc.). No Tailwind in v1.
- **Status:** **RESOLVED**

---

### D4: Frontend State Management Architecture

- **Decision:** **React Context + Custom Hooks**
- **Rules:** React Context for Auth, Session, Current user, and Theme. React state is NOT the source of truth; backend/MongoDB is authoritative. No Redux in v1.
- **Status:** **RESOLVED**

---

### D5: Frontend Client Routing Framework

- **Decision:** **React Router**
- **Rules:** Protected routes based on two orthogonal dimensions: `careerRole` (`JOB_SEEKER`, `EMPLOYEE`, `FOUNDER`) and `platformRole` (`NONE`, `ADMIN`, `AI_MANAGER`).
- **Status:** **RESOLVED**

---

### D6: AI Queue Processing Mechanism (MongoDB-Backed)

- **Decision:** **Custom MongoDB-Backed Worker**
- **Rules:** In-process Node worker with atomic job claiming polling every 2 seconds (`setInterval`). No Redis in v1.
- **Job States:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `WAITING_FOR_PROVIDER`, `CANCELLED`.
- **Status:** **RESOLVED**

---

### D7: AI Gateway & Provider Model Configuration

- **Decision:** **Decoupled AI Gateway > Provider Router > Adapters**
- **Rules:** Do NOT hardcode frozen model IDs in architecture. Provider models are configurable in `PlatformConfig`. Adapter contract (`generate(request)`, `healthCheck()`, `getUsage()`) remains stable across Gemini, OpenAI, and Groq.
- **Default Priority:** 1. Gemini, 2. OpenAI, 3. Groq (configurable by AI Manager).
- **Retry Policy:** Maximum 3 attempts per provider before fallback; if all fail $\rightarrow$ `WAITING_FOR_PROVIDER`.
- **Status:** **RESOLVED**

---

### D8: ATS Screening Scoring Formula & Passing Threshold

- **Decision:** **Score 0–100, Passing Threshold: 70**
- **Weights:**
  - Domain Relevance: 40%
  - Technical Skill Match: 35%
  - Projects / Experience: 15%
  - Resume Clarity / Formatting: 10%
- **Status:** **RESOLVED**

---

### D9: Interview Chat Communication Protocol

- **Decision:** **REST API**
- **Endpoint:** `POST /applications/:id/interview/messages`
- **Rules:** Request receives AI interviewer response + current interview state. No WebSockets or streaming in v1 to ensure persistence, auditability, and replayability.
- **Status:** **RESOLVED**

---

### D10: Daily Employee Task Assignment Schedule

- **Decision:** **On-Demand Generation**
- **Rules:** Triggered when employee requests `GET /employee/tasks/today`. If today's task exists, returns it; if not, triggers AI task generation, stores, and returns. Avoids generating tasks for inactive users.
- **Daily Limits:** 1 Primary Task + 1 Bonus Task = Max 2 tasks/day.
- **Status:** **RESOLVED**

---

### D11: Provider Pools Isolation (DEMO vs PIPELINE)

- **Decision:** **Separate Logical Provider Pools**
- **Rules:** AI Gateway isolates `DEMO` pool (Admin demonstrations) from `PIPELINE` pool (real job seeker hiring, employee tasks, company AI, founder simulations) with separate quotas, API keys, rate limits, queues, and usage tracking.
- **Status:** **RESOLVED**

---

### D12: Company Simulation Engine Mathematical Formulas

- **Decision:** **Deterministic Backend Formulas**
- **Daily Revenue:**
  $$\text{dailyRevenue} = 100 + (\text{employeeCount} \times \text{averageProductivity} \times 5) + (\text{companyRating} \times 2)$$
  where $\text{productivity} = \text{average recent task score} / 100 \in [0, 1]$ and $\text{companyRating} \in [0, 100]$.
- **Daily Expenses:**
  $$\text{dailyExpenses} = 50 + (\text{employeeCount} \times 10) + (\text{botCount} \times 10)$$
- **Daily Profit:**
  $$\text{profit} = \text{dailyRevenue} - \text{dailyExpenses}$$
  $$\text{companyFinancialHealth} += \text{profit}$$
- **Status:** **RESOLVED**

---

### D13: Bot Shop Expansion & Advanced Bots in V1 Scope

- **Decision:** **Display as "LOCKED — COMING SOON"**
- **Rules:** Basic bots cost 250 CorpCoin each (Hiring, Task, Evaluation). Advanced bots cost 400 CorpCoin in config, displayed in shop as locked/coming soon, but unpurchasable in v1.
- **Status:** **RESOLVED**

---

### D14: File Ingestion & Parsing Libraries

- **Decision:** **`file-type` + `pdf-parse` + `mammoth`**
- **Rules:** Magic-byte validation (`file-type`), PDF text extraction (`pdf-parse`), DOCX text extraction (`mammoth`). Max file size 10 MB.
- **Status:** **RESOLVED**

---

### D15: Authentication Lockout Parameters & Token Lifetimes

- **Decision:**
  - Password hashing: **Argon2id**
  - Access token lifetime: **15 minutes**
  - Refresh token cookie lifetime: **7 days**
  - Account lockout: **5 failed attempts within 15 minutes** triggers a **15-minute lockout**.
- **Status:** **RESOLVED**

---

### D16: Automated Testing Framework & Tooling

- **Decision:** **Vitest + Supertest**
- **Rules:** Vitest for services, utilities, AI adapters, and simulation engine. Supertest for Express REST endpoint integration tests.
- **Status:** **RESOLVED**

---

### D17: Employee Promotion Eligibility Criteria Matrix

- **Decision:** **EXP + Completed Tasks + Average Score + Active Warnings**
- **Rules:**
  - Minimum average evaluation score: $\ge 70$
  - Maximum active warnings: $\le 1$
  - Required completed tasks:
    - L1 $\rightarrow$ L2: 5 tasks
    - L2 $\rightarrow$ L3: 10 tasks
    - L3 $\rightarrow$ L4: 10 tasks
    - L4 $\rightarrow$ L5: 10 tasks
    - L5 $\rightarrow$ L6: 10 tasks
    - L6 $\rightarrow$ L7: 15 tasks
    - L7 $\rightarrow$ L8: 15 tasks
    - L8 $\rightarrow$ L9: 15 tasks
    - L9 $\rightarrow$ L10: 15 tasks
- **Status:** **RESOLVED**

---

### D18: Email Verification Flow

- **Decision:** **Mock verification in development, real verification in production**
- **Rules:** Expose `DEV_VERIFICATION_URL` in development; real OTP/token verification in production.
- **Status:** **RESOLVED**

---

### D19: Founder Daily Scenario Storage

- **Decision:** **Dedicated `companyScenarios` collection**
- **Rules:** States: `ACTIVE`, `DECIDED`, `EXPIRED`. Active scenario displayed to founder until decided, preserving complete scenario history.
- **Status:** **RESOLVED**

---

## 2. Source Document Conflicts Resolutions

### Conflict C1: Warning Threshold for Demotion / Firing

- **Resolution:** **4 active warnings trigger an Employment Review** (not automatic termination).
- **Rule:** Reaching 4 active warnings (`warningCount >= 4`) initiates a review where AI recommends and backend decides either Demotion or Termination.
- **Status:** **RESOLVED**

---

### Conflict C2: Admin Demo Mode Architecture

- **Resolution:** **Single Hiring Engine with Isolated AI Provider Pools**
- **Rule:** Demo Mode runs through the exact same Hiring Engine as production, routing requests to the `DEMO` provider pool (D11).
- **Status:** **RESOLVED**

---

### Conflict C3: Career Domain Taxonomy & Naming

- **Resolution:**
  - Database tokens: `SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`.
  - Frontend display labels: `Software Engineer`, `Cloud Engineer`, `AI Engineer`.
- **Status:** **RESOLVED**

---

### Conflict C4: Profile Onboarding Field Requirements

- **Resolution:**
  - **Mandatory:** Email, Password, Display Name, Career Domain, Skills, Resume.
  - **Optional:** GitHub, LinkedIn, Portfolio, Projects, Certifications.
- **Status:** **RESOLVED**

---

## 3. Open Questions (Pending User Decisions)

### Q1: Resume Replace and Delete Behavior

- **Context:** Spec Section 5.2 and Section 20 define `resumes` and `profiles.resumeId`, but do not specify what happens when an existing candidate uploads a new resume or requests resume deletion.
- **Resolution:**
  - **Replacement (Archive & Preserve):** When a user with an existing resume uploads a new one, the previous `ResumeFile` record is updated to `status: 'ARCHIVED'`. The previous GridFS binary and metadata are preserved for historical audit trails and past job applications. `profile.resumeId` is updated to point to the latest uploaded resume.
  - **Deletion:** Deletion is disallowed if active job applications exist. Re-upload acts as replacement through archiving.
- **Reference:** ADR-040.
- **Status:** **RESOLVED**

---

### Q2: Job Applications Lifecycle & ATS Evaluation Engine (TASK P5.3 Design)

- **Context:** Spec Section 7, Section 26 (Collection 11), Section 27.4, and Section 39 define the 8-stage application pipeline and ATS scoring criteria, but execution semantics for the ATS evaluation stage require alignment with the asynchronous AI Gateway.
- **Resolution / Design Decisions:**
  - **Pre-Conditions for Application:** Candidate must possess `careerRole === 'JOB_SEEKER'`, an existing `Profile`, and a completed `ResumeAnalysis` (`profile.resumeAnalysisId`).
  - **Concurrency Quota:** The count of non-terminal applications (`status === 'ACTIVE'`) for the user must be strictly $< 5$ (`PlatformConfig.applications.maxActive`). Exceeding returns 400 `BUSINESS_RULE_VIOLATION`.
  - **Duplicate Prevention:** A candidate cannot submit a new application for a job if an active application already exists for the same `(userId, jobId)`. Returns 409 `BUSINESS_RULE_VIOLATION`. If a previous application reached a terminal state (`REJECTED`, `WITHDRAWN`, `EXPIRED`), re-application is permitted.
  - **Asynchronous ATS Processing:** Upon submission (`POST /api/applications`), the application record is created with `currentStage: 'APPLIED'`, `status: 'ACTIVE'`, and transitions to `ATS_SCREENING` by enqueuing an AI task (`ATS_EVALUATION` in `PIPELINE` pool) via `AIGateway.submit()`.
  - **Deterministic Formula & Gate:** The ATS evaluation scores candidate resume attributes against the job requirements using the locked weights (40% domain, 35% skills, 15% experience, 10% clarity). Passing score $\ge 70$ advances `currentStage` to `SCREENING`. Failing score $< 70$ sets `status = 'REJECTED'`, stores structured diagnostic feedback, and frees the active application slot.
  - **Candidate Withdrawal:** `POST /api/applications/:id/withdraw` sets `status = 'WITHDRAWN'` if non-terminal, releasing the active application slot.
- **Reference:** Spec Section 7, ADR-018, Task P5.3.
- **Status:** **RESOLVED (Implementation Ready for P5.3)**

---

### Q3: Stale Job Application Expiry Duration (TASK P6.1)

- **Context:** Spec Section 7.1 and Section 26.11 define `EXPIRED` as a valid terminal status for job applications (`APPLIED`, `ATS_SCREENING`, `SCREENING`, `ASSESSMENT`, `INTERVIEW`, `FINAL_REVIEW`, `OFFER`). However, the exact staleness duration (in days) is not defined in `CORPVERSE_SPECIFICATION.md` (unlike warnings which have an explicit 30-day window).
- **Current Behavior:** The `expireStaleApplications(staleDays?: number)` service method and `runApplicationExpiryJob` default to 30 days of inactivity as a safe fallback.
- **Open Question / TODO for Project Lead:**
  - What should be the official staleness expiration duration?
    - Option A: Uniform 30 days of inactivity across all stages.
    - Option B: Uniform 14 days of inactivity across all stages.
    - Option C: Multi-tier stage expirations (e.g., 7 days for `OFFER`, 14 days for `ASSESSMENT`/`INTERVIEW`, 30 days for others).
    - Option D: Configurable in `PlatformConfig.applications.staleApplicationDays`.
- **Status:** **TODO (Pending User Decision)**

---

### Q4: FINAL_REVIEW Stage Weights, Level Salary Bands, and Offer Decline Terminal State (TASK P6.4)

- **Context:** TASK P6.4 builds `FINAL_REVIEW`, `OFFER`, and `ACCEPTED`. Per `GEMINI.md` No-Invention Rules and user prompt instructions, stage weights for `FINAL_REVIEW`, level salary bands for `OFFER`, negotiation caps, and the terminal state for declining an offer must be agreed with the project lead and configured in `PlatformConfig`.
- **Proposed Defaults:**
  1. **Final Review Stage Score Weights (`PlatformConfig.stages.finalReview`):**
     - ATS Screening: 15%
     - Screening: 20%
     - Assessment: 30%
     - Interview: 35%
     - Passing Threshold: 70
  2. **Level Salary Bands (Simulated Annual USD in `PlatformConfig.career.salaryBands`):**
     - L1 Intern: $45,000 – $60,000 (default: $50,000)
     - L2 Junior: $60,000 – $80,000 (default: $70,000)
     - L3 Junior+: $80,000 – $100,000 (default: $90,000)
     - L4 Associate: $100,000 – $125,000 (default: $110,000)
     - L5 Mid: $125,000 – $155,000 (default: $140,000)
     - L6 Mid+: $155,000 – $190,000 (default: $170,000)
     - L7 Senior: $190,000 – $230,000 (default: $210,000)
     - L8 Senior+: $230,000 – $280,000 (default: $250,000)
     - L9 Lead: $280,000 – $340,000 (default: $300,000)
     - L10 Principal: $340,000 – $420,000 (default: $380,000)
  3. **Offer Negotiation (`PlatformConfig.stages.offer`):**
     - `maxNegotiationRounds`: 3 (demo default: 1)
  4. **Offer Decline State Transition:**
     - Option A (Recommended): Moves to `WITHDRAWN` (candidate voluntarily declined/walked away from offer, releasing active quota cleanly).
     - Option B: Moves to `REJECTED` (candidate rejected the company's offer).
- **Status:** **RESOLVED (Confirmed by User)**
- **Resolution:**
  - `finalReview`: `atsWeight: 15`, `screeningWeight: 20`, `assessmentWeight: 30`, `interviewWeight: 35`, `passingScore: 70`.
  - `salaryBands`: 10 level bands locked into `PlatformConfig.career.salaryBands`.
  - `offer`: `maxNegotiationRounds: 3` (demo: 1).
  - `declineStatus`: `WITHDRAWN` (candidate voluntarily declined/walked away from offer, releasing active quota cleanly).

