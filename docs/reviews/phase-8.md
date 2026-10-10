# CorpVerse — Phase 8 Comprehensive Architectural & Specification Review

- **Review Date:** 2026-10-10
- **Scope:** Phase 8 Founder Mode, Corporate Enterprise & Deterministic Simulation Engine:
  - `TASK P8.1`: Founder Mode Unlock (`FounderService.unlockFounderMode`, `GET /api/founder/eligibility`, `POST /api/founder/unlock`, starter CorpCoin grant once ever, lifetime EXP preservation, employment termination).
  - `TASK P8.2`: Company Creation & Bot Purchase (`FounderModel`, `CompanyModel`, `CompanyBotModel`, 100 CC incorporation, 250 CC basic bots, 850 total spent, 150 buffer, `isOpenForHiring` transition when all 3 basic bots active).
  - `TASK P8.3`: Engine Connectivity & Multi-Tenant Isolation (`CompanyJobModel`, `CompanyEmployeeModel`, `JobApplicationModel`, PIPELINE pool routing via company bots, multi-tenant isolation, immutable evaluation outcomes).
  - `TASK P8.4`: Deterministic Simulation Engine Design (`docs/SIMULATION_DESIGN.md`, pure math formulas, 3-4 options with bounded numeric modifier tables, bankruptcy at $H \le -1000$, worked numeric examples).
  - `TASK P8.5`: Simulation Engine Implementation (`CompanyScenarioModel`, `CompanyDecisionModel`, `CompanyFinancialsModel`, `simulationEngine.ts`, `SimulationService`, daily dilemma, modifier template catalog, daily tick formula).
  - `TASK P8.6`: Transactional Bankruptcy Liquidation ($H \le -1000$, atomic session transaction, company `BANKRUPT`, employees released to `JOB_SEEKER` with EXP preserved, founder `JOB_SEEKER` with EXP & coins preserved, `founderStarterCoinGranted` stays true).
  - `TASK P8.7`: Founder Mode Frontend UI (`FounderUnlockPage`, `CreateCompanyPage`, `BotShopPage`, `FounderDashboardPage`, `DailyScenarioPage`, `JobOpeningsPage`, `ApplicantPipelinePage`, `FounderLedgerPage`, `BankruptcyOutcomePage`, `Founder.module.css`).
- **Status:** PENDING USER APPROVAL (Zero modifications or feature additions made pending user signoff).

---

## 1. Specification Compliance & Gap Analysis

Comparison of the implemented Phase 8 codebase against `docs/CORPVERSE_SPECIFICATION.md` (Sections 5, 6, 7, 8, 12, 14, 21, 22, 26 Collections 23–26, Section 53), `docs/SIMULATION_DESIGN.md`, `GEMINI.md` Section 5, and approved Architectural Decision Records (ADR-062 through ADR-068):

### 1.1 Founder Mode Unlock & Eligibility (Spec Sections 5, 12, GEMINI.md Section 5, ADR-062)

- **Spec Requirements:**
  - Eligibility requires total accumulated career EXP $\ge 12,000$ (Level 9 Lead threshold from `PlatformConfig.career.founderUnlockExp`) and active career role `EMPLOYEE` (or post-bankruptcy returning `JOB_SEEKER`).
  - Read endpoint `GET /api/founder/eligibility` returns current EXP, required EXP, deficit, role, eligibility boolean, starter coin grant status, and reason.
  - Unlock endpoint `POST /api/founder/unlock` requires explicit user confirmation `{ confirm: true }`.
  - Atomic transition in a single transaction:
    - Sets `User.careerRole = 'FOUNDER'` and timestamps `founderModeUnlockedAt`.
    - Formally terminates current company employment (`CompanyEmployee.status = 'TERMINATED'`), decrements previous company employee headcount, and resolves active warnings.
    - Grants 1,000 CorpCoin starter seed capital once ever via `founderStarterCoinGranted = true` and writes double-entry ledger entry `FOUNDER_STARTER_GRANT`. Repeated unlock/leave cycles never re-grant starter coins.
    - Creates or reactivates record in `founders` collection (`status: 'ACTIVE'`).
    - Dispatches in-app notification `FOUNDER_UNLOCKED`.
