# CorpVerse — Project Brief

## 1. Executive Summary & Project Vision

**CorpVerse** is an interactive, gamified virtual corporate simulation designed to bridge the gap between academic education and real-world corporate engineering environments. Combining career progression, an internal simulated economy, and multi-provider artificial intelligence, CorpVerse offers students and fresh graduates a realistic, engaging, and feedback-rich sandbox where they can experience the end-to-end corporate lifecycle.

Users enter CorpVerse as job seekers, undergo ATS screening and AI-driven conversational interviews, work as corporate employees tackling real-world domain engineering challenges, earn career experience (EXP), climb organizational hierarchies, and eventually unlock **Founder Mode** to build, fund, and manage their own AI-automated tech companies.

---

## 2. Core Problem Statement

1. **The Corporate Reality Gap for Fresh Graduates:** College graduates and students lack hands-on exposure to corporate workflows, engineering problem scenarios, and corporate expectations.
2. **Opaque "Black-Box" ATS and Hiring Filters:** In modern recruitment, automated bots filter out candidate resumes without actionable, constructive feedback, leaving job seekers unaware of specific deficiencies in their skill set or resume formatting.
3. **Absence of Structured Practice & Motivation:** Traditional learning platforms provide isolated coding puzzles without corporate context, team dynamics, or realistic career consequences (e.g., performance reviews, warnings, promotions, demotions).

CorpVerse directly addresses these challenges by simulating every layer of the corporate ladder with transparent, AI-generated constructive feedback at every milestone.

---

## 3. Core Philosophy: The Three Subsystems

CorpVerse operates through three decoupled, collaborating subsystems:

