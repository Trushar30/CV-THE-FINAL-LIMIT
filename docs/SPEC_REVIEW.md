# CorpVerse Specification Audit Report (`docs/SPEC_REVIEW.md`)

This document presents a comprehensive audit of [docs/CORPVERSE_SPECIFICATION.md](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/docs/CORPVERSE_SPECIFICATION.md) against the two source documents:
- `docs/source/CorpVerse - The Final Limit.md`
- `docs/source/CorpVerse v1.0 — Complete Rules & Technical Specification.pdf`
and the approved Architecture Decision Records in [docs/DECISIONS.md](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/docs/DECISIONS.md).

Per the master protocol in [GEMINI.md](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/GEMINI.md), **no fixes have been applied silently**. All findings are reported here with concrete proposed remedies awaiting user review and approval.

---

## 1. Items in Source Missing from the Specification

| # | Item from Source | Location in Source | Status in Specification | Proposed Fix |
|---|---|---|---|---|
| **M1** | **Email Verification Step** | `CorpVerse - The Final Limit.md` line 40: *"Firstly, they verify their main [mail] and set email-password."* | Missing from Section 4. Section 4 only defines email/password registration without email verification token or confirmation flow. | Add explicit email verification status (`isEmailVerified: boolean`) to `users` and define whether email verification is active in V1 or mocked. Add to `OPEN_QUESTIONS.md` as D18. |
| **M2** | **Cached Balances on User Document** | PDF page 34: *"total EXP = sum(valid EXP transactions) You can also cache the current balance for performance."* | Missing from Section 26.1 `users` collection. `users` does not define `totalExpCached` or `corpCoinBalanceCached`, even though `GET /profile/me` (Section 27.2) directly returns them. | Add `totalExpCached: Number` (default 0) and `corpCoinBalanceCached: Number` (default 0) to Section 26.1 `users` schema. |
| **M3** | **Active Pipeline Assignment for Company Bots** | Source 1 line 55 & PDF page 7: *"by a bot and set it in the company pipeline as a hiring ai, task provider ai, and review/feedback ai."* | Section 26.9 `companyBots` tracks bot purchases, but lacks an `isActiveInPipeline: Boolean` flag or assigned role field. | Add `isActive: Boolean` (default `true`) and `assignedPipelineStage: String` to Section 26.9 `companyBots`. |
| **M4** | **Employee Retention Metric in Simulation Engine** | PDF page 16: *"The simulation engine calculates: Revenue, Expenses, Profit, Employee satisfaction, Productivity, Retention, Reputation."* | Section 14 omits `Retention` from the computed metric list, tracking only Satisfaction, Productivity, Reputation, and Financial Health. | Add `employeeRetentionRate: Number` to Section 14 formulas, Section 26.24 `companyDecisions`, and Section 26.25 `companyFinancials`. |
| **M5** | **Company Bankruptcy Employee Transition Rule** | PDF page 15–16 & GEMINI.md: *"Upon bankruptcy, founder becomes JOB_SEEKER... employees released."* | Section 6.2 states "employees released", but does not explicitly document their resulting `careerRole` or company disassociation. | Explicitly specify in Section 3.1 and 6.2 that when a company becomes bankrupt, all its active employees have their `companyEmployees.status` set to `TERMINATED` and their `careerRole` becomes `JOB_SEEKER`. |
| **M6** | **AI Manager Capability to Remove/Add Provider APIs** | Source 1 line 46: *"ai manger can remove dead APIs and add as many APIs as he wants as fallback."* | Section 27.10 API only has `PATCH /ai-manager/providers/:code` (update), but lacks endpoints to dynamically register or delete providers. | Add `POST /ai-manager/providers` and `DELETE /ai-manager/providers/:code` to Section 27.10. |

---

## 2. Items in the Specification NOT in the Source or Approved Decisions (Invented / Unapproved)

