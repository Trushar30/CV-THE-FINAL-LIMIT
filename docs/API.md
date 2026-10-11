# CorpVerse Authoritative REST API Reference

The CorpVerse API follows RESTful architectural principles. All endpoints return standardized JSON payloads, enforce strict input validation via Zod, and utilize authoritative server-side business rules.

---

## 1. Global Conventions

### 1.1 Base URLs
- Default: `http://localhost:4000/api`
- Versioned alias: `http://localhost:4000/api/v1`

### 1.2 Authentication
- **Access Token:** Bearer JWT in `Authorization: Bearer <token>` header or `accessToken` cookie.
- **Refresh Token:** Sent in httpOnly, SameSite cookie named `refreshToken`.
- **Public Endpoints:** Marked as **Public**.
- **Protected Endpoints:** Require valid authenticated session (`authMiddleware`).
- **Role Guards:**
  - `requireRole('ADMIN')`: Platform administrator (`platformRole === 'ADMIN'`).
  - `requireRole('AI_MANAGER')`: AI operations manager (`platformRole === 'AI_MANAGER' || 'ADMIN'`).
  - `requireCareerRole('EMPLOYEE')`: Active corporate employee (`careerRole === 'EMPLOYEE'`).
  - `requireCareerRole('FOUNDER')`: Enterprise founder (`careerRole === 'FOUNDER'`).
  - `requireCareerRole('JOB_SEEKER')`: Registered job candidate (`careerRole === 'JOB_SEEKER'`).

### 1.3 Standard Response Formats
- **Success Response:**
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- **Error Response (RFC 7807 Aligned):**
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request parameters",
      "statusCode": 400,
      "details": [
        { "field": "email", "issue": "Invalid email address" }
      ]
    }
  }
  ```

---

## 2. Health & System Status

### `GET /api/health`
- **Access:** Public
- **Description:** Returns server uptime, environment, timestamp, and database connectivity.
- **Response (200):**
  ```json
  {
    "status": "healthy",
    "uptime": 1420.5,
    "timestamp": "2026-10-11T00:00:00.000Z",
    "services": {
      "database": "connected",
      "aiWorker": "running"
    }
  }
  ```

---

## 3. Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new candidate account |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue tokens |
| `POST` | `/api/auth/refresh` | Public (Cookie) | Rotate refresh token & issue new access token |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session & clear cookies |
| `GET` | `/api/auth/me` | Authenticated | Retrieve currently authenticated user context |
| `GET` | `/api/auth/verify-email` | Public | Verify email address with signed verification token |
| `POST` | `/api/auth/resend-verification` | Public | Resend email verification link |

#### Sample Request: `POST /api/auth/register`
```json
{
  "email": "candidate@corpverse.dev",
  "password": "Password@1234"
}
```

#### Sample Response: `POST /api/auth/login`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "670876543210abcdef123456",
      "email": "candidate@corpverse.dev",
      "careerRole": "JOB_SEEKER",
      "platformRole": "NONE",
      "totalExp": 0,
      "corpCoinBalance": 0,
      "emailVerified": true
    }
  }
}
```

---

## 4. Profile & Onboarding (`/api/profile`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile` | Authenticated | Get current user's profile |
| `PUT` | `/api/profile/name` | Authenticated | Update display name |
| `PUT` | `/api/profile/domain` | Authenticated | Select career domain |
| `PUT` | `/api/profile/skills` | Authenticated | Update technical skills array |
| `POST` | `/api/profile/resume` | Authenticated | Upload resume file (PDF/DOCX, multipart/form-data) |
| `GET` | `/api/profile/resume-status` | Authenticated | Check AI resume extraction status |
| `POST` | `/api/profile/complete` | Authenticated | Finalize onboarding wizard and activate candidate |

---

## 5. Domains & Skills (`/api/domains`, `/api/skills`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/domains` | Public | List all active career domains |
| `POST` | `/api/domains` | Admin | Create a new career domain |
| `GET` | `/api/skills` | Public | List technical skills (supports `?domain=SOFTWARE_ENGINEERING`) |

---

## 6. Companies & Jobs (`/api/companies`, `/api/jobs`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/companies` | Public | Browse companies (`?domain=...&status=ACTIVE`) |
| `GET` | `/api/companies/:id` | Public | Retrieve public company profile |
| `GET` | `/api/companies/:id/jobs` | Public | List open job postings for a specific company |
| `GET` | `/api/jobs` | Public | Browse open job postings (`?domain=...&minLevel=...`) |
| `GET` | `/api/jobs/:id` | Public | Retrieve job details and eligibility criteria |

---

## 7. Job Applications & Hiring Journey (`/api/applications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/applications` | Authenticated | List all applications for current candidate (max 5 active) |
| `POST` | `/api/applications` | Job Seeker | Submit job application (`{ "jobId": "..." }`) |
| `GET` | `/api/applications/:id` | Authenticated | Get detailed application status, feedback & bot results |
| `POST` | `/api/applications/:id/withdraw` | Authenticated | Withdraw active application |
| `POST` | `/api/applications/:id/assessment`| Authenticated | Submit technical assessment answer |
| `POST` | `/api/applications/:id/interview` | Authenticated | Send message in conversational AI interview |
| `GET` | `/api/applications/:id/offer` | Authenticated | Inspect formal employment offer |
| `POST` | `/api/applications/:id/offer/accept`| Authenticated | Accept offer (transition careerRole to EMPLOYEE) |
| `POST` | `/api/applications/:id/offer/decline`| Authenticated | Decline offer |

