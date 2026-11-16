# Auto Poster Platform - Company Page Inventory

This document provides a comprehensive inventory of every route, page component, role permission matrix, API dependencies, form actions, UI states, and internationalization namespaces for the **Company Portal** and its associated public auth workflows.

---

## 1. Public Authentication & Account Recovery Routes

| Route | Page Component | Allowed Roles | Target Redirect / Guard | Primary API Endpoints | Forms & Key Actions | Screen States | i18n Namespaces |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `/login` | `LoginPage.tsx` | Public (Unauthenticated) | Redirects to `/company/dashboard` if already logged in | `POST /auth/company/login`<br>`POST /auth/refresh` | Email + Password form, "Sign In" button, link to `/register`, link to `/forgot-password` | - Initial<br>- Submitting (disabled + spinner)<br>- Validation errors<br>- 401 Invalid credentials<br>- Success redirect<br>- OTP-disabled banner | `auth`, `common`, `errors` |
| `/register` | `RegisterPage.tsx` | Public (Unauthenticated) | Redirects to `/verify-mobile` or `/login` | `POST /auth/company/register` | Business email, mobile, password, language selection, "Register Company" button | - Initial<br>- Form validation<br>- 409 Conflict (duplicate email/mobile)<br>- Success redirect | `auth`, `common`, `errors` |
| `/verify-mobile` | `VerifyMobilePage.tsx` | Public (Unauthenticated) | Redirects to `/login` upon verification | `POST /auth/company/verify-mobile`<br>`POST /auth/company/resend-otp` | 6-digit OTP code input, resend button with countdown timer, "Verify Mobile" button | - Initial<br>- Submitting<br>- Invalid OTP (400)<br>- Expired OTP<br>- Success redirect | `auth`, `common`, `errors` |
| `/forgot-password` | `ForgotPasswordPage.tsx` | Public (Unauthenticated) | Redirects to `/reset-password` | `POST /auth/password/forgot` | Email input, "Send Reset Code" button, back to sign in link | - Initial<br>- Submitting<br>- Invalid email format<br>- Success redirect with query param | `auth`, `common`, `errors` |
| `/reset-password` | `ResetPasswordPage.tsx` | Public (Unauthenticated) | Redirects to `/login` with success banner | `POST /auth/password/reset` | Email, reset code, new password input, "Reset Password" button | - Initial<br>- Submitting<br>- Code mismatch<br>- Success redirect to `/login` | `auth`, `common`, `errors` |
| `/change-password` | `ChangePasswordPage.tsx` | Authenticated (Any role) | Enforced by `AuthGuard` when `mustChangePassword=true` | `POST /auth/password/change` | Current password, new password, confirm new password, "Update Password" button | - Initial<br>- Password mismatch<br>- Wrong current password<br>- Success toast | `auth`, `common`, `errors` |
| `/*` (Fallback) | `AppRouter.tsx` | Any | Redirects unknown paths to `/login` | None | Client-side routing fallback | 404 redirect | `common` |

---

## 2. Company Portal Routes (`/company/*` under `CompanyLayout`)

All routes under `/company/*` are protected by `RoleGuard(allowedRoles: [ROLES.COMPANY])`.
Members within a company hold one of four roles:
- `OWNER`: Full administrative, financial, campaign creation, and team control.
- `MANAGER`: Campaign creation, daily monitoring, dispute handling, read-only billing.
- `FINANCE`: Billing, payment execution, tax document downloads, read-only campaigns.
- `VIEWER`: Read-only access across approved dashboards and campaigns.

