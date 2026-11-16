# AG-1 Baseline Health Check & Infrastructure Metrics

Date: 2026-11-08  
Commit Reference: `ae2a855` (baseline branch `feature/ag-1-auth-simplification`)  
Host Environment: Windows 11, Node.js v22.23.4, npm v10.8.2, Supabase PostgreSQL, Redis 8.10.3

---

## 1. Executive Summary

| Verification Target | Command | Status | Duration | Metrics / Notes |
|:---|:---|:---|:---|:---|
| **Contract Synchronization** | `cd api && npm run sync:shared:check` | **PASS** | 0.8s | Zero drift across `api`, `web`, and `mobile` |
| **Architectural Boundaries** | `cd api && npm run check:boundaries` | **PASS** | 0.5s | Zero cross-app or cross-portal leakages |
| **Environment Variable Consistency** | `cd api && npm run check:env` | **PASS** | 0.6s | All keys matched schemas and `.env.example` (Fixed BUG-002) |
| **Secret Scanning** | `cd api && npm run check:secrets` | **PASS** | 0.7s | Zero high-entropy secrets committed |
| **Database Schema Drift** | `cd api && npm run db:verify` | **PASS** | 5.2s | Read-only inspection on `public` (57 tables found, drift reported) |
| **Test Schema Preparation** | `cd api && npm run db:test:prepare` | **PASS** | 9.8s | Fresh `test` schema initialized with all 468 DDL statements (Fixed BUG-004) |
| **API Typecheck** | `cd api && npm run typecheck` | **PASS** | 35.4s | 0 errors |
| **API Lint** | `cd api && npm run lint` | **PASS** | 22.1s | 0 errors, 408 warnings |
| **API Contract & Shared Tests** | `cd api && npx vitest run src/contract src/shared` | **PASS** | 2.1s | 10 test files passed, 66 tests passed |
| **API Auth Unit & Integration Tests** | `cd api && npx vitest run --no-file-parallelism src/modules/auth/__tests__` | **PASS** | 81.9s | 4 test files passed, 34 tests passed |
| **Web Typecheck** | `cd web && npm run typecheck` | **PASS** | 6.8s | 0 errors |
| **Web Lint** | `cd web && npm run lint` | **PASS** | 7.9s | 0 errors, 1264 warnings (i18n strings) |
| **Web Tests** | `cd web && npm run test` | **PASS** | 9.2s | 4 test files passed, 10 tests passed |
| **Web Production Build** | `cd web && npm run build` | **PASS** | 7.2s | Bundled successfully (`dist/assets/index.js`: 633 kB gzip: 179 kB) |
| **Mobile Typecheck** | `cd mobile && npm run typecheck` | **PASS** | 7.1s | 0 errors |
| **Mobile Lint** | `cd mobile && npm run lint` | **PASS** | 6.5s | 0 errors, 235 warnings |
| **Mobile Tests** | `cd mobile && npm run test` | **PASS** | 0.8s | 3 test files passed, 19 tests passed |
| **Mobile Doctor** | `cd mobile && npx expo-doctor` | **PASS** | 12.4s | 17/18 passed (expected CNG check note) |
| **Mobile Production Export** | `cd mobile && npx expo export --platform android` | **PASS** | 10.5s | Android bytecode bundle: 2.98 MB HBC |

---

## 2. Blockers Found & Resolved During Baseline

1. **BUG-002: Missing `.env.example` keys for Razorpay**
   - *Problem:* `npm run check:env` failed due to missing `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `api/.env.example`.
   - *Resolution:* Added placeholder test variables to `api/.env.example`.
2. **BUG-003: IPv6 Direct Supabase Host Timeout on Windows**
   - *Problem:* `api/src/shared/prisma.ts` attempted to connect directly to `db.wqpvvjtfoqgiecsykjrk.supabase.co:5432`, timing out on Windows environments without IPv6 routing.
   - *Resolution:* Wrapped connection resolution in `toReachableSupabaseUrl` pooler bridge.
3. **BUG-004: Missing `db:test:prepare` Script and Empty `test` Schema**
   - *Problem:* Integration tests failed with `relation "<table_name>" does not exist` because the Supabase `test` schema was empty.
   - *Resolution:* Authored `api/scripts/db-test-prepare.ts` and added `db:test:prepare` script to safely drop and recreate schema `test` with all 468 DDL statements.
4. **BUG-005: Redis Version Mismatch for BullMQ (3.0.504 vs 8.10.3)**
   - *Problem:* Background worker and BullMQ queues require Redis >= 5.0.0; port 6379 had legacy Windows Redis 3.0.504.
   - *Resolution:* Standardized on `C:\Users\Ravi\.redis\redis-server.exe` running Redis 8.10.3 on port `6380`.

---

## 3. Local Stack Startup Verification

- **Redis 8 Server**: Port `6380` (active)
- **Express REST API**: Port `4000` (active)
- **BullMQ Background Worker**: Active and listening for repeatable jobs
- **Vite Web Portal**: Port `5173` (HTTP 200 OK)
- **Probes**:
  - `GET /api/v1/health` -> `{"status":"ok","services":{"database":"connected","redis":"connected"}}`
  - `GET /api/v1/health/ready` -> `{"status":"ready","checks":{"database":"ok","redis":"ok"}}`

