# AG-2 Implementation Plan: Complete API Endpoint Test Coverage

This plan outlines the systematic testing, verification, bug tracking, and regression coverage for **every endpoint** in the Auto Poster Advertising Platform backend.

---

## 1. Objectives & Safety Guarantees

1. **100% Route Coverage**: Verify every route registered in [api/src/routes.ts](file:///d:/Ravi/Radhe/Auto-Poster-Platform/api/src/routes.ts) and child routers with real HTTP calls via `supertest`.
2. **Isolated `test` Schema**: All database transactions and assertions execute against the Supabase `test` schema (`DATABASE_URL_TEST`), with 0 writes to `public`.
3. **Double Verification**: Both `AUTH_OTP_ENABLED=false` (streamlined test fixtures) and authenticated session tokens (Driver, Company, Admin roles) are rigorously exercised.
4. **Bug Isolation**: Any route defects, unhandled rejections, permission leaks, or missing validation schemas will be logged to [api/docs/ag/BUG_REGISTER.md](file:///d:/Ravi/Radhe/Auto-Poster-Platform/api/docs/ag/BUG_REGISTER.md) and immediately fixed.

---

## 2. Test Suites Decomposition

We organize the end-to-end tests into 6 clean, modular suites under `api/src/__tests__/`:

1. `e2e-public-and-shared.integration.test.ts` (Public, Help, Legal, Locations, Uploads, Devices, Me)
2. `e2e-driver-domain.integration.test.ts` (Driver Profile, KYC, Vehicle, Bank, Campaigns, Proofs, Disputes)
3. `e2e-company-domain.integration.test.ts` (Company Profile, KYC, Campaign lifecycle, Escrow, Photo browse)
4. `e2e-admin-domain.integration.test.ts` (Review queues, Users, Team, Strikes, Settings, Step-up, PII reveal)
5. `e2e-finance-and-webhooks.integration.test.ts` (Razorpay webhooks, Escrow release, Settlements, Driver Payouts)
6. `e2e-security-and-errors.integration.test.ts` (Role guards, Prefix guards, Rate limiting, Invalid inputs)

---

## 3. Progress Milestones

- [ ] **Suite 1: Public, Shared & Utility Routes**
- [ ] **Suite 2: Driver Domain Flow**
- [ ] **Suite 3: Company Domain Flow**
- [ ] **Suite 4: Admin Operations & Queues**
- [ ] **Suite 5: Finance & Webhooks**
- [ ] **Suite 6: Security & Negative Boundary Matrix**
- [ ] **Final Project Gate: Typecheck, Lint, Full Test Suite**

