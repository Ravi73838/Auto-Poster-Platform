# Predictable Test Accounts (AG-1 Specification)

This document establishes the canonical test accounts for local development, automated integration testing, and manual QA across the Auto Poster Advertising Platform.

---

## 1. Testing Modes Overview

| Feature | `AUTH_OTP_ENABLED=false` (Default Dev/Staging) | `AUTH_OTP_ENABLED=true` (Production Enforced) |
| :--- | :--- | :--- |
| **Driver Auth** | Mobile + Password (`POST /api/v1/auth/driver/login` & `/register`) | Passwordless Mobile + 6-digit SMS OTP |
| **Company Auth** | Email + Password (auto-activates without mobile OTP) | Email + Password + Mobile OTP verification |
| **Admin Auth** | 1-step Email + Password login | 2-step Email/Password + TOTP/SMS Step 2 |
| **Step-Up Verification** | Account Password re-confirmation | SMS/Email OTP Challenge & Verify |
| **Password Reset** | Instant admin temporary password generation | Email/SMS OTP reset flow |

---

## 2. Standard Test Accounts Matrix

> [!NOTE]
> All passwords meet platform security constraints (minimum 8 characters, uppercase, lowercase, digit, and special symbol).

| Role | Identifier / Email | Mobile | Password | Account Status | Permissions / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `admin@autoposter.in` | `+919999999999` | `AdminPassword123!` | `APPROVED` | Full platform access, all 37 permissions |
| **MODERATOR** | `moderator@autoposter.in` | `+919888888888` | `ModeratorPassword123!` | `APPROVED` | Campaigns, photos, KYC, disputes, strikes |
| **FINANCE** | `finance@autoposter.in` | `+919777777777` | `FinancePassword123!` | `APPROVED` | Ledger, payouts, settlements, refunds |
| **COMPANY** | `demo.company@autoposter.in` | `+919666666666` | `CompanyPassword123!` | `APPROVED` | AdVantage Media Pvt Ltd (Campaigns & Escrow) |
| **DRIVER (Approved)** | N/A | `+919555555555` | `DriverPassword123!` | `APPROVED` | GJ01AA1234 (Active KYC, can accept campaigns) |
| **DRIVER (Pending)** | N/A | `+919444444444` | `DriverPassword123!` | `PENDING` | Pending KYC verification flow |

---

## 3. Account Reset & Provisioning

### In Automated Integration Tests
Integration tests run in the isolated Supabase `test` schema. Each test suite or worker initializes fresh test accounts using test fixtures (`createTestUser`, `createTestDriver`, etc.) and tears them down without polluting development records.

### In Local Development Walkthrough (`public` Schema)
The initial super admin is seeded automatically via:
```bash
cd api && npm run db:seed:base
```
Additional test accounts can be registered via the API or Web/Mobile interfaces in seconds when `AUTH_OTP_ENABLED=false`.

If an admin needs to reset any team member or user password during development:
```http
POST /api/v1/admin/users/:userId/reset-password
Authorization: Bearer <SUPER_ADMIN_TOKEN>
```
Response returns a temporary random password (e.g. `Temp-Abc123xyz!`) and flags the account for `mustChangePassword: true`.
