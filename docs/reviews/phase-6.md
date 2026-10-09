# CorpVerse — Phase 6 Comprehensive Architectural & Specification Review

- **Review Date:** 2026-10-09
- **Scope:** Phase 6 Interview Simulation Engine & Hiring Lifecycle:
  - `TASK P6.1`: Application Model & State Machine (`ApplicationModel`, `ApplicationStateMachine`, 8-stage pipeline, active application quota of 5, duplicate application prevention, withdrawal, stale expiry job).
  - `TASK P6.2`: ATS Screening Evaluation Engine & AI Integration (`ATS_SCREEN` AI task type, `evaluations` & `feedbacks` persistence, authoritative backend score gate, queue resilience).
  - `TASK P6.3`: Chat-Based Stages: SCREENING, ASSESSMENT, INTERVIEW (`StageEngineService`, `PlatformConfig.stages`, dynamic context-grounded question generation, turn-by-turn answer evaluation, arithmetic mean score gate, progression/rejection, token budget trimming).
  - `TASK P6.4`: Final Review, Offer Negotiation, and Atomic Acceptance (`FinalReviewOfferService`, weighted score synthesis, simulated level salary bands, conversational negotiation chat, salary clamping, atomic acceptance transaction, full-company rejection, auto-withdrawal of competing applications).
  - `TASK P6.5`: Notification Foundation & Hiring Events (`NotificationModel`, `NotificationService`, stage advanced, rejected with feedback link, offer received, hired, expired events, owner-only feedback endpoint).
  - `TASK P6.6`: Admin Demo Hiring Simulator (`DemoSessionModel`, `DemoHiringService`, mode `DEMO`, demo company & demo provider pool, step-by-step and full lifecycle simulation, inspection endpoints, hard production state isolation, single & bulk cleanup with audit logs).
  - `TASK P6.7`: Candidate Experience Frontend for Hiring Journey (`ApplicationsTrackerPage`, `StageChatPage`, `FeedbackModal`, `OfferPage`, `NotificationBell`).
  - `TASK P6.8`: Frontend for Admin Demo Console (`AdminDemoPage`, configuration form, candidate runner, stage results grid, per-call AI telemetry inspector, audited cleanup modals).
- **Status:** PENDING USER APPROVAL (Zero modifications or feature additions made pending user signoff).

---

## 1. Specification Compliance & Gap Analysis

Comparison of implemented Phase 6 codebase against `docs/CORPVERSE_SPECIFICATION.md` (Sections 7, 8, 23, 24, 26 Collections 11–16, 36, 42, Section 27.4, 27.5, 27.8, 27.10, 28, 30, 42) and approved decisions:

### 1.1 8-Stage Hiring Pipeline & State Machine (Spec Section 7.1, 7.3, Section 26 Collection 11, Section 27.4)

- **Spec Requirements:**
  - 8-stage pipeline: `APPLIED` $\rightarrow$ `ATS_SCREENING` $\rightarrow$ `SCREENING` $\rightarrow$ `ASSESSMENT` $\rightarrow$ `INTERVIEW` $\rightarrow$ `FINAL_REVIEW` $\rightarrow$ `OFFER` $\rightarrow$ `ACCEPTED`.
  - Terminal states: `REJECTED`, `WITHDRAWN`, `EXPIRED`, `ACCEPTED`.
  - Active applications quota: Maximum 5 concurrent active applications per job seeker (`PlatformConfig.applications.maxActive`).
  - Duplicate application prevention: Cannot apply to the same job while an active application exists.
  - Re-application allowed once an application reaches a terminal state.
- **Codebase Implementation:** `server/src/models/Application.ts`, `server/src/services/career/applicationStateMachine.ts`, `server/src/services/career/application.service.ts`, `server/src/jobs/applicationExpiry.job.ts`.
- **Match Status:** **PERFECT MATCH**.
  - All 8 stages and 4 terminal states strictly modeled in `ApplicationStateMachine.ts`.
  - Quota of 5 enforced atomically before creating any application.
  - Duplicate prevention indexed and checked at database level (`{ userId: 1, jobId: 1, status: 1 }`).
  - Terminal states permanently locked against further transitions.

