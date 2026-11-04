# Monorepo Migration Baseline Report

**Recorded At:** 2026-11-04  
**Git Tag:** `pre-restructure`  
**Branch:** `restructure/three-folders`  
**Package Manager (Baseline):** `pnpm` (v10.33.0) + Turborepo (v2.4.4)  
**Target Structure:** Three independent self-contained folders (`api/`, `web/`, `mobile/`) using standard `npm`.

---

## 1. Test Execution Baseline

All tests were executed against local test services (PostgreSQL 16 on port 5432, Redis 7 on port 6379 in WSL Ubuntu).

| Workspace Package | Test Files | Total Tests | Passed | Failed | Skipped | Status |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| `apps/api` (`@ap/api`) | 25 | 261 | 261 | 0 | 0 | **PASS** |
| `apps/web` (`@ap/web`) | 3 | 5 | 5 | 0 | 0 | **PASS** |
| `apps/mobile` (`@ap/mobile`) | 1 | 1 | 1 | 0 | 0 | **PASS** |
| `packages/api-client` (`@ap/api-client`) | 1 | 5 | 5 | 0 | 0 | **PASS** |
| `packages/design-tokens` (`@ap/design-tokens`) | 1 | 8 | 8 | 0 | 0 | **PASS** |
| **Total Baseline** | **31** | **280** | **280** | **0** | **0** | **PASS** |

### Breakdown of API Test Suites (25 files, 261 tests):
* `src/modules/auth/__tests__/auth.integration.test.ts` (20 tests)
* `src/modules/assignments/__tests__/assignments.integration.test.ts` (17 tests)
* `src/modules/daily-photos/__tests__/daily-photos.integration.test.ts` (9 tests)
* `src/modules/campaigns/__tests__/campaigns.integration.test.ts` (15 tests)
* `src/modules/auth/__tests__/password.service.test.ts` (4 tests)
* `src/__tests__/integration.test.ts` (11 tests)
* `src/modules/auth/__tests__/token.service.test.ts` (4 tests)
* `src/__tests__/phase9-disputes-discipline-notifications.integration.test.ts` (11 tests)
* `src/__tests__/phase10-admin.integration.test.ts` (23 tests)
* `src/__tests__/phase8-finance.integration.test.ts` (7 tests)
* `src/modules/ledger/__tests__/recipes.test.ts` (9 tests)
* `src/modules/auth/__tests__/otp.service.test.ts` (6 tests)
* `src/shared/crypto/__tests__/crypto.test.ts` (9 tests)
* `src/__tests__/api.test.ts` (3 tests)
* `src/shared/money/__tests__/money.test.ts` (10 tests)
* `src/modules/notifications/__tests__/registry-completeness.test.ts` (3 tests)
* `src/__tests__/enums-sync.test.ts` (55 tests)
* `src/modules/accounts/__tests__/accounts.state-machine.test.ts` (7 tests)
* `src/modules/assignment-days/__tests__/assignment-days.math.test.ts` (10 tests)
* `src/shared/time/__tests__/time.test.ts` (5 tests)
* `src/shared/state-machine/__tests__/state-machine.test.ts` (4 tests)
* `src/modules/disputes/__tests__/disputes-math.test.ts` (11 tests)
* `src/modules/health/__tests__/health.test.ts` (2 tests)
* `src/modules/discipline/__tests__/strike-ladder.test.ts` (4 tests)
* `src/modules/_template/__tests__/template.test.ts` (2 tests)

---

## 2. Typecheck Status

`turbo run typecheck` across all 11 monorepo packages executed successfully:
* `@ap/shared-constants`: PASS
* `@ap/shared-types`: PASS
* `@ap/shared-validation`: PASS
* `@ap/shared-i18n`: PASS
* `@ap/design-tokens`: PASS
* `@ap/api-client`: PASS
* `@ap/api`: PASS
* `@ap/web`: PASS
* `@ap/mobile`: PASS

---

## 3. Build Status

* `@ap/api`: `tsup` compiled `src/main.ts` into `dist/main.js` (674.76 KB) in 252ms.
* `@ap/web`: `tsc --noEmit && vite build` built production bundle into `dist/` (assets, HTML) in 10.54s.

---

## 4. Monorepo Package Inventory & Import Matrix

| Module | Location | Imported By | Content Description |
|:---|:---|:---|:---|
| `@ap/shared-constants` | `packages/shared-constants` | `api`, `web`, `mobile`, `validation`, `api-client` | Roles, error codes, setting keys, states, enums |
| `@ap/shared-types` | `packages/shared-types` | `api`, `web`, `mobile`, `api-client` | Common domain entities, DTOs, API responses |
| `@ap/shared-validation` | `packages/shared-validation` | `api`, `web`, `mobile` | Zod validation schemas for all requests/settings |
| `@ap/shared-i18n` | `packages/shared-i18n` | `api`, `web`, `mobile` | Translations for en, hi, gu (JSON) + i18n keys |
| `@ap/design-tokens` | `packages/design-tokens` | `web`, `mobile` | Design tokens, color palettes, contrast ratio tests |
| `@ap/api-client` | `packages/api-client` | `web`, `mobile` | Pure TypeScript ApiClient and typed error wrapper |
| `@ap/tsconfig` | `packages/tsconfig` | All workspaces | Base compiler options (`base.json`, `node.json`, `web.json`) |
| `@ap/eslint-config` | `packages/eslint-config` | All workspaces | Base ESLint rules and restrictions |

---

## 5. Pure Functions Identified for Deduplication

1. **Money & Currency Helpers**:
   * Previously located in: `apps/api/src/shared/money/index.ts`
   * Ad-hoc `formatINR` functions duplicated in `apps/mobile/src/features/wallet/DriverWalletScreen.tsx`, `apps/web/src/portals/admin/features/payments/PaymentsPage.tsx`, `apps/web/src/portals/admin/features/payouts/PayoutsPage.tsx`, `apps/web/src/portals/company/features/payments/PaymentsPage.tsx`.
   * Action: Moved into `api/src/contract/money` (`Money`, `formatINR`, `calculateCampaignPricing`, `calculateRentPayout`, `paiseToRupees`, `rupeesToPaise`).
2. **IST Date & Time Helpers**:
   * Previously located in: `apps/api/src/shared/time/index.ts`
   * Pure date formatters (`todayIST`, `toISTDate`, `startOfISTDay`, `endOfISTDay`, `isWithinISTHours`) have zero Node dependencies.
   * Action: Moved into `api/src/contract/time` and unified across apps.

---

## 6. Purity Audit of `packages/*`

* Scanned for `process.env`, `node:*`, `fs`, `path`, `@prisma/client`, and server frameworks:
  * **Result**: Zero unauthorized node or server imports in `packages/*`.
  * `ApiClient` requires `baseUrl` as an explicit constructor parameter; does not read environment directly.
  * All packages contain only pure TypeScript, JSON, and `zod`.
