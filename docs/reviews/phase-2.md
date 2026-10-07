# CorpVerse — Phase 2 Comprehensive Architectural & Specification Review

- **Review Date:** 2026-10-07
- **Scope:** Phase 2 User Onboarding & Authentication Layer:
  - `TASK P2.1`: User Registration, Argon2id Password Hashing, Single-Use Verification Tokens, Email Services, Anti-Enumeration Protection.
  - `TASK P2.2`: Dual-Token Authentication, Refresh Token Rotation, Family Compromise Reuse Detection, Brute-Force Lockout, Authoritative `authenticateJwt` Middleware, Client Auth UI (`LoginPage`, `RegisterPage`, `VerifyEmailPage`, `AuthContext`, silent refresh).
  - `TASK P2.3`: Candidate Profile Schema, Locked Career Domain Selection (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), Backend Authoritative Role Progression (`careerRole: 'JOB_SEEKER'`), Client Setup Wizard (`ProfileSetupPage.tsx`), Route Guard Redirects.
- **Status:** PENDING USER APPROVAL (Zero modifications made pending signoff).

---

## 1. Specification Compliance & Gap Analysis

Comparison of implemented Phase 2 codebase against `docs/CORPVERSE_SPECIFICATION.md` sections relevant to this phase (Sections 2, 4, 5, 20, 27, 31, 32):

### 1.1 User Model & Roles (Spec Section 2 & Section 20 Collection 1)

- **Spec Requirements:**
  - `careerRole`: `JOB_SEEKER` | `EMPLOYEE` | `FOUNDER` | `NONE` (default is `NONE` before profile completion, transitions to `JOB_SEEKER` upon profile setup).
  - `platformRole`: `NONE` | `ADMIN` | `AI_MANAGER` (default `NONE`).
  - Fields: `_id`, `email`, `passwordHash`, `careerRole`, `platformRole`, `isEmailVerified`, `isSuspended`, `failedLoginAttempts`, `lockoutUntil`, `totalExpCached`, `corpCoinBalanceCached`, `founderModeUnlockedAt`, `founderStarterCoinGranted`, `createdAt`, `updatedAt`.
- **Codebase Implementation:** `server/src/models/User.ts`, `server/src/services/auth/auth.service.ts`, `server/src/services/profile/profile.service.ts`.
- **Mismatches / Observations:**
  - _Field Aliasing / Backward Compatibility:_ Implemented `emailVerified` (synced with `isEmailVerified`), `status: 'ACTIVE' | 'SUSPENDED'` (synced with `isSuspended`), `lockUntil` (synced with `lockoutUntil`), `totalExp` (synced with `totalExpCached`), and `corpCoinBalance` (synced with `corpCoinBalanceCached`). Mongoose pre-save and pre-validation hooks maintain synchronization bidirectionally so neither legacy ledger code nor new auth services break.
  - _Onboarding Tracking:_ Added `onboardingStep` string enum (`'REGISTERED'` -> `'EMAIL_VERIFIED'` -> `'PROFILE_COMPLETED'`) to track candidate progress cleanly.

### 1.2 Password Security, Token Hashing & Anti-Enumeration (Spec Section 4 & 32)

- **Spec Requirements:**
  - Passwords hashed with Argon2id (memory cost 64 MB, time cost 3, parallelism 4).
  - Complex password rules: 8–128 chars, uppercase, lowercase, numeric, special symbol.
  - Single-use, expiring verification tokens stored hashed with SHA-256 in MongoDB.
  - Anti-enumeration: Registering an existing email or resending verification to non-existent or verified emails must return indistinguishable generic success responses.
- **Codebase Implementation:** `server/src/utils/password.ts`, `server/src/utils/token.ts`, `server/src/models/EmailVerificationToken.ts`, `server/src/services/auth/auth.service.ts`, `server/src/controllers/auth.controller.ts`.
- **Match Status:** **PERFECT MATCH**. All endpoints return uniform success responses without revealing user existence. Tokens are never stored in plaintext and are invalidated upon use (`usedAt`).

### 1.3 Session Management, Token Rotation & Lockout (Spec Section 32)

- **Spec Requirements:**
  - Short-lived access JWT (15 minutes, configurable via `PlatformConfig.security.accessTokenMinutes`).
  - Refresh token stored in `httpOnly`, `Secure` (in prod), `SameSite: strict` (in prod) cookie named `refreshToken` (7 days duration).
  - Refresh tokens stored hashed (SHA-256) in MongoDB; rotated upon each refresh.
  - Replay / Reuse detection: presentation of an already revoked token triggers immediate revocation of the entire token family.
  - Brute-force lockout: after 5 failed login attempts (`security.maxLoginAttempts`), account locks for 15 minutes (`security.lockoutMinutes`); generic 401 on bad password; 423 `ACCOUNT_LOCKED` when locked.
  - `authenticateJwt` middleware verifies token, loads user from database, and rejects `SUSPENDED` users and unverified users with HTTP 403.