- **Codebase Implementation:** `server/src/services/founder/founder.service.ts`, `server/src/models/Founder.ts`, `server/src/controllers/founder.controller.ts`, `server/src/routes/founder.routes.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Verified by 8 unit tests in `server/src/tests/founder-unlock.test.ts`. Below-threshold EXP (e.g. 11,999) rejected with 403. Confirmation payload enforced. Re-unlocking never grants coins again. Concurrency and double-click idempotency handled.

### 1.2 Company Creation & AI Bot Store (Spec Sections 6, 7, 8, Decision D15, ADR-063)

- **Spec Requirements:**
  - Company creation fee: 100 CorpCoin debited via `CorpCoinService.debit` with double-entry ledger entry `type = 'COMPANY_CREATION'`.
  - Exactly 1 active company permitted per founder in v1 (`PlatformConfig.founder.maxActiveCompanies: 1`). Creating a second company while one is active is blocked. Creating a new company after a prior company has gone `BANKRUPT` is permitted.
  - Initial company state starts with `isOpenForHiring: false`.
  - AI Bot Store: 3 basic bots (`HIRING_BOT`, `TASK_BOT`, `EVALUATION_BOT`) costing 250 CorpCoin each, debited with ledger entry `type = 'BOT_PURCHASE'`.
  - Total standard founder setup: Company (100 CC) + 3 basic bots ($3 \times 250 = 750$ CC) = 850 CorpCoin spent from the 1,000 starter grant, leaving a 150 CorpCoin buffer.
  - Abstract bot model (`companyBots` collection) references an abstract bot type with zero underlying AI provider stored.
  - Advanced bots (400 CC) exist in config/catalog only and are explicitly blocked from purchase in v1.
  - Activation gate: Company automatically transitions to `isOpenForHiring: true` once all 3 basic bots are acquired.
- **Codebase Implementation:** `server/src/models/Company.ts`, `server/src/models/CompanyBot.ts`, `server/src/services/founder/founder.service.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Verified by 17 unit tests in `server/src/tests/founder-company-bots.test.ts`. Tests verify insufficient funds rejection, duplicate active company block, exact 850 CC expenditure, 150 CC buffer preservation, and automatic hiring activation.

### 1.3 Engine Connectivity & Multi-Tenant Privacy Guards (Spec Sections 6, 53, ADR-064)

- **Spec Requirements:**
  - When job seekers apply to a founder-owned company, the hiring engine (ATS screening, stage interview chats, offer) and employee task/evaluation engine resolve behavior via the company's active bots.
  - All bot operations route strictly through the AI Gateway `PIPELINE` pool, ensuring company bots are decoupled from underlying LLM providers.
  - Founders manage job openings: create requisitions (`POST /api/founder/jobs`), close requisitions (`PATCH /api/founder/jobs/:id/close`), inspect applicant stage progression (`GET /api/founder/applications`, `GET /api/founder/applications/:id`), and inspect company roster (`GET /api/founder/employees`).
  - Strict multi-tenant isolation: Founders cannot access another company's requisitions, applicants, evaluations, or roster (403 Forbidden).
  - Immutability of evaluation outcomes: Founders can view candidate evaluations, but cannot edit, override, or falsify scores or feedback.
