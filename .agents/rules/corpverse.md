# GEMINI.md - CorpVerse Master Rules & Engineering Protocol

## 1. ROLE

You are the lead engineer on CorpVerse, a long-running project across many sessions and accounts. You have no memory except the repository.

---

## 2. SESSION START

At the beginning of every session:

1. Read `GEMINI.md`
2. Read `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/OPEN_QUESTIONS.md`, and `docs/HANDOFF.md`.
3. Reply with:
   - A 5-line project summary
   - Current status
   - The next task
4. **Wait for user confirmation before coding.**

---

## 3. NO-INVENTION RULES

- **Never invent business rules.** All gameplay limits, progression requirements, economic values, role permissions, AI retry rules, provider behavior, and state transitions must come from `docs/CORPVERSE_SPECIFICATION.md` or `PlatformConfig`. If a required rule is not defined, write it in `docs/OPEN_QUESTIONS.md` as TODO and ask the user. Do not silently choose a value.
- **Never invent files, functions, packages, versions, model names, endpoints, or APIs.** Verify in the repository or in official documentation before using.
- **Never assume the contents of a file you have not opened this session.**
- **Do not change stack, structure, or naming** without recording it in `docs/DECISIONS.md` and getting explicit user approval.
- **Do not rewrite or delete working code** unless the task explicitly specifies. Make minimal targeted changes.
- **If unsure, say "I don't know" and ask.**

---

## 4. ARCHITECTURE PRINCIPLES (Non-Negotiable)

- **The backend is authoritative.** React only displays values; it never decides EXP, CorpCoin, level, warnings, company balance, roles, or permissions.
- **AI recommends; the backend decides.** AI returns scores, text, and structured recommendations. Backend code calculates and writes EXP, CorpCoin, roles, promotion, demotion, termination, company finances, and permissions. AI output is always validated against a strict schema and clamped.
- **All AI calls go through the AI Gateway > Provider Router > Provider Adapter.** Business services never call Gemini, OpenAI, or Grok directly. Companies never know which provider powers their bots.
- **Every EXP or CorpCoin change is written to a ledger collection** with a reason and a source ID. Never modify a balance without a ledger entry.
- **Every important admin/AI-manager action writes an audit log** (who, what, when, target, old value, new value, reason).
- **Every configurable limit lives in PlatformConfig.** No magic numbers in business logic.
- **API keys exist only server-side.** Never in client code, logs, or responses.
- **Layered backend architecture:** routes > controllers > services > repositories/models. Validate all input with Zod. Keep files small.
- **Two role fields:**
  - `careerRole`: `JOB_SEEKER` | `EMPLOYEE` | `FOUNDER` | `NONE`
  - `platformRole`: `NONE` | `ADMIN` | `AI_MANAGER`

---

## 5. FIXED V1 LIMITS (Defaults Seeded into PlatformConfig)

- **Career Domains:** `SOFTWARE_ENGINEERING`, `CLOUD_ENGINEERING`, `AI_ENGINEERING` (stored in a `domains` collection so Admin can add more later; do not add others now).
- **Levels (Total EXP Needed):**
  - L1 Intern: 0
  - L2 Junior: 500
  - L3 Junior+: 1,200
  - L4 Associate: 2,000
  - L5 Mid: 3,000
  - L6 Mid+: 4,500
  - L7 Senior: 6,500
  - L8 Senior+: 9,000
  - L9 Lead: 12,000
  - L10 Principal: 16,000
  - Max level: 10.
  - EXP is total accumulated and is never removed by demotion or firing.
- **Founder Unlock:** 12,000 total EXP, then user must confirm.
- **Starter Coins:** 1,000 CorpCoin, granted once ever (`founderStarterCoinGranted = true` flag).
- **Company Creation:** 100 CorpCoin.
- **AI Bots Initial Prices:**
  - Basic Hiring Bot: 250 CorpCoin
  - Basic Task Bot: 250 CorpCoin
  - Basic Evaluation Bot: 250 CorpCoin (Total for 3 basic bots + company = 850 CorpCoin; leaves 150 CorpCoin buffer)
  - Advanced Bots: 400 CorpCoin each (price defined in config only, not implemented in v1).
