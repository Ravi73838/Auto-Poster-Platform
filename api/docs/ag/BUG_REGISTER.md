# Auto Poster Platform - Bug Register

This register documents defects, edge cases, and unexpected test failures encountered during development and testing, along with their resolution and regression tests.

| ID | Severity | Area | Description | How Found | Status | Fix Commit / Note | Regression Test |
|:---|:---|:---|:---|:---|:---|:---|:---|
| BUG-001 | Medium | Auth / Admin | Permissions dropped or not matched after admin entity approval | User manual testing (Phase 10) | RESOLVED | `SUPER_ADMIN` case-insensitive bypass and DB permission key cross-mapping | `web/src/shared/permissions/__tests__/permissions.test.ts` |
| BUG-002 | Low | Config / Environment | `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` missing from `api/.env.example` | Baseline check (`npm run check:env`) | RESOLVED | Added missing placeholder keys to `api/.env.example` | `cd api && npm run check:env` |
| BUG-003 | High | Database / Connectivity | Supabase direct host unreachable on Windows IPv4 in `prisma.ts` | Baseline test runs (`password.service.test.ts`) | RESOLVED | Added `toReachableSupabaseUrl` bridge in `api/src/shared/prisma.ts` | `cd api && npx vitest run src/modules/auth/__tests__/password.service.test.ts` |
| BUG-004 | High | Database / Testing | Missing `db:test:prepare` script leaving `test` schema empty | Baseline integration test run | RESOLVED | Created `api/scripts/db-test-prepare.ts` recreating isolated `test` schema and deploying DDL | `cd api && npm run db:test:prepare` |
| BUG-005 | Medium | Infrastructure / Redis | Redis 5 port conflict with BullMQ v6 requiring Redis >= 6.2 | Redis startup check | RESOLVED | Configured local Redis 8 on port 6380 with fallback bridge | `api/src/shared/redis/index.ts` |
| BUG-006 | Low | Auth / Mobile | Mobile ApiClient method mismatch (`getAppConfig` vs `getPublicAppConfig`) | Mobile typecheck during AG-1 | RESOLVED | Fixed method call to `getPublicAppConfig` and added explicit language default | `mobile/src/features/auth/MobileInputScreen.tsx` |
| BUG-007 | Medium | Auth / Testing | Parallel vitest test files competing on Supabase `test` schema rows | Multi-suite test run | RESOLVED | Added `skipDuplicates: true` and `--no-file-parallelism` standard | `api/vitest.config.ts` |
