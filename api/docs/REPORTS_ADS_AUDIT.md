# Reports, Google Ads (AdMob) and Local Ads Audit (Phase 13)

**Document Version:** 1.0.0  
**Phase:** 13 (Reports, Google Ads & Local Ads)  
**Date:** 2026-11-07  
**Status:** Audit Complete & Implementation Blueprint Approved

---

## 1. Executive Summary

Phase 13 introduces two foundational monetization and transparency pillars to the Auto Poster Advertising Platform:
1. **The PDF Report Engine**: Production-grade headless PDF generation for campaign reports (interim and final with photo proof and financial settlement), driver earnings statements, finance monthly packs, and local ad performance reports. Multi-language (English, Hindi, Gujarati) with correct Indic conjunct shaping, verifiable via QR code and SHA-256 snapshot hashes.
2. **Google AdMob & Local Direct Ads**: Non-intrusive bonus monetization for drivers following strict placement safety (banners only on non-critical screens, forbidden on camera, KYC, and financial transaction screens) alongside high-margin local direct advertising targeted to auto-rickshaw drivers (tyre shops, CNG pumps, mechanics, insurance, finance).

---

## 2. Existing Repository State (What is Present)

### 2.1 Reports & Document Generation
- **Phase 10 Export Registry (`api/src/modules/admin/reports/`)**:
  - `ReportsService` processes asynchronous CSV export jobs for `DRIVERS`, `COMPANIES`, `CAMPAIGNS`, `ASSIGNMENTS`, `PAYMENTS`, and `PAYOUTS`.
  - Persisted in Prisma via `ExportJob` model.
  - Web UI at `web/src/portals/admin/features/reports/ReportsPage.tsx` allows filtering, triggering, and downloading CSV reports.
- **Phase 8 Tax Document Generator (`api/src/modules/tax-documents/`)**:
  - `TaxDocumentService` issues GST-compliant Tax Invoices (`INV`) and Credit Notes (`CN`) using `pdf-lib`.
  - Sequential FY-based numbering (`INV/26-27/0001`) with GST calculation.
  - *Limitation*: `pdf-lib` cannot reliably handle complex HTML layouting or Indic font complex conjunct shaping (Hindi Devanagari and Gujarati).
- **Phase 11 Company Campaign Views (`web/src/portals/company/features/campaigns/`)**:
  - `CampaignProgressTab.tsx` offers basic CSV export of running vehicles and verified days.
  - Print-friendly layout exists in CSS, but no downloadable immutable PDF report.
- **Campaign Settlement Lifecycle (`api/src/modules/settlements/`)**:
  - `SettlementService.approveSettlement` and `SettlementService.closeoutCampaign` calculate financial settlement, release escrow, and refund surplus.
  - *Gap*: The `'campaign.settled'` event is not yet defined in `api/src/events/types.ts` and not emitted to trigger final report generation.
- **Storage Infrastructure (`api/src/modules/uploads/`)**:
  - S3 / Supabase Storage integration via `S3StorageProvider` and `FileAccessService`.
  - Supports private object storage with audited signed read URLs.

### 2.2 Advertising & Monetization
- **Mobile App (`mobile/src/features/ads/`)**:
  - Contains an 8-line placeholder `README.md` defining high-level rules (no ads during camera capture, KYC, or payout).
  - No AdMob SDK installed or configured in `app.config.ts`.
- **Public Remote Configuration (`api/src/modules/public/`)**:
  - `GET /api/v1/public/app-config` exposes version gating (`minVersion`, `latestVersion`) and maintenance status.
  - *Gap*: Lacks remote advertising kill switches, placement toggles, and safety configuration.

---

## 3. Gap Analysis & Architecture Blueprint