```
                     ┌───────────────────────────┐
                     │         CORPVERSE         │
                     └─────────────┬─────────────┘
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│   Career System   │    │     AI System     │    │  Economy System   │
├───────────────────┤    ├───────────────────┤    ├───────────────────┤
│ • Job Seeker      │    │ • Gemini Adapter  │    │ • EXP Ledger      │
│ • Employee        │    │ • OpenAI Adapter  │    │ • CorpCoin Ledger │
│ • Founder         │    │ • Groq Adapter    │    │ • Levels & Rank   │
│ • State Machine   │    │ • AI Gateway/Queue│    │ • P&L Simulation  │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

1. **Career System:** Manages user progression, job listings, applications, hiring pipelines, daily work tasks, warnings, demotions, promotions, and founder status.
2. **AI System:** Powers dynamic content generation (ATS analysis, conversational chat interviews, contextual task generation, evaluation scoring, and business scenario simulations) across multiple interchangeable AI providers (Gemini, OpenAI, Groq).
3. **Economy System:** Manages dual currencies (EXP and CorpCoin), deterministic ledger accounting, level calculations, company balance sheets, and company bankruptcy.

---

## 4. User Roles & Dual-Role Hierarchy

To maintain strict boundaries between normal gameplay progression and privileged administrative oversight, CorpVerse splits roles into two separate fields:

### A. Career Roles (`careerRole`) — Normal Progression

- **`JOB_SEEKER`:** The default initial state for all new registered users. Enables browsing companies, viewing job openings, and applying to positions.
- **`EMPLOYEE`:** Active employment within a platform or founder company. Unlocks daily engineering tasks, performance evaluations, and promotion tracks.
- **`FOUNDER`:** Unlocked by senior employees (12,000+ total EXP). Allows founding a company, purchasing AI bots, hiring employees, and making daily strategic business decisions.
- **`NONE`:** Assigned to dedicated system accounts that do not participate in career progression.

### B. Platform Roles (`platformRole`) — Privileged System Roles

- **`NONE`:** Standard role for all normal simulation participants.
- **`ADMIN`:** Full platform administrative authority ("God Mode"). Oversees platform configurations, users, companies, domain catalogs, system audit logs, and demo mode simulations.
- **`AI_MANAGER`:** AI infrastructure oversight. Configures LLM provider priorities, monitors real-time API health and failure rates, toggles providers, inspects token usage, and manages fallback policies.

---

## 5. Supported Career Domains (V1)

CorpVerse v1 focuses strictly on three technical engineering domains (stored in a database `domains` collection so Admin can extend them in future releases):

1. **`SOFTWARE_ENGINEERING`** (Full-stack, backend, frontend, systems)
2. **`CLOUD_ENGINEERING`** (Infrastructure, DevOps, cloud architectures, CI/CD)
3. **`AI_ENGINEERING`** (Machine learning, LLMs, data engineering, AI pipelines)

---

## 6. The End-to-End User Career Journey

### 6.1 Onboarding & Profile Setup

- **Authentication:** Email and password registration with Argon2id password hashing.
- **Profile Fields:**
  - _Mandatory:_ Email, Password, Display Name, Domain selection, Skills array, Resume upload.
  - _Optional:_ GitHub profile URL, LinkedIn profile URL, Portfolio URL, Projects list, Certifications.
- **Resume Processing Pipeline:**
  - Upload format restricted to PDF or DOCX (max 10 MB).
  - Validation enforced via binary magic bytes (never file extension alone).
  - Binary file stream stored securely in **MongoDB GridFS**.
  - Decoupled data models: `ResumeFile` (file metadata & GridFS pointer), `ResumeAnalysis` (structured extracted skills, education, experience), and `UserProfile` remain separate logical records.
  - Visual review screen allows the user to review extracted resume data before confirming profile creation.

### 6.2 Job Seeker Stage: The Hiring Pipeline

- **Company Catalog:** Job seekers browse openings across 3 Initial Platform Companies (AI-powered, maintained by AI Manager) and active Founder-created companies.
- **Application Limit:** Strict limit of **maximum 5 active applications simultaneously** to prevent spam.
- **The 8-Stage Hiring Pipeline:**
  ```
  APPLIED ──► ATS_SCREENING ──► SCREENING ──► ASSESSMENT ──► INTERVIEW ──► FINAL_REVIEW ──► OFFER ──► ACCEPTED
  ```
  - _Terminal States:_ `REJECTED`, `WITHDRAWN`, `EXPIRED`, `ACCEPTED`.
- **Transparent AI Feedback:** If rejected at any stage (ATS score below threshold, technical interview failure, etc.), the AI generates detailed, constructive feedback outlining specific improvement areas, missing keywords, and recommended study topics.
- **Interactive Chat Interview:** Structured multi-turn technical interview conducted in chat format, grounded dynamically in the applicant's resume context and target job requirements.

### 6.3 Employee Stage: Daily Engineering Life

- **Daily Tasks:** Each active employee receives:
  - **1 Primary Task per day** (Mandatory daily engineering challenge).
  - **1 Bonus Task per day** (Optional extra challenge).
- **Task Evaluation & EXP Rewards:**
  - Tasks span 3 difficulty tiers: Easy (Max 30 EXP), Medium (Max 60 EXP), Hard (Max 100 EXP).
  - AI evaluates the submission and returns a performance score (0–100).
  - **Authoritative Backend Rule:** Backend clamps EXP between `0 <= awardedExp <= task.maxExp` and creates an immutable ledger entry.
- **Performance Bands:**
  - 90–100: Excellent
  - 75–89: Good
  - 60–74: Acceptable / Normal
  - 40–59: Needs Improvement (Performance Issue)
  - 0–39: Poor (Warning Candidate)
- **Warning & Termination Policy:**
  - Active warnings expire after **30 days**.
  - Accumulating **4 active warnings** triggers an automatic **Employment Review**.
  - Review results in either **Demotion** (level drops by 1, EXP remains intact) or **Termination** (`careerRole` resets to `JOB_SEEKER`, keeps all accumulated personal EXP and history).

### 6.4 Levels & Progression System

Accumulated EXP is permanent and represents lifelong career experience. Demotion or company bankruptcy never strips accumulated EXP.

- **Level 1 (Intern / Beginner):** 0 EXP
- **Level 2 (Junior):** 500 EXP
- **Level 3 (Junior+):** 1,200 EXP
- **Level 4 (Associate):** 2,000 EXP
- **Level 5 (Mid-Level):** 3,000 EXP
- **Level 6 (Mid-Level+):** 4,500 EXP
- **Level 7 (Senior):** 6,500 EXP
- **Level 8 (Senior+):** 9,000 EXP
- **Level 9 (Lead):** 12,000 EXP _(Unlocks Founder Mode)_
- **Level 10 (Principal):** 16,000 EXP _(Maximum Level)_

### 6.5 Founder Mode & Company Simulation

- **Founder Mode Unlock:** Available upon reaching **12,000 total EXP** (Level 9 Lead). The transition is deliberate and requires explicit user confirmation.
- **Founder Capital:** Founder receives a one-time grant of **1,000 CorpCoin** (`founderStarterCoinGranted = true`).
- **Company Setup Costs:**
  - Company Creation: 100 CorpCoin.
  - Basic Hiring Bot: 250 CorpCoin.
  - Basic Task Bot: 250 CorpCoin.
  - Basic Evaluation Bot: 250 CorpCoin.
  - Total minimum setup cost = 850 CorpCoin (leaves 150 CorpCoin operating buffer).
  - _Advanced Bots (400 CorpCoin each) exist in configuration for future expansion._
- **Company Operational Limits:**
  - Exactly **1 active company** per founder in v1.
  - Maximum **20 employees** per company.
- **Daily Business Decisions:**
  - Founders receive **1 strategic business scenario per day** (e.g., infrastructure scaling, team turnover, tooling investments).
  - Founder selects an option; the backend simulation engine deterministically computes changes in revenue, expenses, employee satisfaction, productivity, and reputation.
- **Bankruptcy & Failure Rules:**
  - Bankruptcy threshold: Company financial health `<= -1,000`.
  - When a company goes bankrupt, the company is liquidated, and the founder reverts to `JOB_SEEKER`.
  - The founder **keeps all personal EXP and career history**.

---

## 7. Platform Economy & Ledger Principles

1. **Currency Segregation:** EXP represents individual career skill; CorpCoin represents corporate capital. They are never mixed or directly exchanged.
2. **Immutable Double-Entry Ledgers:** Every balance modification requires a ledger document (`expTransactions` or `corpCoinTransactions`) specifying user ID, amount, type, source ID, and resulting balance. Direct in-place mutation without a ledger entry is forbidden.

---

## 8. AI Gateway & Multi-Provider Architecture

To ensure high availability and prevent vendor lock-in, CorpVerse abstracts all LLM calls behind a unified internal gateway:

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

- **Unified Interface:** Standard internal `AIRequest` format translated to provider-specific payloads, with provider responses parsed into a normalized `AIResponse`.
- **Bot Decoupling:** Companies purchase functional bots (e.g., "Hiring Bot"), not LLM vendor contracts. Companies never know which AI provider executes requests.
- **Provider Resilience:**
  - AI Manager configures provider priority order and monitors health states (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`).
  - Max 3 attempts per provider before automatic fallback to the next provider.
  - Fallback is triggered only by infrastructure errors (timeouts, 5xx, rate limits, network drops). Validation errors and bad inputs fail fast without fallback.
  - If all providers are exhausted, jobs enter `WAITING_FOR_PROVIDER` in a persistent MongoDB-backed queue.

---

## 9. Admin Capabilities & Demo Mode

- **God-Mode Control:** View, edit, suspend, or restore users; manage domains and company listings; adjust `PlatformConfig` values; inspect audit logs.
- **Destructive Operation Protection:** Sensitive actions (deleting users, wiping companies, resetting the economy) require explicit confirmation.
- **Hiring Engine Demo Mode:** Provides a controlled presentation sandbox for evaluations and demos. Allows Admin to configure question counts, difficulty, and domain while running through the **identical underlying production hiring engine**.

---

## 10. Security & Non-Negotiable Rules

- **Backend Authoritative:** React is strictly a presentation layer. All calculations, state transitions, and ledger entries occur in Node/Express.
- **Zero Secrets on Client:** AI API keys and environment variables are strictly server-side.
- **Input Validation:** Every incoming payload is validated with Zod schemas.
- **Audit Logging:** Every administrative and AI-management action creates an immutable audit record.