---

## 8. Employee Workplace & Tasks (`/api/employee`, `/api/tasks`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/employee/workplace` | Employee | Workplace overview, company details & level telemetry |
| `GET` | `/api/employee/daily-task` | Employee | Fetch today's primary daily scenario and bonus task |
| `POST` | `/api/employee/daily-task/submit` | Employee | Submit technical solution for AI evaluation |
| `GET` | `/api/employee/task-history` | Employee | Paginated history of past completed tasks |
| `GET` | `/api/employee/exp-ledger` | Employee | Immutable EXP double-entry ledger |
| `GET` | `/api/employee/warnings` | Employee | Active disciplinary warnings & expiration countdowns |
| `GET` | `/api/employee/promotion-status` | Employee | Check promotion criteria progress |
| `POST` | `/api/employee/promotion-claim` | Employee | Claim next promotion level once criteria met |

---

## 9. Founder Operations & Simulation (`/api/founder`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/founder/unlock-status` | Authenticated | Check Founder Mode eligibility (12,000 EXP required) |
| `POST` | `/api/founder/unlock` | Authenticated | Confirm Founder Mode activation (+1,000 CorpCoin grant) |
| `POST` | `/api/founder/company` | Founder | Incorporate new company (-100 CorpCoin statutory fee) |
| `GET` | `/api/founder/company` | Founder | Retrieve executive dashboard metrics & telemetry |
| `GET` | `/api/founder/bots` | Founder | AI Bot Storefront (inventory & pricing) |
| `POST` | `/api/founder/bots/buy` | Founder | Purchase autonomous bot (250 CC each) |
| `POST` | `/api/founder/jobs` | Founder | Publish job requisition |
| `POST` | `/api/founder/jobs/:id/close` | Founder | Close active job requisition |
| `GET` | `/api/founder/applications` | Founder | Review candidate intake pipeline |
| `POST` | `/api/founder/applications/:id/review` | Founder | Make final hiring offer decision |
| `GET` | `/api/founder/ledger` | Founder | Immutable CorpCoin double-entry ledger |
| `GET` | `/api/founder/simulation/dilemma` | Founder | Fetch active strategic dilemma scenario |
| `POST` | `/api/founder/simulation/decision` | Founder | Submit strategic decision rationale |
| `POST` | `/api/founder/simulation/tick` | Founder | Execute daily corporate simulation tick |
| `GET` | `/api/founder/simulation/financials`| Founder | Historical financial telemetry snapshots |

---

## 10. Global Deterministic Leaderboards (`/api/leaderboards`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/leaderboards` | Public | Paginated rankings (`?category=...&period=...&domain=...`) |
| `POST` | `/api/leaderboards/refresh` | Admin / AI Manager | Force cache recalculation |

**Categories Available:**
- **Talent Rankings:** `USER_EXP`, `USER_LEVEL`, `USER_CORPCOIN`, `USER_PERFORMANCE`, `USER_FOUNDER`.
- **Corporate Rankings:** `COMPANY_PROFIT`, `COMPANY_REVENUE`, `COMPANY_WORKFORCE`, `COMPANY_RETENTION`, `COMPANY_RATING`, `COMPANY_GROWTH`, `COMPANY_LOSS_MAKING`.

---

## 11. Notifications Center (`/api/notifications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Authenticated | Paginated in-app alerts (`?page=1&limit=20`) |
| `GET` | `/api/notifications/unread-count`| Authenticated | Real-time unread alert count |
| `POST` | `/api/notifications/:id/read` | Authenticated | Mark individual notification as read |
| `POST` | `/api/notifications/mark-all-read`| Authenticated | Mark all notifications as read |

---

## 12. AI Infrastructure Manager (`/api/ai-manager`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ai-manager/providers` | AI Manager | Health, circuit breakers, and status across Gemini, OpenAI, Groq |
| `POST` | `/api/ai-manager/providers/:id/toggle` | AI Manager | Enable/disable AI provider |
| `POST` | `/api/ai-manager/providers/:id/test` | AI Manager | Run live diagnostic ping |
| `GET` | `/api/ai-manager/queue` | AI Manager | Queue telemetry (pending, retrying, dead-letter jobs) |
| `GET` | `/api/ai-manager/workers` | AI Manager | Worker heartbeats and active claims |

---

## 13. Platform Administration & Demo (`/api/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/config` | Admin | Get current single active `PlatformConfig` |
| `PUT` | `/api/admin/config` | Admin | Update system configuration (writes audit log) |
| `GET` | `/api/admin/audit-logs` | Admin | Query immutable administrative audit log trail |
| `GET` | `/api/admin/analytics` | Admin | System-wide macro statistics |
| `POST` | `/api/admin/demo/trigger-ats` | Admin | Manually advance candidate through ATS evaluation |
| `POST` | `/api/admin/demo/trigger-tick`| Admin | Advance global simulation tick |
| `POST` | `/api/admin/reset-economy` | Admin | Purge simulation balances and restore initial state |
