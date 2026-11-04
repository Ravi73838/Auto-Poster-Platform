# Admin Portal Architecture & Specification

## 1. Overview & Goals

The **Admin Portal** is the centralized mission-control application for the **Auto Poster Advertising Platform**. It empowers operations, moderation, finance, and platform executives to manage daily workflows without developer intervention.

Key principles:
- **Separation of Duties (RBAC)**: Fine-grained permissions across Super Admin, Moderator, and Finance roles.
- **Defense in Depth**: Idle session timeouts (15 minutes), Step-Up Authentication (2FA challenge), CIDR IP allowlisting, and Emergency Maintenance Mode.
- **Privacy by Default**: Automatic masking of customer PII (phone, email, bank account, PAN, GSTIN) with audited step-up reveals.
- **Maker-Checker Dual Authorization**: Critical platform and financial parameters cannot be modified unilaterally.
- **Operational Speed**: Global Omnisearch with \`pg_trgm\`, saved view presets, keyboard shortcuts (\`?\`, \`Ctrl+K\`, \`j\`/\`k\`, \`x\`, \`e\`), and consolidated work queue aggregation.

---

## 2. Architecture & Components

```mermaid
graph TD
    User([Admin Staff]) --> UI[Admin Web Portal (React + Vite + Tailwind)]
    UI --> Palette[Command Palette (Ctrl+K)]
    UI --> DataTable[AdminDataTable (Saved Views, Filter Sync)]
    UI --> Drawers[360° Entity Drawers (Driver, Company)]
    UI --> Modals[Step-Up 2FA Challenge & Verify]

    UI --> Gateway[API Gateway & Router]
    Gateway --> IPGuard[adminIpAllowlist Middleware]
    Gateway --> MaintGuard[maintenanceModeGuard Middleware]
    Gateway --> AuthGuard[authenticate & idleTimeout Check]
    Gateway --> PermGuard[requirePermission Guard]
    Gateway --> StepUpGuard[requireStepUp Middleware]

    StepUpGuard --> Core[Admin Modules]
    Core --> SearchSvc[AdminSearchService (pg_trgm)]
    Core --> QueueSvc[WorkQueuesService (My-Work Aggregator)]
    Core --> AnalyticsSvc[AnalyticsService (Daily Rollups)]
    Core --> ReportsSvc[ReportsService (Export Streaming)]
    Core --> Entity360Svc[Entity360Service (Driver & Co 360)]
    Core --> SettingsSvc[AdminSettingsService (Maker-Checker)]
    Core --> RolesSvc[RolesService (Matrix Editor)]
    Core --> ContentSvc[Legal & Help CMS]
    Core --> SystemSvc[Health & JobRuns Monitor]

    Core --> DB[(PostgreSQL with pg_trgm & GIN)]
    Core --> Redis[(Redis Cache & Session Store)]
```

---

## 3. Security Hardening Features

### 3.1 Step-Up Authentication (2FA Challenge)
Sensitive actions require immediate verification through an OTP sent to the admin's verified mobile SMS or email.
- **Valid Window**: 15 minutes (\`stepUpVerifiedAt\` stored in the session/JWT).
- **Protected Actions**:
  - PII Unmasking / Reveal
  - Lifting Driver Bans
  - Reinstating Terminated Assignments
  - Setting Maker-Checker Approvals
  - Updating Role Permissions Matrix
  - Authorizing Payout Batches
  - Publishing Legal Policies with Re-Consent
  - Retrying Background Cron Jobs

### 3.2 Idle Session Timeout
To protect unattended workstations in operations centers, any session inactive for greater than **15 minutes** (\`admin.session.idle_timeout_minutes\`) is immediately terminated with a \`401 SESSION_EXPIRED\` error.

### 3.3 CIDR IP Allowlisting
Access to \`/api/v1/admin/*\` endpoints can be restricted to specific office or VPN CIDR ranges configured in \`admin.security.ip_allowlist\`. Requests from unlisted IPs receive \`403 IP_NOT_ALLOWED\`.

### 3.4 Platform Maintenance Mode
When enabled via \`platform.maintenance_mode = true\`:
- Mobile Driver and Company Web portals reject mutations with \`503 SERVICE_UNAVAILABLE\`.
- All administrative routes remain operational to allow the team to perform migrations or triage incidents.

### 3.5 PII Masking & Tamper-Evident Reveal Audit
Driver and advertiser contact information is masked on all standard list and detail views:
- Phone: \`+91 98*** **210\`
- Email: \`r***@domain.com\`
- Bank Account: \`**** **** 1234\`
- PAN: \`ABC*****1F\`
- GSTIN: \`27AA*****1Z5\`

Clicking "Reveal" triggers Step-Up authentication and logs an immutable \`PII_REVEALED\` audit record capturing the operator ID, target entity, field name, IP address, and justification.

---

## 4. Key Workflows

### 4.1 Work Queues & My-Work Inbox
The portal aggregates outstanding work into unified queues:
1. **Driver KYC**: Unreviewed identity and vehicle RC documents.
2. **Campaign Approval**: Advertiser creative designs, pricing snapshots, and print instructions.
3. **Poster Installations**: Verification photos of mounted posters and license plates.
4. **Daily Proofs**: Auto-flagged or company-flagged daily photos.
5. **Disputes**: Open conflict tickets between advertisers and drivers.
6. **Adjustments & Settings**: Financial maker-checker and parameter requests.

Operators can claim items, view SLA deadlines, and process them directly.

### 4.2 Maker-Checker Parameter Configuration
To modify sensitive platform parameters:
1. **Maker**: Any authorized admin submits a change request with proposed value and business justification.
2. **System**: Creates a \`SettingChangeRequest\` in \`REQUESTED\` status; current value remains active.
3. **Checker**: A separate administrator inspects the proposed diff, completes Step-Up authentication, and either approves or rejects the change.
4. **Audit**: Diff and approver details are recorded in \`AuditLog\`.

### 4.3 Reports & Data Exports
Bulk data extraction runs asynchronously via \`ExportJob\`:
- Supported datasets: \`DRIVERS\`, \`CAMPAIGNS\`, \`ASSIGNMENTS\`, \`PAYMENTS\`, \`PAYOUTS\`, \`AUDIT_LOGS\`.
- Exports are streamed into CSV format, compressed, and assigned a secure signed download URL with 24-hour expiration.

---

## 5. UI Features & Keyboard Accessibility

- **Command Palette (\`Ctrl/Cmd + K\`)**: Quick jump to pages, actions, and global search across all 7 entities.
- **Keyboard Shortcuts (\`?\`)**: Navigation and queue review shortcuts:
  - \`j\` / \`k\`: Move up/down rows
  - \`x\`: Select row
  - \`a\` / \`r\`: Approve / Reject active review item
  - \`e\`: Export active table to CSV
  - \`/\`: Focus search
- **AdminDataTable**: Density toggle (Compact / Comfortable), column chooser, URL synchronization, and custom Saved Views.
- **360° Drawers**: Slide-over inspector panels for Drivers and Companies without navigating away from the active workflow.