| # | Item in Specification | Location in Spec | Why it is Unapproved / Invented | Proposed Fix |
|---|---|---|---|---|
| **I1** | **`PROBATION` and `DISSOLVED` Company Statuses** | Section 6.2 Table & Section 26.7 `companies.status` | Neither source document mentions `PROBATION` or `DISSOLVED`. Source documents only specify `ACTIVE` and `BANKRUPT` (PDF pages 8, 15, 36). | Remove `PROBATION`. Replace `DISSOLVED` with `INACTIVE` or restrict company statuses strictly to `['ACTIVE', 'BANKRUPT']` plus Admin emergency archive `['SUSPENDED']`. |
| **I2** | **`ONBOARDING`, `ON_REVIEW`, and `DEMOTED` as Persistent Employee Statuses** | Section 9.1 Table & Section 26.8 `companyEmployees.status` | In the source, demotion lowers job level by 1 while the employee remains active. An employee does not permanently sit in a `'DEMOTED'` status. | Simplify `companyEmployees.status` to `['ACTIVE', 'UNDER_REVIEW', 'TERMINATED']`. When demotion occurs, `level` decrements by 1 and status returns to `'ACTIVE'`. |
| **I3** | **Leaderboard `period: 'MONTHLY'`** | Section 26.34 `leaderboards` & Section 27.8 query param | The source documents (Source 1 line 58, PDF page 17) only define all-time cumulative leaderboards across users and companies. No monthly reset was specified. | Remove `period: 'MONTHLY'` from V1 scope; lock to `'ALL_TIME'`. |
| **I4** | **`promptHash` in `aiRequests`** | Section 26.30 `aiRequests` | Added as an implementation detail for request deduplication/caching, but was never specified in the source. | Document as an internal optional indexing optimization or remove if strict schema purity is required. |
| **I5** | **Field Name Inconsistency: `companyFinancials.balanceHealth` vs `companies.financialHealth`** | Section 26.7 vs Section 26.25 | Section 26.7 calls it `financialHealth`, while Section 26.25 calls it `balanceHealth`. The PDF consistently calls it `financial health` (page 15). | Standardize field name across both collections to `financialHealth`. |

---

## 3. Internal Contradictions Between Sections

| # | Area | Contradicting Sections | Description of Contradiction | Proposed Fix |
|---|---|---|---|---|
| **C1** | **Warning Count for Review** | Section 9.1 & 11.2 vs Source 1 line 52 vs PDF page 10 | Source 1 states 4 warnings are given and the **5th** triggers demotion/firing. PDF page 10 states 4 active warnings (`>= 4`) triggers the review. Section 11.2 uses 4 active warnings. | Documented as Conflict C1 in `OPEN_QUESTIONS.md`. Awaiting user choice: does warning #4 trigger review, or warning #5? |
| **C2** | **Demoted Status in Employee State Machine** | Section 9.1 Table | In Section 9.1, `ON_REVIEW` transitions to `DEMOTED`. However, the table lists NO transitions out of `DEMOTED`, making it appear as a dead-end terminal state. | Change transition to: `ON_REVIEW` $\rightarrow$ `ACTIVE` with side effect: Level decremented by 1, active warning count reset, EXP preserved. |
| **C3** | **Task EXP Minimum vs Clamping Formula** | Section 9.1 vs Section 10.3 vs PDF page 11 | PDF page 11 states *"Task EXP range: 10–100 EXP"*. Section 10.3 states formula: $\text{round}((\text{score}/100) \times \text{task.maxExp})$ clamped to $0 \le \text{awardedExp} \le \text{task.maxExp}$. A score of 0 yields 0 EXP, contradicting a minimum of 10 EXP. | Clarify in Section 10.3 that the task *difficulty ceiling* ranges from 30 to 100 EXP (Easy 30, Medium 60, Hard 100), whereas individual performance scores can award between 0 and `task.maxExp`. |
| **C4** | **Founder Mode Transition & Prior Employment** | Section 3.1 vs Section 12.1 | Section 3.1 states `EMPLOYEE` transitions to `FOUNDER`. It does not specify whether the employee is automatically released from their current company when founding a new one. | Clarify in Section 3.1 and 12.1 that confirming Founder Mode terminates active employment at the prior company (`companyEmployees.status: 'TERMINATED'`) so the user can lead their own company. |
| **C5** | **Admin Demo Mode Isolation vs Session Data** | Section 23 vs Section 27.9 vs Section 29 | Section 27.9 defines `POST /admin/demo/hiring`, but provides no endpoints for the Admin to view demo interview chat history or demo scorecard. | Add `GET /admin/demo/hiring/:sessionId` and `POST /admin/demo/hiring/:sessionId/turns` to Section 27.9 so Admin can interact with the demo. |

