# Architectural Decision Records (ADRs)

## ADR-001: Monorepo Package Manager & Metro Hoisting (Superseded by ADR-031)
- **Decision**: Use `pnpm` workspaces with `node-linker=hoisted` in `.npmrc`.
- **Context**: Expo / React Native Metro bundler expects dependencies to be discoverable in flat `node_modules` and struggles with symlinks in pnpm's default symlink-based isolated node_modules structure.
- **Consequences**: Enables zero-friction React Native compilation while retaining pnpm's fast downloads and Turborepo workspace orchestration. *(Superseded by ADR-031: migrated to 3 independent npm projects with contract sync).*

## ADR-002: TypeScript Compiler Strictness Configuration
- **Decision**: Enable `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `forceConsistentCasingInFileNames: true`, and `skipLibCheck: true`. Set `exactOptionalPropertyTypes: false`.
- **Context**: `exactOptionalPropertyTypes: true` creates excessive friction when dealing with React component prop interfaces (e.g. `children?: ReactNode` with `undefined`) and Express standard typings.
- **Consequences**: Rock-solid strict types across the whole codebase without library typing incompatibilities.

## ADR-003: Single Web App with Dual Lazy-Loaded Portals
- **Decision**: Host both Advertiser (Company) and Administrator portals in `web` under a unified Vite setup with `React.lazy()` route splitting.
- **Context**: Reduces operational overhead and simplifies deployment while keeping the portals isolated at the bundle and code boundary levels.
- **Consequences**: Vite splits `CompanyPortalRoutes` and `AdminPortalRoutes` into distinct chunks. Portal boundary violations are banned via ESLint rules.

## ADR-004: Centralized Internationalization Strategy
- **Decision**: Preload translation resources in `@ap/shared-i18n` with type-safe namespaces for `common`, `auth`, `errors`, `status`, and `settings`.
- **Context**: The product requires immediate day-one multi-lingual capabilities across English, Hindi, and Gujarati for drivers, companies, and staff.
- **Consequences**: API error codes are decoupled from presentation strings; clients map error codes to user-friendly translated text.

## ADR-005: Theme Token Contrast Verification
- **Decision**: Unit-test color token contrast ratios (WCAG AA >= 4.5:1) in `@ap/design-tokens` via Vitest.
- **Context**: Driver visibility in direct sunlight and dark environments requires strict contrast guarantees.
- **Consequences**: Prevents regressions in accessibility when styling themes.

## ADR-006: Monetary Representation as Integer Paise with BigInt for Totals
- **Decision**: Represent all currency figures as integer paise ($1\text{ INR} = 100\text{ paise}$). Store cumulative amounts, transactions, and balances as PostgreSQL `BIGINT`, with per-unit rates stored as `INT`.
- **Context**: Floating-point representations introduce rounding drift and precision anomalies in multi-party financial workflows (campaign budgets, driver payouts, platform commission, GST calculations).
- **Consequences**: Complete precision safety. JavaScript handles totals via native `bigint`. A global `BigInt.prototype.toJSON` serializer formats BigInt values as strings over the JSON wire.

## ADR-007: Append-Only Double-Entry Ledger with Deferrable Balance Checks
- **Decision**: Disallow direct mutations on wallet and escrow balances. All money movements require paired `DEBIT` and `CREDIT` entries in `ledger_entries` under a `ledger_transactions` header.
- **Context**: Financial integrity, regulatory auditing, and fraud prevention require verifiable proof of every balance transition.
- **Consequences**: Balances are calculated through ledger journals. Deferrable PostgreSQL constraint triggers guarantee `sum(debit) == sum(credit)` on commit, and account balances are protected against illegal overdrafts.

## ADR-008: Selective Soft Delete Policy (User & Campaign Only)
- **Decision**: Restrict soft deletion (`deleted_at`) strictly to `User` and `Campaign` models. All other operational tables (photos, assignments, vehicles, documents, ledger transactions) are permanent.
- **Context**: Overusing soft delete across relational databases introduces query overhead, composite foreign key complexity, and data integrity leaks.
- **Consequences**: Driver audit records, photo verifications, and financial transactions are never accidentally orphaned or hidden by cascade deletions.

## ADR-009: Database-Level Immutability and Business Invariant Enforcement
- **Decision**: Augment Prisma migrations with custom raw-SQL CHECK constraints, partial unique indexes, and PostgreSQL append-only triggers.
- **Context**: Application code bugs or rogue scripts could violate business rules (such as assigning two campaigns to one vehicle simultaneously or updating settled ledger transactions).
- **Consequences**: PostgreSQL enforces single active assignments per vehicle, single verified photos per assignment per day, positive non-zero amounts, and immutability of audit and ledger rows directly at the engine level.

## ADR-010: Versioned Envelope Symmetric Encryption for PII and Banking Data
- **Decision**: Encrypt driver bank account numbers, IFSC codes, and sensitive payout credentials using AES-256-GCM with a versioned envelope (`v1:iv:authTag:ciphertext`).
- **Context**: Compliance with Indian data protection standards and prevention of credential leakage in database dumps.
- **Consequences**: Compromised database snapshots cannot expose sensitive bank account numbers. Key rotation is supported through the version prefix.

## ADR-011: Strict Enum Parity Between Prisma Schema and Shared Constants
- **Decision**: Synchronize all database enums with `@ap/shared-constants` using a comprehensive CI test (`api/src/__tests__/enums-sync.test.ts`).
- **Context**: Drift between database enums and client-side TypeScript types causes runtime validation errors and query failures.
- **Consequences**: Changes to statuses, roles, or document types require intentional updates across both layers and fail CI immediately upon drift.

## ADR-012: Argon2id over bcrypt for Password Hashing
- **Decision**: Standardize on `argon2` (Argon2id variant) with 64 MB memory cost, 3 iterations, and 1 parallelism thread.
- **Context**: bcrypt is vulnerable to GPU-accelerated side-channel and parallel cracking attacks. Argon2id won the Password Hashing Competition (PHC) and provides state-of-the-art resistance to GPU/ASIC hardware attacks and memory-hard tradeoffs.
- **Consequences**: Password hashing uses slightly more memory (~64 MB per hash), but guarantees maximum defense against brute-force attacks.

## ADR-013: jose over jsonwebtoken for JWT Signing & Verification
- **Decision**: Adopt the modern `jose` library for JWT handling instead of legacy `jsonwebtoken`.
- **Context**: `jsonwebtoken` relies on legacy Node.js cryptographic wrappers, has unmaintained callback-heavy patterns, and does not natively align with standard Web Crypto API and modern ESM runtimes. `jose` is universal, lightweight, fully typed, and secure by default.
- **Consequences**: Zero-dependency ESM-native JWT handling across the backend and future edge or worker environments.

## ADR-014: Stateful Session Management with Database-Backed Revocation
- **Decision**: Issue short-lived access JWTs (15-minute TTL) coupled with stateful database `sessions` records checked at the API gateway layer.
- **Context**: Pure stateless JWTs cannot be revoked instantly if an account is compromised, a role changes, or an employee is terminated. Storing sessions with `revokedAt` timestamps provides immediate global kill-switch capability while keeping token verification fast.
- **Consequences**: Instant session revocation on user logout, account suspension, or password change, with minimal database read overhead cached in memory or touched on access.

## ADR-015: Sliding-Window Single-Use Refresh Token Rotation with Reuse Detection
- **Decision**: Rotate refresh tokens on every refresh invocation. Store only the SHA-256 hash in the database alongside `previousTokenHash`. If an old rotated token is presented again, immediately revoke the entire session family for that user.
- **Context**: Detects stolen token replay attacks where a refresh token has been intercepted and used concurrently by an attacker.
- **Consequences**: Immediate containment of compromised tokens; an attacker or victim attempting a second refresh instantly triggers security revocation.

## ADR-016: 2-Step Admin Login via SMS OTP vs. TOTP Authenticator App
- **Decision**: Implement SMS OTP as the first mandatory 2-step verification factor for administrator logins, with future extensibility for TOTP apps.
- **Context**: Internal admin staff operating on the ground and across regional offices require rapid zero-onboarding 2FA that integrates seamlessly with existing corporate SIM cards and carrier DLT sender registrations without requiring manual authenticator app QR setup during initial deployment.
- **Consequences**: Immediate 2-step protection on all admin accounts from launch day, leveraging the existing carrier DLT SMS infrastructure.

## ADR-017: Constant-Time Dummy Verification for Anti-Enumeration Protection
- **Decision**: Execute a dummy Argon2id verification with pre-computed hash parameters when an email address is not found in the database during login.
- **Context**: Attackers measure response times to enumerate registered accounts on the platform (if non-existent email returns in 2ms while existent email returns in 150ms).
- **Consequences**: All password login attempts consume equivalent CPU time regardless of account existence, preventing timing-based account harvesting.

## ADR-018: Campaign Pricing Model and Paise Monetary Integrity
- **Decision**: Store all campaign monetary rates and budget totals in integer paise (`BigInt` for cumulative amounts, `Int` for 30-day unit rates). Platform commission is calculated exclusively on rent, never on the driver's printing allowance.
- **Context**: Floating point math introduces rounding drift that corrupts escrow balances and ledger entries. Printing allowance is a direct pass-through reimbursement for driver expenses and should not be subject to marketplace commission.
- **Consequences**: Complete mathematical consistency across API, web wizard, mobile earnings breakdown, and financial ledger. Zero floating point roundoff errors.

## ADR-019: IST Calendar Day Boundaries for Campaign Dates
- **Decision**: Treat `startDate` and `endDate` as Indian Standard Time (`Asia/Kolkata`) calendar dates (00:00:00 to 23:59:59 IST), while storing all timestamps in UTC.
- **Context**: Auto-rickshaws operate on Indian local calendar days. A campaign scheduled from Nov 5 to Nov 20 must start at midnight IST on Nov 5 and end at midnight IST on Nov 20, regardless of the UTC offset of the server or client browser.
- **Consequences**: Eliminates off-by-one calendar errors and midnight boundary discrepancies between company dashboards and driver app schedules.

## ADR-020: Pessimistic Row Locking for Campaign Slot Allocation
- **Decision**: Use PostgreSQL `SELECT FOR UPDATE` inside an atomic transaction when drivers claim campaign slots via `SlotsService`.
- **Context**: When high-paying campaigns go live, hundreds of drivers simultaneously race to enroll. Optimistic locking or non-locking queries lead to severe overbooking beyond the client's purchased slot count.
- **Consequences**: Strict serializability of slot increments; guaranteed 0 overbooking even during massive concurrent enrollment spikes.

## ADR-021: Assignment Lifecycle, Atomic Slot Holding & 48-Hour Reservation Expiry
- **Decision**: Implement a 48-hour temporary `RESERVED` assignment hold for drivers upon campaign selection, backed by atomic PostgreSQL row locking and automated expiration via scheduled BullMQ jobs. Drivers can voluntarily release slots via `RELEASED`.
- **Context**: Drivers require time to download the high-resolution artwork, visit a digital vinyl print shop, and paste the poster on their auto. If slots are held indefinitely without verification, unavailable drivers lock up campaign inventory.
- **Consequences**: Clean guarantee of slot recycling; automatic cancellation of inactive driver bookings; prevents oversubscription and unfulfilled advertiser orders.

## ADR-022: Automated Photo Checks & Sharp 64-bit Perceptual dHash
- **Decision**: Validate driver installation photos through a deterministic automated pipeline utilizing Sharp for 64-bit difference hashing (dHash) and Hamming distance comparison, paired with Haversine geofence calculations.
- **Context**: Drivers may be tempted to submit previously captured images, stock photos, photos outside operating zones, or photos from other vehicles. Manual human review of thousands of photos needs algorithmic fraud deterrence and duplicate flagging.
- **Consequences**: Immediate rejection of corrupted/out-of-bounds submissions and automatic flagging of duplicate/reused photos before moderator review, drastically reducing reviewer load.

## ADR-023: Company Review SLA Escalation & Driver PII Masking
- **Decision**: Allow companies to review their campaign installations while strictly masking driver PII (names formatted as `DRV-XXXX`, phone numbers omitted, vehicle plates partially masked). Enforce a 24-hour review SLA that automatically escalates unreviewed submissions to Platform Super Admins.
- **Context**: Brand safety requires companies to inspect their creative on real autos if requested. However, exposing driver phone numbers or home identities risks offline harassment. Additionally, unresponsive brand reviewers must not block drivers from going live.
- **Consequences**: Comprehensive driver privacy protection while maintaining client brand control, with guaranteed turnaround times due to automatic platform fallback.

## ADR-024: Two-Tier Daily Proof Verification Pipeline & Fraud Detection Architecture
- **Decision**: Partition daily photo validation into synchronous Tier-1 HARD checks (exact SHA-256 byte collision, mock GPS detection, past 22:00 IST cutoff) that reject immediately without deducting from the driver's daily attempt allowance (5 attempts/day), and Tier-2 SOFT checks (time-of-day, GPS in zone, Sharp 64-bit dHash collision, stationary auto, clock-skew, device correlation) that increment a cumulative risk score and route suspicious submissions to an asynchronous Admin manual review queue with 10-minute TTL concurrency locks.
- **Context**: Drivers on the road experience network drops, poor lighting, or device clocks out of sync. Rejecting hard technical collisions protects platform integrity, while soft-scoring with human review prevents false positives that unfairly penalize honest auto drivers.
- **Consequences**: Clean, fraud-resistant proof pipeline; zero false-positive rejections from automated algorithms; fast path (<200ms) for 90%+ clean photos via automatic approval.

## ADR-025: Assignment Rent Finalization & Grace Days Math
- **Decision**: Calculate payable days using `payableDays = min(totalDays, verifiedDays + excusedDays + min(missedDays, graceDaysAllowed))` with default `graceDaysAllowed = 3`. Final rent payout is computed as `roundHalfUp(dailyRentPaise * payableDays)`. Full assignment completion is strictly gated until all assignment days are finalized (`PENDING` count == 0 and `UNDER_REVIEW` count == 0).
- **Context**: Vehicle breakdowns, local transport strikes, or unexpected family emergencies should not wipe out a driver's earnings for minor unavoidable absences. A fixed forgiveness window aligns incentives while protecting campaign advertising deliverables.
- **Consequences**: Transparent, predictable earnings for auto drivers; rigorous financial settlement guarantees for advertisers; mathematical consistency between daily progress tracking and final wallet credits.

## ADR-026: Double-Entry Financial Ledger, Non-Overdraft Accounts & Append-Only Conservation of Funds
- **Decision**: Represent every monetary movement across the platform through an append-only, double-entry financial ledger (`LedgerTransaction` + `LedgerEntry`), where integer paise amounts are posted strictly via 8 typed recipes in `modules/ledger/recipes/`. Enforce non-overdraft invariants on all liability accounts (`CAMPAIGN_ESCROW`, `DRIVER_WALLET`, `PAYOUT_IN_TRANSIT`, `COMPANY_REFUND`).
- **Context**: Moving real money between companies, auto drivers, and the platform requires mathematically verifiable conservation of funds. Floating-point rounding, direct column increments (`balance += x`), or single-sided transactions introduce silent fund leaks and reconciliation failures.
- **Consequences**: Provable zero-discrepancy trial balance ($\sum \text{Debits} - \sum \text{Credits} = 0$); absolute auditability; complete immunity against race conditions and overdrafts.

## ADR-027: Maker-Checker Dual Control & Emergency Circuit Breakers (Kill Switches)
- **Decision**: Enforce a mandatory Maker-Checker dual approval protocol for all company refunds and manual ledger adjustments: the administrator requesting the transaction cannot be the one who approves it (`requestedById !== reviewerId`). Provide real-time emergency kill switches (`finance.payments_enabled` and `finance.payouts_enabled`) that immediately halt inward deposits or outward disbursements in case of detected anomalies.
- **Context**: High-value refund requests or manual ledger modifications carry insider fraud risk. Similarly, gateway outages, banking delays, or suspected security incidents require instantaneous system-wide pauses without deploying code.
- **Consequences**: Elimination of unilateral financial authority; robust protection against internal fraud; safe administrative operations with full audit trail.

## ADR-028: Graduated Three-Strike Discipline Ladder & Automatic Assignment Termination
- **Decision**: Implement a progressive 3-strike disciplinary ladder (Strike 1 = Warning, Strike 2 = Final Warning, Strike 3 = 90-day temporary suspension) paired with a 48-hour cure window for damaged posters (`POSTER_FIX_NOTICE`) and automatic abandonment termination after 7 consecutive missed days. Upon reaching Strike 3, all active assignments (`RESERVED`, `INSTALLING`, `INSTALL_SUBMITTED`, `INSTALL_APPROVED`, `RUNNING`) are immediately terminated and slots are returned to respective campaigns. Drivers who complete 30 consecutive clean days have their active strike count reset to zero.
- **Context**: Compliance failures such as fake photos, missing posters, or abandoned assignments degrade advertiser trust. A progressive, transparent ladder allows drivers to learn and correct accidental issues while decisively ejecting bad actors and freeing up inventory.
- **Consequences**: Fair, predictable enforcement for drivers; immediate slot recycling for advertisers; clear audit trails and appeal paths for all disciplinary actions.

## ADR-029: Disputed Escrow Holds & 12 Typed Transactional Resolution Effects
- **Decision**: When a dispute is filed by a driver or company, compute `calculateHoldAmount()` and lock the disputed funds in escrow via `SettlementHoldProvider.hasActiveHold()`, preventing assignment payout or campaign closeout while the claim is open. Dispute resolutions are modeled as 12 typed atomic effects previewed with financial/state diffs and committed in ACID transactions, accompanied by balanced double-entry ledger entries. Companies never see driver PII, and appeals (second-level reviews) are restricted exclusively to Super Admins.
- **Context**: Resolving photo rejections, missing days, or campaign shortfalls involves moving funds between escrow, driver wallets, and company accounts. Unstructured resolutions or premature payouts cause unreconciled deficits or unrecoverable losses.
- **Consequences**: Mathematical conservation of funds during disputes; prevention of double-spend or premature payouts; strict driver privacy preservation; single-appeal finality.

## ADR-030: Unified Notification Registry, Multi-Channel Routing & Quiet Hours Policy
- **Decision**: Centralize all platform alerts into a declarative `NotificationRegistry` catalog with strongly typed keys, categorized urgency, and multi-channel dispatch rules (In-App, Push via Expo, SMS via DLT, Email via SMTP/MailHog). Enforce an Indian Standard Time quiet-hours window (22:00 to 07:00 IST) where non-urgent push and SMS are held, while critical security alerts and OTPs bypass immediately. Implement daily push rate limits to prevent driver fatigue.
- **Context**: Scattered notifications lead to duplicate alerts, missed regulatory communications, spamming drivers late at night, and unmanageable dispatch logic across diverse channels.
- **Consequences**: Unified channel orchestration; regulatory DLT compliance; driver-friendly alerting during working hours; guaranteed delivery of critical security and financial events.

## ADR-031: Migration from Turborepo/pnpm Monorepo to Three Independent Folders (api, web, mobile) with Contract Sync
- **Decision**: Restructure the repository from a Turborepo/pnpm monorepo into three standalone, independent folders: `api`, `web`, and `mobile`. Each folder manages its own `package.json`, isolated `node_modules`, lockfile, and deployment target with standard `npm`. Place all shared interfaces, enums, validation schemas, tokens, and the unified API client in `api/src/contract/` as the single source of truth, and generate copies into `web/src/shared/` and `mobile/src/shared/` using a deterministic sync script (`npm run sync:shared`).
- **Context**: The previous Turborepo monorepo setup introduced excessive complexity: workspace linking issues, Metro bundler symlink conflicts, hoisting quirks in `.npmrc`, heavy cross-project build-time coupling, and cumbersome multi-service deployment configurations. Hosting targets naturally divide into independent platforms: API on Node VPS/container runners, Web on static SPA hosts (Vercel/Cloudflare Pages), and Mobile on Expo EAS.
- **Consequences**:
  - Independent project lifecycles: each folder can be installed, linted, tested, and built in complete isolation with zero cross-project dependency pollution.
  - Simplified, fast hosting workflows: standard Dockerfile for API/worker, zero-config SPA deployment for Web, standard EAS build for Mobile.
  - Zero run-time or build-time symlinks: Expo Metro and Vite run on standard local folders.
  - Contract synchronization is verified via CI (`.github/workflows/shared.yml`) and pre-commit git hooks, guaranteeing type safety and contract parity across all platforms.









