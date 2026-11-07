# Phase 12: Driver Mobile App Gap Audit

**Date:** 2026-11-07  
**Status:** Complete  
**Scope:** `mobile/` (`app/`, `src/`, `package.json`, `app.config.ts`, `eas.json`), and API driver-related endpoints (`/api/v1/driver/*`, `/api/v1/uploads/*`, `/api/v1/notifications/*`, `/api/v1/devices/*`, `/api/v1/auth/*`, `/api/v1/public/*`, `/api/v1/legal/*`, `/api/v1/help/*`, `/api/v1/locations/*`).

---

## 1. Executive Summary

A comprehensive scan of the mobile codebase was conducted at the start of Phase 12.
Key findings:
1. **Missing Native Modules:**
   - Essential native modules are NOT installed in `mobile/package.json`: `expo-camera`, `expo-location`, `expo-notifications`, `expo-device`, `expo-application`, `expo-file-system`, `expo-sharing`, `expo-image`, `expo-font`, `expo-build-properties`, `expo-screen-capture`, `@react-native-community/netinfo`, `@shopify/flash-list`, `@tanstack/query-async-storage-persister`, `react-native-gesture-handler`, and `react-native-reanimated`.
2. **Simulated & Fake Captures:**
   - In `DailyPhotoCaptureScreen.tsx`, photo capture is simulated using synthetic timestamps, a hard-coded file key (`daily-proofs/dev-sim-...`), hard-coded GPS coordinates (`21.205, 72.855`), and hard-coded `isMockLocation: false`. This completely bypasses the platform's anti-fraud protections.
   - `InstallationUploadScreen.tsx` provides a print guide but lacks the real camera capture and installation photo submission workflow.
3. **Missing Features & Stubs:**
   - **Driver KYC Onboarding:** `src/features/kyc/index.ts` is only a 3-line placeholder; new drivers cannot submit documents or get verified via the app.
   - **Offline Upload Queue:** `src/offline/` contains only a `README.md`; no persistent queue or retry logic exists.
   - **Push Notifications & Device Registration:** No push token registration (`POST /api/v1/devices`) or channel management is implemented.
   - **Orphaned Screens:** Screens for assignments, installation, daily photo, discipline, disputes, and notifications exist as components but are not linked into `app/` routes.
4. **Internationalization & Test Gaps:**
   - Exactly **235 hardcoded text warnings** (`i18next/no-literal-string`) exist across `mobile/src` and `mobile/app`.
   - Only 1 test file (`mobile.test.ts` with 1 test) exists in the mobile workspace.
5. **Backend Additions Needed:**
   - Aggregated `GET /api/v1/driver/home` endpoint to minimize network roundtrips on low-end 2G/3G connections.
   - `GET /api/v1/driver/capture-rules` to supply server-configured photo constraints (accuracy, max age, daily attempts, grace period).
   - `GET /api/v1/public/app-config` for minimum version enforcement and maintenance mode.
   - `Idempotency-Key` header support on critical write actions.

---

## 2. Mobile Screen Components Inventory

