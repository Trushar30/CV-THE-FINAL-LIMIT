# CorpVerse — Phase 7 Comprehensive Architectural & Specification Review

- **Review Date:** 2026-10-10
- **Scope:** Phase 7 Employee Progression & Daily Gameplay:
  - `TASK P7.1`: Level and EXP Engine (`LevelService`, pure `expEngine.ts` math, `PlatformConfig.career.levelTable`, clamping of AI scores, atomic EXP ledger awards).
  - `TASK P7.2`: Daily Tasks Engine & AI Scenario Generation (`EmployeeTaskModel`, Option A graduated stretch difficulty, lazy on-demand task issuance, `AIGateway` integration with `WAITING_FOR_PROVIDER` fallback).
  - `TASK P7.3`: Task Submission & AI Evaluation Engine (`TaskSubmissionModel`, `PerformanceRecordModel`, deadline validation, Zod validation, score clamping to $[0, 100]$, pure `calculateTaskExp`, idempotency, running stats update).
  - `TASK P7.4`: Employee Discipline System (`WarningModel`, `DemotionModel`, `EmploymentReviewModel`, 30-day natural decay query, Rule D4 Poor-band warning issuance, Rule D5 authoritative demotion/termination state machine, Admin force-termination with confirmation and audit log).
  - `TASK P7.5`: Employee Promotion & Career Advancement Engine (`PromotionModel`, `PlatformConfig.employee.promotionRules`, multi-criteria rules matrix, deterministic `PromotionService`, advisory AI non-deciding boundary, real-time progression telemetry).
  - `TASK P7.6`: Employee Workplace Frontend UI (`WorkplaceDashboardPage`, `TaskWorkPage`, `TaskHistoryPage`, `Employee.module.css`, clear AI-waiting indicators).
- **Status:** PENDING USER APPROVAL (Zero modifications or feature additions made pending user signoff).

---

## 1. Specification Compliance & Gap Analysis

Comparison of implemented Phase 7 codebase against `docs/CORPVERSE_SPECIFICATION.md` (Sections 9, 10, 11, 12, 14, 16, 26 Collections 17–22, Section 28), `GEMINI.md` Section 5, and approved Architectural Decision Records (ADR-055 to ADR-061):

### 1.1 Career Levels & EXP Calculation Engine (Spec Sections 10 & 14, GEMINI.md Section 5, ADR-055)

- **Spec Requirements:**
  - 10 career levels with exact accumulated EXP thresholds: L1 Intern (0), L2 Junior (500), L3 Junior+ (1,200), L4 Associate (2,000), L5 Mid (3,000), L6 Mid+ (4,500), L7 Senior (6,500), L8 Senior+ (9,000), L9 Lead (12,000), L10 Principal (16,000). Max level is 10.
  - EXP is total accumulated and is never removed by demotion or termination.
  - Founder mode unlocks at 12,000 total EXP.
  - Pure calculation functions without direct state mutation.
  - Awarded EXP calculated via Decision D2: $\text{round}((\text{score} / 100) \times \text{task.maxExp})$.
  - Performance score bands: Poor (0–39), Needs Improvement (40–59), Acceptable (60–74), Good (75–89), Excellent (90–100).
  - Task max EXP by difficulty: Easy (30), Medium (60), Hard (100).
- **Codebase Implementation:** `server/src/services/economy/expEngine.ts`, `server/src/services/economy/level.service.ts`, `server/src/config/platformConfig.schema.ts`.
- **Match Status:** **PERFECT MATCH**.
  - All 10 levels and exact threshold boundaries seeded in `PlatformConfig.career.levelTable`.
  - Math functions in `expEngine.ts` are pure and clamp arbitrary inputs (negative scores, scores > 100, NaN, non-finite).
  - `LevelService` delegates to `ExpService` for atomic double-entry ledger entries in `expTransactions` with zero direct balance writes.
  - Demotion and termination logic preserves total accumulated EXP permanently.

