# Phase 10: Admin Portal Gap Audit & Inventory

## 1. Executive Summary

This audit comprehensively catalogs all existing administrative API endpoints, frontend portal pages, security mechanisms, data tables, and operational workflows across `apps/api` and `apps/web`.

The platform currently provides foundational admin features implemented in Phases 1–9 (Team management, Campaigns review, Daily photo review, Escrow/settlements/payouts finance portal, Discipline/strikes/bans, Disputes workspace, Announcements). However, significant gaps exist in unified information architecture, security hardening (step-up OTP, PII masking, idle timeout, IP allowlist), standardized data tables with saved views, 360-degree driver/company profiles, central reports registry with background export jobs, content management (legal versions and help articles), system health/job monitoring, and settings two-person approval.

---

## 2. Admin API Endpoint Inventory

| HTTP Method | Path | Permission / Guard | Audited? | Paginated? | Test Coverage? | UI Component / Page | Status / Notes |
|:---|:---|:---|:---:|:---:|:---:|:---|:---|
| `GET` | `/api/v1/admin/ping` | `SUPER_ADMIN, MODERATOR, FINANCE` | No | No | Yes | None | Ping check |
| `POST` | `/api/v1/admin/team` | `team.manage` | Yes | No | Yes | `TeamRolesPage.tsx` | Create admin staff |
| `GET` | `/api/v1/admin/team` | `team.manage` | No | No | Yes | `TeamRolesPage.tsx` | List staff |
| `PATCH` | `/api/v1/admin/team/:id/status` | `team.manage` | Yes | No | Partial | `TeamRolesPage.tsx` | Suspend/activate admin |
| `PATCH` | `/api/v1/admin/team/:id` | `team.manage` | Yes | No | Partial | `TeamRolesPage.tsx` | Change role |
| `GET` | `/api/v1/admin/campaigns` | `campaign.view` | No | Yes | Yes | NO UI | Filter campaigns |
| `GET` | `/api/v1/admin/campaigns/review-queue` | `campaign.review` | No | Yes | Yes | `CampaignReviewPage.tsx` | Campaign submissions |
| `POST` | `/api/v1/admin/campaigns/claim-next` | `campaign.review` | Yes | No | Yes | `CampaignReviewPage.tsx` | FIFO queue claim |
| `POST` | `/api/v1/admin/campaigns/:id/claim` | `campaign.review` | Yes | No | Yes | `CampaignReviewPage.tsx` | Manual claim |
| `POST` | `/api/v1/admin/campaigns/:id/release` | `campaign.review` | Yes | No | Yes | `CampaignReviewPage.tsx` | Release lock |
| `GET` | `/api/v1/admin/campaigns/:id` | `campaign.view` | No | No | Yes | `CampaignReviewModal.tsx`| Campaign details |
| `POST` | `/api/v1/admin/campaigns/:id/decision` | `campaign.review` | Yes | No | Yes | `CampaignReviewModal.tsx`| Approve/reject campaign |
| `POST` | `/api/v1/admin/campaigns/:id/cancel` | Role `SUPER_ADMIN` | Yes | No | Yes | NO UI | Force cancel campaign |
| `GET` | `/api/v1/admin/locations/cities` | `location.manage` | No | No | Yes | NO UI | List active cities |
| `POST` | `/api/v1/admin/locations/cities` | `location.manage` | Yes | No | Yes | NO UI | Create city |
| `PUT` | `/api/v1/admin/locations/cities/:id` | `location.manage` | Yes | No | Yes | NO UI | Update city |
| `GET` | `/api/v1/admin/locations/zones` | `location.manage` | No | No | Yes | NO UI | List zones |
| `POST` | `/api/v1/admin/locations/zones` | `location.manage` | Yes | No | Yes | NO UI | Create zone |
| `PUT` | `/api/v1/admin/locations/zones/:id` | `location.manage` | Yes | No | Yes | NO UI | Update zone |
| `GET` | `/api/v1/admin/installations/review-queue`| `campaign.review` | No | Yes | Yes | NO UI | Poster installation queue |
| `POST` | `/api/v1/admin/installations/:id/claim` | `campaign.review` | Yes | No | Yes | NO UI | Claim installation |
| `POST` | `/api/v1/admin/installations/:id/release`| `campaign.review` | Yes | No | Yes | NO UI | Release installation |
| `POST` | `/api/v1/admin/installations/:id/decision`| `campaign.review` | Yes | No | Yes | NO UI | Approve/reject install |
| `GET` | `/api/v1/admin/daily-photos/queue` | `SUPER_ADMIN, MODERATOR` | No | Yes | Yes | `DailyPhotoReviewTab.tsx`| Daily photos review |
| `POST` | `/api/v1/admin/daily-photos/claim-next` | `SUPER_ADMIN, MODERATOR` | Yes | No | Yes | `DailyPhotoReviewTab.tsx`| Claim next photo |
| `POST` | `/api/v1/admin/daily-photos/:id/claim` | `SUPER_ADMIN, MODERATOR` | Yes | No | Yes | `DailyPhotoReviewTab.tsx`| Claim photo |
| `POST` | `/api/v1/admin/daily-photos/:id/release` | `SUPER_ADMIN, MODERATOR`| Yes | No | Yes | `DailyPhotoReviewTab.tsx`| Release photo lock |
| `GET` | `/api/v1/admin/daily-photos/:id` | `SUPER_ADMIN, MODERATOR` | No | No | Yes | `DailyPhotoReviewTab.tsx`| Photo review detail |
| `POST` | `/api/v1/admin/daily-photos/:id/review` | `SUPER_ADMIN, MODERATOR` | Yes | No | Yes | `DailyPhotoReviewTab.tsx`| Verify/reject photo |
| `POST` | `/api/v1/admin/assignments/:id/days/:date/excuse` | `SUPER_ADMIN, MODERATOR` | Yes | No | Yes | `DailyPhotoReviewTab.tsx` | Override day excuse |
| `GET` | `/api/v1/admin/fraud/overview` | `SUPER_ADMIN, MODERATOR` | No | No | Yes | `FraudOverviewTab.tsx` | Risk metrics |
| `GET` | `/api/v1/admin/drivers/:id/trust` | `SUPER_ADMIN, MODERATOR` | No | No | Yes | `FraudOverviewTab.tsx` | Driver trust score |
| `GET` | `/api/v1/admin/finance/dashboard` | `payment.view, ledger.view` | No | No | Yes | `PaymentsPage.tsx` | Finance KPIs & balances |
| `POST` | `/api/v1/admin/finance/pause` | `finance.settings` | Yes | No | Yes | `PaymentsPage.tsx` | Kill switch toggles |
| `GET` | `/api/v1/admin/finance/payments` | `payment.view` | No | Yes | Yes | `PaymentsPage.tsx` | Escrow payments list |
| `GET` | `/api/v1/admin/finance/refunds` | `payment.view` | No | Yes | Yes | `PaymentsPage.tsx` | Refunds list |
| `POST` | `/api/v1/admin/finance/refunds` | `payment.refund` | Yes | No | Yes | `PaymentsPage.tsx` | Maker: request refund |
| `POST` | `/api/v1/admin/finance/refunds/:id/review` | `payment.refund` | Yes | No | Yes | `PaymentsPage.tsx` | Checker: approve/reject |
| `GET` | `/api/v1/admin/finance/settlements` | `settlement.view` | No | Yes | Yes | `PaymentsPage.tsx` | Settlements list |
| `POST` | `/api/v1/admin/finance/settlements/:id/review`| `settlement.approve` | Yes | No | Yes | `PaymentsPage.tsx` | Approve settlement |
| `POST` | `/api/v1/admin/finance/campaigns/:id/closeout`| `settlement.approve` | Yes | No | Yes | `PaymentsPage.tsx` | Closeout unspent funds |
| `GET` | `/api/v1/admin/finance/payouts` | `payout.view` | No | Yes | Yes | `PayoutsPage.tsx` | Payout batches list |
| `POST` | `/api/v1/admin/finance/payouts/export-csv` | `payout.process` | Yes | No | Yes | `PayoutsPage.tsx` | Bank file generation |
| `POST` | `/api/v1/admin/finance/payouts/import-csv` | `payout.process` | Yes | No | Yes | `PayoutsPage.tsx` | Bank UTR reconciliation |
| `GET` | `/api/v1/admin/finance/ledger/accounts` | `ledger.view` | No | Yes | Yes | `PaymentsPage.tsx` | Chart of accounts |
| `GET` | `/api/v1/admin/finance/ledger/transactions` | `ledger.view` | No | Yes | Yes | `PaymentsPage.tsx` | Journal entries |
| `GET` | `/api/v1/admin/finance/ledger/trial-balance` | `ledger.view` | No | No | Yes | `PaymentsPage.tsx` | Balance validation |
| `GET` | `/api/v1/admin/finance/adjustments` | `ledger.view` | No | Yes | Yes | `PaymentsPage.tsx` | Manual adjustments list|
| `POST` | `/api/v1/admin/finance/adjustments` | `ledger.adjust` | Yes | No | Yes | `PaymentsPage.tsx` | Maker: request adjust |
| `POST` | `/api/v1/admin/finance/adjustments/:id/review`| `ledger.adjust` | Yes | No | Yes | `PaymentsPage.tsx` | Checker: approve adjust |
| `POST` | `/api/v1/admin/strikes` | `strike.manage` | Yes | No | Yes | `DisciplinePage.tsx` | Issue strike |
| `GET` | `/api/v1/admin/strikes` | `strike.view` | No | Yes | Yes | `DisciplinePage.tsx` | Strikes list |
| `POST` | `/api/v1/admin/strikes/:id/revoke` | `strike.manage` | Yes | No | Yes | `DisciplinePage.tsx` | Revoke strike |
| `GET` | `/api/v1/admin/bans` | `strike.view` | No | Yes | Yes | `DisciplinePage.tsx` | Suspensions list |
| `POST` | `/api/v1/admin/bans/:id/lift` | `strike.manage` | Yes | No | Yes | `DisciplinePage.tsx` | Lift driver ban |
| `GET` | `/api/v1/admin/drivers/:driverId/discipline` | `strike.view` | No | No | Yes | `DisciplinePage.tsx` | Driver strike history |
| `POST` | `/api/v1/admin/assignments/:id/terminate` | `strike.manage` | Yes | No | Yes | `DisciplinePage.tsx` | Terminate assignment |
| `POST` | `/api/v1/admin/assignments/:id/reinstate` | `strike.manage` | Yes | No | Yes | `DisciplinePage.tsx` | Reinstate assignment |
| `GET` | `/api/v1/admin/disputes` | `dispute.view` | No | Yes | Yes | `DisputesPage.tsx` | Disputes workspace |
| `POST` | `/api/v1/admin/disputes/claim-next` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | FIFO dispute claim |
| `POST` | `/api/v1/admin/disputes/:id/claim` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Claim dispute |
| `POST` | `/api/v1/admin/disputes/:id/release` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Release dispute |
| `GET` | `/api/v1/admin/disputes/:id` | `dispute.view` | No | No | Yes | `DisputesPage.tsx` | Dispute detail & logs |
| `POST` | `/api/v1/admin/disputes/:id/messages` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Add message |
| `POST` | `/api/v1/admin/disputes/:id/evidence` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Upload evidence |
| `PATCH` | `/api/v1/admin/disputes/:id/evidence/:evidenceId/visibility` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Toggle admin-only |
| `POST` | `/api/v1/admin/disputes/:id/request-info`| `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Request information |
| `POST` | `/api/v1/admin/disputes/:id/decision/preview`| `dispute.resolve` | No | No | Yes | `DisputesPage.tsx` | Preview resolution |
| `POST` | `/api/v1/admin/disputes/:id/decision` | `dispute.resolve` | Yes | No | Yes | `DisputesPage.tsx` | Execute resolution |
| `POST` | `/api/v1/admin/disputes/:id/accept-reopen` | Role `SUPER_ADMIN`| Yes | No | Yes | `DisputesPage.tsx` | Reopen review appeal |
| `POST` | `/api/v1/admin/announcements` | `SUPER_ADMIN, MODERATOR` | Yes | No | Yes | `AnnouncementsPage.tsx` | Broadcast composer |
| `GET` | `/api/v1/admin/announcements` | `SUPER_ADMIN, MODERATOR` | No | Yes | Yes | `AnnouncementsPage.tsx` | Broadcasts history |
| `GET` | `/api/v1/admin/announcements/:id` | `SUPER_ADMIN, MODERATOR` | No | No | Yes | `AnnouncementsPage.tsx` | Delivery stats |

---

## 3. Admin Web Portal Page Inventory

| Route | Page Component | Permission Required | Endpoints Used | Loading State | Empty State | Error State | i18n Complete | Responsive | Accessible | Quality Status |
|:---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| `/admin/dashboard` | `DashboardPage.tsx` | Authenticated Admin | None | No | Stub | No | Partial | Yes | Basic | **STUB** (Empty card) |
| `/admin/drivers` | `DriversPage.tsx` | `kyc.approve` | None | No | Stub | No | Hardcoded | Yes | Basic | **STUB** (No list/API) |
| `/admin/companies` | `CompaniesPage.tsx` | `kyc.approve` | None | No | Stub | No | Hardcoded | Yes | Basic | **STUB** (No list/API) |
| `/admin/campaign-review` | `CampaignReviewPage.tsx` | `campaign.approve` | `getReviewQueue`, `claimNext`, `claim`, `release`, `decide` | Yes | Yes | Yes | Partial | Yes | Good | Complete feature |
| `/admin/photo-review` | `PhotoReviewPage.tsx` | `photo.approve` | `getDailyPhotosQueue`, `claimNext`, `review`, `excuseDay`, `getFraudOverview` | Yes | Yes | Yes | Partial | Yes | Good | Complete feature |
| `/admin/payments` | `PaymentsPage.tsx` | `payout.approve` | `getFinanceDashboard`, `getTrialBalance`, `settlements`, `refunds`, `ledger` | Yes | Yes | Yes | Hardcoded | Partial | Fair | Feature-rich; Needs AdminDataTable & i18n |
| `/admin/payouts` | `PayoutsPage.tsx` | `payout.approve` | `listAdminPayouts`, `exportPayoutsCsv`, `importPayoutsCsv` | Yes | Yes | Yes | Hardcoded | Yes | Fair | Needs standard table & step-up |
| `/admin/disputes` | `DisputesPage.tsx` | `dispute.resolve` | `disputes.*` | Yes | Yes | Yes | Partial | Yes | Good | Complete feature |
| `/admin/discipline` | `DisciplinePage.tsx` | `strike.manage` | `strikes.*`, `bans.*`, `assignments.*` | Yes | Yes | Yes | Partial | Yes | Good | Complete feature |
| `/admin/announcements` | `AnnouncementsPage.tsx`| `announcement.manage` | `announcements.*` | Yes | Yes | Yes | Partial | Yes | Good | Complete feature |
| `/admin/reports` | `ReportsPage.tsx` | `audit.view` | None | No | Stub | No | Hardcoded | Yes | Basic | **STUB** (No registry/API) |
| `/admin/audit-log` | `AuditLogPage.tsx` | `audit.view` | None | No | Stub | No | Hardcoded | Yes | Basic | **STUB** (No table/API) |
| `/admin/team-roles` | `TeamRolesPage.tsx` | `settings.manage` | `listAdmins`, `createAdmin`, `updateAdminRole`, `updateAdminStatus` | Yes | Yes | Yes | Hardcoded | Yes | Good | Lacks role permission matrix & login logs |
| `/admin/settings` | `SettingsPage.tsx` | `settings.manage` | `getHealth` | Yes | No | Yes | Partial | Yes | Fair | Infrastructure check only, lacks config settings |

---

## 4. Key Inconsistencies & Architecture Gaps

1. **Table Implementations**:
   - `DataTable.tsx` in `apps/web/src/shared/components/DataTable.tsx` is an elementary non-paginated table without server filters, sorting, column toggles, row selection, or saved views.
   - `PaymentsPage`, `DisciplinePage`, `DisputesPage`, and `PayoutsPage` implement ad-hoc pagination, sorting, and filter bars with duplicated UI states.
2. **Date & Currency Formatting**:
   - `PayoutsPage.tsx` defines an inline `formatINR(paiseStr)`.
   - `PaymentsPage.tsx` uses a separate paise division formula.
   - Various pages format timestamps using browser-local `toLocaleDateString()` instead of consistent Indian Standard Time (IST) formatting (`DD/MM/YYYY hh:mm A IST`).
3. **Missing Critical APIs & Security Controls**:
   - No Step-Up OTP flow (`POST /api/v1/admin/step-up/request` and `verify`).
   - No PII masking and audit reveal endpoint (`POST /api/v1/admin/reveal`).
   - No Admin Session Idle Timeout or IP Allowlist validation.
   - No Work Queues Summary (`/api/v1/admin/work-queues/summary`), My-Work inbox (`/api/v1/admin/my-work`), or Global Search (`/api/v1/admin/search`).
   - No Drivers and Companies directory or 360-degree overview endpoints.
   - No Centralized Reports Registry or asynchronous `ExportJob` runner.
   - No System Health/Job Monitoring endpoints (`/api/v1/admin/system/*`).
   - No Legal Documents and Help Articles content management APIs.
   - No Two-Person Approval workflow for sensitive system settings (`SettingChangeRequest`).
4. **i18n & ESLint Compliance**:
   - Several admin screens have hardcoded English text in buttons, headers, and modal labels without translation keys in `@ap/shared-i18n`.

---

## 5. Prioritized Fix & Implementation Plan

- **P0: Database Schema & Core Security Hardening (Steps 1 & 2)**
  - Enable `pg_trgm` extension and GIN indexes.
  - Add tables: `DailyMetric`, `SavedView`, `ExportJob`, `SettingChangeRequest`, `LegalDocument`, `HelpArticle`, `JobRun`.
  - Add `stepUpVerifiedAt` to `Session`.
  - Implement Step-up OTP middleware, Idle timeout, IP allowlist, and PII Masking/Reveal with audit logging.
- **P0: Information Architecture, Work Queues & Global Search (Step 3)**
  - Backend: `work-queues/summary`, `my-work`, `queues/assign`, `team/workload`, and `search` with trigram matching.
  - Frontend: Grouped sidebar navigation by permission, Command Palette (`Cmd+K`), keyboard shortcuts, and "My Work" inbox.
- **P1: Standard Data Table System & Building Blocks (Step 6)**
  - Build `AdminDataTable` with URL sync, server-side pagination/sorting, column selector, loading skeletons, and `SavedView` support.
  - Standard components: `ConfirmDialog`, `ReasonDialog`, `StatusChip`, `Money`, `DateTime`, `MaskedValue`, `EntityLink`, `HistoryDrawer`, `SlaBadge`.
- **P1: Dashboards, Daily Metrics Rollup & Reports Registry (Step 4)**
  - Implement `metrics-rollup` cron job and `GET /api/v1/admin/analytics/overview`.
  - Build role-specific dashboards for Super Admin, Moderator, and Finance.
  - Implement Reports Registry with streaming CSV `ExportJob` lifecycle and Web UI.
- **P1: 360-Degree Entity Pages (Step 5)**
  - Build Driver 360 and Company 360 endpoints and web views with permissions-gated tabs.
  - Build reusable `HistoryDrawer` powered by `GET /api/v1/admin/audit-logs`.
- **P1: Settings Management with Two-Person Approval (Step 7)**
  - Grouped system settings API with Zod validation, sensitive keys maker-checker, and Web UI.
- **P2: Team, Roles Matrix & Audit Log Viewer (Step 8)**
  - Implement RolePermission matrix editor, `docs/PERMISSIONS.md` generator script & freshness test.
  - Implement full Audit Log viewer with before/after diffs.
- **P2: Content Management & System Monitoring (Steps 9 & 10)**
  - Legal documents versioning & forced re-consent flow. Help articles public/admin CRUD.
  - System health, BullMQ job runs recorder, failed jobs retry/discard.
- **P2: Performance, Testing, Accessibility & Documentation (Steps 11–14)**
  - Large-data seed (`db:seed:load`), performance check script, Playwright E2E suite, accessibility checks, and complete operational runbooks.