| File Path | Routed from `app/` | API Endpoints Used | Stubs / Simulated Behavior | Lines | i18n Warnings | Tests |
|---|---|---|---|---|---|---|
| `app/_layout.tsx` | Root Layout (`/`) | None | None | 58 | 0 | None |
| `app/index.tsx` | Entry Redirect (`/`) | None | Simple redirect to tabs or login | 14 | 0 | None |
| `app/+not-found.tsx` | NotFound (`/+not-found`) | None | None | 42 | 2 | None |
| `app/(auth)/login.tsx` | Auth Screen (`/(auth)/login`) | `requestDriverOtp`, `verifyDriverOtp` | None | 57 | 0 | None |
| `app/(tabs)/_layout.tsx` | Tabs Layout (`/(tabs)`) | None | Tab bar definition | 52 | 0 | None |
| `app/(tabs)/index.tsx` | Home Tab (`/(tabs)`) | Sub-component `DriverStatusHomeScreen` | None | 13 | 0 | None |
| `app/(tabs)/campaigns.tsx` | Campaigns Tab (`/(tabs)/campaigns`) | Sub-component `CampaignsScreen` | None | 16 | 0 | None |
| `app/(tabs)/wallet.tsx` | Wallet Tab (`/(tabs)/wallet`) | Sub-component `DriverWalletScreen` | None | 39 | 1 | None |
| `app/(tabs)/profile.tsx` | Profile Tab (`/(tabs)/profile`) | `listSessions`, `revokeSession` | Basic profile, lacks legal/help | 273 | 4 | None |
| `app/campaigns/[id].tsx` | Campaign Detail (`/campaigns/[id]`) | Sub-component `CampaignDetailScreen` | None | 19 | 0 | None |
| `src/features/auth/LanguageSelectScreen.tsx` | Yes (via `login.tsx`) | None | Local state only | 103 | 3 | None |
| `src/features/auth/MobileInputScreen.tsx` | Yes (via `login.tsx`) | `driverOtpRequest` | None | 147 | 10 | None |
| `src/features/auth/OtpVerifyScreen.tsx` | Yes (via `login.tsx`) | `verifyDriverOtp` | None | 167 | 10 | None |
| `src/features/auth/DriverStatusHomeScreen.tsx` | Yes (via `(tabs)/index.tsx`) | `getMe` | Lacks aggregated home data | 194 | 9 | None |
| `src/features/auth/DriverSettingsScreen.tsx` | **No** (Orphaned) | `listSessions`, `revokeSession` | Duplicate of `profile.tsx` logic | 267 | 9 | None |
| `src/features/campaigns/CampaignsScreen.tsx` | Yes (via `(tabs)/campaigns.tsx`) | `listDriverCampaigns` | None | 258 | 15 | None |
| `src/features/campaigns/CampaignDetailScreen.tsx` | Yes (via `campaigns/[id].tsx`) | `getDriverCampaignDetail`, `selectCampaign` | None | 382 | 24 | None |
| `src/features/assignments/DriverAssignmentsScreen.tsx` | **No** (Orphaned) | `listDriverAssignments`, `withdrawAssignment` | None | 300 | 11 | None |
| `src/features/installation/InstallationUploadScreen.tsx` | **No** (Orphaned) | `getDriverAssignment`, `getPrintGuide`, `getPosterDownloadUrl`, `startInstalling` | No camera capture flow; no photo submission | 272 | 19 | None |
| `src/features/daily-photo/DailyPhotoCaptureScreen.tsx` | **No** (Orphaned) | `getTodayStatus`, `submitDailyPhoto`, `uploads/presign` | **Critical:** Simulated capture, hard-coded coordinates, `dev-sim` key, hard-coded `isMockLocation: false` | 493 | 22 | None |
| `src/features/wallet/DriverWalletScreen.tsx` | Yes (via `(tabs)/wallet.tsx`) | `getDriverWalletBalance`, `getDriverWalletStatement`, `requestDriverWithdrawal` | Lacks payout timeline and settlement explainer | 477 | 14 | None |
| `src/features/discipline/DriverDisciplineScreen.tsx` | **No** (Orphaned) | `driverGetDisciplineMe`, `driverGetDisciplineRules` | None | 445 | 22 | None |
| `src/features/disputes/DriverDisputesScreen.tsx` | **No** (Orphaned) | `listDisputes`, `getDisputeDetail`, `driverCreateDispute`, `addDisputeMessage`, `requestDisputeReopen` | None | 873 | 23 | None |
| `src/features/notifications/NotificationsScreen.tsx` | **No** (Orphaned) | `listNotifications`, `getUnreadNotificationsCount`, `markNotificationRead`, `markAllNotificationsRead` | None | 333 | 6 | None |
| `src/features/kyc/index.ts` | **No** (Placeholder) | None | **3 lines:** completely empty placeholder | 4 | 0 | None |

---

## 3. API Endpoint Inventory (Driver & App Scope)

