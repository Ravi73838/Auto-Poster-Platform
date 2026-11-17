# Auto Poster Platform - Driver Mobile Screen Inventory (AG-5)

**Platform:** React Native (Expo SDK 52)  
**Target User Role:** `DRIVER`  
**Authentication Modes:** Password authentication (`AUTH_OTP_ENABLED=false`) & SMS OTP mode (`AUTH_OTP_ENABLED=true`)

---

## 1. Master Screen & State Matrix

| Screen Route | Component | Auth & Gating | API Endpoints | Native Modules Used | Forms / Primary Actions | States Handled | i18n Namespaces | AdSlot Policy |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| `/(public)/language` | `LanguageSelectScreen` | Public / Settings | Local storage only | `expo-localization`, `expo-secure-store` | Select language (English, Hindi, Gujarati) | Ready | `auth`, `common` | **FORBIDDEN** |
| `/(public)/login` | `MobileInputScreen` | Public (Unauthenticated) | `POST /auth/driver/login`<br/>`POST /auth/driver/register`<br/>`POST /auth/driver/otp/request`<br/>`GET /config` | `expo-secure-store`, NetInfo | Mobile input, Password input, Sign in / Register submit, Switch to OTP | Loading, Error, Validation, Offline, OTP Disabled banner | `auth`, `common`, `errors` | **FORBIDDEN** |
| `/(public)/otp-verify` | `OtpVerifyScreen` | Public (OTP flow) | `POST /auth/driver/otp/verify`<br/>`POST /auth/driver/otp/resend` | `expo-secure-store` | 6-digit OTP input, Resend timer, Verify submit | Loading, Error, Resend cooldown | `auth`, `common`, `errors` | **FORBIDDEN** |
| `/(public)/maintenance` | `MaintenanceScreen` | Public (Maintenance active) | `GET /config` | None | Refresh config, Contact support callback | Locked maintenance | `common` | **FORBIDDEN** |
| `/(public)/update-required` | `UpdateRequiredScreen` | Public (Version < minVersion) | `GET /config` | `expo-application`, Linking | Open Play Store update link | Locked update gate | `common` | **FORBIDDEN** |
| `/consent-gate` | `ConsentGateScreen` | Auth (`pendingConsents > 0`) | `GET /legal/documents/pending`<br/>`POST /legal/consent` | `expo-secure-store` | Read policy, Check consent, Accept terms | Loading, Error, Mandatory gate | `legal`, `common` | **FORBIDDEN** |
| `/blocked` | `BlockedAccountScreen` | Auth (`status = BLOCKED`) | `GET /drivers/me/discipline` | None | View block reason, File appeal dispute | Locked account | `discipline`, `common` | **FORBIDDEN** |
| `/(onboarding)/wizard` | `KycWizardScreen` | Auth (`status = PENDING \| NEED_MORE_INFO`) | `POST /drivers/kyc`<br/>`POST /uploads/presign`<br/>`POST /uploads/confirm` | `expo-image-picker`, `expo-screen-capture` | 6-step form: Personal, Vehicle, Documents, Payout, Consents, Submit | Step progress, Validation, Uploading, Error | `kyc`, `common`, `validation` | **FORBIDDEN** |
| `/(onboarding)/status` | `KycStatusScreen` | Auth (`status = PENDING \| REJECTED`) | `GET /drivers/me/kyc-status` | None | Refresh status, Re-edit rejected documents | Pending review, Rejected, Need more info | `kyc`, `common` | **FORBIDDEN** |
| `/(tabs)/` (Home) | `DriverStatusHomeScreen` | Auth (`status = APPROVED \| SUSPENDED`) | `GET /drivers/me`<br/>`GET /assignments/my` | None | Navigate to today's task, Open settings, View status badge | Ready, Suspended banner, Empty assignments | `status`, `common` | **ALLOWED** (Bottom banner) |
| `/(tabs)/campaigns` | `CampaignsScreen` | Auth (`APPROVED \| SUSPENDED`) | `GET /campaigns/driver` | None | Browse campaigns, Sort by rent/urgency, Tap campaign card | Loading, Empty, Error, Pull-to-refresh, Banned banner | `campaigns`, `common` | **ALLOWED** (Inline card) |
| `/campaigns/[id]` | `CampaignDetailScreen` | Auth (`APPROVED \| SUSPENDED`) | `GET /campaigns/driver/:id`<br/>`POST /assignments/select` | Linking | View poster artwork, Reserve advertising slot (48h lock) | Loading, Error, Slot full, Vehicle busy, Reserved | `campaigns`, `common` | **FORBIDDEN** |
| `/assignments` | `DriverAssignmentsScreen` | Auth (`APPROVED \| SUSPENDED`) | `GET /assignments/my`<br/>`POST /assignments/:id/withdraw` | None | View active & past contracts, Release slot, Open installation | Loading, Empty, Error, Withdrawn | `assignments`, `common` | **FORBIDDEN** |
| `/assignments/[id]/install` | `InstallationUploadScreen` | Auth (`APPROVED \| SUSPENDED`) | `GET /assignments/:id`<br/>`GET /assignments/:id/print-guide`<br/>`POST /installations/submit` | `expo-file-system`, `expo-sharing`, `expo-camera` | Download poster PDF, View print checklist, Submit installation photo | Loading, Downloading, Photo captured, Submitting | `installation`, `common` | **FORBIDDEN** |
| `/assignments/[id]/daily-camera` | `DailyPhotoCaptureScreen` | Auth (`APPROVED`) | `GET /assignments/:id/today`<br/>`GET /daily-photos/capture-rules`<br/>`POST /daily-photos/submit` | `expo-camera`, `expo-location`, `expo-device` | Live camera preview, GPS accuracy verification, Daily photo submission | Live camera, GPS acquiring, Past cutoff, Submitted | `dailyPhoto`, `common` | **FORBIDDEN** |
| `/(tabs)/wallet` | `DriverWalletScreen` | Auth (`APPROVED \| SUSPENDED`) | `GET /wallet/driver/balance`<br/>`GET /wallet/driver/statement`<br/>`POST /wallet/driver/withdraw` | `expo-screen-capture` | View escrow/earned balance, Filter statement, Request withdrawal | Loading, Empty, Withdraw modal, Cooldown | `wallet`, `common` | **FORBIDDEN** |
| `/discipline` | `DriverDisciplineScreen` | Auth (`ANY`) | `GET /discipline/driver/me`<br/>`GET /discipline/driver/rules` | None | Strike meter (0/3), View active strikes, Read rules, Appeal dispute | Clean (0), Warning (1-2), Banned (3+) | `discipline`, `common` | **FORBIDDEN** |
| `/disputes` | `DriverDisputesScreen` | Auth (`ANY`) | `GET /disputes`<br/>`POST /disputes`<br/>`POST /disputes/:id/messages` | `expo-image-picker` | List disputes, Conversation thread, File new dispute modal, Appeal | Loading, Empty, Chat thread, Resolved | `disputes`, `common` | **FORBIDDEN** |
| `/(tabs)/notifications` | `NotificationsScreen` | Auth (`ANY`) | `GET /notifications`<br/>`POST /notifications/:id/read` | `expo-notifications` | View notification list, Tap deep link, Mark all read | Loading, Empty, Unread badge | `notifications`, `common` | **ALLOWED** |
| `/(tabs)/profile` | `DriverSettingsScreen` | Auth (`ANY`) | `GET /auth/sessions`<br/>`DELETE /auth/sessions/:id`<br/>`POST /auth/logout` | `expo-secure-store` | Change language, Toggle theme, Revoke other sessions, Log out | Loading sessions, Logged out | `settings`, `common` | **FORBIDDEN** |
| `/upload-queue` | `UploadQueueScreen` | Auth (`ANY`) | Local queue + API uploads | `expo-file-system`, NetInfo | View pending uploads, Retry failed items, Clear finished | Idle, Syncing, Retry backoff | `common` | **FORBIDDEN** |

