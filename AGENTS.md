# Auto Poster Platform - Agent Guidelines & Repository Rules

This document establishes the mandatory rules and architectural conventions for all AI agents and contributors working in this repository.

---

## 1. Repository Structure
The repository consists of exactly three independent applications plus `.github/` and root configurations:
* `api/`: Node.js + Express + TypeScript backend (Prisma ORM, BullMQ workers, Docker, scripts, all architecture documentation in `api/docs/`).
* `web/`: React + Vite + TypeScript (Single-page app hosting Admin Portal, Company Portal, and Public marketing/legal pages).
* `mobile/`: Expo + React Native + TypeScript (Auto-rickshaw Driver mobile application).

Each folder contains its own `package.json`, TypeScript configuration (`tsconfig.json`), and ESLint configuration. Always run scripts within their respective directory:
```bash
cd api && npm run <script>
cd web && npm run <script>
cd mobile && npm run <script>
```

---

## 2. Shared Code Rule (Contract Sync)
Pure shared code (types, constants, Zod validation schemas, API client, design tokens, and i18n error strings) lives **exclusively** in `api/src/contract/`.
* **NEVER** edit files in `web/src/shared/` or `mobile/src/shared/` by hand. These directories contain generated code.
* Always edit source files in `api/src/contract/`.
* Sync code to web and mobile by running:
  ```bash
  cd api && npm run sync:shared
  ```
* Verify sync integrity with:
  ```bash
  cd api && npm run sync:shared:check
  ```
* Shared aliases used across applications: `@ap/shared-types`, `@ap/shared-validation`, `@ap/shared-constants`, `@ap/shared-i18n`, `@ap/api-client`, `@ap/design-tokens`.

---

## 3. Database & Safety Policy (Zero Compromise)
* **Single Database Instance:** The ONLY database used for development is the Supabase PostgreSQL database configured in `api/.env`. There is NO local PostgreSQL container or service.
* **Schema Segregation:**
  * `public`: Development and walkthrough demo data. **NEVER** run destructive commands (`prisma migrate reset`, `migrate dev`, `db push --force-reset`, `DROP`, `TRUNCATE`) against `public`.
  * `test`: Automated integration and end-to-end tests run exclusively against this isolated schema (`DATABASE_URL_TEST`, prepared via `npm run db:test:prepare`).
  * `perf`: Performance and load testing runs against this dedicated schema.
* **Migration Approval:** If a database schema migration is ever required:
  1. Author hand-reviewed SQL.
  2. Verify with `npm run db:verify`.
  3. Present the migration plan and SQL to the human owner and wait for explicit confirmation before deploying to `public`.
* **Secrets & Credentials:**
  * Never print, log, copy, or commit real secrets, API keys, or connection strings.
  * Real `.env` files are ignored; only update `.env.example` templates and document variable names in `api/docs/ENVIRONMENT.md`.
  * External integrations (Razorpay, MSG91 SMS, SendGrid/SES, FCM) stay in sandbox/mock/test mode in development.

---

## 4. Code Quality & Conventions
* **Strict TypeScript:** No implicit any, no new unvetted `any` types. Typechecks must pass with 0 errors across all three folders.
* **Modular Codebase:** Keep files focused and maintain single responsibility.
* **Trilingual Localization:** All user-facing UI text, validation messages, and API error codes must provide complete translations in English (`en`), Hindi (`hi`), and Gujarati (`gu`).
* **Route Registry & Security Policies:** Every new API endpoint must:
  * Be declared in the centralized route registry with an explicit access control policy (`public`, `authenticated`, `role`, or `permission`).
  * Validate inputs using contract Zod schemas.
  * Emit structured audit logs for any data-modifying action.
  * Be covered by automated tests running against the `test` schema.
* **Step-Up Verification:** Sensitive actions (bank account changes, payouts, user management, policy updates) require step-up authorization.

---

## 5. Bug Register & Progress Tracking
All defects, unexpected test failures, and their verified fixes are tracked in:
* Bug Register: `api/docs/ag/BUG_REGISTER.md`
* Milestone Progress: `api/docs/ag/AG_PROGRESS.md`
* Baseline Metrics: `api/docs/ag/AG1_BASELINE.md`

