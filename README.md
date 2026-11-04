# Auto Poster Advertising Platform

A marketplace platform connecting commercial advertisers with auto-rickshaw drivers across India.
Companies launch poster campaigns, drivers verify daily physical display with GPS-stamped photos, and verified earnings are released through an escrow-backed ledger.

> **Status**: Phases 1–9 Completed (Foundation, Database Core, Authentication & Roles, KYC & Admin Review, Campaigns Module, Driver Assignment & Installation Flow, Daily Photo Proof & Fraud Checks, Wallet Ledger, Escrow, Payments & Payouts, Disputes, Strikes & Notifications).

---

## 1. Prerequisites
- **Node.js**: v22 LTS (managed via `.nvmrc`)
- **pnpm**: v10+ (`corepack enable` or `npm install -g pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL and Redis instances

---

## 2. First-Time Setup

```bash
# 1. Clone repository and copy environment configuration
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 2. Install workspace dependencies
pnpm install

# 3. Start local database and cache services
pnpm db:up

# 4. Generate Prisma client and run migrations
pnpm --filter @ap/api db:generate
pnpm --filter @ap/api db:migrate

# 5. Seed base platform data (roles, permissions, settings, super admin)
pnpm --filter @ap/api db:seed:base
```

---

## 3. Running Applications

### Start All Development Servers
```bash
pnpm dev
```

### Start Individual Applications
```bash
# Backend API (runs on http://localhost:4000)
pnpm --filter @ap/api dev

# Web Portal (Company + Admin on http://localhost:5173)
pnpm --filter @ap/web dev

# Driver Mobile App (Expo development server)
pnpm --filter @ap/mobile start
```

---

## 4. Authentication & Credentials Overview

- **Driver Mobile App**: Passwordless phone authentication with 6-digit SMS OTP (dev bypass: `123456`).
- **Company Portal** (`/login`, `/register`): Email + mobile + password registration with mobile OTP verification, followed by email + password login with rotating refresh token in `httpOnly` cookie (`ap_refresh`).
- **Admin Portal** (`/admin/login`): Mandatory 2-step verification (email/password + mobile SMS challenge) for `SUPER_ADMIN`, `MODERATOR`, and `FINANCE`. Default seeded super-admin:
  - Email: `admin@autoposter.com`
  - Password: `Admin@123456`
  - Requires immediate password change on first login.
- For complete sequence diagrams, token rotation rules, DLT SMS compliance, and security policies, see [docs/AUTH.md](docs/AUTH.md).

---

## 5. Testing, Linting & Building

```bash
# Run all tests across workspace
pnpm test

# Run ESLint across workspace
pnpm lint

# Run TypeScript typechecks
pnpm typecheck

# Build all packages and applications for production
pnpm build

# Format workspace files
pnpm format
```

---

## 6. Folder Overview

```
auto-poster-platform/
├── apps/
│   ├── api/            # Node.js + Express + Prisma + Redis + jose + Argon2id
│   ├── mobile/         # Expo + React Native driver mobile app (passwordless OTP)
│   └── web/            # React + Vite (Company & Admin portals + 2FA challenge)
├── packages/
│   ├── api-client/     # Typed client with refresh queue lock & onAuthLost hook
│   ├── design-tokens/  # Semantic light/dark colors with WCAG AA test
│   ├── eslint-config/  # ESLint flat config with cross-app boundary bans
│   ├── shared-constants/# Enums for roles, statuses, permissions, error codes
│   ├── shared-i18n/    # Translation resources (English, Hindi, Gujarati)
│   ├── shared-types/   # API envelope & DTO type contracts
│   ├── shared-validation/ # Zod schemas (mobile, password, auth DTOs)
│   └── tsconfig/       # Shared TypeScript presets
├── infra/
│   ├── docker/         # Docker Compose for PostgreSQL 16 & Redis 7
│   └── ci/             # CI documentation (workflow in .github/workflows)
└── docs/
    ├── ARCHITECTURE.md # Architectural patterns and boundary rules
    ├── AUTH.md         # Authentication flows, token rotation, DLT SMS compliance
    ├── CONVENTIONS.md  # Layered module architecture conventions
    ├── DAILY_PROOF.md  # Daily photo verification, fraud heuristics & admin audit
    ├── DATABASE.md     # Relational schema, indexes, and SQL constraints
    ├── DECISIONS.md    # Architectural Decision Records (ADRs)
    ├── DISCIPLINE_AND_DISPUTES.md # Three-strike ladder, 12 dispute effects, privacy masking
    ├── MONEY.md        # Double-entry ledger, posting recipes & escrow mechanics
    └── NOTIFICATIONS.md# Notification registry, quiet hours & multi-channel routing
```

---

## 6. Troubleshooting

### Expo / Metro Module Resolution in pnpm Monorepo
Expo uses Metro, which natively traverses single flat `node_modules` trees.
To prevent resolution issues with pnpm's default symlink isolation, `.npmrc` contains:
```ini
node-linker=hoisted
```
If you encounter `Cannot find module` errors in Expo:
1. Ensure `.npmrc` is present in root.
2. Delete `node_modules` and re-run:
   ```bash
   pnpm clean
   pnpm install
   ```