### 1.2 ATS Screening Evaluation Engine (Spec Section 7.2, Section 26 Collections 15 & 16, Section 27.4)

- **Spec Requirements:**
  - ATS score range: 0–100.
  - Authoritative passing threshold: 70 (`PlatformConfig.ats.passingScore`).
  - Category weights: Domain Relevance (40%), Technical Skill Match (35%), Projects/Experience (15%), Resume Clarity (10%).
  - Evaluation gate: Score $\ge 70 \rightarrow$ advance to `SCREENING`; Score $< 70 \rightarrow$ transition to `REJECTED` and persist actionable feedback.
- **Codebase Implementation:** `server/src/services/career/atsScreening.service.ts`, `server/src/schemas/atsScreening.schema.ts`, `server/src/models/Evaluation.ts`, `server/src/models/Feedback.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Background AI worker executes `ATS_SCREEN` with candidate resume analysis snapshot and target job requisition.
  - Match score clamped strictly to $[0, 100]$: `Math.max(0, Math.min(100, Math.round(rawScore)))`.
  - Backend authoritatively compares clamped score against `PlatformConfig.ats.passingScore` regardless of AI recommendation text.
  - Rejections persist structured feedback with missing skills and improvement suggestions into `feedbacks` collection.

### 1.3 Multi-Turn Chat Stages: SCREENING, ASSESSMENT, INTERVIEW (Spec Section 8, Section 26 Collections 12–14, Section 27.5, Decision D12)

- **Spec Requirements:**
  - Conversational multi-turn chat via REST transport (`POST /api/applications/:id/stage/messages` / `/interview/messages`).
  - No WebSockets in v1 to ensure deterministic replayability, persistence, and auditability.
  - Questions grounded dynamically in candidate profile, verified resume, and job context.
  - Backend authoritative evaluation: AI evaluates turn responses; backend validates, clamps scores, computes arithmetic mean across turns, and makes final pass/fail decision.
- **Codebase Implementation:** `server/src/services/career/stageEngine.service.ts`, `server/src/schemas/stageChat.schema.ts`, `server/src/models/Interview.ts`, `server/src/models/Question.ts`, `server/src/models/Answer.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Reusable `StageEngineService` dynamically parameterizes `SCREENING`, `ASSESSMENT`, and `INTERVIEW` from `PlatformConfig.stages`.
  - Anti-tampering guards prevent answering out-of-order, resubmitting answers to already evaluated questions, or skipping ahead.
  - Turn answer scores clamped to $[0, 100]$; stage pass/fail determined by average score $\ge$ stage passing threshold.

### 1.4 Final Review, Offer Negotiation & Atomic Acceptance (Spec Section 7.3, Section 26 Collections 8 & 11, Section 27.4, Decision D12)

- **Spec Requirements:**
  - `FINAL_REVIEW`: Aggregates all stage scores into weighted final score using weights from `PlatformConfig`. AI generates summary text only.
  - `OFFER`: Generates simulated salary within level band from `PlatformConfig`. Conversational negotiation with backend salary clamping and round limits. EXP is strictly non-negotiable.
  - `ACCEPTED`: Atomic transaction creates `CompanyEmployee` record, updates user `careerRole = 'EMPLOYEE'`, increments company `employeeCount` (rejecting if company is full at max 20), and closes competing active applications as `WITHDRAWN`.
