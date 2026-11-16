# Authentication OTP Simplification & Safety Toggle

This document details the configuration, behavior matrix, production guardrails, and reversion playbook for the `AUTH_OTP_ENABLED` toggle introduced in AG-1.

---

## 1. Overview & Rationale

In development, staging, and automated test environments, requiring SMS/Email OTPs for every login, registration, and step-up action introduces significant testing friction, external SMS gateway dependency (MSG91/Twilio costs & rate limits), and flaky network timeouts.

The `AUTH_OTP_ENABLED` environment variable allows the platform to run in a streamlined, password-backed mode during development while strictly guaranteeing that production environments enforce complete OTP verification.

---

## 2. Configuration & Guardrails

### Environment Variable
Defined in `api/.env`:
```env
AUTH_OTP_ENABLED=false
```

### Safety Invariants
1. **Production Boot Refusal**:
   If `NODE_ENV === 'production'` and `AUTH_OTP_ENABLED !== 'true'`, the API server refuses to start and immediately terminates with exit code 1:
   ```ts
   if (env.NODE_ENV === 'production' && !env.AUTH_OTP_ENABLED) {
     throw new Error('FATAL: AUTH_OTP_ENABLED cannot be false in production environments');
   }
   ```
2. **Pilot Readiness Check**:
   `npm run pilot:readiness-check` asserts that `AUTH_OTP_ENABLED === true` prior to any deployment authorization.
3. **Environment Ribbon Warning**:
   When `AUTH_OTP_ENABLED=false`, the Web Portal displays an amber warning ribbon:
   *"⚠️ Testing Mode: OTP is DISABLED. Passwords accepted for Driver & 1-step Admin auth."*
4. **App Config Discovery**:
   The public endpoint `GET /api/v1/public/app-config` publishes:
   ```json
   {
     "auth": {
       "otpEnabled": false,
       "passwordLogin": true
     }
   }
   ```
   Both the React Web App and React Native Mobile App dynamically adjust their forms based on this configuration.

---

## 3. Endpoint Behavior Matrix

| Flow / Endpoint | `AUTH_OTP_ENABLED=true` (Production) | `AUTH_OTP_ENABLED=false` (Dev / Test) |
| :--- | :--- | :--- |
| **Driver OTP Request** (`POST /api/v1/auth/driver/otp/request`) | Sends 6-digit SMS OTP via gateway | Throws `400 Bad Request` (`OTP_DISABLED`) |
| **Driver OTP Verify** (`POST /api/v1/auth/driver/otp/verify`) | Verifies SMS code and issues session | Throws `400 Bad Request` (`OTP_DISABLED`) |
| **Driver Password Register** (`POST /api/v1/auth/driver/register`) | Disabled / rejects | Creates new Driver user & profile with hashed password |
| **Driver Password Login** (`POST /api/v1/auth/driver/login`) | Disabled / rejects | Authenticates mobile + password with rate limiting |
| **Company Register** (`POST /api/v1/auth/company/register`) | Sets user to `PENDING` (needs OTP) | Sets user to `APPROVED` & auto-verifies mobile/email |
| **Company Verify Mobile** (`POST /api/v1/auth/company/verify-mobile`) | Verifies SMS OTP | Throws `400 Bad Request` (`OTP_DISABLED`) |
| **Admin Login Step 1** (`POST /api/v1/auth/admin/login`) | Returns `{ step: 2, mfaToken }` | Returns `{ accessToken, refreshToken, user }` (1-step login) |
| **Admin Login Step 2** (`POST /api/v1/auth/admin/login/step2`) | Verifies TOTP or SMS OTP | Throws `400 Bad Request` (`OTP_DISABLED`) |
| **Step-Up Verification** (`POST /api/v1/admin/step-up/verify`) | Verifies SMS/Email OTP code | Re-authenticates using user's password |
| **Admin Reset User Password** (`POST /api/v1/admin/users/:id/reset-password`) | Admin generates temporary password for user | Admin generates temporary password for user |

---

## 4. Reversion & Production Cutover Playbook

When transitioning to staging with real SMS or cutting over to production:

1. **Update Environment**:
   In `api/.env`:
   ```env
   AUTH_OTP_ENABLED=true
   ```
2. **Restart API Service**:
   ```bash
   cd api && npm run build && npm run start
   ```
3. **Verify App Config**:
   ```bash
   curl http://localhost:4000/api/v1/public/app-config
   ```
   Confirm `auth.otpEnabled` returns `true`.
4. **Run Pilot Readiness Check**:
   ```bash
   cd api && npm run pilot:readiness-check
   ```
   The check must pass with 0 warnings.
5. **Driver Compatibility**:
   Existing drivers created with passwords can seamlessly continue to log in via SMS OTP; their phone numbers remain unchanged and valid.