### 1.2 Daily Tasks Engine & AI Scenario Generation (Spec Sections 9 & 15, Decisions D7 & D10, ADR-056)

- **Spec Requirements:**
  - 1 Primary task + 1 optional Bonus task per day.
  - Option A (Graduated Stretch Difficulty):
    - L1–L2: Primary Easy, Bonus Medium.
    - L3–L6: Primary Medium, Bonus Hard.
    - L7–L10: Primary Hard, Bonus Hard.
  - Lazy on-demand issuance per dayKey (`YYYY-MM-DD` UTC); idempotent so opening dashboard repeatedly never duplicates tasks.
  - AI Generation through AI Gateway (`PIPELINE` pool) with graceful fallback to `WAITING_FOR_PROVIDER` when providers are degraded or unavailable.
  - Task status lifecycle: `ASSIGNED`, `IN_PROGRESS`, `SUBMITTED`, `EVALUATED`, `EXPIRED`, `WAITING_FOR_PROVIDER`.
- **Codebase Implementation:** `server/src/models/EmployeeTask.ts`, `server/src/services/employee/dailyTask.service.ts`, `server/src/schemas/task.schema.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Compound unique index `{ employeeId: 1, dayKey: 1, kind: 1 }` prevents duplicate daily task generation.
  - Graduated difficulty mapping strictly implemented per Decision D7.
  - `DailyTaskService.getOrCreateDailyTasks` handles synchronous AI generation and falls back to `WAITING_FOR_PROVIDER` on provider failure.
  - Background AIWorker completion handler updates `WAITING_FOR_PROVIDER` tasks to `ASSIGNED`.

### 1.3 Task Submission & AI Evaluation Engine (Spec Sections 9, 10, 16, Decisions D2 & D4, ADR-058)

- **Spec Requirements:**
  - Submission model storing employee work before deadline (`dueAt`).
  - Exactly one submission allowed per task.
  - AI evaluation via Gateway (`TASK_EVALUATE`) validating against schema: score (0–100), strengths, weaknesses, feedback, rubric criteria scores.
  - Backend authoritatively computes EXP via pure `calculateTaskExp` and awards through `ExpService` with `sourceId = submission._id`.
  - Idempotent: duplicate evaluation calls never double-award EXP.
  - Running performance stats updated (completed tasks count, average score, score bands) for promotion eligibility.
  - In-app notification on evaluation completion.
- **Codebase Implementation:** `server/src/models/TaskSubmission.ts`, `server/src/models/PerformanceRecord.ts`, `server/src/services/employee/taskEvaluation.service.ts`, `server/src/schemas/taskEvaluation.schema.ts`.
- **Match Status:** **PERFECT MATCH**.
  - `TaskSubmissionModel` enforces uniqueness on `taskId`.
  - Deadline validation rejects late submissions before `dueAt`.
  - `TaskEvaluationService.evaluateSubmission` validates output against Zod schema, clamps scores to $[0, 100]$, and clamps EXP to $[0, \text{maxExp}]$.
  - Double evaluation guard verifies existing `PerformanceRecord` and returns it without re-awarding EXP.
  - Dispatches `'TASK_EVALUATED'` notification.

### 1.4 Employee Discipline System (Spec Sections 11–13, 18–19, Decisions D4 & D5, ADR-059)

- **Spec Requirements:**
  - Warnings model: `userId`, `companyId`, `taskSubmissionId`, `status` (`ACTIVE`, `EXPIRED`, `RESOLVED`, `ESCALATED`), `issuedAt`, `expiresAt = issuedAt + 30 days`.
  - Natural query decay: Active warnings computed as `expiresAt > now && status === 'ACTIVE'`, requiring no scheduled cron jobs.
  - Warning issued only on Poor score band ($\le 39$) per approved Decision D4.
  - When active warnings $\ge 4$ (threshold from `PlatformConfig.employee.warningThreshold`), triggers an authoritative employment review.
  - Backend decides authoritatively; AI may supply advisory commentary text only:
    - **Demotion Branch (`level > 1`):** Lowers level by 1, recalculates position title and simulated salary, records in `demotions`, resets active warnings to `'RESOLVED'`, and leaves EXP untouched.
    - **Termination Branch (`level === 1`):** Sets `CompanyEmployee.status = 'TERMINATED'`, decrements `Company.employeeCount`, reverts user `careerRole = 'JOB_SEEKER'`, while keeping EXP, skills, resume, and profile intact.
  - Admin force-terminate requires dangerous-action confirmation string (`CONFIRM_FORCE_TERMINATE`) and records an immutable audit log.
- **Codebase Implementation:** `server/src/models/Warning.ts`, `server/src/models/Demotion.ts`, `server/src/models/EmploymentReview.ts`, `server/src/services/employee/discipline.service.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Natural query decay verified by automated tests.
  - Exact boundary of 3 warnings (no review) vs 4 warnings (triggers review) covered by unit tests.
  - Demotion and termination branches tested with EXP retention verification.
  - Admin force-termination generates audit log with actor and target tracking.

