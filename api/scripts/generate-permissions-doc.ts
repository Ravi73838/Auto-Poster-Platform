import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PermissionSpec {
  key: string;
  name: string;
  module: string;
  description: string;
  defaultRoles: ('SUPER_ADMIN' | 'MODERATOR' | 'FINANCE')[];
  requiresStepUp?: boolean;
}

export const ALL_PERMISSIONS: PermissionSpec[] = [
  // KYC & Onboarding
  {
    key: 'kyc.view',
    name: 'View KYC Submissions',
    module: 'KYC & Onboarding',
    description: 'Inspect driver identity documents, RC, DL, and bank passbooks.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },
  {
    key: 'kyc.approve',
    name: 'Approve or Reject KYC',
    module: 'KYC & Onboarding',
    description: 'Review and verify or reject driver onboarding submissions with reason codes.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },

  // Campaigns
  {
    key: 'campaign.view',
    name: 'View Campaign Submissions',
    module: 'Campaigns',
    description: 'Browse advertiser campaigns, budgets, creative designs, and targets.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR', 'FINANCE'],
  },
  {
    key: 'campaign.approve',
    name: 'Review Campaigns',
    module: 'Campaigns',
    description: 'Approve or reject advertising campaign designs and print instructions.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },

  // Installations
  {
    key: 'installation.view',
    name: 'View Installations',
    module: 'Installations',
    description: 'Inspect auto-rickshaw poster installation verification photos.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },
  {
    key: 'installation.approve',
    name: 'Approve/Reject Installations',
    module: 'Installations',
    description: 'Approve poster mount quality or reject with damage/obscured reason codes.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },

  // Daily Photos & Fraud
  {
    key: 'photo.view',
    name: 'View Daily Photos',
    module: 'Daily Photos',
    description: 'Inspect daily proof photos, GPS geofencing, and EXIF timestamps.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },
  {
    key: 'photo.approve',
    name: 'Review Flagged Photos',
    module: 'Daily Photos',
    description: 'Verify auto-flagged, randomly sampled, or company-disputed daily photos.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },

  // Payments & Ledger
  {
    key: 'payment.view',
    name: 'View Escrow & Inbound Payments',
    module: 'Finance',
    description: 'Monitor Razorpay payments, gateway orders, and ledger escrow accounts.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    key: 'settlement.view',
    name: 'View Settlements & Holds',
    module: 'Finance',
    description: 'Track daily earned rent, held settlements, and commission releases.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    key: 'payout.view',
    name: 'View Payout Batches',
    module: 'Finance',
    description: 'Inspect driver IMPS/NEFT payout queues and batch progress.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    key: 'payout.approve',
    name: 'Approve Payout Batches',
    module: 'Finance',
    description: 'Release batch disbursement of driver rent and printing allowances.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
    requiresStepUp: true,
  },
  {
    key: 'ledger.view',
    name: 'View General Ledger',
    module: 'Finance',
    description: 'Audit double-entry ledger transactions, trial balances, and chart of accounts.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
  },

  // Discipline & Disputes
  {
    key: 'dispute.view',
    name: 'View Disputes',
    module: 'Disputes & Discipline',
    description: 'Read company and driver dispute tickets, evidence, and messages.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR', 'FINANCE'],
  },
  {
    key: 'dispute.resolve',
    name: 'Resolve Disputes',
    module: 'Disputes & Discipline',
    description: 'Issue binding dispute judgments with rent reallocations and strike actions.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },
  {
    key: 'strike.manage',
    name: 'Issue & Lift Strikes',
    module: 'Disputes & Discipline',
    description: 'Apply driver strikes, bans, and early assignment terminations.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
    requiresStepUp: true,
  },

  // Team & Administration
  {
    key: 'team.manage',
    name: 'Manage Staff Accounts',
    module: 'Team & Security',
    description: 'Create admin operators, assign staff roles, and suspend credentials.',
    defaultRoles: ['SUPER_ADMIN'],
    requiresStepUp: true,
  },
  {
    key: 'role.manage',
    name: 'Edit Permissions Matrix',
    module: 'Team & Security',
    description: 'Configure permission assignments for Moderator and Finance roles.',
    defaultRoles: ['SUPER_ADMIN'],
    requiresStepUp: true,
  },
  {
    key: 'audit.view',
    name: 'View Audit Trail',
    module: 'Compliance & Audit',
    description: 'Browse tamper-evident logs, shallow diffs, and actor IP addresses.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    key: 'report.view',
    name: 'View Analytics Dashboards',
    module: 'Reporting',
    description: 'Inspect city rollups, revenue metrics, and fleet utilization stats.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR', 'FINANCE'],
  },
  {
    key: 'report.export',
    name: 'Export CSV Datasets',
    module: 'Reporting',
    description: 'Queue and download raw CSV reports with audit logging.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE'],
  },

  // Settings & CMS
  {
    key: 'settings.view',
    name: 'View Platform Parameters',
    module: 'Settings & Policy',
    description: 'Read system configuration keys, money rates, and thresholds.',
    defaultRoles: ['SUPER_ADMIN', 'FINANCE', 'MODERATOR'],
  },
  {
    key: 'settings.update',
    name: 'Update Platform Settings',
    module: 'Settings & Policy',
    description: 'Modify parameters or submit maker-checker change requests.',
    defaultRoles: ['SUPER_ADMIN'],
  },
  {
    key: 'settings.approve',
    name: 'Approve Maker-Checker Changes',
    module: 'Settings & Policy',
    description: 'Act as the checker to verify and apply sensitive setting modifications.',
    defaultRoles: ['SUPER_ADMIN'],
    requiresStepUp: true,
  },
  {
    key: 'legal.manage',
    name: 'Publish Legal Policies',
    module: 'Settings & Policy',
    description: 'Draft and publish Terms of Service, Privacy, and mandate re-consent.',
    defaultRoles: ['SUPER_ADMIN'],
    requiresStepUp: true,
  },
  {
    key: 'help.manage',
    name: 'Manage Help Center',
    module: 'Settings & Policy',
    description: 'Author and organize knowledge base guides and onboarding FAQs.',
    defaultRoles: ['SUPER_ADMIN', 'MODERATOR'],
  },
  {
    key: 'system.view',
    name: 'View System Diagnostics',
    module: 'System & Operations',
    description: 'Monitor PostgreSQL, Redis, disk, memory, and job execution logs.',
    defaultRoles: ['SUPER_ADMIN'],
  },
  {
    key: 'system.manage',
    name: 'Retry Jobs & Trigger Rollups',
    module: 'System & Operations',
    description: 'Restart failed background jobs and force daily analytics aggregation.',
    defaultRoles: ['SUPER_ADMIN'],
    requiresStepUp: true,
  },
];

export function generatePermissionsMarkdown(): string {
  let md = `# Platform Roles & Permissions Reference

This document serves as the single source of truth for administrative and platform security roles, permission keys, sensitivity levels, and maker-checker requirements across the **Auto Poster Advertising Platform**.

---

## 1. Overview of Roles

The platform enforces Role-Based Access Control (RBAC) with dynamic permission matrices:

| Role | Target Persona | Scope & Responsibilities |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Platform Operations Executives | Full unrestricted platform administration. Manages staff credentials, reviews maker-checker sensitive settings, and audits compliance. Privileges are **immutable by design**. |
| **MODERATOR** | Daily Operations & Review Staff | Verifies driver KYC documents, reviews campaign creatives, verifies daily photo proofs, and resolves dispute tickets. |
| **FINANCE** | Accounting & Treasury Ops | Oversees escrow accounts, reconciles payment gateway transactions, manages ledger adjustments, and authorizes payout batches. |
| **COMPANY** | Advertisers / Brands | Self-service advertiser portal to launch campaigns, track fleet verification, and deposit escrow funds. |
| **DRIVER** | Auto-Rickshaw Partners | Mobile driver app to reserve campaigns, submit photo proofs, and withdraw rental earnings. |

---

## 2. Security Safeguards

1. **Step-Up Authentication (2FA)**: High-risk administrative actions (e.g. lifting bans, releasing payouts, editing permission matrices, revealing masked PII) require step-up authentication via SMS OTP or Email challenge with a 15-minute verification window.
2. **Maker-Checker Dual Authorization**: Changes to critical platform parameters (commission fee %, GST rate, auto-flagging risk thresholds) cannot be applied by a single admin. The creator submits a \`SettingChangeRequest\`, and an independent checker must approve it with Step-Up verification.
3. **Immutable Audit Trail**: Every sensitive state change, PII reveal, or permission update generates a tamper-evident audit record with actor ID, IP address, and shallow diff.
4. **Session Idle Timeout**: Admin sessions expire automatically after **15 minutes** of inactivity to mitigate unattended terminal risks.

---

## 3. Permissions Matrix Reference

`;

  const modules = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.module)));

  for (const mod of modules) {
    md += `### ${mod}\n\n`;
    md += `| Permission Key | Description | Super Admin | Moderator | Finance | Step-Up Required |\n`;
    md += `| :--- | :--- | :---: | :---: | :---: | :---: |\n`;

    const perms = ALL_PERMISSIONS.filter((p) => p.module === mod);
    for (const p of perms) {
      const isSuper = p.defaultRoles.includes('SUPER_ADMIN') ? '✅' : '❌';
      const isMod = p.defaultRoles.includes('MODERATOR') ? '✅' : '❌';
      const isFin = p.defaultRoles.includes('FINANCE') ? '✅' : '❌';
      const stepUp = p.requiresStepUp ? '🔒 Yes' : 'No';
      md += `| \`${p.key}\` | ${p.description} | ${isSuper} | ${isMod} | ${isFin} | ${stepUp} |\n`;
    }
    md += '\n';
  }

  md += `---

## 4. Evaluation Architecture

\`\`\`mermaid
flowchart TD
    Req[Incoming HTTP Request] --> AuthGuard[Authenticate Middleware]
    AuthGuard --> SessionCheck{Session Idle > 15m?}
    SessionCheck -- Yes --> Reject[401 Session Inactive]
    SessionCheck -- No --> PermCheck{requirePermission key}
    PermCheck -- Cached in Redis --> Allow[Evaluate Grant]
    PermCheck -- Cache Miss --> DB[(Prisma RolePermission)]
    DB --> CacheRedis[Write Redis Cache]
    CacheRedis --> Allow
    Allow -- Granted --> StepUpCheck{requireStepUp applied?}
    StepUpCheck -- Yes --> StepUpVerify{Step-Up Valid < 15m?}
    StepUpVerify -- No --> Challenge[403 STEP_UP_REQUIRED]
    StepUpVerify -- Yes --> Handler[Execute Controller Action]
    StepUpCheck -- No --> Handler
\`\`\`
`;

  return md;
}

const outputPath = path.resolve(__dirname, '..', 'docs', 'PERMISSIONS.md');
fs.writeFileSync(outputPath, generatePermissionsMarkdown(), 'utf-8');
console.log(`Generated permissions documentation at: ${outputPath}`);