| Endpoint | Method | Purpose | Status in App | Existing API Tests |
|---|---|---|---|---|
| `/api/v1/auth/driver/otp/request` | `POST` | Request SMS OTP | Used (`MobileInputScreen`) | Integration |
| `/api/v1/auth/driver/otp/verify` | `POST` | Verify OTP and authenticate | Used (`OtpVerifyScreen`) | Integration |
| `/api/v1/auth/refresh` | `POST` | Refresh session token | Used (`ApiClient`) | Integration |
| `/api/v1/auth/me` | `GET` | Fetch authenticated user | Used (`authStore`) | Integration |
| `/api/v1/auth/me/preferences` | `PATCH` | Update language & theme | Missing in Mobile | Integration |
| `/api/v1/auth/logout` | `POST` | Invalidate current session | Used (`profile.tsx`) | Integration |
| `/api/v1/auth/logout-all` | `POST` | Invalidate all sessions | Missing in Mobile | Integration |
| `/api/v1/auth/sessions` | `GET` | List active sessions | Used (`profile.tsx`) | Integration |
| `/api/v1/auth/sessions/:id` | `DELETE` | Revoke specific session | Used (`profile.tsx`) | Integration |
| `/api/v1/driver/onboarding` | `GET` | Get draft onboarding state | Missing in Mobile | Integration |
| `/api/v1/driver/profile` | `PUT` | Save driver profile draft | Missing in Mobile | Integration |
| `/api/v1/driver/vehicle` | `PUT` | Save vehicle details draft | Missing in Mobile | Integration |
| `/api/v1/driver/documents` | `POST` | Attach KYC document | Missing in Mobile | Integration |
| `/api/v1/driver/documents/:id` | `DELETE` | Remove KYC document | Missing in Mobile | Integration |
| `/api/v1/driver/payout-details` | `PUT` | Save UPI / bank details | Missing in Mobile | Integration |
| `/api/v1/driver/consents` | `POST` | Submit legal consents | Missing in Mobile | Integration |
| `/api/v1/driver/kyc/submit` | `POST` | Submit KYC for verification | Missing in Mobile | Integration |
| `/api/v1/driver/kyc` | `GET` | Get current KYC status | Missing in Mobile | Integration |
| `/api/v1/driver/campaigns` | `GET` | Browse available campaigns | Used (`CampaignsScreen`) | Integration |
| `/api/v1/driver/campaigns/:id` | `GET` | Get campaign specifications | Used (`CampaignDetailScreen`) | Integration |
| `/api/v1/driver/campaigns/:id/select` | `POST` | Select and reserve slot | Used (`CampaignDetailScreen`) | Integration |
| `/api/v1/driver/assignments` | `GET` | List active & past assignments | Used (`DriverAssignmentsScreen`) | Integration |
| `/api/v1/driver/assignments/:id` | `GET` | Assignment details | Used (`InstallationUploadScreen`) | Integration |
| `/api/v1/driver/assignments/:id/start-installing` | `POST` | Transition to INSTALLING | Used (`InstallationUploadScreen`) | Integration |
| `/api/v1/driver/assignments/:id/withdraw` | `POST` | Withdraw from reservation | Used (`DriverAssignmentsScreen`) | Integration |
| `/api/v1/driver/assignments/:id/poster-download` | `GET` | Download artwork | Used (`InstallationUploadScreen`) | Integration |
| `/api/v1/driver/assignments/:id/print-guide` | `GET` | Print specifications & checklist | Used (`InstallationUploadScreen`) | Integration |
| `/api/v1/driver/assignments/:id/installation` | `POST` | Submit installation photo | Missing in Mobile UI | Integration |
| `/api/v1/driver/assignments/:id/daily-photos` | `POST` | Submit daily proof photo | Used (Simulated in `DailyPhotoCaptureScreen`) | Integration |
| `/api/v1/driver/assignments/:id/today` | `GET` | Today's proof status & attempts | Used (`DailyPhotoCaptureScreen`) | Integration |
| `/api/v1/driver/assignments/:id/days` | `GET` | 30-day proof calendar | Missing in Mobile UI | Integration |
| `/api/v1/driver/assignments/:id/daily-photos` | `GET` | Historical photo gallery | Missing in Mobile UI | Integration |
| `/api/v1/driver/wallet` | `GET` | Balance, in-transit, lifetime | Used (`DriverWalletScreen`) | Integration |
| `/api/v1/driver/wallet/statement` | `GET` | Transaction ledger | Used (`DriverWalletScreen`) | Integration |
| `/api/v1/driver/withdrawals` | `POST` | Request payout | Used (`DriverWalletScreen`) | Integration |
| `/api/v1/driver/payouts` | `GET` | Payout history & UTR status | Missing in Mobile UI | Integration |
| `/api/v1/driver/assignments/:id/settlement` | `GET` | Rent calculation explainer | Missing in Mobile UI | Integration |
| `/api/v1/driver/discipline` | `GET` | Active strikes & bans | Used in unrouted component | Integration |
| `/api/v1/driver/discipline/rules` | `GET` | Discipline rules explainer | Used in unrouted component | Integration |
| `/api/v1/driver/disputes` | `GET` | List disputes | Used in unrouted component | Integration |
| `/api/v1/driver/disputes` | `POST` | Open new dispute | Used in unrouted component | Integration |
| `/api/v1/driver/disputes/:id` | `GET` | Dispute thread & evidence | Used in unrouted component | Integration |
| `/api/v1/driver/disputes/:id/messages` | `POST` | Send dispute message | Used in unrouted component | Integration |
| `/api/v1/driver/disputes/:id/evidence` | `POST` | Attach dispute evidence | Used in unrouted component | Integration |
| `/api/v1/driver/disputes/:id/reopen-request` | `POST` | Request re-review | Used in unrouted component | Integration |
| `/api/v1/uploads/presign` | `POST` | S3 presigned URL for upload | Used directly without queue | Integration |
| `/api/v1/uploads/confirm` | `POST` | Mark upload confirmed in DB | Missing in Mobile UI | Integration |
| `/api/v1/notifications` | `GET` | List in-app notifications | Used in unrouted component | Integration |
| `/api/v1/notifications/unread-count` | `GET` | Badge count for notifications | Used in unrouted component | Integration |
| `/api/v1/notifications/:id/read` | `PATCH` | Mark notification read | Used in unrouted component | Integration |
| `/api/v1/notifications/read-all` | `POST` | Mark all read | Used in unrouted component | Integration |
| `/api/v1/notifications/preferences` | `GET`/`PUT` | Notification settings matrix | Missing in Mobile UI | Integration |
| `/api/v1/devices` | `POST` | Register push token | Missing in Mobile | Integration |
| `/api/v1/devices/:token` | `DELETE` | Unregister push token | Missing in Mobile | Integration |
| `/api/v1/locations/cities` | `GET` | Select city & operational zone | Missing in Mobile UI | Integration |
| `/api/v1/legal` | `GET` | List legal documents | Missing in Mobile UI | Integration |
| `/api/v1/legal/:type` | `GET` | Get terms/privacy document | Missing in Mobile UI | Integration |
| `/api/v1/help` | `GET` | List help articles | Missing in Mobile UI | Integration |
| `/api/v1/help/:id` | `GET` | Help article detail | Missing in Mobile UI | Integration |
| `/api/v1/driver/home` | `GET` | **NEW:** Aggregated home dashboard | **MISSING API & APP** | Step 10 Deliverable |
| `/api/v1/driver/capture-rules` | `GET` | **NEW:** Dynamic camera & GPS rules | **MISSING API & APP** | Step 10 Deliverable |
| `/api/v1/public/app-config` | `GET` | **NEW:** Min version & maintenance | **MISSING API & APP** | Step 10 Deliverable |