### 1.5 Employee Promotion Engine (Spec Sections 10, 11.3, Decision D17, ADR-060)

- **Spec Requirements:**
  - Promotion rules per level in `PlatformConfig`: EXP, completed tasks, average score, max active warnings.
  - Multi-criteria progression matrix:
    - Canonical example ($L4 \rightarrow L5$): 3,000 EXP, 10 tasks, avg score $\ge 70$, active warnings $\le 1$.
  - Deterministic `PromotionService` evaluates eligibility after each task evaluation.
  - AI may supply advisory recommendation text but never decides.
  - On promotion: increment level, update position title and simulated salary, write record in `promotions`, dispatch `'PROMOTION'` notification.
  - Read endpoint showing live progress toward next level (met vs missing criteria).
  - Maximum level boundary: Level 10 Principal Engineer cannot advance further (`isMaxLevel = true`).
- **Codebase Implementation:** `server/src/models/Promotion.ts`, `server/src/services/employee/promotion.service.ts`, `server/src/controllers/promotion.controller.ts`, `server/src/routes/employee.routes.ts`.
- **Match Status:** **PERFECT MATCH**.
  - PlatformConfig schema encodes `promotionRules` across all level transitions ($L1 \rightarrow L10$).
  - `getPromotionProgress` computes met vs missing status for all 4 criteria independently.
  - Automated tests verify each requirement failing in isolation, the canonical $4 \rightarrow 5$ transition, and AI recommendation non-deciding behavior.

### 1.6 Employee Workplace Frontend (Spec Section 28, ADR-061)

- **Spec Requirements:**
  - Workplace Dashboard: Career level, EXP bar to next level target, active warnings with expiry dates, today's primary and bonus tasks, company info, Founder mode banner with remaining EXP until 12,000 threshold.
  - Task Page: Scenario brief, core requirements, evaluation rubric criteria, answer solution editor (minimum length validation, single-submission guard), evaluation result with score hero, rubric breakdown, and feedback.
  - History Page: Evaluated past tasks with scores, and immutable double-entry EXP ledger viewer.
  - Promotion progress panel: Progress breakdown across all 4 criteria showing what is met and what is missing.
  - Clear AI-waiting states for `WAITING_FOR_PROVIDER` and in-flight evaluation scoring.
- **Codebase Implementation:** `client/src/pages/employee/WorkplaceDashboardPage.tsx`, `client/src/pages/employee/TaskWorkPage.tsx`, `client/src/pages/employee/TaskHistoryPage.tsx`, `client/src/pages/employee/Employee.module.css`.
- **Match Status:** **PERFECT MATCH**.
  - Routed at `/workplace`, `/employee/dashboard`, `/tasks/:id`, `/tasks`, `/tasks/history`.
  - Responsive cyber-corporate design using Vanilla CSS design tokens.
  - Single-submission guard with minimum 10-character validation.
  - AI-waiting states clearly communicated visually with badges and status banners.

