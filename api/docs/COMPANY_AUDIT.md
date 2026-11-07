# Phase 11: Company Portal & Public Pages Gap Audit

**Date:** 2026-11-06  
**Status:** Complete  
**Scope:** `api/` (all `/api/v1/company/*`, `/api/v1/auth/company/*`, and public endpoints), `web/src/portals/company/*`, `web/src/features/*`, and `web/src/shared/*`.

---

## 1. Executive Summary

A comprehensive architectural and functional scan of the company portal was conducted before beginning Phase 11 implementation.
The review confirms:
1. **Context Limitation:** All company endpoints currently resolve company profiles directly from `req.auth.userId` (1:1 relationship). Multi-user company teams (Owner, Manager, Finance, Viewer) and invitations do not exist.
2. **Missing UI & Placeholders:**
   - Five company routes (`/company/dashboard`, `/company/business-profile`, `/company/reports`, `/company/support`, `/company/tracking`) are 14–15 line static placeholders with no API integration.
   - There is NO company onboarding and KYC wizard in the UI; a new advertiser cannot submit business details, GSTIN, or verification documents from the web portal.
   - Campaign detail lacks a driver slot grid, activity timeline, renewal action, and cancel-with-refund preview.
   - Payment checkout is limited to a "Simulate Payment (Dev)" button; no real Razorpay Checkout flow or webhook polling exists.
   - No public pages exist (home, how it works, pricing preview calculator, for drivers, FAQ, contact).
3. **Component Reusability:** No shared `FileUploader` component exists; poster upload was implemented inline in `CreateCampaignWizard.tsx`.
4. **Internationalization & Code Quality:** 1,192 hardcoded text warnings exist across `web/`; complete English, Hindi, and Gujarati coverage is required for all company and public screens.

---

## 2. Company & Public API Endpoint Inventory