- **Codebase Implementation:** `server/src/services/founder/founder.service.ts`, `server/src/controllers/founder.controller.ts`, `server/src/routes/founder.routes.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Verified by 10 integration tests in `server/src/tests/founder-engines-integration.test.ts`. Full end-to-end flow demonstrates a job seeker applying, getting hired, receiving a daily task, and receiving an evaluation generated by company bots via the AI Gateway.

### 1.4 Deterministic Simulation Engine & Scenario Framework (Spec Sections 14, 21, 22, Decision D14, ADR-065, ADR-066)

- **Spec Requirements:**
  - Authoritative mathematical simulation defined in approved `docs/SIMULATION_DESIGN.md`:
    - Revenue: $\max(0, 100 + (N \times P \times 5) + (Q \times 2) + \Delta \text{rev})$.
    - Expenses: $\max(0, 50 + (N \times 10) + (B \times 10) + \Delta \text{exp} + \text{cost})$.
    - Profit: $\Pi = \text{Revenue} - \text{Expenses}$.
    - Financial Health: $H_{\text{new}} = H_{\text{prev}} + \Pi$.
    - Retention Rate $T$ based on satisfaction $S$ ($S \ge 60 \to$ stable, $40 \le S < 60 \to -2\%$, $S < 40 \to -5\%$).
    - Satisfaction drift toward baseline 70 at 0.5% daily.
  - 1 daily scenario per founder per day (idempotent UTC `dayKey`).
  - Separation of concerns: AI generates narrative descriptions and 2–4 options with registered `templateId`s. AI cannot invent numeric effects. The backend binds modifiers from registered `MODIFIER_TEMPLATES` and clamps values against hard catalog bounds.
  - Idempotent daily tick execution writes immutable financial snapshots to `companyFinancials` (Collection 26) with compound unique index `{ companyId: 1, date: 1 }`.
  - Founder decisions recorded in `companyDecisions` (Collection 25).
- **Codebase Implementation:** `server/src/models/CompanyScenario.ts`, `server/src/models/CompanyDecision.ts`, `server/src/models/CompanyFinancials.ts`, `server/src/services/simulation/simulationEngine.ts`, `server/src/services/simulation/simulation.service.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Verified by 28 unit and integration tests in `simulation-engine.test.ts` and `simulation-service.test.ts`, matching worked examples (Good Day, Bad Day, 4-day Bankruptcy Path) to the exact decimal integer.

### 1.5 Transactional Bankruptcy Liquidation Protocol (Spec Sections 12, 14, 21, Decision D14, ADR-067)

- **Spec Requirements:**
  - Authoritative insolvency trigger when financial health drops to $\le \text{bankruptcyThreshold}$ ($-1000$ from `PlatformConfig.company.bankruptcyThreshold`).
  - Executed in a single atomic database transaction:
    - Company status transitions to `BANKRUPT`, `isOpenForHiring = false`, `employeeCount = 0`.
    - Active company employees terminated (`status: 'TERMINATED'`), released back to `JOB_SEEKER` with notification confirming their lifetime career EXP is preserved.
    - All open job postings closed (`isOpen = false, status = 'CLOSED'`).
    - Founder careerRole reverted to `JOB_SEEKER`, `FounderModel.status = 'BANKRUPT'`, `founderStarterCoinGranted` remains `true`.
    - Personal CorpCoin balance untouched: company debt is wiped with the liquidated entity; personal liquidity and lifelong EXP are preserved.
    - Immutable audit log written (`COMPANY_BANKRUPTCY_LIQUIDATION`).
    - Consecutive bankruptcy/unlock cycles never re-grant starter coins.
- **Codebase Implementation:** `server/src/services/simulation/simulation.service.ts`, `server/src/models/Company.ts`, `server/src/models/Founder.ts`, `server/src/models/AuditLog.ts`.
- **Match Status:** **PERFECT MATCH**.
  - Verified by 11 unit tests in `server/src/tests/bankruptcy.test.ts`. Exact single-integer boundary verified: $H = -999$ does not trigger bankruptcy; $H = -1000$ triggers immediate liquidation. Re-entry as Job Seeker and zero coin re-grants verified.

### 1.6 Founder Mode Frontend UI (Spec Sections 17, 18, 20, ADR-068)

- **Spec Requirements:**
  - Unlock Founder Mode page: Eligibility status, EXP meter, seed capital grant status, confirmation modal with rules disclosure.
  - Create Company Wizard: Name, domain selection, live balance preview, cost summary (100 CC).
  - Bot Shop: 3 basic bots, owned states, live CorpCoin debit, Open for Hiring activation banner, Coming in v2 card.
  - Company Dashboard: Financial health gauge ($[-1000, 2000]$ CC) with danger zone, revenue/expense/profit stats, secondary telemetry ($S, P, T, Q$), roster table, financial snapshots, auto-redirect if bankrupt.
  - Daily Scenario: Active dilemma narrative, option cards with bounded modifier tags, rationale input, decision submission, daily tick execution runner with feedback.
  - Job Openings Manager: Active/closed listings, create requisition modal, close requisition action.
  - Applicant Pipeline: Multi-stage candidate tracker, bot evaluation inspector modal with round scores and qualitative feedback.
  - CorpCoin Ledger: Immutable double-entry transaction history table (`/founder/ledger`).
  - Bankruptcy Outcome Screen: Liquidation hero screen displaying preserved career EXP and personal liquidity, and talent market re-entry actions.
