# Environment Configuration Guide

This document details all environment variables across the **Auto Poster Advertising Platform** (`api`, `web`, and `mobile`), migration rules for Supabase PostgreSQL, and instructions for updating local configuration safely.

---

## 1. Action Required: Updates to Local `api/.env`

> [!IMPORTANT]
> In accordance with safety rules, never commit, copy, or print secrets into documentation or repositories. Only variable names and placeholder shapes are shown below.

To update an existing local `api/.env` file for Phase 10.5 stabilization, add or update the following keys:

1. **`DB_ENVIRONMENT`** (Required):
   Set to `development`. This activates the database safety guard protecting production and production schemas.
2. **`DIRECT_URL`** (Recommended for Supabase):
   Direct PostgreSQL connection (e.g. Supabase port 5432) used for migrations and DDL scripts. If absent, defaults to `DATABASE_URL`.
3. **`DATABASE_URL_TEST`** (Optional):
   Connection URL for the integration test schema (`schema=test`). If omitted, `env.ts` automatically derives it from `DATABASE_URL` with `schema=test` and `connection_limit=5`.
4. **`OTP_HMAC_SECRET`** (Standardized):
   If your `.env` contains `HMAC_SECRET`, rename it to `OTP_HMAC_SECRET` (or define both, as fallback is maintained).
5. **`EMAIL_PROVIDER`** & **`PUSH_PROVIDER`**:
   Ensure `EMAIL_PROVIDER=smtp` (or `dev`) and `PUSH_PROVIDER=dev` (or `expo`) are set.
6. **`EXPO_ACCESS_TOKEN`** (Optional):
   Expo push notification access token when using push provider `expo`.
7. **Storage Configuration**:
   Verify `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_FORCE_PATH_STYLE` are configured for your local MinIO instance or remote Supabase Storage S3-compatible endpoint.

---

## 2. Supabase Connection & Schema Policy

- **`DATABASE_URL` (Pooled Connection)**:
  Used by the running application (`api` web server and `worker`). On Supabase, this should point to the connection pooler (Session / Transaction mode on port 6543 or port 5432 with pgbouncer parameters).
- **`DIRECT_URL` (Direct Connection)**:
  Used exclusively for Prisma migrations (`prisma migrate deploy`, `prisma migrate diff`, DDL scripts). Connects directly to PostgreSQL without pooler proxy limitations.
- **Schema Separation**:
  - `public`: Development application data. Shown in web and mobile dashboards.
  - `test`: Automated integration tests. Can be truncated and recreated freely.
  - `perf`: Performance benchmarking and load test seed (`db:seed:load`).
  - `verify_tmp`, `diff_tmp`: Ephemeral schemas created and dropped during migration drift checks.

---

## 3. Complete Environment Variable Catalog

### API Service (`api/.env`)