| Method | Path | Required Permission | Audited | Paginated | Existing Tests | Consuming UI Page / Component |
|---|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/company/register` | Public (None) | Yes | N/A | Integration | `RegisterPage.tsx` |
| `POST` | `/api/v1/auth/company/verify-mobile` | Public (None) | Yes | N/A | Integration | `VerifyMobilePage.tsx` |
| `POST` | `/api/v1/auth/company/login` | Public (None) | Yes | N/A | Integration | `LoginPage.tsx` |
| `GET` | `/api/v1/company/ping` | `COMPANY` role | No | N/A | Integration | Diagnostic only |
| `GET` | `/api/v1/company/onboarding` | `COMPANY` role | No | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `PUT` | `/api/v1/company/profile` | `COMPANY` role | Yes | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `POST` | `/api/v1/company/documents` | `COMPANY` role | Yes | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `DELETE` | `/api/v1/company/documents/:id` | `COMPANY` role | Yes | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `POST` | `/api/v1/company/consents` | `COMPANY` role | Yes | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `POST` | `/api/v1/company/kyc/submit` | `COMPANY` role | Yes | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `GET` | `/api/v1/company/kyc` | `COMPANY` role | No | N/A | Integration | **NO UI** (Placeholder `BusinessProfilePage.tsx`) |
| `GET` | `/api/v1/company/campaigns/rules` | `campaign.view` | No | N/A | Integration | `CreateCampaignWizard.tsx` |
| `GET` | `/api/v1/company/campaigns/availability` | `campaign.view` | No | N/A | Integration | `CreateCampaignWizard.tsx` |
| `POST` | `/api/v1/company/campaigns/price-preview` | `campaign.view` | No | N/A | Integration | `CreateCampaignWizard.tsx` |
| `POST` | `/api/v1/company/campaigns` | `campaign.manage` | Yes | N/A | Integration | `CreateCampaignWizard.tsx` |
| `GET` | `/api/v1/company/campaigns` | `campaign.view` | No | Yes | Integration | `CampaignsPage.tsx`, `CompanyDisputesPage.tsx` |
| `GET` | `/api/v1/company/campaigns/:id` | `campaign.view` | No | N/A | Integration | `CampaignDetailPage.tsx` |
| `PATCH` | `/api/v1/company/campaigns/:id` | `campaign.manage` | Yes | N/A | Integration | `CreateCampaignWizard.tsx` |
| `PUT` | `/api/v1/company/campaigns/:id` | `campaign.manage` | Yes | N/A | Integration | `CreateCampaignWizard.tsx` |
| `DELETE` | `/api/v1/company/campaigns/:id` | `campaign.manage` | Yes | N/A | Integration | **NO UI** |
| `POST` | `/api/v1/company/campaigns/:id/clone` | `campaign.manage` | Yes | N/A | Integration | `CampaignDetailPage.tsx` |
| `POST` | `/api/v1/company/campaigns/:id/submit` | `campaign.manage` | Yes | N/A | Integration | `CampaignDetailPage.tsx`, `CreateCampaignWizard.tsx` |
| `POST` | `/api/v1/company/campaigns/:id/cancel` | `campaign.cancel` | Yes | N/A | Integration | `CampaignDetailPage.tsx` (Direct call, no preview) |
| `POST` | `/api/v1/company/campaigns/:id/reopen` | `campaign.manage` | Yes | N/A | Integration | `CampaignDetailPage.tsx` |
| `GET` | `/api/v1/company/campaigns/:id/payment-summary` | `campaign.view` | No | N/A | Integration | `CampaignDetailPage.tsx` |
| `POST` | `/api/v1/company/campaigns/:id/payment/order` | `payment.pay` | Yes | N/A | Integration | **NO UI** (Calls dev simulate instead) |
| `POST` | `/api/v1/company/campaigns/:id/payment/verify` | `payment.pay` | Yes | N/A | Integration | **NO UI** |
| `GET` | `/api/v1/company/campaigns/:id/payments` | `payment.view` | No | N/A | Integration | `PaymentsPage.tsx` |
| `GET` | `/api/v1/company/campaigns/:id/invoices` | `payment.view` | No | N/A | Integration | **NO UI** |
| `GET` | `/api/v1/company/payments` | `payment.view` | No | Yes | Integration | `PaymentsPage.tsx` |
| `GET` | `/api/v1/company/tax-documents/:id/pdf` | `payment.view` | No | N/A | Integration | `PaymentsPage.tsx` |
| `GET` | `/api/v1/company/campaigns/:id/installations` | `installation.review` | No | N/A | Integration | **NO UI** |
| `POST` | `/api/v1/company/installations/:id/decision` | `installation.review` | Yes | N/A | Integration | **NO UI** |
| `GET` | `/api/v1/company/campaigns/:id/progress` | `campaign.view` | No | N/A | Integration | `CampaignProgressTab.tsx` |
| `GET` | `/api/v1/company/campaigns/:id/photos` | `campaign.view` | No | Yes | Integration | `CampaignProgressTab.tsx` |
| `GET` | `/api/v1/company/campaigns/:id/map` | `campaign.view` | No | N/A | Integration | **NO UI** |
| `POST` | `/api/v1/company/campaigns/:id/photos/:photoId/flag` | `photo.flag` | Yes | N/A | Integration | `CampaignProgressTab.tsx` |
| `GET` | `/api/v1/company/campaigns/:id/report.csv` | `report.view` | Yes | N/A | Integration | **NO UI** (Placeholder `ReportsPage.tsx`) |
| `POST` | `/api/v1/company/disputes` | `dispute.manage` | Yes | N/A | Integration | `CompanyDisputesPage.tsx` |
| `GET` | `/api/v1/company/disputes` | `dispute.manage` | No | Yes | Integration | `CompanyDisputesPage.tsx` |
| `GET` | `/api/v1/company/disputes/:id` | `dispute.manage` | No | N/A | Integration | `CompanyDisputesPage.tsx` |
| `POST` | `/api/v1/company/disputes/:id/messages` | `dispute.manage` | Yes | N/A | Integration | `CompanyDisputesPage.tsx` |
| `POST` | `/api/v1/company/disputes/:id/evidence` | `dispute.manage` | Yes | N/A | Integration | **NO UI** |
| `POST` | `/api/v1/company/disputes/:id/reopen-request` | `dispute.manage` | Yes | N/A | Integration | **NO UI** |

---

## 3. Web Pages & UI Features Audit

| Route | Page / Feature | Endpoints Used | States (Loading / Empty / Error) | i18n (en, hi, gu) | Mobile Layout | a11y & ARIA | Hardcoded Warning Count |
|---|---|---|---|---|---|---|---|
| `/company/dashboard` | `DashboardPage.tsx` | None (Placeholder) | ❌ Incomplete | ⚠️ English only | ⚠️ Untested | ❌ Incomplete | 2 |
| `/company/business-profile` | `BusinessProfilePage.tsx` | None (Placeholder) | ❌ Incomplete | ❌ English only | ⚠️ Untested | ❌ Incomplete | 2 |
| `/company/onboarding` | KYC Onboarding Wizard | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/company/kyc` | KYC Status Screens | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/company/campaigns` | `CampaignsPage.tsx` | `listCompanyCampaigns` | ✅ Yes | ⚠️ Partial | ⚠️ Table on phone | ⚠️ Partial | 28 |
| `/company/campaigns/new` | `CreateCampaignWizard.tsx` | `rules`, `cities`, `zones`, `availability`, `price-preview`, `uploadFile`, `submit` | ✅ Yes | ⚠️ Partial | ⚠️ Large forms | ⚠️ Partial | 84 |
| `/company/campaigns/:id` | `CampaignDetailPage.tsx` | `getDetail`, `submit`, `clone`, `reopen`, `cancel`, `simulatePayment` | ✅ Yes | ⚠️ Partial | ⚠️ Desktop bias | ⚠️ Partial | 56 |
| `/company/campaigns/:id` (Progress) | `CampaignProgressTab.tsx` | `getProgress`, `listPhotos`, `flagPhoto` | ✅ Yes | ⚠️ Partial | ⚠️ Desktop bias | ⚠️ Partial | 32 |
| `/company/tracking` | `TrackingPage.tsx` | None (Placeholder) | ❌ Incomplete | ❌ English only | ⚠️ Untested | ❌ Incomplete | 2 |
| `/company/payments` | `PaymentsPage.tsx` | `listPayments`, `downloadTaxDocumentPdf` | ✅ Yes | ⚠️ Partial | ⚠️ Table on phone | ⚠️ Partial | 38 |
| `/company/reports` | `ReportsPage.tsx` | None (Placeholder) | ❌ Incomplete | ❌ English only | ⚠️ Untested | ❌ Incomplete | 2 |
| `/company/disputes` | `CompanyDisputesPage.tsx` | `listDisputes`, `getDetail`, `createDispute`, `addMessage` | ✅ Yes | ⚠️ Partial | ⚠️ Desktop bias | ⚠️ Partial | 42 |
| `/company/support` | `SupportPage.tsx` | None (Placeholder) | ❌ Incomplete | ❌ English only | ⚠️ Untested | ❌ Incomplete | 2 |
| `/company/team` | Team & Invitations | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/company/billing` | Billing Profile | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/` (Public) | Public Landing Page | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/how-it-works` | How It Works | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/pricing` | Pricing Preview | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/for-drivers` | For Drivers Public Page | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |
| `/contact` | Contact & Inquiries | None (Missing) | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing | N/A |