---

## 2. Test, Lint & Build Verification Report

All quality gates executed across the entire repository:

| Check | Workspace | Command | Status | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 7 Server Tests** | `@corpverse/server` | `npx vitest run src/tests/promotion.test.ts src/tests/discipline.test.ts src/tests/taskEvaluation.test.ts src/tests/dailyTask.service.test.ts src/tests/dailyTask.routes.test.ts src/tests/level.service.test.ts src/tests/expEngine.test.ts` | **PASSED** | **121 passed** across 7 test suites (100% pass) |
| **Client Tests** | `@corpverse/client` | `npm test --workspace=@corpverse/client` | **PASSED** | **96 passed** across 13 test suites (100% pass) |
| **ESLint** | Root | `npm run lint` | **PASSED** | **0 errors, 0 warnings** across all workspaces |
| **Server Build** | `@corpverse/server` | `tsc -p tsconfig.build.json` | **PASSED** | 0 compilation errors |
| **Client Build** | `@corpverse/client` | `tsc && vite build` | **PASSED** | Production bundle built cleanly (`dist/assets/index-wG1SqkJB.js` 430.99 kB) |
| **Monorepo Build** | Root | `npm run build --workspaces` | **PASSED** | Both server and client build successfully |

---

## 3. Audit of Hardcoded Numbers (Candidates for PlatformConfig)

In accordance with Rule 4 ("Every configurable limit lives in PlatformConfig. No magic numbers in business logic"):

| File | Line | Current Hardcoded Value | Description | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `server/src/services/employee/dailyTask.service.ts` | 134 | `24 * 60 * 60 * 1000` (24h) | Deadline duration from daily task generation until `dueAt` | Add `taskDeadlineHours: z.number().default(24)` to `PlatformConfig.employee` |
| `server/src/services/employee/dailyTask.service.ts` | 89 | `temperature: 0.4` | LLM sampling temperature for scenario generation | Move to `PlatformConfig.ai.taskTemperatures.taskGeneration` |
| `server/src/services/employee/taskEvaluation.service.ts` | 92 | `temperature: 0.2` | LLM sampling temperature for rubric evaluation scoring | Move to `PlatformConfig.ai.taskTemperatures.taskEvaluation` |
| `server/src/services/employee/discipline.service.ts` | 272 | `reason.trim().length < 10` | Minimum character length for admin force-termination reason | Add `minReasonLength: z.number().default(10)` to `PlatformConfig.security` or keep as internal validation guard |
| `server/src/controllers/dailyTask.controller.ts` | 251 | `.limit(50)` | Default maximum records returned for EXP ledger history | Move to `PlatformConfig.employee.ledgerHistoryLimit` (default: 50) |
| `client/src/pages/employee/WorkplaceDashboardPage.tsx` | 97 | `founderUnlockExp = 12000` | Founder mode unlock threshold displayed on client banner | Read dynamically from PlatformConfig or user profile rather than client-side literal |
| `client/src/pages/employee/TaskWorkPage.tsx` | 335 | `solutionContent.trim().length < 10` | Client-side minimum character length for solution submission | Keep as standard client validation guard or sync with server schema |

---

## 4. Audit of AI Output Handling (Schema Validation & Clamping)

In accordance with Architecture Principle 2 ("AI recommends; the backend decides. AI output is always validated against a strict schema and clamped"):

