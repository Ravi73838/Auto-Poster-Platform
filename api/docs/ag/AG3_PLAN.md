# Auto Poster Platform - AG-3 Plan: Company Portal UI Testing (Page-by-Page)

This document establishes the test strategy, execution roadmap, Playwright infrastructure, and quality criteria for testing every screen of the Company Portal.

---

## 1. Milestones & Safety Rules

- **Database Safety**: Automated tests execute strictly against the Supabase `test` schema (`DATABASE_URL_TEST`). Zero writes or modifications to `public`.
- **Read-Only Exploration**: The live walkthrough pass on `public` demo data will enforce read-only route abortion (blocking non-GET methods).
- **Trilingual Parity**: Verified across `en`, `hi`, and `gu`. Zero raw untranslated i18n keys permitted.
- **Accessibility & Privacy**: WCAG checks via `@axe-core/playwright` and strict PII filters (zero driver identity leakage).

---

## 2. Test Batches Roadmap

1. **Batch 1: Public & Auth**: `LoginPage`, `RegisterPage`, `VerifyMobilePage`, `ForgotPasswordPage`, `ResetPasswordPage`, `ChangePasswordPage`, `EnvironmentRibbon`, `LanguageSwitcher`, `ThemeSwitcher`, 404 handler.
2. **Batch 2: Onboarding & KYC**: Business profile editing, GSTIN validation, legal documentation, status badge transitions (PENDING, APPROVED, NEED_MORE_INFO, REJECTED), portal locking.
3. **Batch 3: Dashboard & Navigation**: KPI summary cards, pending action links, responsive sidebar vs mobile bottom navigation, role visibility.
4. **Batch 4: Campaigns Marketplace & Wizard**: Campaigns listing with status filters, 6-step Create Campaign Wizard (basics, targeting, schedule, pricing with 50 slots = ₹69,300 live preview, poster checker & mockup, review & submit), clone, renew, delete draft.
5. **Batch 5: Campaign Detail & Gallery**: Overview tab, progress tracking gallery, installations review mode, photo proofs, map flags, cancel preview & execution with step-up, privacy check.
6. **Batch 6: Payments & Invoices**: Payments table with ₹ INR formatting, tax invoice/credit note PDF downloads, dev checkout flow.
7. **Batch 7: Disputes, Support, Team & Security**: Dispute listing & messaging thread, support contact, idle timeout lock, password confirmation step-up.
