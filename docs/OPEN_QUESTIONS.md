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
- **Rules:** Do NOT hardcode frozen model IDs in architecture. Provider models are configurable in `PlatformConfig`. Adapter contract (`generate(request)`, `healthCheck()`, `getUsage()`) remains stable across Gemini, OpenAI, and Grok.
- **Default Priority:** 1. Gemini, 2. OpenAI, 3. Grok (configurable by AI Manager).
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
