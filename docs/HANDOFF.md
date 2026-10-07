# CorpVerse — Session Handoff Document

## 1. Task Completed

- **Task ID:** TASK P2.3 (User Profile Setup Wizard & Career Domain Selection)
- **Task Title:** Implement Candidate Profile Schema, locked career domain selection (`SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING`), backend profile service with authoritative role progression (`careerRole: 'JOB_SEEKER'`, `onboardingStep: 'PROFILE_COMPLETED'`), duplicate setup prevention (409 Conflict), domain catalog endpoint, profile retrieval and update endpoints, client 3-step interactive onboarding wizard (`ProfileSetupPage.tsx`), route guard redirects, and full test suites.
- **Completion Status:** Fully Completed and Verified (149/149 tests passing across monorepo — 107 on server, 42 on client; 0 lint errors, 100% Prettier compliance, clean build on both server and client).

---

## 2. What Was Done

1. **Profile Zod Schemas (`server/src/schemas/profile.schema.ts`):**
   - Defined `profileSetupSchema` with mandatory `displayName` (2–80 chars), `domain` (one of the 3 locked career domains), and `skills` (array of 1–50 lowercase strings).
   - Validates optional fields: `bio` (max 500 chars), `githubUrl`, `linkedinUrl`, `portfolioUrl`, `projects` array, and `certifications` array.
   - Defined `profileUpdateSchema` permitting partial updates to optional fields and skills while prohibiting changes to `domain` or `userId`.
2. **Profile Mongoose Model (`server/src/models/Profile.ts`):**
   - Targets `profiles` collection (Specification Section 20, Collection 2).
   - Unique index on `{ userId: 1 }` ensuring strict 1-to-1 relationship with `users`.
   - Index on `domain` for querying and candidate marketplace lookups.
   - Nested subschemas for `projects` and `certifications`.
3. **Authoritative Profile Service & Role Activation (`server/src/services/profile/profile.service.ts`):**
   - `setupProfile`: Verifies no profile exists for user; if present, throws `AppError.conflict('Profile already exists for this user')` (HTTP 409, `BUSINESS_RULE_VIOLATION`).
   - Inserts profile document and authoritatively updates user in MongoDB: `careerRole = 'JOB_SEEKER'`, `onboardingStep = 'PROFILE_COMPLETED'`.
   - Dispatches `USER_PROFILE_SETUP` audit log entry.
   - `getProfile`: Retrieves profile by `userId` or throws 404 `RESOURCE_NOT_FOUND`.
   - `updateProfile`: Updates profile fields and emits `USER_PROFILE_UPDATED` audit log.
   - `getAvailableDomains`: Exposes domain catalog, descriptions, and recommended skill tags.
4. **Profile Controller & Routes (`server/src/controllers/profile.controller.ts`, `server/src/routes/profile.routes.ts`):**
   - Protected routes (`authenticateJwt`): `POST /setup`, `GET /me`, `PUT /me`.
   - Public/catalog route: `GET /domains`.
   - Mounted at both `/api/profile` and `/api/v1/profile`.
5. **Client Wizard & Navigation Integration (`client/src/`):**
   - `AuthContext`: Added `setupProfile(payload)` calling `POST /api/profile/setup` and updating local user state.
   - `RoleRoute`: Automatically detects users with `careerRole: 'NONE'` and `onboardingStep: 'EMAIL_VERIFIED'` attempting to access Job Seeker pages and redirects them to `/profile/setup`.
   - `Sidebar`: Dynamically renders "Candidate Onboarding" navigation item for `careerRole: 'NONE'` users.
   - `ProfileSetupPage.tsx` & `ProfileSetup.module.css`: Built high-contrast 3-step cyber-corporate wizard:
     - Step 1: Career Domain Selection cards with domain descriptions and tech focus.
     - Step 2: Skills & Details with quick-add suggested skill chips, custom skill tagger, and optional bio/portfolio links.
     - Step 3: Review & Activation summary card triggering authoritative role activation.
   - Mounted route `/profile/setup` in `client/src/App.tsx`.
6. **Full Test Suites (149 passing tests across monorepo):**
   - Created `server/src/tests/profile.test.ts` (10 integration tests covering setup, authoritative role transition, 409 conflict on duplicate setup, validation errors, unauthenticated rejection, profile retrieval, profile updates, and suspended user rejection).
   - Created `client/src/tests/profile.test.tsx` (5 client tests covering domain selection, skill tag addition/removal, wizard submission, and error alerts).