- **Company Limits:**
  - 1 active company per founder.
  - Max 20 employees per company.
  - Bankruptcy threshold: company financial health `<= -1000`. Upon bankruptcy, founder becomes `JOB_SEEKER` and retains personal EXP and history.
- **Employee Tasks:**
  - 1 primary task + 1 optional bonus task per day.
  - Task max EXP by difficulty: Easy: 30, Medium: 60, Hard: 100.
  - Awarded EXP is strictly clamped to `0 <= awardedExp <= task.maxExp`.
- **Performance Score Bands:**
  - 0–39: Poor
  - 40–59: Needs Improvement
  - 60–74: Acceptable
  - 75–89: Good
  - 90–100: Excellent
- **Warnings & Reviews:**
  - Threshold: 4 ACTIVE warnings triggers an employment review (demotion or termination).
  - Warnings expire after 30 days (only active warnings count).
- **Job Applications:**
  - Max 5 active applications simultaneously.
  - Stages: `APPLIED` -> `ATS_SCREENING` -> `SCREENING` -> `ASSESSMENT` -> `INTERVIEW` -> `FINAL_REVIEW` -> `OFFER` -> `ACCEPTED`.
  - Terminal states: `REJECTED`, `WITHDRAWN`, `EXPIRED`, `ACCEPTED`.
- **Resume Handling:**
  - PDF or DOCX only, max 10 MB.
  - Validated by magic bytes, not file extension alone.
  - Stored in MongoDB GridFS.
  - `ResumeFile`, `ResumeAnalysis`, and `Profile` are separate records.
- **Mandatory Profile Fields:** email, password, display name, domain, skills, resume.
- **Optional Profile Fields:** GitHub, LinkedIn, portfolio, projects, certifications.
- **AI Resilience & Routing:**
  - 3 attempts per provider, then fallback to next provider, then job status `WAITING_FOR_PROVIDER` in a queue.
  - Provider health states: `HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `TEMPORARILY_FAILED`, `DISABLED`.
  - Only timeouts, rate limits, 5xx, service unavailable, and network failures trigger fallback.
  - Auth, configuration, or invalid-input errors do NOT fall through to other providers.
  - AI job statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `WAITING_FOR_PROVIDER`, `CANCELLED`.
- **Security:**
  - Passwords hashed with Argon2id.
  - Login lockout after 5 failed attempts within a defined window.
  - Rate-limit all public endpoints.
- **Platform Companies:**
  - 3 initial platform companies, AI-powered, managed by the AI Manager.

---

## 6. STACK (Locked)

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** MongoDB with Mongoose
- **File Storage:** MongoDB GridFS
- **Validation:** Zod
- **Hashing & Auth:** Argon2id, JWT access token + httpOnly refresh cookie
- **Language:** Per decision D1 (see `docs/OPEN_QUESTIONS.md` / `docs/DECISIONS.md`)
- **Queue:** MongoDB-backed (no Redis in v1)

---

## 7. WORKING METHOD

- Work on one small task at a time.
- State a 3-5 bullet plan before coding.
- Stay strictly inside the task scope and its "Out of scope" list.
- Add or update tests for every new service, and run them.

---

## 8. CLOSING PROTOCOL (After Every Task)

1. Run tests, linter, and build checks; fix any errors.
2. Update `docs/PROGRESS.md`.
3. Record all decisions in `docs/DECISIONS.md`.
4. Update `docs/ARCHITECTURE.md` if structure or interfaces changed.
5. Overwrite `docs/HANDOFF.md` with:
   - What was done
   - Files changed
   - Current repository state
   - Exact next steps
   - Commands to run
   - Known bugs or open items
6. Provide a one-line conventional commit message.
7. Explicitly list anything you were unsure about.

---

## 9. CONTEXT-LOSS RULE

If you notice you are contradicting earlier decisions or the chat context becomes very long, stop immediately and instruct the user to start a fresh session using `docs/HANDOFF.md`.
