# System Architecture

## 1. Overview & 3-Folder Architecture
The Auto Poster Advertising Platform connects advertising businesses with auto-rickshaw drivers across Indian metropolitan and tier-2/3 cities.
The platform is organized into three independent, self-contained top-level folders: `api`, `web`, and `mobile`. Each folder has its own `package.json`, isolated `node_modules`, lockfile, and tooling configuration.

```
                              ┌───────────────────────────┐
                              │      api/src/contract     │
                              │ (Single Source of Truth)  │
                              │  - types, validation,     │
                              │    constants, tokens,     │
                              │    i18n, money, time,     │
                              │    api-client (pure TS)   │
                              └─────────────┬─────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │ npm run sync:shared                         │
                     ▼                                             ▼
          ┌─────────────────────┐                       ┌─────────────────────┐
          │    web/src/shared   │                       │   mobile/src/shared │
          │  (GENERATED COPY)   │                       │  (GENERATED COPY)   │
          └──────────┬──────────┘                       └──────────┬──────────┘
                     │                                             │
                     ▼                                             ▼
          ┌─────────────────────┐                       ┌─────────────────────┐
          │         web         │                       │        mobile       │
          │  (Company + Admin   │                       │   (Driver Expo App) │
          │   Portals, Vite)    │                       │    React Native     │
          └─────────────────────┘                       └─────────────────────┘
```

## 2. Shared Code & Contract Synchronization
- **Single Source of Truth**: All shared interfaces, enums, Zod validation schemas, translations, UI tokens, and the unified HTTP API client reside inside `api/src/contract/`.
- **Pure TypeScript Contract**: Contract files must be pure TypeScript/JSON and can only depend on `zod`. Node built-ins, database models, Prisma, and UI framework bindings are strictly forbidden in contract code.
- **One-Way Generator Flow**:
  - Run `npm run sync:shared` inside `api` (or `npm run sync` from repository root) to sync contract code to `web/src/shared` and `mobile/src/shared`.
  - Every generated file includes an explicit header: `/* GENERATED FILE - DO NOT EDIT. Source: api/src/contract/... */`.
  - Developers NEVER edit `web/src/shared/` or `mobile/src/shared/` directly.
- **Import Aliases**:
  - Code across all three folders uses the standard `@ap/*` namespace (e.g. `@ap/shared-types`, `@ap/shared-constants`, `@ap/shared-validation`, `@ap/api-client`, `@ap/design-tokens`, `@ap/shared-i18n`).
  - `api` maps `@ap/*` to `./src/contract/*` via `tsconfig.json` paths and tsup bundling.
  - `web` and `mobile` map `@ap/*` to `./src/shared/*` via their respective `tsconfig.json`, Vite, and Metro configs.

## 3. Architecture Boundary Rules
1. **Zero Cross-Folder Imports**: No code in `api` may import from `web` or `mobile`, and vice versa. Each folder builds in total isolation.
2. **Web Portal Isolation**:
   - Inside `web/src/portals/company`, files must NOT import from `web/src/portals/admin`.
   - Inside `web/src/portals/admin`, files must NOT import from `web/src/portals/company`.
   - Enforced by ESLint and `api/scripts/check-boundaries.ts`.
3. **Automated Enforcement**:
   - `npm run check:boundaries` verifies that zero cross-folder imports or portal leaks exist.
   - `npm run sync:shared:check` verifies that contract purity is maintained and that `web/src/shared` and `mobile/src/shared` match `api/src/contract` byte-for-byte.

## 4. Backend Architecture (`api`)
- **Modular Monolith**: Organized into clean domain modules (`auth`, `admin`, `company`, `driver`, `campaigns`, `assignments`, `photos`, `ledger`, `wallet`, `payments`, `settlements`, `refunds`, `disputes`, `notifications`).
- **Layered Clean Design**: Every module follows `routes -> controller -> service -> repository -> validation/types`.
- **Dual Execution Roles**:
  - Main API Server (`dist/main.js`): Handles HTTP requests, authentication, and webhooks.
  - Background Worker (`dist/worker.js`): Consumes BullMQ job queues (daily photo verification, settlement processing, notification dispatch, 48-hour reservation expiration).
- **Postgres 16 & Redis 7**: Data persistence with Prisma ORM; Redis for BullMQ queues, sliding-window rate limiting, and review locks.

## 5. Web Frontend Architecture (`web`)
- **Single App, Dual Portals**: One single web app serving both the Company advertiser portal and the Admin portal.
- **Route Chunk Splitting**: Both portals are imported using `React.lazy()` to guarantee separate production bundles.
- **Role & Permission Guards**: Routes and navigation elements are filtered based on user roles (`COMPANY`, `SUPER_ADMIN`, `MODERATOR`, `FINANCE`) and granular permissions (`kyc.approve`, `campaign.approve`, etc.).
- **Static SPA Deployment**: Compiles to standard static assets in `dist/` deployable to Vercel, Cloudflare Pages, Netlify, or Caddy.

## 6. Mobile Driver App Architecture (`mobile`)
- **Expo & React Native**: Dedicated Android & iOS driver application.
- **File-Based Routing**: Expo Router tabs (`(tabs)/campaigns`, `(tabs)/assignments`, `(tabs)/wallet`, `(tabs)/profile`).
- **Offline & Token Persistence**: Expo SecureStore for encrypted auth tokens; AsyncStorage for user preferences and offline queues.
- **Deployment**: Expo Application Services (EAS Build & Submit) for internal APKs and Play Store/App Store distribution.

## 7. Hosting & Deployment Topologies
See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.
1. **Single VPS (All-in-One)**: `api/infra/docker-compose.prod.yml` runs API, Worker, PostgreSQL 16, Redis 7, and Caddy with automatic Let's Encrypt HTTPS certificates.
2. **Split Managed Cloud**:
   - API & Worker on Railway / Render / AWS ECS.
   - Web Portal on Vercel / Cloudflare Pages.
   - Mobile Driver App via Expo EAS.
   - Managed DB (Neon / RDS) and Managed Redis (Upstash).