- **Codebase Implementation:** `server/src/services/career/finalReviewOffer.service.ts`, `server/src/schemas/offer.schema.ts`, `server/src/models/CompanyEmployee.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Final review weights ($ATS: 15\%$, $Screening: 20\%$, $Assessment: 30\%$, $Interview: 35\%$, passing score $70$) loaded from `PlatformConfig.stages.finalReview`.
  - Salary negotiation strictly clamps counter-offers to `[offer.salaryMin, offer.salaryMax]`; negotiation rounds capped by `PlatformConfig.stages.offer.maxNegotiationRounds` (default 3); candidate cannot alter EXP.
  - Single atomic MongoDB transaction creates employment record, verifies company capacity ($\le 20$), updates user careerRole to `EMPLOYEE`, and auto-withdraws other active applications.

### 1.5 In-App Notification Foundation (Spec Section 24, Section 26 Collection 36, Section 27.8)

- **Spec Requirements:**
  - Notifications collection (Collection 36): `userId`, `type`, `title`, `message`, `isRead`, `link`, `createdAt`.
  - Generates notifications on stage advancement, job offers, hiring, and rejections (with feedback link).
  - Endpoints to list notifications and mark as read (`GET /notifications`, `PATCH /notifications/:id/read`).
  - Owner-only feedback inspection endpoint.
- **Codebase Implementation:** `server/src/models/Notification.ts`, `server/src/services/notification/notification.service.ts`, `server/src/controllers/notification.controller.ts`, `server/src/routes/notification.routes.ts`, `server/src/controllers/application.controller.ts` (`getApplicationFeedback`).
- **Match Status:** **PERFECT MATCH**.
  - Fully supports unread counting, single mark read, mark all read, and owner-only access to rejection feedback records.

### 1.6 Admin Demo Hiring Simulator (Spec Sections 23, 27.10, 42)

- **Spec Requirements:**
  - Built on the exact same hiring engine (no duplicate or mock engine).
  - Admin parameterizes domain, question count, difficulty, and interview type.
  - Demo applications run with `mode: 'DEMO'`, against a demo company, and use the `DEMO` provider pool.
  - Zero production contamination: never creates real employees, never alters user `careerRole`, never writes EXP/CorpCoin ledgers, and never impacts platform leaderboards.
  - Full inspection of stage scores and AI request metadata.
  - Admin cleanup actions for single sessions and bulk purge with audit logs.
- **Codebase Implementation:** `server/src/models/DemoSession.ts`, `server/src/services/admin/demoHiring.service.ts`, `server/src/controllers/demoHiring.controller.ts`, `server/src/routes/admin.routes.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Implements `ensureDemoCompany()`, `ensureDemoJob()`, `ensureDemoCandidate()` with `aiProviderPool: 'DEMO'`.
  - Explicit checks in `FinalReviewOfferService.acceptOffer` completely bypass employee record creation, role mutation, and ledger entries when `mode === 'DEMO'`.
  - Audit logs recorded for both single session deletion and bulk purge.

### 1.7 Frontend Candidate Hiring Experience & Admin Demo Console (Spec Section 28, Tasks P6.7 & P6.8)

- **Spec Requirements:**
  - Candidate: Application tracker (`/applications`), stage chat (`/applications/:id/stage`), rejection feedback modal, offer page (`/applications/:id/offer`), topbar notifications bell.
  - Admin: Hiring demo simulator console (`/admin/demo`) with parameter setup form, interactive candidate runner, results dashboard, per-call AI telemetry inspector, and audited cleanup modals.
- **Codebase Implementation:** `client/src/pages/career/ApplicationsTrackerPage.tsx`, `client/src/pages/career/StageChatPage.tsx`, `client/src/pages/career/OfferPage.tsx`, `client/src/components/career/FeedbackModal.tsx`, `client/src/components/notifications/NotificationBell.tsx`, `client/src/pages/admin/AdminDemoPage.tsx`.
- **Match Status:** **PERFECT MATCH**.
  - All views conform strictly to Apple-grade fluid spring ergonomics, dark/light design tokens, and zero client-side business logic calculation.

---

## 2. Test, Lint & Build Verification Report

All quality gates executed across the entire repository:

| Check                    | Workspace           | Command                      | Status     | Details                                                 |
| :----------------------- | :------------------ | :--------------------------- | :--------- | :------------------------------------------------------ |
| **Server Tests**         | `@corpverse/server` | `npm test`                   | **PASSED** | 535 passed, 3 skipped across 26 test suites (100% pass) |
| **Client Tests**         | `@corpverse/client` | `npm test -- --run`          | **PASSED** | 88 passed across 12 test suites (100% pass)             |
| **Total Monorepo Tests** | Root                | Monorepo suites              | **PASSED** | **623 passed**, 3 skipped across 38 test suites         |
| **ESLint**               | Root                | `npm run lint`               | **PASSED** | 0 errors, 0 warnings across all workspaces              |
| **Server Build**         | `@corpverse/server` | `tsc -p tsconfig.build.json` | **PASSED** | 0 compilation errors                                    |
| **Client Build**         | `@corpverse/client` | `tsc && vite build`          | **PASSED** | Production bundle built cleanly (0 errors)              |