| Route | Page Component | Member Roles Access | Blocked Member Behavior | Primary API Endpoints | Forms & Key Actions | Screen States | i18n Namespaces |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `/company/dashboard` | `CompanyDashboardPage.tsx` | OWNER, MANAGER, FINANCE, VIEWER | None (All members view dashboard) | `GET /company/profile`<br>`GET /company/campaigns` | - KPI Summary Cards<br>- Recent Campaigns table<br>- Quick link to "+ Create Campaign"<br>- Onboarding checklist | - Loading skeleton<br>- Active metrics<br>- Empty state<br>- Pending review banner<br>- Suspended banner | `common`, `status` |
| `/company/business-profile` | `BusinessProfilePage.tsx` | OWNER, MANAGER (Write)<br>FINANCE, VIEWER (Read-only) | VIEWER/FINANCE cannot submit KYC or profile edits | `GET /company/profile`<br>`PUT /company/profile`<br>`POST /company/kyc` | - Profile edit form (Brand, Legal Name, Address, Website, Contact Person)<br>- KYC document uploader (GSTIN, PAN)<br>- "Submit for KYC Approval" button | - Loading<br>- Viewing verified profile<br>- Editing draft<br>- KYC Status (PENDING, APPROVED, NEED_MORE_INFO, REJECTED) | `common`, `auth`, `status` |
| `/company/campaigns` | `CampaignsPage.tsx` | OWNER, MANAGER, FINANCE, VIEWER | "+ New Campaign" CTA hidden/disabled for VIEWER | `GET /company/campaigns?status=...&search=...&page=...` | - Status filter tabs (All, Draft, Under Review, Awaiting Payment, Active, Completed, Rejected)<br>- Search input<br>- Click card to view details<br>- "+ Create Campaign" button | - Loading spinner<br>- Campaigns cards / table<br>- Empty state per status<br>- Network error with retry | `common`, `campaigns`, `status` |
| `/company/campaigns/new` | `CreateCampaignWizard.tsx` | OWNER, MANAGER | VIEWER / FINANCE redirected or blocked; Blocked if company KYC is not APPROVED | `GET /company/campaigns/rules`<br>`GET /locations/cities`<br>`GET /locations/zones`<br>`GET /company/campaigns/availability`<br>`POST /company/campaigns/price-preview`<br>`POST /uploads/presigned-url`<br>`POST /uploads/confirm`<br>`POST /company/campaigns`<br>`POST /company/campaigns/:id/submit` | Multi-Step Wizard:<br>1. Basics (Title, Description)<br>2. Targeting (City, Zones, Availability meter)<br>3. Schedule (Dates, Min lead check)<br>4. Pricing (Slots, Rent, Printing allowance, Material, Live price preview with 5% platform fee & 18% GST)<br>5. Poster (Upload file, aspect ratio check, auto mockup)<br>6. Review & Submit (Summary table, policy agreement checkbox, Save Draft, Submit) | - Step navigation 1..6<br>- Field validation errors<br>- Live pricing calculation loader<br>- Poster upload progress<br>- Availability gauge<br>- Submission success redirect | `common`, `campaigns`, `validation` |
| `/company/campaigns/:id` | `CampaignDetailPage.tsx` | OWNER, MANAGER, FINANCE, VIEWER | Write actions (Submit, Cancel, Clone, Delete) hidden for VIEWER | `GET /company/campaigns/:id`<br>`GET /company/campaigns/:id/assignments`<br>`GET /company/campaigns/:id/photos`<br>`GET /company/campaigns/:id/reports`<br>`POST /company/campaigns/:id/submit`<br>`POST /company/campaigns/:id/cancel`<br>`POST /company/campaigns/:id/clone`<br>`DELETE /company/campaigns/:id` | - Tab navigation (Overview, Progress)<br>- Submit for review button (DRAFT)<br>- Delete Draft button (DRAFT)<br>- Pay now button (AWAITING_PAYMENT)<br>- Cancel campaign modal with reason<br>- Clone campaign button<br>- Poster preview modal | - Loading skeleton<br>- DRAFT state<br>- UNDER_REVIEW state<br>- AWAITING_PAYMENT state<br>- LIVE active tracking<br>- REJECTED banner with reasons<br>- COMPLETED summary | `common`, `campaigns`, `status` |
| `/company/tracking` | `TrackingPage.tsx` | OWNER, MANAGER, FINANCE, VIEWER | None (Read-only monitoring) | `GET /company/campaigns?status=LIVE` | - City & Campaign selector<br>- Active driver routes & live photos | - Loading<br>- Live monitoring view<br>- Empty state | `common`, `status` |
| `/company/payments` | `CompanyPaymentsPage.tsx` | OWNER, MANAGER, FINANCE (Write/Pay)<br>VIEWER (Read-only) | VIEWER cannot initiate checkout | `GET /company/payments`<br>`GET /company/invoices/:id/download`<br>`POST /company/campaigns/:id/pay` | - Payments data table (Date, Amount ₹, Method, Status)<br>- "Download Invoice" button<br>- "Retry Payment" CTA | - Loading spinner<br>- Payments table<br>- Empty state<br>- PDF downloading indicator | `common`, `finance`, `status` |
| `/company/reports` | `CompanyReportsPage.tsx` | OWNER, MANAGER, FINANCE, VIEWER | None | `GET /company/reports` | - Campaign performance metrics<br>- Date range selector<br>- "Export CSV" / "Download PDF" | - Loading<br>- Reports dashboard<br>- Empty state | `common`, `reports` |
| `/company/disputes` | `CompanyDisputesPage.tsx` | OWNER, MANAGER (Write)<br>FINANCE, VIEWER (Read-only) | VIEWER cannot file claim or reply | `GET /company/disputes`<br>`GET /company/disputes/:id`<br>`POST /company/disputes`<br>`POST /company/disputes/:id/messages` | - Left sidebar dispute list with status filters<br>- Right conversation thread<br>- Message composer form<br>- "+ Raise Dispute" modal (Campaign, Reason, Description, Claimed Amount) | - Loading list<br>- Loading active thread<br>- Empty state<br>- Dispute open / resolved / rejected badge | `common`, `disputes`, `status` |
| `/company/support` | `CompanySupportPage.tsx` | OWNER, MANAGER, FINANCE, VIEWER | None | `GET /help`<br>`POST /support/tickets` | - Help center FAQ links<br>- Contact support form | - Default support cards<br>- Message sent confirmation | `common`, `status` |

---

## 3. Shell Controls & Global Company UI Elements

| Component | Location | Roles | Behavior & Visibility | Associated API / Store |
|:---|:---|:---|:---|:---|
| **EnvironmentRibbon** | Top of main viewport | All | Displays active simulation banner if clock is skewed; displays Amber banner: `"OTP authentication is DISABLED (testing mode) - Auth Mode: Password Only"` | `GET /public/app-config`<br>`GET /dev/clock` |
| **LanguageSwitcher** | Header top-right | All | Instant trilingual toggle (`en`, `hi`, `gu`) across whole UI | `i18next`, local storage persistence, user preferences API |
| **ThemeSwitcher** | Header top-right | All | Toggles `light`, `dark`, and `system` theme classes on `<html>` | Theme store, local storage persistence |
| **Account Status Banner** | Under Header in `CompanyLayout` | All | - `PENDING`: Warning banner stating account is under admin review.<br>- `SUSPENDED`: Danger banner stating account is suspended. | `useAuthStore().user.status` |
| **Logout Button** | Sidebar footer | All | Calls server logout, clears tokens and auth store, navigates to `/login` | `POST /auth/logout`, `useAuthStore.clearAuth()` |
| **Step-Up Verification Dialog** | Modal overlay | Sensitive operations | Prompts for account password re-entry on sensitive flows (cancellations, bank edits) | `POST /admin/step-up/verify` or company password confirmation |
