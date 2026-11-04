# CI / CD Workflows

Continuous Integration workflows are located in the repository root at `.github/workflows/ci.yml`.

### Pipeline Checks:
1. Workspace linting (`pnpm lint`)
2. TypeScript compilation (`pnpm typecheck`)
3. Unit and integration tests (`pnpm test`)
4. Production bundle builds (`pnpm build`)