---

## 3. Files Created & Modified

### Created Files

- `server/src/schemas/profile.schema.ts`
- `server/src/models/Profile.ts`
- `server/src/services/profile/profile.service.ts`
- `server/src/controllers/profile.controller.ts`
- `server/src/routes/profile.routes.ts`
- `server/src/tests/profile.test.ts`
- `client/src/pages/ProfileSetup.module.css`
- `client/src/pages/ProfileSetupPage.tsx`
- `client/src/tests/profile.test.tsx`

### Modified Files

- `server/src/app.ts` (registered `profileRouter`)
- `server/src/index.ts` (exported `ProfileModel`, `profile.schema.js`, `profile.service.js`, `profile.controller.js`, `profile.routes.js`)
- `client/src/store/AuthContext.tsx` (added `setupProfile` method and `onboardingStep` in `UserStub`)
- `client/src/components/guards/RoleRoute.tsx` (added redirect to `/profile/setup` for unactivated users)
- `client/src/components/layout/Sidebar.tsx` (added onboarding link for unactivated candidates)
- `client/src/App.tsx` (registered `/profile/setup` route)
- `docs/DECISIONS.md` (recorded ADR-028)
- `docs/ARCHITECTURE.md` (added Section 17: Candidate Profile Subsystem & Role Progression Architecture)
- `docs/PROGRESS.md` (updated progress and roadmap)

---

## 4. Current Repository State

- **Branch:** `main` (clean workspace, git working tree ready for commit).
- **TypeScript:** Strict mode enabled; zero errors on both server (`tsc -p tsconfig.build.json`) and client (`tsc && vite build`).
- **ESLint:** Zero warnings and zero errors across the entire monorepo (`npm run lint`).
- **Prettier:** 100% formatted and verified (`npm run format:check`).
- **Vitest:**
  - Server: 107 / 107 passing tests across 8 test suites (`profile.test.ts`, `session.test.ts`, `auth.test.ts`, `config.service.test.ts`, `ledgers.test.ts`, `platformConfig.schema.test.ts`, `core.test.ts`, `smoke.test.ts`).
  - Client: 42 / 42 passing tests across 7 test suites (`profile.test.tsx`, `auth.test.tsx`, `apiClient.test.ts`, `guards.test.tsx`, `components.test.tsx`, `responsive.test.tsx`, `App.test.tsx`).
  - Total: 149 / 149 passing tests.
- **Running Services:**
  - Client dev server running on `http://localhost:5173`.
  - Server API running on `http://localhost:5000`.

---

## 5. Exact Next Steps

### Next Task: TASK P2.4 — Resume Ingestion Engine (GridFS, Magic Bytes, Parsing)

1. **MongoDB GridFS Bucket Configuration:**
   - Initialize GridFS bucket for file storage (`resumes.files`, `resumes.chunks`).
   - Limit file size to 10 MB maximum.
2. **File Validation via Magic Bytes:**
   - Validate incoming uploads by magic bytes (not just file extension or MIME header):
     - PDF: `%PDF-` (`25 50 44 46`).
     - DOCX: `PK\x03\x04` (`50 4B 03 04`).
3. **Data Models:**
   - `ResumeFileModel`: Stores metadata (`filename`, `mimeType`, `sizeBytes`, `gridFsFileId`, `userId`, `uploadedAt`).
   - `ResumeAnalysisModel`: Stores parsed text, extracted skills, experience summary, and ATS match readiness.
   - Link `resumeFileId` in `Profile`.
4. **Endpoints & Service:**
   - `POST /api/profile/resume` (multipart/form-data upload, magic byte check, GridFS stream write, analysis placeholder).
   - `GET /api/profile/resume` (download / stream from GridFS).
   - `DELETE /api/profile/resume` (delete from GridFS and unlink profile).

---

## 6. Commands to Run

```bash
# Run all tests across monorepo
npm run test --workspaces

# Run server tests specifically (requires bypass sandbox for MongoDB socket)
cd server && npm run test

# Run client tests specifically
cd client && npm run test -- --run

# Run linting
npm run lint

# Check formatting
npm run format:check

# Run production build checks
npm run build
```

---

## 7. Known Bugs or Open Items

- None. All requirements for TASK P2.3 are complete and verified.