- **Codebase Implementation:** `server/src/utils/jwt.ts`, `server/src/models/RefreshToken.ts`, `server/src/services/auth/auth.service.ts`, `server/src/middleware/auth.middleware.ts`, `server/src/controllers/auth.controller.ts`.
- **Match Status:** **PERFECT MATCH**. Dual-token architecture, family revocation on replay, and lockout thresholds work exactly as specified.

### 1.4 Profile Model & Career Domain Selection (Spec Section 5, 20 Collection 2 & Section 27)

- **Spec Requirements:**
  - Collection `profiles` with unique index on `{ userId: 1 }`.
  - Career domains strictly locked to: `SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`.
  - Mandatory fields: `displayName`, `domain`, `skills`, `resume`.
  - Optional fields: `bio`, `githubUrl`, `linkedinUrl`, `portfolioUrl`, `projects`, `certifications`.
  - Role transition: user promoted from `careerRole: 'NONE'` to `'JOB_SEEKER'` upon profile completion.
- **Codebase Implementation:** `server/src/models/Profile.ts`, `server/src/schemas/profile.schema.ts`, `server/src/services/profile/profile.service.ts`, `server/src/controllers/profile.controller.ts`, `client/src/pages/ProfileSetupPage.tsx`.
- **Mismatches / Observations:**
  - _Resume Scope Boundary (Intentional):_ Resume ingestion, parsing, magic-byte checks, and GridFS storage are deliberately deferred to `TASK P2.4: Resume Ingestion Engine`. Hence, in P2.3 `Profile` model defines `resumeId?: Types.ObjectId` and `resumeAnalysisId?: Types.ObjectId` as optional placeholders, to be populated in P2.4.
  - _Field Naming in Model:_ Spec Section 20 Collection 2 names the resume pointer `resumeFileId` referencing `resumeFiles`. In `server/src/models/Profile.ts`, the field was named `resumeId`. In TASK P2.4, this field should be aligned to `resumeFileId`.
  - _Project Subdocument Schema:_ Spec Section 20 specifies projects as `{ title, description, technologies: string[], repositoryUrl?: string, liveUrl?: string }`. In `Profile.ts` and `profile.schema.ts`, projects are defined as `{ title, description, techStack: string[], link?: string }`.
  - _Domain Catalog Storage:_ GEMINI.md Section 5 notes domains should be "stored in a `domains` collection so Admin can add more later; do not add others now". Currently, domains are defined via enum `CAREER_DOMAINS` and `DOMAIN_METADATA` constant in TypeScript code. Dynamic MongoDB storage for domains can be seeded in Phase 6 (Admin Console).

---

## 2. Test, Lint & Build Verification Report

Executed on local environment:

| Check              | Workspace           | Command                 | Status     | Details                                           |
| :----------------- | :------------------ | :---------------------- | :--------- | :------------------------------------------------ |
| **Vitest Tests**   | `@corpverse/server` | `npm run test`          | **PASSED** | 107 / 107 tests passing across 8 test suites      |
| **Vitest Tests**   | `@corpverse/client` | `npm run test -- --run` | **PASSED** | 42 / 42 tests passing across 7 test suites        |
| **Combined Tests** | Monorepo Root       | `npm run test`          | **PASSED** | **149 / 149 tests passing** (100% pass rate)      |
| **ESLint**         | Monorepo Root       | `npm run lint`          | **PASSED** | 0 errors, 0 warnings                              |
| **Prettier**       | Monorepo Root       | `npm run format:check`  | **PASSED** | 100% compliant across all files                   |
| **Server Build**   | `@corpverse/server` | `npm run build`         | **PASSED** | `tsc -p tsconfig.build.json` succeeded (0 errors) |
| **Client Build**   | `@corpverse/client` | `npm run build`         | **PASSED** | `tsc && vite build` bundled 86 modules (0 errors) |

---

## 3. Audit of Hardcoded Numbers (Candidates for PlatformConfig)

We inspected all services, controllers, and schemas in Phase 2 for numeric literals:

1. **Email Verification Token Lifetime (`server/src/services/auth/auth.service.ts`):**
   - `24 * 60 * 60 * 1000` (24 hours).
   - _Status:_ Currently hardcoded in `register` and `resendVerification`. Should be added to `PlatformConfig.security.verificationTokenHours = 24`.
2. **Refresh Token Byte Length (`server/src/services/auth/auth.service.ts`):**
   - `40` bytes (`generateVerificationToken(40)`).
   - _Status:_ Internal cryptographic entropy parameter; safe as a constant, but could be exposed in config if desired.