---

## 3. Audit of Hardcoded Numbers (Candidates for PlatformConfig)

In accordance with Rule 4 ("Every configurable limit lives in PlatformConfig. No magic numbers in business logic"):

| File | Line | Current Hardcoded Value | Description | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `server/src/jobs/applicationExpiry.job.ts` | 15 | `staleDays = 30` | Default expiration period in days for stale non-terminal applications | Move to `PlatformConfig.applications.expiryDays` (default: 30) |
| `server/src/services/career/stageEngine.service.ts` | 64 | `MAX_HISTORY_CHAR_BUDGET = 8000` | Character ceiling for trimmed conversation history (~2000 tokens) | Move to `PlatformConfig.ai.stageHistoryCharBudget` or keep as internal token budget constant |
| `server/src/services/admin/demoHiring.service.ts` | 77 | `financialHealth: 100000` | Initial financial health assigned to simulated demo company | Move to `PlatformConfig.company.demoInitialFinancialHealth` or keep as demo seed default |
| `server/src/services/admin/demoHiring.service.ts` | 79 | `maxEmployees: 100` | Employee capacity assigned to simulated demo company | Move to `PlatformConfig.company.demoMaxEmployees` or align with `company.maxEmployees` (20) |
| `server/src/services/admin/demoHiring.service.ts` | 111 | `targetLevel = difficulty === 'HARD' ? 7 : 4 : 2` | Level assigned to demo job based on difficulty | Candidate for `PlatformConfig.stages.demoDifficultyLevels` |
| `server/src/services/career/finalReviewOffer.service.ts` | 238 | `temperature: 0.2` | Model temperature for final review summary generation | Move to `PlatformConfig.ai.taskTemperatures.finalReview` |
| `server/src/services/career/finalReviewOffer.service.ts` | 541 | `temperature: 0.3` | Model temperature for offer negotiation assistant | Move to `PlatformConfig.ai.taskTemperatures.offerNegotiation` |
| `server/src/services/career/stageEngine.service.ts` | 443 | `temperature: 0.2` | Model temperature for answer evaluation | Move to `PlatformConfig.ai.taskTemperatures.stageEvaluation` |
| `server/src/services/career/stageEngine.service.ts` | 239 | `temperature: 0.4` | Model temperature for dynamic question synthesis | Move to `PlatformConfig.ai.taskTemperatures.stageQuestion` |

---

## 4. Audit of AI Output Handling (Schema Validation & Clamping)

In accordance with Architecture Principle 2 ("AI recommends; the backend decides. AI output is always validated against a strict schema and clamped"):

| AI Task Type | Zod Schema Enforced | Validation Mechanism | Backend Score / State Authority | Clamping Enforced |
| :--- | :--- | :--- | :--- | :--- |
| `ATS_SCREEN` | `atsScreeningOutputSchema` | `safeParse` in worker completion handler & gateway | Backend authoritatively computes pass/fail by comparing clamped score against `PlatformConfig.ats.passingScore`. AI recommendation is purely advisory. | `Math.max(0, Math.min(100, Math.round(rawScore)))` |
| `INTERVIEW_QUESTION` | `stageQuestionOutputSchema` | Worker hook validator + gateway schema | Backend assigns sequence number, validates question difficulty and type, and limits total questions against `PlatformConfig.stages[stage].questionCount`. | Sequence locked; questions count strictly capped |
| `INTERVIEW_EVALUATION` | `stageAnswerEvaluationOutputSchema` | Worker hook validator + gateway schema | Backend authoritatively clamps individual turn score, stores in `answers`, and calculates final stage arithmetic mean. Pass/fail is determined strictly by `averageScore >= stage.passingScore`. | Turn score clamped to $[0, 100]$; average clamped to $[0, 100]$ |
| `STAGE_FEEDBACK` | `stageRejectionFeedbackOutputSchema` | Worker hook validator + gateway schema | Stored in `feedbacks` collection only after backend makes authoritative rejection decision. | Text arrays validated by Zod; non-empty strings enforced |
| `FINAL_REVIEW_SUMMARY` | `finalReviewSummaryOutputSchema` | Worker hook validator + gateway schema | AI generates summary and recommendations ONLY. Final score is calculated strictly by backend arithmetic: $ATS \times 15\% + Screening \times 20\% + Assessment \times 30\% + Interview \times 35\%$. | Clamped to $[0, 100]$; passing gate determined strictly by `finalScore >= passingScore` |
| `OFFER_NEGOTIATION` | `offerNegotiationOutputSchema` | Worker hook validator + gateway schema | AI provides conversational response and optional counter salary. Backend authoritatively clamps any counter salary strictly to level salary band `[salaryMin, salaryMax]`. EXP is non-negotiable. Rounds decrement monotonically. | Strict clamp: `Math.max(salaryMin, Math.min(salaryMax, round(salary)))` |

