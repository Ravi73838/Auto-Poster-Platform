# System Architecture

## 1. Overview & Monorepo Design
The Auto Poster Advertising Platform connects advertising businesses with auto-rickshaw drivers across Indian metropolitan and tier-2/3 cities.
The monorepo is structured with **pnpm workspaces** and **Turborepo** to orchestrate dependencies, caching, and task execution.

```
                      ┌──────────────────────┐
                      │    Shared Packages   │
                      │  (@ap/design-tokens) │
                      │  (@ap/shared-i18n)   │
                      │  (@ap/shared-types)  │
                      │  (@ap/shared-consts) │
                      │  (@ap/shared-valid)  │
                      │  (@ap/api-client)    │
                      └──────────┬───────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│     apps/api     │   │     apps/web     │   │   apps/mobile    │
│  (Node/Express)  │   │  (Company+Admin) │   │  (Driver App)    │
│  Postgres, Redis │   │   Vite + React   │   │   Expo + RN      │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

## 2. Dependency Direction Rules
1. **Unidirectional**: Apps (`apps/*`) depend on Packages (`packages/*`).
2. **Boundary Restrictions**:
   - Apps must never import from other apps.
   - Packages must never import from apps.
   - Inside `apps/web`, files in `src/portals/company` cannot import from `src/portals/admin`, and vice versa.
   - Enforced automatically at build and lint time via custom ESLint flat config rules.

## 3. Backend Architecture (`apps/api`)
- **Modular Monolith**: Organized into domain modules (`health`, `auth`, `company`, `admin`, `driver`).
- **Layered Clean Design**: Every module follows `routes -> controller -> service -> repository -> validation/types`.
- **Controllers**: Strictly orchestrate HTTP requests, status codes, and envelope formatting. No database queries.
- **Services**: Encapsulate domain rules, validation assertions, and business transactions.
- **Repositories**: Own all database access (Prisma ORM queries, cache keys).
- **API Envelope**: All responses follow `{ success: true, data: T }` or `{ success: false, error: { code, message, details } }`.

## 4. Frontend Architecture (`apps/web`)
- **Single App, Dual Portals**: One single web app serving both the Company advertiser portal and the Admin portal.
- **Route Chunk Splitting**: Both portals are imported using `React.lazy()` to guarantee separate production bundles.
- **Role & Permission Guards**: Routes and navigation elements are filtered based on user roles (`COMPANY`, `SUPER_ADMIN`, `MODERATOR`, `FINANCE`) and granular permissions (`kyc.approve`, `campaign.approve`, etc.).

## 5. Theme and i18n Strategy
- **Design Tokens**: Centralized in `@ap/design-tokens`.
  - Light and Dark semantic color definitions.
  - Text-to-background contrast verified at build time to exceed WCAG AA standards (>= 4.5:1).
  - Web converts tokens into CSS variables on `:root` and `.dark`.
  - Mobile derives them dynamically using `useColorScheme()` and `@ap/design-tokens`.
- **Internationalization (i18n)**:
  - Supports English (`en`), Hindi (`hi`), and Gujarati (`gu`).
  - Preloaded translation namespaces: `common`, `auth`, `errors`, `status`, `settings`.
  - Stored in `localStorage` (web) and `AsyncStorage` (mobile), defaulting to device/browser locale before fallback to English.