---

## 2. Gating & Redirection Logic (`resolveEntryRoute`)

1. **Maintenance Active** ➔ `/(public)/maintenance`
2. **Hard Version Update Required** ➔ `/(public)/update-required`
3. **First Launch (No Language Chosen)** ➔ `/(public)/language`
4. **Unauthenticated** ➔ `/(public)/login`
5. **Account Status = `BLOCKED`** ➔ `/blocked`
6. **Pending Legal Consents > 0** ➔ `/consent-gate`
7. **Role != `DRIVER`** ➔ Redirect to login
8. **Account Status = `PENDING` & KYC Submitted** ➔ `/(onboarding)/status`
9. **Account Status = `PENDING` & KYC Not Submitted** ➔ `/(onboarding)/wizard`
10. **Account Status = `NEED_MORE_INFO`** ➔ `/(onboarding)/wizard`
11. **Account Status = `REJECTED`** ➔ `/(onboarding)/status`
12. **Account Status = `APPROVED` or `SUSPENDED`** ➔ `/(tabs)`

---

## 3. AdMob Placement Rule Enforcement

* **Strictly Prohibited Screens**: Camera (`daily-camera`, `install`), KYC wizard, Banking/Payout/Withdraw screens, Login/Register, Consent Gate, Disputes, Discipline.
* **Permitted Screens**: `/(tabs)/` Home Dashboard, `/(tabs)/campaigns` browse list, `/(tabs)/notifications`.
* **Testing AdMob Unit IDs**: All non-production environments must use Google's official test ad unit IDs (`ca-app-pub-3940256099942544/...`).