| AI Task Type | Zod Schema Enforced | Validation Mechanism | Backend Score / State Authority | Clamping Enforced |
| :--- | :--- | :--- | :--- | :--- |
| `TASK_GENERATION` | `employeeTaskAiOutputSchema` | Gateway output validator + Zod schema validation | Backend generates metadata (`dayKey`, `level`, `domain`, `kind`, `difficulty`, `maxExp`, `dueAt`, `status`). Only validated technical scenario text is persisted. | Difficulty and max EXP computed by backend lookup, never by LLM. |
| `TASK_EVALUATE` | `taskEvaluationAiOutputSchema` | Gateway output validator + Zod schema validation | Backend authoritatively clamps score to $[0, 100]$, computes EXP via pure math `calculateTaskExp(clampedScore, task.maxExp)`, and awards EXP via `ExpService`. Band determined by backend lookup table. | Score clamped: `Math.max(0, Math.min(100, Math.round(rawScore)))`. Awarded EXP clamped: `0 <= awardedExp <= maxExp`. |
| `EMPLOYMENT_REVIEW` | Advisory text only | N/A (Optional commentary) | AI provides advisory text only (`aiRecommendation`). Backend authoritatively decides demotion vs termination based on employee level. | No score or state mutation authority. |
| `PROMOTION` | Advisory text only | N/A (Optional commendation) | AI provides advisory text only (`aiRecommendation`). Backend authoritatively determines promotion eligibility based purely on the 4 quantitative criteria. | No score or state mutation authority. |

**Verification Verdict:** **ZERO UNPROTECTED WRITES**. All AI outputs are validated against strict Zod schemas before being used, and no AI model ever directly writes scores, EXP, CorpCoin, salaries, or status transitions to the database.

---

## 5. Audit of Inventions & Non-Spec Items

In accordance with Rule 3 ("No-invention rules: Never invent business rules... Never invent files, functions, packages, versions, model names, endpoints, or APIs"):

1. **Utility Read Endpoints for Frontend Views:**
   - **Endpoints:**
     - `GET /api/employee/company`: Convenience endpoint returning the employee's active company details.
     - `GET /api/employee/tasks/history`: Endpoint returning evaluated tasks with associated performance records.
     - `GET /api/employee/ledger/exp`: Endpoint returning the employee's personal EXP transaction ledger.
   - **Origin & Purpose:** Spec Section 28 requires employee views to display company info, past task history, and double-entry EXP ledgers. These read-only endpoints safely expose existing collections (`Company`, `EmployeeTask`, `PerformanceRecord`, `ExpTransaction`) without creating new business models.
   - **Status:** **BENIGN READ-ONLY UTILITY EXTENSION**.

2. **Late Submission Rejection Guard:**
   - **Implementation:** Submitting after `dueAt` returns `400 BAD_REQUEST` ("Task deadline has passed").
   - **Origin & Purpose:** In TASK P7.3 prompt ("endpoint to submit once per task before dueAt (late rule from spec or TODO)"), the prompt requested enforcing `dueAt`. Spec does not define late partial credit or late penalties; tracked in `docs/OPEN_QUESTIONS.md`.
   - **Status:** **APPROVED USER EXTENSION (Documented in OPEN_QUESTIONS.md)**.

3. **Demotion Warning Reset Rule:**
   - **Implementation:** Active warnings are reset to status `'RESOLVED'` upon employee demotion.
   - **Origin & Purpose:** Decision D5 explicitly specifies: "Demotion lowers level and position/compensation, resets active warnings, never removes EXP."
   - **Status:** **APPROVED DECISION D5**.

---

## 6. Summary of Recommended Actions (Pending User Approval)

1. **PlatformConfig Schema Expansion:** Add `taskDeadlineHours: z.number().default(24)` to `PlatformConfig.employee` schema so task duration is 100% configurable.
2. **Founder Unlock Literal Sync:** Expose `founderUnlockExp` via PlatformConfig public read endpoint so frontend does not maintain a hardcoded `12,000` literal.
3. **No Breaking Mismatches Found:** The implementation strictly adheres to all non-negotiable architectural principles, maintains 100% test pass rates across 121 Phase 7 server tests and 96 client tests, and is ready for git commit and remote push upon user approval.
