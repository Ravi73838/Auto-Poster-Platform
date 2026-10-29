# Auto Poster Advertising Platform

A marketplace platform connecting commercial advertisers with auto-rickshaw drivers across India.
Companies launch poster campaigns, drivers verify daily physical display with GPS-stamped photos, and verified earnings are released through an escrow-backed ledger.

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

# 2. Install workspace dependencies
pnpm install

# 3. Start local database and cache services
pnpm db:up

# 4. Generate Prisma client
pnpm --filter @ap/api db:generate
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

## 4. Testing, Linting & Building

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

## 5. Folder Overview

```
auto-poster-platform/
├── apps/
│   ├── api/            # Node.js + Express + Prisma + Redis
│   ├── mobile/         # Expo + React Native driver mobile app
│   └── web/            # React + Vite (Company & Admin portals)
├── packages/
│   ├── api-client/     # Typed fetch client with API envelope handling
│   ├── design-tokens/  # Semantic light/dark colors with WCAG AA test
│   ├── eslint-config/  # ESLint flat config with cross-app boundary bans
│   ├── shared-constants/# Enums for roles, statuses, and error codes
│   ├── shared-i18n/    # Translation resources (English, Hindi, Gujarati)
│   ├── shared-types/   # API envelope & DTO type contracts
│   ├── shared-validation/ # Zod schemas (mobile number, UUID, pagination)
│   └── tsconfig/       # Shared TypeScript presets
├── infra/
│   ├── docker/         # Docker Compose for PostgreSQL 16 & Redis 7
│   └── ci/             # CI documentation (workflow in .github/workflows)
└── docs/
    ├── ARCHITECTURE.md # Architectural patterns and boundary rules
    ├── CONVENTIONS.md  # Layered module architecture conventions
    └── DECISIONS.md    # Architectural Decision Records (ADRs)
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