---

## 4. Architectural Inconsistencies & Gaps

1. **Direct User-to-Company Coupling:**
   All services in `api/src/modules/company/` and `api/src/modules/campaigns/company-campaigns.service.ts` execute:
   ```ts
   const profile = await prisma.companyProfile.findUnique({ where: { userId } });
   ```
   This prevents multiple users from collaborating under one company account.
   **Solution:** Introduce `CompanyMember` with roles (`OWNER`, `MANAGER`, `FINANCE`, `VIEWER`), `CompanyInvitation`, and a middleware `resolveCompanyContext` that binds `req.company = { companyId, memberId, memberRole, permissions }`.

2. **No Reusable File Uploader:**
   File upload logic is duplicated inline in `CreateCampaignWizard.tsx`.
   **Solution:** Build `web/src/shared/ui/FileUploader.tsx` supporting drag-and-drop, client-side type/size check, image compression/EXIF safe rotation, presign -> upload -> confirm flow, progress bar, retry, and cancellation.

3. **Fake Dev Checkout Instead of Real Razorpay Test Checkout:**
   Currently `CampaignDetailPage.tsx` only offers a "Simulate Payment (Dev)" button.
   **Solution:** Implement Razorpay checkout modal via `https://checkout.razorpay.com/v1/checkout.js` in TEST mode (`rzp_test_`), handle verify callback and webhook reconciliation, while keeping simulated fallback for automated test environments.