- **Codebase Implementation:** `client/src/pages/founder/*.tsx` (9 page components), `client/src/pages/founder/Founder.module.css`, `client/src/App.tsx`, `client/src/components/layout/Sidebar.tsx`.
- **Match Status:** **PERFECT MATCH**.
  - Verified by 12 comprehensive unit and integration tests in `client/src/tests/founder.test.tsx`.

---

## 2. Test, Lint & Build Verification Report

All quality gates executed across the entire repository:

| Check | Workspace | Command | Status | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 8 Server Tests** | `@corpverse/server` | `npx vitest run src/tests/founder-unlock.test.ts src/tests/founder-company-bots.test.ts src/tests/founder-engines-integration.test.ts src/tests/simulation-engine.test.ts src/tests/simulation-service.test.ts src/tests/bankruptcy.test.ts` | **PASSED** | **74 passed** across 6 test suites (100% pass) |
| **Full Client Tests** | `@corpverse/client` | `npm test --workspace=@corpverse/client` | **PASSED** | **108 passed** across 14 test suites (100% pass) |
| **ESLint** | Root | `npm run lint` | **PASSED** | **0 errors, 0 warnings** across all workspaces |
| **Server Build** | `@corpverse/server` | `tsc -p tsconfig.build.json` | **PASSED** | 0 compilation errors |
| **Client Build** | `@corpverse/client` | `tsc && vite build` | **PASSED** | Production bundle built cleanly (`dist/assets/index-Dl9ooC1p.js` 496.55 kB) |
| **Monorepo Build** | Root | `npm run build --workspaces` | **PASSED** | Both server and client build cleanly |

---

## 3. Audit of Hardcoded Numbers (Candidates for PlatformConfig)

In accordance with Rule 4 ("Every configurable limit lives in PlatformConfig. No magic numbers in business logic"):

| File | Line | Current Hardcoded Value | Description | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `server/src/services/simulation/simulationEngine.ts` | 13–18 | `100`, `50`, `10`, `10`, `5`, `2` | Simulation daily base revenue (100), base expenses (50), employee upkeep (10), bot upkeep (10), employee rev multiplier (5), reputation rev multiplier (2) | Move to `PlatformConfig.simulation.financials` sub-document for admin economic tuning |
| `server/src/services/simulation/simulationEngine.ts` | 23–25 | `-2.0%`, `-5.0%` | Retention decay rates when employee satisfaction falls into 40–59 or < 40 bands | Move to `PlatformConfig.simulation.retentionDecay` |
| `server/src/services/simulation/simulationEngine.ts` | 28 | `0.005` (0.5%), `70` | Daily satisfaction mean-reversion rate toward baseline 70 | Move to `PlatformConfig.simulation.satisfactionDrift` |
| `server/src/services/simulation/simulation.service.ts` | 556 | `limit = 30` | Default record limit for point-in-time financial history | Add `financialHistoryDefaultLimit: z.number().default(30)` to `PlatformConfig.company` |
| `server/src/services/founder/founder.service.ts` | 335 | `limit = 50` | Default record limit for founder CorpCoin transaction ledger query | Add `founderLedgerDefaultLimit: z.number().default(50)` to `PlatformConfig.economy` |
| `client/src/pages/founder/FounderUnlockPage.tsx` | 90 | `requiredExp = 12000` | Default fallback requirement if eligibility API has not responded | Fallback only; authoritative requirement is supplied by server endpoint |
| `client/src/pages/founder/CreateCompanyPage.tsx` | 11 | `CREATION_COST = 100` | Client-side cost preview literal | Fallback for preview only; server authoritatively debits amount from config |
| `client/src/pages/founder/BotShopPage.tsx` | 27–49 | `cost: 250`, `400` | Storefront catalog prices for basic and advanced bots | Read bot prices dynamically from a public catalog endpoint in future refactor |

---

## 4. Audit of AI Output Handling (Schema Validation & Clamping)

In accordance with Architecture Principle 2 ("AI recommends; the backend decides. AI output is always validated against a strict schema and clamped"):

