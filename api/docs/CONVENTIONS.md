# Coding Standards & Conventions

## 1. Feature Folder Architecture Pattern
Every backend and frontend module follows a strict architectural separation:
```
module-name/
├── routes.ts         # HTTP router bindings, middleware registration
├── controller.ts     # Request parsing, HTTP response envelopes
├── service.ts        # Pure business logic and domain assertions
├── repository.ts     # Data access layer (Prisma queries, SQL, Redis)
├── validation.ts     # Zod request / query / params schemas
├── types.ts          # Domain models and DTO interfaces
└── __tests__/        # Unit and integration test suites
```

### Invariants:
1. **Controllers have NO business logic**. They parse input with Zod, invoke services, and respond with the standard envelope.
2. **Repositories hold ALL database queries**. Services never call `prisma.*` directly.
3. **Money changes only through a ledger**. In Phase 2+, direct balance mutations are forbidden; all financial transactions require immutable double-entry ledger entries.

## 2. Internationalization (i18n) Rules
- **Key Naming Convention**: `namespace:feature.section.meaning` (e.g. `settings:themeLight`, `common:dashboard`).
- **No Hardcoded Strings in JSX**:
  All user-facing text must be rendered through `t('...')`.
  `eslint-plugin-i18next` enforces this with warnings during lint checks.
- **Language Switcher Labels**: Language names must always appear in their native script:
  - English -> "English"
  - Hindi -> "हिन्दी"
  - Gujarati -> "ગુજરાતી"

## 3. Styling & Token Rules
- **No Raw Hex Values in UI**:
  Components must only use semantic color classes (e.g., `text-primary`, `bg-surface`, `border-border`, `text-danger`).
- **Logical CSS Properties**:
  Use `margin-inline-start`, `padding-inline-end`, `border-e`, `border-s` to support future RTL language expansion.
- **Contrast Ratios**:
  All text and background pairs must maintain >= 4.5:1 WCAG AA contrast ratio.

## 4. API Versioning & Error Envelopes
- All API routes are prefixed under `/api/v1/`.
- Success responses strictly format as:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { ... }
  }
  ```
- Error responses strictly format as:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human readable summary",
      "details": { ... }
    }
  }
  ```
- No stack traces or internal infrastructure errors are exposed in production.

## 5. Database Conventions & Standards
- **Naming Conventions**:
  - Tables and database columns are strictly `snake_case` in PostgreSQL, mapped using Prisma `@map` and `@@map`.
  - Prisma models and client properties are strictly `PascalCase` and `camelCase`.
  - Primary keys are UUID v4 strings.
  - Mutable entities include `createdAt` (`created_at`) and `updatedAt` (`updated_at`). Immutable append-only records (ledger transactions, ledger entries, audit logs) omit `updatedAt`.
- **Soft Delete Policy**:
  - Soft deletion via `deletedAt` (`deleted_at`) is **strictly isolated to `User` and `Campaign`**.
  - All other entities (vehicles, documents, assignments, photos, payouts, ledger accounts) are permanent.
  - Active record queries must filter with `notDeletedClause()` or `deletedAt: null`.
- **Money & Financial Rules**:
  - Floating point numbers are **strictly forbidden** for monetary figures.
  - All amounts are stored and calculated as **integer paise** (100 paise = 1 INR).
  - Per-unit configuration fields (rates, allowances) use `Int`; all balances, payments, payouts, and ledger entries use `BigInt`.
  - `BigInt` values are serialized safely as strings via `apps/api/src/shared/money` JSON serialization.
  - Campaign pricing and rent calculations use pure functions with half-up rounding.
- **Audit Logging Rule**:
  - Sensitive fields (passwords, PINs, tokens, encryption keys, raw bank details, UPI handles) must be redacted before recording into `audit_logs`.
  - Audit logs record shallow diffs (`oldValues` and `newValues`) and are append-only.

## 6. Authentication & Authorization Conventions
- **Secrets & Token Handling**:
  - Raw passwords, plaintext OTPs, and refresh tokens are **strictly forbidden from appearing in logs**.
  - All passwords must be hashed using Argon2id (`apps/api/src/modules/auth/password.service.ts`).
  - Refresh tokens are hashed with SHA-256 before database lookup.
- **Route Authorization Pipeline**:
  - Global middleware `authenticate` parses Bearer access tokens, validates active session in DB, and populates `req.user`, `req.session`, and `req.permissions`.
  - Global middleware `blockSuspendedWrites()` automatically rejects `POST`, `PUT`, `PATCH`, `DELETE` with HTTP 403 `ACCOUNT_SUSPENDED` if `req.user.status === 'SUSPENDED'`.
  - Prefix role guards strictly enforce role boundaries:
    - `/api/v1/company/*` -> `requireRole(ROLES.COMPANY)`
    - `/api/v1/admin/*` -> `requireRole(ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE)`
    - `/api/v1/driver/*` -> `requireRole(ROLES.DRIVER)`
  - Feature access requiring verified status must use `requireApproved()`.
  - Granular administrative capabilities use `requirePermission('permission.key')`.
- **Client Refresh Invariant**:
  - Front-end API clients (`@ap/api-client`) must employ single-flight refresh token locking. Concurrent 401s must wait on the primary refresh operation and replay with the new token.

## 7. Campaign & Scheduling Conventions
- **Dates vs Timestamps**:
  - `startDate` and `endDate` are Indian Standard Time (`Asia/Kolkata`) calendar date boundaries. Never apply UTC timezone conversion to start/end calendar dates.
  - All audit times (`liveAt`, `approvedAt`, `createdAt`, `updatedAt`) are UTC ISO 8601 timestamps.
- **Campaign Pricing**:
  - Never recalculate campaign pricing inline; always call `calculateCampaignPricing` from `@ap/shared-constants`.
- **Slot Allocation Concurrency**:
  - Drivers enrolling into a campaign MUST use row-level pessimistic locking (`SELECT FOR UPDATE`) via `SlotsService.reserveSlot`.

## 8. Discipline, Disputes & Notification Conventions (Phase 9)
- **Driver PII Masking**:
  - Companies must NEVER receive driver personal information (full name, phone number, vehicle registration number). Controllers and repositories must mask driver details as `Driver #<shortId>` or `Auto #<shortPlate>`.
- **Dispute Thread Visibility**:
  - All dispute messages and evidence must respect the `visibility` attribute (`ALL` vs `ADMIN_ONLY`). Internal moderator notes must never leak to drivers or advertisers.
- **Single Entry Point for Notifications**:
  - All transactional, disciplinary, and marketing alerts must be dispatched through `NotificationsService.notify()` using keys declared in `NotificationRegistry`.
- **Mandatory Notification Categories**:
  - `DISCIPLINE` and critical `SYSTEM` notifications have `isMandatory: true` and cannot be opted out of by users.
- **Quiet Hours Invariant**:
  - Notifications dispatchers must evaluate IST quiet hours (22:00 to 07:00 IST). Non-urgent messages must not fire noisy push or SMS alerts during this window.