---

## 4. Endpoints in Section 27 vs Data Models in Section 26 Discrepancies

### 4.1 Collections in Section 26 that have NO API Endpoints in Section 27
The following 10 collections exist in Section 26 but lack corresponding REST endpoints in Section 27:

1. **`domains` (Section 26.5):**
   - *Problem:* No endpoint exists for the frontend to fetch domains (`GET /domains`) during onboarding, nor for Admin to add domains (`POST /admin/domains`).
   - *Proposed Fix:* Add `GET /domains` (Public/Authenticated) and `POST /admin/domains`, `PATCH /admin/domains/:id` (Admin).
2. **`skills` (Section 26.6):**
   - *Problem:* No endpoint exists for fetching skills (`GET /skills`) for profile onboarding or job tagging autocomplete.
   - *Proposed Fix:* Add `GET /skills` (Authenticated, filterable by domain).
3. **`notifications` (Section 26.35):**
   - *Problem:* Section 24 and Section 26 define notifications, but Section 27 has zero endpoints for reading or dismissing notifications.
   - *Proposed Fix:* Add `GET /notifications` and `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
4. **`expTransactions` (Section 26.26):**
   - *Problem:* Ledger exists, but user cannot view their transaction history.
   - *Proposed Fix:* Add `GET /economy/exp/history` (Authenticated).
5. **`corpCoinTransactions` (Section 26.27):**
   - *Problem:* Ledger exists, but Founder cannot view CorpCoin debit/credit logs.
   - *Proposed Fix:* Add `GET /founder/economy/transactions` (Founder).
6. **`companyBots` (Section 26.9):**
   - *Problem:* Bot purchase endpoint exists (`POST /founder/bots/purchase`), but no endpoint exists to query owned bots.
   - *Proposed Fix:* Add `GET /founder/bots` (Founder).
7. **`companyEmployees` (Section 26.8):**
   - *Problem:* No endpoint exists for a Founder to view their company's employee roster.
   - *Proposed Fix:* Add `GET /founder/company/employees` (Founder).
8. **`promotions` & `demotions` (Section 26.21 & 26.22):**
   - *Problem:* Historical logs are written, but never readable by the employee or admin.
   - *Proposed Fix:* Add `GET /employee/career-history` (Employee) returning promotions and demotions.
9. **`aiJobs` (Section 26.32):**
   - *Problem:* PDF page 30 explicitly grants Admin/AI Manager the ability to *"View queues"*, but no queue inspection endpoint exists.
   - *Proposed Fix:* Add `GET /ai-manager/jobs` and `GET /admin/queues` (AI Manager, Admin).
10. **`aiModels` (Section 26.29):**
    - *Problem:* AI Manager permissions include *"Configure model"*, but no model retrieval/update endpoint exists.
    - *Proposed Fix:* Add `GET /ai-manager/models` and `PATCH /ai-manager/models/:id` (AI Manager).

### 4.2 Endpoints in Section 27 that have Missing Data in Section 26
1. **`GET /profile/me`:** Returns `totalExp` and `corpCoin`, but Section 26.1 `users` has no cached balance fields.
   - *Proposed Fix:* Add `totalExpCached` and `corpCoinBalanceCached` to `users` (see M2).
2. **`GET /founder/scenario/today`:** Retrieves today's active scenario for the founder.
   - *Problem:* Section 26.24 `companyDecisions` only stores scenarios *after* a choice is committed. If a scenario is generated and awaiting decision, there is no field or collection to persist the pending prompt.
   - *Proposed Fix:* Add `pendingScenario: Object` to Section 26.7 `companies` or create a lightweight `pendingScenarios` subdocument.

---

## 5. Complete Inventory of Open TODOs

| Spec Section | Open Item | Tagged Identifier |
|---|---|---|
| **Section 4: Authentication Flow** | JWT Access & Refresh token TTLs; lockout duration window | `TODO (see OPEN_QUESTIONS D15)` |
| **Section 5: Profile and Resume System** | Server-side binary file text extraction libraries for PDF/DOCX | `TODO (see OPEN_QUESTIONS D14)` |
| **Section 7: Hiring State Machine** | ATS screening scoring weights and minimum passing score threshold | `TODO (see OPEN_QUESTIONS D8)` |
| **Section 8: Interview System** | Interview chat transport protocol (REST turns vs SSE vs WebSockets) | `TODO (see OPEN_QUESTIONS D9)` |
| **Section 9: Employee Task System** | Daily task issuance schedule (UTC midnight cron vs on-demand first login) | `TODO (see OPEN_QUESTIONS D10)` |
| **Section 9 & 11: Warnings** | Warning trigger count for Employment Review (4 active warnings vs 5th warning) | `TODO (see OPEN_QUESTIONS C1)` |
| **Section 11: Warning / Promotion** | Minimum completed tasks & evaluation average score required per level promotion | `TODO (see OPEN_QUESTIONS D17)` |
| **Section 13: CorpCoin Economy** | Advanced Bot storefront visibility in Founder Bot Shop UI in V1 | `TODO (see OPEN_QUESTIONS D13)` |
| **Section 14: Company Simulation** | Exact deterministic formulas for revenue, expenses, satisfaction, retention | `TODO (see OPEN_QUESTIONS D12)` |
| **Section 16: AI Gateway** | Provider pool isolation implementation (`DEMO` vs `PIPELINE` pool) | `TODO (see OPEN_QUESTIONS D11)` |
| **Section 17–20: Adapters & Manager** | Target default model IDs and initial fallback priority sequence | `TODO (see OPEN_QUESTIONS D7)` |
| **Section 21: AI Queue & Retry** | Queue worker implementation mechanism (Polling loop vs Agenda vs Change Streams) | `TODO (see OPEN_QUESTIONS D6)` |

### Architectural Stack Questions Also Open in `docs/OPEN_QUESTIONS.md`:
- `D1`: Primary Language (TypeScript strict mode vs JavaScript ESM)
- `D2`: Repository Structure (Monorepo npm workspaces vs dual folders)
- `D3`: Frontend Styling (Vanilla CSS custom properties vs CSS Modules)
- `D4`: Frontend State Management (React Context vs Zustand vs Redux Toolkit)
- `D5`: Frontend Client Routing (React Router v6/v7)
- `D16`: Automated Testing Suite (Vitest + Supertest vs Jest)

---

## 6. Proposed Action Plan (Awaiting User Approval)

1. **Approval of Source Gaps (M1–M6):** Incorporate cached balances, bot active flags, retention metric, company bankruptcy cascade, and missing provider management endpoints.
2. **Approval of Inventions Cleanup (I1–I5):** Remove `PROBATION` and `DISSOLVED` company statuses; simplify employee status enum; standardize `financialHealth` field name.
3. **Approval of Contradiction Resolutions (C1–C5):** Resolve dead-end `DEMOTED` status; clarify task EXP ceiling vs awarded EXP; clarify Founder Mode employment release.
4. **Approval of Endpoint & Collection Alignment:** Add missing endpoints for domains, skills, notifications, ledger histories, owned bots, and employee rosters; add pending scenario persistence to `companies`.
5. **Update [docs/OPEN_QUESTIONS.md](file:///Users/trushargpatel/Downloads/IT/SEM%20-%207/SGP/CV/docs/OPEN_QUESTIONS.md):** Incorporate D18 (Email Verification Flow).
