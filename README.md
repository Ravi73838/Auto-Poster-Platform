# Auto Poster Advertising Platform

A marketplace platform connecting commercial advertisers with auto-rickshaw drivers across Indian metropolitan and tier-2/3 cities.
Companies launch poster campaigns, drivers verify daily physical display with GPS-stamped photos, and verified earnings are released through an escrow-backed ledger.

> **Status**: Phases 1–10 Completed. Refactored into three independent, self-contained folders (`api`, `web`, `mobile`) with contract synchronization.

---

## 1. Architecture Overview

The repository is organized into three independent folders:

```
auto-poster-platform/
├── api/                  # Node.js backend & BullMQ worker (Prisma, PostgreSQL, Redis)
│   ├── src/contract/     # Single source of truth for all shared code (pure TS/JSON)
│   ├── docs/             # Complete system architecture and domain documentation
│   ├── infra/            # Docker Compose (dev/prod), Caddyfile, environment templates
│   ├── prisma/           # PostgreSQL schema & migration history
│   └── scripts/          # Contract sync, boundary checker, permissions generator
├── web/                  # Company Advertiser & Admin Portals (Vite + React 18 SPA)
│   └── src/shared/       # GENERATED copy of api/src/contract (DO NOT EDIT directly)
├── mobile/               # Auto Driver Application (Expo + React Native)
│   └── src/shared/       # GENERATED copy of api/src/contract (DO NOT EDIT directly)
├── .github/workflows/    # Per-project independent CI workflows (api, web, mobile, shared)
├── .githooks/            # Optional git pre-commit hooks for sync & boundary checks
├── README.md             # This guide
└── package.json          # Root convenience scripts (npm --prefix <dir> run ...)
```

---

## 2. Prerequisites
- **Node.js**: v22 LTS (managed via `api/.nvmrc`, `web/.nvmrc`, `mobile/.nvmrc`)
- **npm**: v10+ (standard Node package manager, included with Node.js)
- **Docker & Docker Compose**: For local PostgreSQL, Redis, MinIO, and MailHog instances

---

## 3. Quick Start

### 3.1 First-Time Setup
Install dependencies in all three projects:
```bash
# Using root convenience script:
npm run install:all

# Or individually:
cd api && npm install
cd ../web && npm install
cd ../mobile && npm install
```

### 3.2 Start Local Infrastructure
Start PostgreSQL, Redis, MinIO, and MailHog:
```bash
npm run db:up
# Or: docker compose -f api/infra/docker-compose.dev.yml up -d
```

### 3.3 Initialize Database
```bash
cd api
npm run db:generate
npm run db:migrate
npm run db:seed:base
```

---

## 4. Running the Development Servers

You can run applications individually in separate terminals:

### Terminal 1: API Server
```bash
cd api
npm run dev
# API running at http://localhost:4000
```

### Terminal 2: Background Worker (BullMQ Queues)
```bash
cd api
npm run worker
```

### Terminal 3: Web Portal (Company + Admin)
```bash
cd web
npm run dev
# Web app running at http://localhost:5173
```

### Terminal 4: Driver Mobile App (Expo)
```bash
cd mobile
npm run start
# Press 'a' for Android emulator, 'i' for iOS simulator, or scan QR with Expo Go
```

Alternatively, use the root convenience scripts:
```bash
npm run dev:api
npm run dev:worker
npm run dev:web
npm run dev:mobile
```

---

## 5. Contract Synchronization (`api/src/contract`)

To guarantee strict type safety and contract parity across backend, web, and mobile without complex workspace linking:
- **`api/src/contract/`** is the **Single Source of Truth** for:
  - `@ap/shared-types` (DTOs, domain models)
  - `@ap/shared-constants` (enums, roles, pricing constants)
  - `@ap/shared-validation` (Zod schemas)
  - `@ap/api-client` (unified HTTP client)
  - `@ap/design-tokens` (semantic UI color tokens)
  - `@ap/shared-i18n` (translations: en, hi, gu)
  - Pure money and time calculations.