4. **Missing Cancel Preview with Mathematical Accuracy:**
   Advertisers cancelling campaigns currently trigger immediate cancellation with no advance preview of non-refundable amounts, released assignments, or driver compensation.
   **Solution:** Implement `POST /api/v1/company/campaigns/:id/cancel/preview` calling the pure financial calculation engine, showing estimated refund and fees in a confirmation dialog requiring step-up OTP.

5. **No Visual Charting or Location Map:**
   Neither Recharts nor Leaflet is installed in `web/package.json`. Progress and coverage cannot be visualized effectively.
   **Solution:** Add `recharts` and `leaflet` (with `@types/leaflet`), lazy-loading them so bundle sizes remain under 500 KB.

6. **Privacy Shield Enforcement:**
   Confirm through automated tests that no driver names, raw phone numbers, exact GPS coordinates, or registration plates are exposed in any company response. Only short driver codes (`DRV-XXXX`) and approximate coordinates may be returned.

---

## 5. Prioritized Fix Roadmap (Phase 11 Steps)

- **Step 1:** Schema & Context Refactor: Add `CompanyMember`, `CompanyInvitation`, `BillingProfile`, `ContactMessage`; backfill existing company profiles; implement `resolveCompanyContext` and permissions.
- **Step 2:** App Shell, KYC Wizard & Shared `FileUploader`: Implement onboarding flow (`/company/onboarding`, `/company/kyc`), shared `FileUploader`, responsive shell with mobile navigation, and real KPI dashboard (`/company/dashboard`).
- **Step 3:** Campaign Experience Enhancements: Poster checker with auto mockup SVG preview, cancel preview endpoint and UI, renewal flow, activity timeline, driver slots grid, and progress map.
- **Step 4:** Installation Reviews & Photo Gallery: Review mode for company reviewers, daily comparison lightbox, flag management, and watermarked ZIP photo export.
- **Step 5:** Payments & Billing: Real Razorpay Test Checkout, billing profile management, account statement with monthly GST summary, and payment deadline reminder jobs.
- **Step 6:** Notifications, Digest & Support: Weekly digest worker job, help center, dispute evidence upload, and contact support forms.
- **Step 7:** Company Security: Step-up OTP for sensitive company operations, login security alerts, active session management.
- **Step 8:** Public Website Pages: Landing page, how it works, for drivers, pricing calculator, FAQ, contact form, and admin contact message viewer under `support.view`.
- **Step 9:** Quality, Accessibility & Zero-Literal Warnings: Strict i18n in English, Hindi, and Gujarati; zero `i18next/no-literal-string` warnings for company/public code; WCAG a11y compliance.
- **Step 10:** Demo Seed & Cleanup Tool: Seed realistic team, campaigns, photos, payments, and disputes in Supabase `public`; update `db:cleanup:go-live`.
- **Step 11:** Test Suite & Playwright E2E: Integration tests across all member roles, test-schema execution, and complete end-to-end user journeys.
- **Step 12:** Documentation & Architecture Runbooks: `COMPANY_PORTAL.md`, guides, translation reviews, and decision updates.

