# CorpVerse Production Readiness & Security Checklist

This document serves as the operational runbook and deployment validation checklist for taking CorpVerse to staging and production environments.

---

## 1. Secrets & Environment Configuration

- [ ] **No Hardcoded Secrets:** Confirm via `git log -p` and static analysis that no API keys, private certificates, or secrets exist in the git history.
- [ ] **Strong Cryptographic Salts & Secrets:**
  - `JWT_ACCESS_SECRET`: Generate a random 64-character hex/base64 string (`openssl rand -hex 32`).
  - `JWT_REFRESH_SECRET`: Generate an independent random 64-character secret.
  - `COOKIE_SECRET`: Generate an independent random 64-character secret.
- [ ] **LLM Provider API Keys:**
  - Securely inject `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `GROQ_API_KEY` into production environment secret managers (e.g. AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager).
  - Implement 90-day credential rotation schedules.
- [ ] **Environment Validation:** Verify startup validates the environment using strict Zod schemas (`server/src/config/env.ts`). Server must fail fast on missing or malformed keys.
- [ ] **Filesystem Isolation:** Ensure `.env` and `.env.*` files are excluded from source control and container build contexts (`.gitignore`, `.dockerignore`).

---

## 2. Network Security, TLS & Transport Hardening

- [ ] **HTTPS / TLS Termination:**
  - Terminate TLS 1.3 at the reverse proxy (Nginx, Traefik, Cloudflare, or AWS ALB).
  - Enforce automated certificate renewal (Let's Encrypt / AWS ACM).
- [ ] **HTTP Strict Transport Security (HSTS):**
  - Verify Helmet sends `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- [ ] **Cookie Security Attributes:**
  - In production (`NODE_ENV=production`), all auth cookies (`refreshToken`) must have `secure: true`, `httpOnly: true`, and `sameSite: 'strict'`.
- [ ] **CORS Origin Whitelisting:**
  - Set `CORS_ORIGIN` strictly to the production frontend domains (e.g. `https://corpverse.dev,https://app.corpverse.dev`). Never allow wildcard `*`.
- [ ] **Security Headers:**
  - Verify Helmet applies `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 3. Database Resilience, Backups & Disaster Recovery

- [ ] **MongoDB Replica Set:**
  - MongoDB must run as a minimum 3-node replica set to support multi-document ACID transactions (`withTransaction` / `runWithTransaction`).
- [ ] **Automated Backup Strategy:**
  - Enable continuous Point-In-Time Recovery (PITR) with MongoDB Atlas or scheduled `mongodump` snapshots.
  - Test restoration drill from snapshot to staging environment quarterly.
- [ ] **Scheduled Backup Command:**
  ```bash
  mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/corpverse" --gzip --archive="/backups/corpverse_$(date +%F_%T).gz"
  ```
- [ ] **Data Consistency Audits:**
  - Configure cron to run the consistency checker script weekly to audit double-entry ledgers against cached balances:
  ```bash
  npx tsx src/scripts/check-consistency.ts
  ```

---

## 4. Rate Limiting, DDoS & Input Protection

- [ ] **Reverse Proxy Rate Limiting:**
  - In addition to Express-level rate limiting (`express-rate-limit`), configure edge-level rate limits on Nginx or Cloudflare WAF.
- [ ] **Brute Force Lockout:**
  - Confirm authentication controller locks accounts for 15 minutes after 5 failed password attempts within 15 minutes (`PlatformConfig.security.lockoutThreshold`).
- [ ] **Payload Clamping & File Upload Boundaries:**
  - JSON body limit clamped to `100kb`.
  - Resume file upload limited strictly to `10MB`, validated by magic numbers (`file-type`), restricted to PDF and DOCX only.
- [ ] **NoSQL Injection Sanitization:**
  - Verify `sanitizeNoSql` middleware strips `$`, `.` and MongoDB query operators from all incoming query, parameter, and body payloads.

---

## 5. Monitoring, Logging & Observability

- [ ] **Structured Logging & Key Redaction:**
  - Winston logger outputs JSON in production.
  - Verify automated key redaction masks `password`, `token`, `secret`, `apiKey`, and bearer credentials in all logs (`utils/logger.ts`).
- [ ] **Health Checks & Probes:**
  - Liveness probe: `GET /api/health` (returns 200 when Express event loop is responding).
  - Readiness probe: validates MongoDB database connectivity and AI worker status.
- [ ] **Alerting Thresholds:**
  - Alert on AI Gateway circuit breaker state transitions (`RATE_LIMITED`, `DEGRADED`, `TEMPORARILY_FAILED`).
  - Alert on AI queue dead-letter job accumulations (`status === 'FAILED'`).
  - Alert on HTTP 5xx error rate $> 1\%$ over a 5-minute window.
  - Alert on container memory usage $> 85\%$.

---

## 6. Pre-Flight Deployment Command Verification

```bash
# 1. Clean build verification
npm run build

# 2. Complete test suite verification
npm run test --workspaces

# 3. Linter & formatting audit
npm run lint
npm run format:check

# 4. Consistency checker audit
cd server && npx tsx src/scripts/check-consistency.ts
```