---

## 4. Dependency Audit

| Package Name | Purpose in Phase 12 | Status | Action Required |
|---|---|---|---|
| `expo-camera` | Real on-device camera capture for daily photos & installation | **MISSING** | Install with `npx expo install expo-camera` |
| `expo-location` | Precise GPS coordinates & mock-location detection | **MISSING** | Install with `npx expo install expo-location` |
| `expo-notifications` | Push notification registration, channels & badge | **MISSING** | Install with `npx expo install expo-notifications` |
| `expo-device` | Model, OS version, device name for hardware trust layer | **MISSING** | Install with `npx expo install expo-device` |
| `expo-application` | App version, build number for device trust layer | **MISSING** | Install with `npx expo install expo-application` |
| `expo-constants` | Runtime constants & EAS project info | Present (`~17.0.7`) | Keep |
| `expo-secure-store` | Encrypted storage for auth tokens and deviceInstallId | Present (`~14.0.1`) | Keep |
| `expo-file-system` | Durable local file storage for offline queue & poster download | **MISSING** | Install with `npx expo install expo-file-system` |
| `expo-sharing` | Share downloaded poster PDF/image with digital print shops | **MISSING** | Install with `npx expo install expo-sharing` |
| `expo-image-manipulator` | Resize & compress images before upload (1600px, 80% JPEG) | Present (`~13.0.6`) | Keep |
| `expo-image-picker` | Gallery picker for KYC documents & dispute evidence ONLY | Present (`~16.0.6`) | Keep |
| `expo-image` | High-performance cached image renderer for lists | **MISSING** | Install with `npx expo install expo-image` |
| `expo-font` | Load offline bundled Noto Sans Devanagari & Gujarati fonts | **MISSING** | Install with `npx expo install expo-font` |
| `expo-localization` | Device language detection | Present (`~16.0.1`) | Keep |
| `expo-build-properties` | Configure cleartext traffic only in development profile | **MISSING** | Install with `npx expo install expo-build-properties` |
| `expo-screen-capture` | Prevent screenshots on sensitive KYC & bank screens | **MISSING** | Install with `npx expo install expo-screen-capture` |
| `@react-native-community/netinfo` | Connectivity listener for offline banner & queue trigger | **MISSING** | Install with `npx expo install @react-native-community/netinfo` |
| `@react-native-async-storage/async-storage` | Persist queue state & React Query cache | Present (`1.23.1`) | Keep |
| `@shopify/flash-list` | 60 FPS scrolling for campaigns & transaction lists on low-end phones | **MISSING** | Install with `npm install @shopify/flash-list` |
| `@tanstack/query-async-storage-persister` | TanStack Query offline persistence | **MISSING** | Install with `npm install @tanstack/query-async-storage-persister @tanstack/react-query-persist-client` |
| `react-native-gesture-handler` | Smooth gesture handling for modals & image pinch zoom | **MISSING** | Install with `npx expo install react-native-gesture-handler` |
| `react-native-reanimated` | Declarative animations for bottom sheets & banners | **MISSING** | Install with `npx expo install react-native-reanimated` |