3. **Endpoint Rate Limits (`server/src/middleware/rateLimiter.ts`):**
   - `resendVerificationLimiter`: `limit: 5`, `windowMs: 15 * 60 * 1000` (15 min)
   - `registerLimiter`: `limit: 20`, `windowMs: 15 * 60 * 1000` (15 min)
   - `loginLimiter`: `limit: 10`, `windowMs: 15 * 60 * 1000` (15 min)
   - `refreshLimiter`: `limit: 30`, `windowMs: 15 * 60 * 1000` (15 min)
   - _Status:_ Currently hardcoded in the rate-limiter middleware. `PlatformConfig` contains `security.maxLoginAttempts` and `security.lockoutMinutes`, but does not define per-route IP sliding window limits. Adding a `security.rateLimits` section would eliminate these hardcoded numbers.
4. **Profile Input Constraints (`server/src/schemas/profile.schema.ts`):**
   - `displayName`: min 2, max 50 chars.
   - `skills`: min 1, max 50 skills; max 40 chars per skill.
   - `bio`: max 500 chars.
   - `projects`: max 20 items.
   - `certifications`: max 20 items.
   - _Status:_ These are input validation schema boundaries. Standard practice keeps them in Zod schemas, but limits like `maxSkills = 50` or `maxProjects = 20` could be seeded in `PlatformConfig`.

---

## 4. AI Output Boundary & Clamping Audit

- **Audit Target:** Identify any path where external AI output can directly mutate database state or balances without Zod schema validation and backend clamping.
- **Audit Findings:**
  - Phase 2 focuses exclusively on authentication, user accounts, and candidate profiles.
  - Zero external AI model calls exist in Phase 2 codebase.
  - All database mutations in Phase 2 (`UserModel`, `EmailVerificationTokenModel`, `RefreshTokenModel`, `ProfileModel`) receive user-provided data validated through strict Zod schemas (`registerSchema`, `loginSchema`, `verifyEmailSchema`, `profileSetupSchema`, `profileUpdateSchema`).
  - All role transitions (`user.careerRole = 'JOB_SEEKER'`, `user.onboardingStep = 'PROFILE_COMPLETED'`) are executed deterministically by backend code in `profile.service.ts`.
  - Economic balances (`totalExp`, `corpCoinBalance`) are not altered by auth/profile endpoints.
- **Conclusion:** **ZERO** paths exist where unvalidated or unclamped AI output reaches persistent state.

---

## 5. Inventions & Deviations Audit

Audit of items introduced that were not explicitly stated in the initial spec or decisions:

1. **`onboardingStep` Tracking Field on User Model:**
   - _Detail:_ Added field `onboardingStep` (`'REGISTERED' | 'EMAIL_VERIFIED' | 'PROFILE_COMPLETED'`) on `UserModel`.
   - _Rationale:_ Required by TASK P2.1 prompt to track onboarding progression explicitly and guide client navigation.
2. **`GET /api/profile/domains` & `DOMAIN_METADATA`:**
   - _Detail:_ Created `DOMAIN_METADATA` constant with titles, descriptions, icons, and recommended skills for each locked domain, exposed via `GET /api/profile/domains`.
   - _Rationale:_ Powers the interactive client setup wizard cards and skill quick-add chips without requiring the full Admin `domains` collection before Phase 6.
3. **Project Subdocument Properties (`techStack` vs `technologies`, `link` vs `repositoryUrl`/`liveUrl`):**
   - _Detail:_ `server/src/models/Profile.ts` and `profile.schema.ts` use `techStack` and `link` instead of the exact field names in Spec Section 20 (`technologies`, `repositoryUrl`, `liveUrl`).
   - _Rationale:_ Simplified initial implementation during P2.3. Can be harmonized in P2.4 to accept both or align with Spec Section 20.
4. **Token Family UUID for Refresh Tokens:**
   - _Detail:_ Added `family` UUID to `RefreshTokenModel` to track token lineages for reuse detection.
   - _Rationale:_ Standard secure pattern to implement token rotation and replay compromise invalidation required by Spec Section 32 and recorded in ADR-027.
5. **`devVerificationUrl` and `rawToken` in Development Responses:**
   - _Detail:_ In `NODE_ENV !== 'production'`, `register` and `resendVerification` responses include `devVerificationUrl` and test tokens.
   - _Rationale:_ Enables automated Vitest testing and effortless manual local development in browser without requiring access to an SMTP inbox.

---

## 6. Recommendations & Pending Items for User Approval

Before proceeding to **TASK P2.4** (Resume Ingestion Engine):

1. **Review and Approve:** Please review this Phase 2 audit report.
2. **Harmonization Recommendations for P2.4:**
   - In `Profile.ts`, align `resumeId` to `resumeFileId: ObjectId, ref: 'resumeFiles'` as defined in Spec Section 20 Collection 2.
   - In `Profile.ts`, add `repositoryUrl` and `liveUrl` alongside `link`, and alias `technologies` to `techStack` for 100% spec alignment.
3. **Configuration Enhancement Candidate:**
   - Add `verificationTokenHours: 24` to `PlatformConfig.security` in a future config migration.
4. **Next Task:** Upon your approval, proceed to **TASK P2.4: Resume Ingestion Engine (GridFS, Magic Bytes, PDF/DOCX Parsing)**.
