# Architectural Decision Records (ADRs)

## ADR-001: Monorepo Package Manager & Metro Hoisting
- **Decision**: Use `pnpm` workspaces with `node-linker=hoisted` in `.npmrc`.
- **Context**: Expo / React Native Metro bundler expects dependencies to be discoverable in flat `node_modules` and struggles with symlinks in pnpm's default symlink-based isolated node_modules structure.
- **Consequences**: Enables zero-friction React Native compilation while retaining pnpm's fast downloads and Turborepo workspace orchestration.

## ADR-002: TypeScript Compiler Strictness Configuration
- **Decision**: Enable `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `forceConsistentCasingInFileNames: true`, and `skipLibCheck: true`. Set `exactOptionalPropertyTypes: false`.
- **Context**: `exactOptionalPropertyTypes: true` creates excessive friction when dealing with React component prop interfaces (e.g. `children?: ReactNode` with `undefined`) and Express standard typings.
- **Consequences**: Rock-solid strict types across the whole codebase without library typing incompatibilities.

## ADR-003: Single Web App with Dual Lazy-Loaded Portals
- **Decision**: Host both Advertiser (Company) and Administrator portals in `apps/web` under a unified Vite setup with `React.lazy()` route splitting.
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