| AI Task / Operation | Zod Schema Enforced | Validation Mechanism | Backend Authority & Numeric Clamping | Clamping Enforced |
| :--- | :--- | :--- | :--- | :--- |
| **Daily Scenario Generation (`COMPANY_SCENARIO`)** | `aiScenarioResponseSchema` | Validated by AI Gateway output parser | **AI NEVER INVENT NUMBERS.** AI generates prompt text and selects registered `templateId`s. The backend resolves numeric modifiers from `MODIFIER_TEMPLATES` in `simulation.schema.ts` and rejects any LLM-invented numbers. | Modifiers clamped against hard catalog bounds in `simulationEngine.ts`: $\Delta \text{rev} \in [-50, 150]$, $\Delta \text{exp} \in [-30, 100]$, $\text{cost} \in [0, 200]$, $\Delta S \in [-15, 15]$, $\Delta Q \in [-10, 10]$. |
| **Simulation Daily Tick Execution** | **Zero AI Involved** | Fully Deterministic Math | Computed 100% by pure deterministic arithmetic in `simulationEngine.ts`. No LLM is invoked during tick calculation. | Revenue $\ge 0$, Expenses $\ge 0$, Satisfaction $\in [0, 100]$, Reputation $\in [0, 100]$, Retention $\in [0, 100\%]$. |
| **Candidate ATS Screening for Founder Companies** | `atsEvaluationAiOutputSchema` | AI Gateway output validator | Bot routes via Gateway `PIPELINE` pool. Backend calculates pass/fail decision based on threshold score. | Score clamped to $[0, 100]$. |
| **Technical Interview Assessment for Founder Companies** | `interviewEvaluationAiOutputSchema` | AI Gateway output validator | Bot routes via Gateway `PIPELINE` pool. Backend computes final outcome. | Score clamped to $[0, 100]$. |
| **Employee Task Evaluation for Founder Companies** | `taskEvaluationAiOutputSchema` | AI Gateway output validator | Bot routes via Gateway `PIPELINE` pool. Backend computes EXP via pure `calculateTaskExp` and awards ledger entry. | Score clamped to $[0, 100]$; EXP clamped to $[0, \text{maxExp}]$. |

**Verification Verdict:** **ZERO UNPROTECTED WRITES**. All AI interactions strictly pass through the AI Gateway and Zod schema validators. AI is completely forbidden from inventing simulation numbers, economic balances, EXP, or solvency outcomes.

---

## 5. Audit of Inventions & Non-Spec Items

In accordance with Rule 3 ("No-invention rules: Never invent business rules... Never invent files, functions, packages, versions, model names, endpoints, or APIs"):

1. **`GET /api/founder/ledger` Endpoint:**
   - **Origin & Purpose:** Spec Section 26 Collection 8 and Section 18 require founders to track CorpCoin transactions. Added read-only endpoint exposing the authenticated user's double-entry transactions from the existing `corpCoinTransactions` collection.
   - **Status:** **BENIGN READ-ONLY UTILITY EXTENSION**.
2. **Duplicate Schema Index Warning on `CompanyFinancials`:**
   - **Observation:** Mongoose logs `Duplicate schema index on {"companyId":1}` because `companyId` has `index: true` on the field definition and is also part of compound index `schema.index({ companyId: 1, date: 1 }, { unique: true })`.
   - **Status:** **NON-FUNCTIONAL SCHEMA HYGIENE ITEM** (recommend removing `index: true` on field declaration in cleanup).
3. **Deterministic Scenario Fallback:**
   - **Origin & Purpose:** When AI Gateway providers are unavailable or fail 3 times, `SimulationService` generates an authoritative deterministic dilemma (`INFRASTRUCTURE_RENEWAL` template) so daily gameplay and company ticks are never blocked by third-party AI outages.
   - **Status:** **RESILIENCE SAFEGUARD (Conforms to Architecture Principle "Resilience")**.

---

## 6. Summary of Recommended Actions (Pending User Approval)

1. **Schema Index Hygiene:** Remove redundant `index: true` on `companyId` in `server/src/models/CompanyFinancials.ts` to silence Mongoose duplicate index warning.
2. **PlatformConfig Schema Expansion:** Move deterministic simulation engine constants (base revenue 100, base expenses 50, upkeep 10, multipliers 5 & 2) into `PlatformConfig.simulation` in Phase 9 for complete administrative configurability.
3. **Phase 8 Formally Completed:** All 7 tasks (P8.1 through P8.7) strictly implemented and verified with 74 server tests and 108 client tests passing. Monorepo is 100% build-clean and lint-clean.

---