| Capability | Current State | Required State (Phase 13) | Action / Hook |
| :--- | :--- | :--- | :--- |
| **PDF Rendering Engine** | Basic `pdf-lib` in `tax-documents` (English only, fixed coordinates) | Playwright headless Chromium (`page.pdf`) with HTML/CSS templates, SVG server-side charts, embedded Noto fonts (Latin, Devanagari, Gujarati) | Build `api/src/modules/reports/engine/` + separate Docker target `reporter` |
| **Report Processing Worker** | No background report worker | Dedicated BullMQ queue `report-generation` processed by `worker:reports` with concurrency 1-2 | Add `worker-reports.ts`, Dockerfile target `reporter`, docker-compose service |
| **Report Database Storage** | `ExportJob` for CSV only | `GeneratedReport` model in Prisma with immutable snapshots, SHA-256 hash, versioning, and QR code verification | Add Prisma migration + go-live cleanup integration |
| **Company Campaign Report** | Ad-hoc CSV download on web | `CAMPAIGN_INTERIM` (on-demand) and `CAMPAIGN_FINAL` (auto on settlement). Verified photo gallery, zone heatmap, cost & refund ledger breakdown | Add data snapshot builder, HTML template, Company Portal UI tab |
| **Driver Earnings Statement** | Mobile wallet UI only | `DRIVER_EARNINGS` PDF report on-demand with UTR numbers, active campaigns, rent & allowance breakdowns | Add driver report endpoints + mobile export/share screen |
| **Finance Monthly Pack** | Manual ledger query | `FINANCE_MONTHLY_PACK` auto-generated on 1st of month at 03:00 IST + ZIP bundle of raw accounting CSVs | BullMQ repeatable job + Admin Finance UI |
| **Public Verification** | None | `GET /api/v1/public/reports/verify/:id?hash=` + accessible web route `/verify-report` | Public controller + web verification page |
| **AdMob Driver SDK** | Placeholder README | `react-native-google-mobile-ads` with test unit IDs in dev/preview, real IDs in prod profile | Expo config plugin, `app.config.ts`, `eas.json` |
| **Ad Layout Safety & Guards** | None | `AdSlot` component with 16dp spacing, list cadence (1 every 6 cards), AST forbidden screen scan test | Create `AdSlot.tsx` and `forbidden-screens.test.ts` |
| **Ad Remote Control** | None | `app-config` ads block (`enabled`, `localAdsEnabled`, `placements`, `disableOnSlowNetwork`) | Extend `PublicController.getAppConfig` |
| **Local Direct Ads** | None | `LocalAdvertiser`, `LocalAd`, `LocalAdStatDaily`, Maker-Checker review, Redis frequency cap, serving API | Prisma models, admin features, serving route |
| **Ad Health & Revenue** | None | `AdPlacementDaily` health aggregation, CTR alert job, `AdRevenueEntry` manual accounting table | BullMQ health check + Admin Revenue UI |

---

## 4. Hooks and Inter-Module Touchpoints

1. **`campaign.settled` Event Hook**:
   - Update `api/src/events/types.ts` to declare `CampaignSettledEvent`.
   - In `SettlementService.closeoutCampaign` (and `approveSettlement` when final), emit `campaign.settled`.
   - Register event listener `CampaignSettledListener` in `api/src/events/listeners/` to enqueue `CAMPAIGN_FINAL` report generation and dispatch notification to company.
2. **`public/app-config` Extension**:
   - Enrich response DTO with `ads` payload queried from `SettingsService`.
3. **`FileAccessService` Expansion**:
   - Add permission rules for `REPORT_DOCUMENT`: Company owner, Driver owner (own earnings statement only), and Admins with `report.view` (audited).
4. **Shared Contract (`api/src/contract/`)**:
   - Add new types, enums (`ReportType`, `ReportStatus`, `AdSource`, `LocalAdCategory`, `LocalAdStatus`), and Zod schemas.
   - Run `npm run sync:shared` across `api`, `web`, and `mobile`.

---

## 5. Security & Privacy Invariants

- **Driver Anonymity in Reports**: Company campaign reports must NEVER expose driver full names, raw mobile numbers, KYC documents, vehicle registration plates, or raw GPS lat/long coordinates. Aggregated data only, with short anonymized slot codes (e.g. `AUTO-042`) and rounded geographical zones.
- **Zero Driver Tracking for Ads**: Local ad serving frequency limits (max 3 impressions per driver per ad per day) must reside **strictly in Redis** with a 48-hour TTL. No per-driver ad impression history is ever written to PostgreSQL.
- **Maker-Checker for Local Ads**: An admin who creates a local ad cannot approve it. Approval requires a distinct `SUPER_ADMIN` user (`MAKER_CHECKER_VIOLATION` enforced).
- **Ads Safety in Build Profiles**: Automated guard tests must fail the build if real AdMob unit IDs are used in non-production builds or if test IDs are used in production.