---

## 5. Inconsistencies & Prioritized Fix Plan

1. **Step 1: Native Foundation & Development Build Setup**
   - Install all missing native packages via `npx expo install`.
   - Update `app.config.ts` with required Android permissions (`CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`), plugin configs, scheme, and development profile cleartext rules.
   - Configure `eas.json` profiles (`development`, `preview`, `production`) and `.env.example`.
2. **Step 2: Complete Navigation, Auth Gating & Deep Links**
   - Route all orphaned screens (`assignments`, `installation`, `daily-photo`, `discipline`, `disputes`, `notifications`, `kyc`, `help`, `legal`, `consent-gate`, `maintenance`, `update-required`).
   - Implement `resolveEntryRoute(me, appConfig)` to cleanly direct drivers based on account status (`PENDING`, `NEED_MORE_INFO`, `REJECTED`, `APPROVED`, `SUSPENDED`, `BLOCKED`).
   - Build robust deep link mapping from notification payloads to screens.
3. **Step 3: Driver KYC Onboarding Wizard**
   - Build 5-step wizard: Personal details, Vehicle details (with BH plate normalizer), Documents (Camera/Gallery with `expo-image-manipulator`), Payout details (UPI/IFSC), and Consents.
   - Server-side draft sync via `PUT /api/v1/driver/profile`, `PUT /vehicle`, `POST /documents`.
   - Dedicated status screens for Under Review, Need More Info (jump to step), Rejected, and Approved.
4. **Step 4: Real Camera, GPS, Time & Device Trust Layer (`src/services/capture`)**
   - Live-only camera screen with alignment overlay and shutter timestamp.
   - Precise GPS fix with accuracy threshold wait and OS-reported `isMockLocation`.
   - Device hardware identification and `deviceInstallId` via SecureStore.
   - Server clock offset calculation (`Date` response header) and skew warnings.
   - Complete removal of all simulated capture code and verification with a guard test.
5. **Step 5: Resumable Offline Upload Queue (`src/offline`)**
   - Durable queue in AsyncStorage / SQLite with state machine: `QUEUED` -> `UPLOADING` -> `CONFIRMING` -> `SUBMITTING` -> `DONE`.
   - Resume from checkpoints on app restart or network restoration.
   - Automatic idempotency key headers.
6. **Step 6: Driver Screens Completion**
   - Implement all 11 core screens with light and dark theme support, skeleton loaders, and error states.
7. **Step 7: Push Notifications**
   - Rationale screen, Expo push token registration with `POST /api/v1/devices`, Android notification channels (`urgent`, `reminders`, `money`, `normal`), and cold-start/foreground handling.
8. **Step 8: Performance & Resilience for Low-End Android**
   - Token storage in SecureStore, TanStack Query persistence for offline data viewing, Hermes engine verification, bundle size measurement.
9. **Step 9: Complete Translations (en, hi, gu) & Typography**
   - Bundle Noto Sans Devanagari and Gujarati fonts.
   - Zero hardcoded text (`i18next/no-literal-string` enforced with 0 warnings).
10. **Step 10: API Additions & Idempotency**
    - Implement `GET /api/v1/driver/home`, `GET /api/v1/driver/capture-rules`, `GET /api/v1/public/app-config`.
    - Enforce `Idempotency-Key` headers on submits.
11. **Step 11: Demo Data in Supabase `public` Schema**
    - Seed realistic demo drivers across every assignment and KYC status with valid stored assets.
12. **Step 12: Comprehensive Tests & Real-Device Test Plan**
    - Unit, component, and full driver journey integration test.
    - Generate `api/docs/MOBILE_TEST_PLAN.md`.
13. **Step 13: Build & Release Readiness**
    - Create `api/docs/MOBILE_RELEASE.md` with Google Play store checklist and data safety declarations.
14. **Step 14: Documentation**
    - Create `api/docs/MOBILE_APP.md` with full architecture, diagrams, and driver guides in English, Hindi, and Gujarati.

