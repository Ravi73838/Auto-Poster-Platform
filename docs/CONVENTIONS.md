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