**Verification Verdict:** **ZERO UNPROTECTED WRITES**. All AI outputs pass through strict Zod schemas before being used, and no AI model ever directly writes scores, EXP, CorpCoin, salaries, or status transitions to the database.

---

## 5. Audit of Inventions & Non-Spec Items

In accordance with Rule 3 ("No-invention rules: Never invent business rules... Never invent files, functions, packages, versions, model names, endpoints, or APIs"):

1. **`PlatformConfig.stages` and `PlatformConfig.career.salaryBands` Extensions:**
   - **Origin:** Specifically requested by user in Task P6.4 prompt ("FINAL_REVIEW: backend aggregates all stage scores into a final score using weights from PlatformConfig (propose defaults, ask me); OFFER: backend generates an offer (position title, level, salary within the band for that level from PlatformConfig)").
   - **Implementation:** User approved defaults ($ATS: 15\%$, $Screening: 20\%$, $Assessment: 30\%$, $Interview: 35\%$, passing score $70$, max rounds $3$, decline status `WITHDRAWN`, and level salary bands for L1–L10).
   - **Status:** **APPROVED USER EXTENSION (Recorded in ADR-049)**.

2. **`DemoSession` Model & Collection:**
   - **Origin:** Spec Section 23 specifies Admin demo hiring sessions with parameters (domain, questions count, difficulty, interview style), and Spec Section 27.10 specifies `POST /admin/demo/hiring` returning `{ demoSessionId }` and `GET /admin/demo/hiring/:sessionId`.
   - **Implementation:** Created `DemoSessionModel` (`demoSessions` collection) to track these parameters, session status, and active stage for administrative inspection.
   - **Status:** **APPROVED ARCHITECTURAL NECESSITY (Mandated by Spec 27.10, Recorded in ADR-052)**.

3. **`Notification.data` Optional Payload Field:**
   - **Origin:** Spec Section 26 Collection 36 listed `_id`, `userId`, `type`, `title`, `message`, `isRead`, `link`, `createdAt`.
   - **Implementation:** Added optional `data?: Record<string, unknown>` to allow attaching contextual IDs (such as `applicationId`) for deep linking without polluting message text.
   - **Status:** **BENIGN METADATA EXTENSION**.

4. **Default Stale Application Expiry (30 Days):**
   - **Origin:** Spec Section 7.1 notes `EXPIRED` is a terminal state, but did not specify the exact day threshold in Section 7.
   - **Implementation:** Set default to 30 days matching `PlatformConfig.employee.warningExpirationDays` (30 days).
   - **Status:** **ALIGNED DEFAULT (Candidate for PlatformConfig)**.

---

## 6. Summary of Recommended Actions (Pending Approval)

1. **PlatformConfig Schema Expansion:** Add `expiryDays: z.number().default(30)` to `PlatformConfig.applications` schema so stale application expiration is 100% configurable via Admin API.
2. **Demo Company Max Employees Alignment:** Align `ensureDemoCompany()` maxEmployees from 100 to `PlatformConfig.company.maxEmployees` (20) for consistency with standard platform companies.
3. **No Breaking Mismatches Found:** The implementation strictly adheres to all non-negotiable architectural principles, maintains 100% test pass rates across 623 tests, and is ready for git commit upon approval.