| Variable Name | Required / Optional | Default / Placeholder | Description & Purpose | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | `development` | Runtime environment (`development`, `production`, `test`) | Phase 1 |
| `DB_ENVIRONMENT` | **Required** | `development` | Target DB classification (`development` or `production`). Checked by db-guard | Phase 10.5 |
| `API_PORT` | Optional | `4000` | HTTP port on which the Express REST API listens | Phase 1 |
| `CORS_ORIGINS` | Optional | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed web origins | Phase 1 |
| `DATABASE_URL` | **Required** | `postgresql://...` | Connection URL to Supabase PostgreSQL database | Phase 1 |
| `DIRECT_URL` | Optional | `postgresql://...` | Direct DB connection URL for Prisma migrations | Phase 10.5 |
| `DATABASE_URL_TEST` | Optional | `postgresql://...` | Connection URL for integration test schema (`schema=test`) | Phase 10.5 |
| `REDIS_URL` | Optional | `redis://127.0.0.1:6380` | Redis instance URL for BullMQ queues, rate limits, and sessions | Phase 1 |
| `ENCRYPTION_KEY` | **Required** | 32-byte hex string | AES-256-GCM encryption key for PII (bank IFSC, account number) | Phase 1 |
| `OTP_HMAC_SECRET` | **Required** | 32-byte string | HMAC-SHA256 secret for hashing OTP tokens and account fingerprints | Phase 1 / 10.5 |
| `HMAC_SECRET` | Optional | Alias of OTP_HMAC_SECRET | Backward-compatible alias for OTP_HMAC_SECRET | Phase 1 |
| `JWT_ACCESS_SECRET` | **Required** | 32-byte string | Secret key for signing and verifying JWT authentication tokens | Phase 1 |
| `JWT_ACCESS_TTL` | Optional | `15m` | Token expiry duration (e.g. 15m, 1h) | Phase 1 |
| `REFRESH_TOKEN_TTL_DAYS` | Optional | `30` | Refresh token session validity duration in days | Phase 1 |
| `SMS_PROVIDER` | Optional | `dev` | SMS delivery adapter (`dev` logs to console, `none` disables) | Phase 1 |
| `OTP_DEV_BYPASS_CODE` | Optional | `123456` | Fixed OTP for rapid local testing (forbidden in production) | Phase 1 |
| `PUSH_PROVIDER` | Optional | `dev` | Push notifications adapter (`expo`, `dev`, `none`) | Phase 7 |
| `EXPO_ACCESS_TOKEN` | Optional | `""` | Bearer token for Expo push notification service | Phase 7 |
| `EMAIL_PROVIDER` | Optional | `smtp` | Email delivery service adapter (`smtp`, `dev`, `none`) | Phase 8 |
| `SMTP_HOST` | Optional | `127.0.0.1` | SMTP server host (e.g. MailHog or Gmail) | Phase 8 |
| `SMTP_PORT` | Optional | `1025` | SMTP server port | Phase 8 |
| `SMTP_USER` | Optional | `""` | SMTP username for authentication | Phase 8 |
| `SMTP_PASS` | Optional | `""` | SMTP password for authentication | Phase 8 |
| `EMAIL_FROM` | Optional | `notifications@autoposter.local` | From address for transactional notification emails | Phase 8 |
| `S3_ENDPOINT` | Optional | `http://127.0.0.1:9000` | S3-compatible storage endpoint URL (MinIO or Supabase Storage) | Phase 3 |
| `S3_REGION` | Optional | `us-east-1` | S3 bucket region | Phase 3 |
| `S3_BUCKET` | Optional | `autoposter-uploads` | S3 storage bucket name | Phase 3 |
| `S3_ACCESS_KEY` | Optional | `minioadmin` | S3 access key / credential ID | Phase 3 |
| `S3_SECRET_KEY` | Optional | `minioadmin123` | S3 secret access key | Phase 3 |
| `S3_FORCE_PATH_STYLE` | Optional | `true` | Enables path-style bucket URLs (`http://host/bucket`) | Phase 3 |
| `ENABLE_DEV_PAYMENT_SIMULATION` | Optional | `false` | Enables sandbox simulated payment callbacks (forbidden in prod) | Phase 8 |

---

### Web Portal (`web/.env`)

| Variable Name | Required / Optional | Default / Placeholder | Description & Purpose | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Optional | `http://localhost:4000/api/v1` | Base REST API URL accessed by browser clients | Phase 1 |
| `VITE_API_URL` | Optional | `http://localhost:4000/api/v1` | Backward-compatible alias for `VITE_API_BASE_URL` | Phase 1 |

---

### Mobile Driver App (`mobile/.env`)

| Variable Name | Required / Optional | Default / Placeholder | Description & Purpose | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_BASE_URL`| Optional | `http://localhost:4000/api/v1` | Base REST API URL accessed by driver React Native client | Phase 1 |
| `EXPO_PUBLIC_API_URL` | Optional | `http://localhost:4000/api/v1` | Backward-compatible alias for `EXPO_PUBLIC_API_BASE_URL` | Phase 1 |
| `EAS_PROJECT_ID` | Optional | `00000000-0000-0000-0000-000000000000` | Expo Application Services project identifier | Phase 1 |