- Code is synchronized to `web/src/shared/` and `mobile/src/shared/`.

### How to Modify Shared Code:
1. **Always edit in `api/src/contract/`**.
2. Run contract sync:
   ```bash
   npm run sync
   # Or inside api/: npm run sync:shared
   ```
3. Commit both the contract source and the generated files.

> ⚠️ **CRITICAL RULE**: **NEVER edit `web/src/shared/` or `mobile/src/shared/` directly.** Any manual changes will be overwritten on the next sync and rejected by CI check mode (`npm run sync:check`).

See [api/docs/CONTRACT_SYNC.md](api/docs/CONTRACT_SYNC.md) for full details.

---

## 6. Testing, Linting & Boundaries

Each project has its own test suite and linters:

```bash
# Test all projects
npm run test:all
# Or per project:
cd api && npm test
cd web && npm test
cd mobile && npm test

# Typecheck all projects
npm run typecheck:all

# Lint all projects
npm run lint:all

# Verify architecture boundaries (no cross-project leakage)
npm run check:boundaries

# Verify contract synchronization & purity
npm run sync:check
```

### Optional Pre-Commit Git Hook
Install local pre-commit hooks to verify sync and boundary rules before every commit:
```bash
npm run hooks:install
```

---

## 7. Authentication & Credentials Overview

- **Driver Mobile App**: Passwordless phone authentication with 6-digit SMS OTP (dev bypass: `123456`).
- **Company Portal** (`/login`, `/register`): Email + mobile registration with mobile OTP verification, followed by email + password login with rotating refresh token in `httpOnly` cookie (`ap_refresh`).
- **Admin Portal** (`/admin/login`): Mandatory 2-step verification (email/password + mobile SMS challenge) for `SUPER_ADMIN`, `MODERATOR`, and `FINANCE`. Default seeded super-admin:
  - Email: `admin@autoposter.com`
  - Password: `Admin@123456`
  - Requires immediate password change on first login.

---

## 8. Deployment & Hosting

The 3-folder architecture enables hosting each component on its ideal platform:
- **`api`**: Docker container on VPS (Hetzner, EC2) via `api/infra/docker-compose.prod.yml`, or serverless/container PaaS (Railway, Render, AWS ECS).
- **`web`**: Static SPA bundle deployed to Vercel, Cloudflare Pages, Netlify, or served via Caddy.
- **`mobile`**: Expo Application Services (EAS Build & Submit) for Google Play Store and Apple App Store.

For step-by-step production guides, see [api/docs/DEPLOYMENT.md](api/docs/DEPLOYMENT.md).

---

## 9. System Documentation

Full specifications are located in `api/docs/`:
- [ARCHITECTURE.md](api/docs/ARCHITECTURE.md) - System architecture & data flow
- [CONVENTIONS.md](api/docs/CONVENTIONS.md) - Coding standards & invariants
- [DECISIONS.md](api/docs/DECISIONS.md) - Architecture Decision Records (ADR-001 to ADR-031)
- [CONTRACT_SYNC.md](api/docs/CONTRACT_SYNC.md) - Shared contract generator & purity guide
- [DEPLOYMENT.md](api/docs/DEPLOYMENT.md) - Complete production hosting guide
- [DATABASE.md](api/docs/DATABASE.md) - Schema design, ledger & constraints
- [AUTH.md](api/docs/AUTH.md) - Token lifecycle & security specifications
- [MONEY.md](api/docs/MONEY.md) - Double-entry ledger, escrow, payments & settlement
- [DAILY_PROOF.md](api/docs/DAILY_PROOF.md) - Photo fraud detection & daily verification
- [DISCIPLINE_AND_DISPUTES.md](api/docs/DISCIPLINE_AND_DISPUTES.md) - Disciplinary strikes, disputes & hold resolution
- [NOTIFICATIONS.md](api/docs/NOTIFICATIONS.md) - Notification catalog, quiet hours & DLT compliance
