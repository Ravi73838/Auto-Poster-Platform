import {
  ROLES,
  ACCOUNT_STATUS,
  SETTING_KEYS,
  LEDGER_ACCOUNT_TYPES,
  type Role,
} from '@ap/shared-constants';
import { prisma, disconnectPrisma } from '../shared/db/index.js';
import { hashPassword } from '../shared/crypto/index.js';
import { logger } from '../shared/logger/index.js';

export const PERMISSIONS = [
  // Campaigns
  { key: 'campaigns:create', description: 'Create advertising campaigns' },
  { key: 'campaigns:read', description: 'View campaigns' },
  { key: 'campaigns:update', description: 'Update campaign details' },
  { key: 'campaigns:delete', description: 'Delete / cancel campaigns' },
  { key: 'campaigns:approve', description: 'Approve or reject campaigns' },

  // Assignments
  { key: 'assignments:create', description: 'Reserve or create campaign assignments' },
  { key: 'assignments:read', description: 'View assignments' },
  { key: 'assignments:update', description: 'Update assignment status' },

  // Photos
  { key: 'photos:upload', description: 'Upload installation or daily proof photos' },
  { key: 'photos:review', description: 'Review, verify or reject photos' },
  { key: 'photos:read', description: 'View proof photos' },

  // Users & Verification
  { key: 'users:read', description: 'View user profiles and KYC documents' },
  { key: 'users:update', description: 'Update user profiles' },
  { key: 'users:approve', description: 'Approve or reject user KYC / accounts' },

  // Payouts & Finance
  { key: 'payouts:request', description: 'Request payouts' },
  { key: 'payouts:approve', description: 'Approve payout requests' },
  { key: 'payouts:process', description: 'Process / execute payouts' },

  // Ledger
  { key: 'ledger:read', description: 'View financial ledger and statements' },
  { key: 'ledger:post', description: 'Post manual ledger adjustments' },

  // Settings
  { key: 'settings:read', description: 'View system configuration settings' },
  { key: 'settings:update', description: 'Update system configuration settings' },

  // Disputes
  { key: 'disputes:create', description: 'Raise disputes' },
  { key: 'disputes:resolve', description: 'Review and resolve disputes' },

  // Team & Admin Management
  { key: 'team.manage', description: 'Manage admin team members and roles' },
  { key: 'team:manage', description: 'Manage admin team members and roles (colon alias)' },
  { key: 'campaign.view', description: 'View campaigns (admin read-only)' },
  { key: 'campaign.review', description: 'Review and approve/reject campaigns' },
  { key: 'location.manage', description: 'Manage cities, zones, and geofencing boundaries' },
  { key: 'user.manage', description: 'Manage, suspend, and block platform users' },
  { key: 'kyc.review', description: 'Claim, review, and decide on KYC submissions' },

  // Phase 8: Financial Management
  { key: 'payment.view', description: 'View payments and invoices' },
  { key: 'payment.refund', description: 'Request or approve refunds' },
  { key: 'settlement.view', description: 'View assignment settlements' },
  { key: 'settlement.approve', description: 'Approve settlements and campaign closeouts' },
  { key: 'payout.view', description: 'View payouts and batches' },
  { key: 'payout.approve', description: 'Approve driver payouts' },
  { key: 'payout.process', description: 'Export or process payout batches' },
  { key: 'ledger.view', description: 'View ledger accounts, transactions, and trial balance' },
  { key: 'ledger.adjust', description: 'Request or approve manual ledger adjustments' },
  { key: 'finance.export', description: 'Export financial CSV reports' },
  { key: 'finance.settings', description: 'Manage finance switches and configurations' },

  // Phase 9: Discipline, Disputes & Notifications
  { key: 'strike.manage', description: 'Issue, revoke, and manage driver strikes and bans' },
  { key: 'dispute.view', description: 'View disputes and dispute timelines' },
  { key: 'dispute.resolve', description: 'Review and decide on moderation disputes' },
  { key: 'dispute.resolve.finance', description: 'Review and decide on finance disputes' },
  { key: 'announcement.manage', description: 'Compose, schedule, and send platform announcements' },
  { key: 'notification.stats', description: 'View notification delivery statistics and logs' },
  { key: 'assignment.manage', description: 'Terminate and reinstate campaign assignments' },

  // Phase 10: Admin Portal & System Operations
  { key: 'report.view', description: 'View platform reports and analytics' },
  { key: 'report.export', description: 'Export report data to CSV' },
  { key: 'pii.reveal', description: 'Reveal masked PII (mobile, email, vehicle plates)' },
  { key: 'settings.view', description: 'View system configuration settings' },
  { key: 'settings.update', description: 'Update non-sensitive configuration settings' },
  { key: 'settings.approve', description: 'Approve sensitive setting change requests' },
  { key: 'role.manage', description: 'Manage roles and edit permission matrix' },
  { key: 'legal.manage', description: 'Manage and publish legal document versions' },
  { key: 'help.manage', description: 'Manage help center articles' },
  { key: 'system.view', description: 'View system health, queues, and job schedules' },
  { key: 'system.manage', description: 'Manage system operations, retry/discard failed jobs' },
  { key: 'queue.assign', description: 'Assign queue items and manage team workload distribution' },
  { key: 'audit.view', description: 'View platform audit trail' },
] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  [ROLES.SUPER_ADMIN]: PERMISSIONS.map((p) => p.key),
  [ROLES.MODERATOR]: [
    'campaigns:read',
    'campaigns:approve',
    'campaign.view',
    'campaign.review',
    'assignments:read',
    'photos:read',
    'photos:review',
    'users:read',
    'users:approve',
    'kyc.review',
    'user.manage',
    'location.manage',
    'disputes:create',
    'disputes:resolve',
    'strike.manage',
    'dispute.view',
    'dispute.resolve',
    'announcement.manage',
    'assignment.manage',
    'settings:read',
    'report.view',
    'report.export',
    'pii.reveal',
    'settings.view',
    'help.manage',
    'audit.view',
  ],
  [ROLES.FINANCE]: [
    'campaigns:read',
    'campaign.view',
    'assignments:read',
    'payouts:approve',
    'payouts:process',
    'ledger:read',
    'ledger:post',
    'payment.view',
    'payment.refund',
    'settlement.view',
    'settlement.approve',
    'payout.view',
    'payout.approve',
    'payout.process',
    'ledger.view',
    'ledger.adjust',
    'finance.export',
    'finance.settings',
    'dispute.view',
    'dispute.resolve.finance',
    'settings:read',
    'report.export',
    'pii.reveal',
    'settings.view',
    'audit.view',
  ],

  [ROLES.COMPANY]: [
    'campaigns:create',
    'campaigns:read',
    'campaigns:update',
    'campaigns:delete',
    'assignments:read',
    'photos:read',
    'disputes:create',
  ],
  [ROLES.DRIVER]: [
    'campaigns:read',
    'assignments:create',
    'assignments:read',
    'photos:upload',
    'photos:read',
    'payouts:request',
    'disputes:create',
  ],
};

export const DEFAULT_SETTINGS = [
  {
    key: SETTING_KEYS.COMMISSION_RATE_BPS,
    value: 1500,
    description: 'Platform commission rate in basis points (1500 = 15%)',
  },
  {
    key: SETTING_KEYS.GST_RATE_BPS,
    value: 1800,
    description: 'GST rate on platform fee in basis points (1800 = 18%)',
  },
  {
    key: SETTING_KEYS.DEFAULT_PRINTING_ALLOWANCE_PAISE,
    value: 50000,
    description: 'Default poster printing allowance per auto in paise (500 INR)',
  },
  {
    key: SETTING_KEYS.DEFAULT_DAILY_RENT_PAISE,
    value: 10000,
    description: 'Default daily rent per auto in paise (100 INR)',
  },
  {
    key: SETTING_KEYS.MIN_DAYS,
    value: 7,
    description: 'Minimum duration of a campaign in days',
  },
  {
    key: SETTING_KEYS.MAX_DAYS,
    value: 90,
    description: 'Maximum duration of a campaign in days',
  },
  {
    key: SETTING_KEYS.DAILY_PHOTO_START_HOUR,
    value: 6,
    description: 'Earliest hour (0-23) to capture and upload daily photo (6 AM)',
  },
  {
    key: SETTING_KEYS.DAILY_PHOTO_END_HOUR,
    value: 22,
    description: 'Latest hour (0-23) to capture and upload daily photo (10 PM)',
  },
  {
    key: SETTING_KEYS.GRACE_PERIOD_HOURS,
    value: 2,
    description: 'Grace period hours allowed after the daily photo window',
  },
  {
    key: SETTING_KEYS.MAX_STRIKES_BEFORE_SUSPENSION,
    value: 3,
    description: 'Number of strikes before driver account is suspended',
  },
  {
    key: SETTING_KEYS.AUTO_APPROVE_INSTALLATION_AFTER_HOURS,
    value: 48,
    description: 'Hours after which installation photo is auto-approved',
  },
  {
    key: SETTING_KEYS.PAYOUT_HOLD_DAYS,
    value: 3,
    description: 'Days to hold payout after campaign completion before release',
  },
  {
    key: SETTING_KEYS.OTP_LENGTH,
    value: 6,
    description: 'Length of generated numeric OTP codes',
  },
  {
    key: SETTING_KEYS.OTP_TTL_SECONDS,
    value: 300,
    description: 'Validity period of generated OTP codes in seconds (5 minutes)',
  },
  {
    key: SETTING_KEYS.OTP_MAX_ATTEMPTS,
    value: 5,
    description: 'Maximum verification attempts before an OTP is invalidated',
  },
  {
    key: SETTING_KEYS.OTP_RESEND_COOLDOWN_SECONDS,
    value: 30,
    description: 'Cooldown between OTP request attempts in seconds',
  },
  {
    key: SETTING_KEYS.OTP_DAILY_LIMIT_PER_TARGET,
    value: 10,
    description: 'Maximum OTP requests permitted per recipient per 24 hours',
  },
  {
    key: SETTING_KEYS.LOGIN_MAX_FAILURES,
    value: 5,
    description: 'Maximum consecutive failed login attempts before temporary account lock',
  },
  {
    key: SETTING_KEYS.LOGIN_LOCK_MINUTES,
    value: 15,
    description: 'Duration of account lockout after exceeding failed login attempts in minutes',
  },
  {
    key: SETTING_KEYS.MAX_SESSIONS_PER_USER,
    value: 5,
    description: 'Maximum concurrent active sessions allowed per user',
  },
  {
    key: SETTING_KEYS.TERMS_VERSION,
    value: '1.0',
    description: 'Current active Terms of Service version',
  },
  {
    key: SETTING_KEYS.PRIVACY_VERSION,
    value: '1.0',
    description: 'Current active Privacy Policy version',
  },
  {
    key: SETTING_KEYS.POSTER_POLICY_VERSION,
    value: '1.0',
    description: 'Current active Poster Content Policy version',
  },
  {
    key: SETTING_KEYS.UPLOAD_MAX_BYTES,
    value: 8388608,
    description: 'Maximum upload file size in bytes (8 MB)',
  },
  {
    key: SETTING_KEYS.SIGNED_URL_TTL_SECONDS,
    value: 300,
    description: 'Time to live for presigned read/download URLs in seconds (5 minutes)',
  },
  {
    key: SETTING_KEYS.MAX_SLOTS_PER_CAMPAIGN,
    value: 500,
    description: 'Maximum auto slots allowed per campaign',
  },
  {
    key: SETTING_KEYS.MIN_LEAD_DAYS,
    value: 3,
    description: 'Minimum advance notice days before campaign start date',
  },
  {
    key: SETTING_KEYS.MAX_CAMPAIGN_DAYS,
    value: 90,
    description: 'Maximum duration of a campaign in days',
  },
  {
    key: SETTING_KEYS.MIN_CAMPAIGN_DAYS,
    value: 15,
    description: 'Minimum duration of a campaign in days',
  },
  {
    key: SETTING_KEYS.MIN_RENT_PER_30_DAYS_PAISE,
    value: 30000,
    description: 'Minimum rent per auto per 30 days in paise (300 INR)',
  },
  {
    key: SETTING_KEYS.MAX_RENT_PER_30_DAYS_PAISE,
    value: 500000,
    description: 'Maximum rent per auto per 30 days in paise (5000 INR)',
  },
  {
    key: SETTING_KEYS.MAX_PRINTING_ALLOWANCE_PAISE,
    value: 50000,
    description: 'Maximum printing allowance per auto in paise (500 INR)',
  },
  {
    key: SETTING_KEYS.CAMPAIGN_REVIEW_SLA_HOURS,
    value: 24,
    description: 'SLA target for admin campaign review in hours',
  },
  {
    key: SETTING_KEYS.MIN_PAYMENT_LEAD_DAYS,
    value: 1,
    description: 'Minimum days payment must be received before campaign start date',
  },
  {
    key: SETTING_KEYS.MAX_POSTER_UPLOAD_BYTES,
    value: 26214400,
    description: 'Maximum poster upload file size in bytes (25 MB)',
  },
  {
    key: SETTING_KEYS.MIN_POSTER_WIDTH_PX,
    value: 1200,
    description: 'Minimum width in pixels for uploaded campaign posters',
  },
  {
    key: SETTING_KEYS.PAYMENT_DEADLINE_DAYS,
    value: 7,
    description: 'Standard payment deadline in days after campaign approval',
  },
  {
    key: SETTING_KEYS.ENROLMENT_CLOSE_DAYS_AFTER_START,
    value: 3,
    description: 'Default days after start date when driver enrolment closes',
  },
  {
    key: SETTING_KEYS.DEFAULT_INSTALL_APPROVER,
    value: 'PLATFORM',
    description: 'Default entity responsible for approving poster installations',
  },
  {
    key: SETTING_KEYS.COMMISSION_BPS,
    value: 2000,
    description: 'Platform commission rate in basis points (2000 = 20%)',
  },
  {
    key: SETTING_KEYS.GST_BPS,
    value: 1800,
    description: 'GST rate on platform fee in basis points (1800 = 18%)',
  },
  {
    key: SETTING_KEYS.LEDGER_ALLOW_NEGATIVE_BALANCE,
    value: false,
    description: 'Allow negative balance on non-overdraft accounts (strict false in production)',
  },
  {
    key: SETTING_KEYS.PAYOUT_AUTO_APPROVE_MAX_PAISE,
    value: 500000,
    description: 'Maximum payout amount in paise eligible for automatic approval (5000 INR)',
  },
  {
    key: SETTING_KEYS.PAYOUT_MIN_WITHDRAWAL_PAISE,
    value: 10000,
    description: 'Minimum driver wallet withdrawal amount in paise (100 INR)',
  },
  {
    key: SETTING_KEYS.PAYOUT_MANUAL_REVIEW_THRESHOLD_PAISE,
    value: 1000000,
    description: 'Payout threshold requiring manual dual-approval in paise (10000 INR)',
  },
  {
    key: SETTING_KEYS.PAYOUT_SLA_HOURS,
    value: 48,
    description: 'SLA target for processing payouts in hours',
  },
  {
    key: SETTING_KEYS.SETTLEMENT_GRACE_DAYS_DEFAULT,
    value: 3,
    description: 'Default grace missed days forgiven during settlement calculation',
  },
  {
    key: SETTING_KEYS.SETTLEMENT_AUTO_APPROVE_DELAY_HOURS,
    value: 24,
    description: 'Delay in hours before clean settlements are auto-approved',
  },
  {
    key: SETTING_KEYS.FINANCE_PAYMENTS_ENABLED,
    value: true,
    description: 'Global master switch for company payments acceptance',
  },
  {
    key: SETTING_KEYS.FINANCE_PAYOUTS_ENABLED,
    value: true,
    description: 'Global master switch for driver payouts and withdrawals',
  },
  {
    key: SETTING_KEYS.FINANCE_TDS_RATE_BPS,
    value: 100,
    description: 'TDS rate on driver payouts in basis points (100 = 1%)',
  },
  {
    key: SETTING_KEYS.FINANCE_COMPANY_GSTIN,
    value: '24AAAAA0000A1Z5',
    description: 'Platform GSTIN for tax invoice generation',
  },
  {
    key: SETTING_KEYS.FINANCE_STATE_CODE,
    value: '24',
    description: 'Platform state code for GST classification (24 = Gujarat)',
  },
  {
    key: SETTING_KEYS.FINANCE_INVOICE_PREFIX,
    value: 'INV',
    description: 'Sequential invoice numbering prefix',
  },
  {
    key: SETTING_KEYS.FINANCE_CREDIT_NOTE_PREFIX,
    value: 'CN',
    description: 'Sequential credit note numbering prefix',
  },
  {
    key: SETTING_KEYS.STRIKE_EXPIRY_DAYS,
    value: 180,
    description: 'Days before an active strike automatically expires',
  },
  {
    key: SETTING_KEYS.POSTER_FIX_HOURS,
    value: 48,
    description: 'Hours granted to a driver to fix damaged or missing poster',
  },
  {
    key: SETTING_KEYS.CONSECUTIVE_MISSED_DAYS_STRIKE,
    value: 5,
    description: 'Consecutive missed days streak threshold to issue a strike (0 disables)',
  },
  {
    key: SETTING_KEYS.ABANDON_DAYS_TERMINATE,
    value: 10,
    description: 'Consecutive missed days streak threshold to terminate assignment (0 disables)',
  },
  {
    key: SETTING_KEYS.APPEAL_WINDOW_DAYS,
    value: 7,
    description: 'Days within which a driver can appeal an issued strike',
  },
  {
    key: SETTING_KEYS.SETTLEMENT_DELAY_DAYS,
    value: 2,
    description: 'Days to delay settlement calculation after completion for dispute window',
  },
  {
    key: SETTING_KEYS.MAX_OPEN_DISPUTES_PER_USER,
    value: 5,
    description: 'Maximum concurrent open disputes per user',
  },
  {
    key: SETTING_KEYS.DISPUTE_REOPEN_WINDOW_DAYS,
    value: 3,
    description: 'Days allowed after decision to request a second-level review',
  },
  {
    key: SETTING_KEYS.DISPUTE_EVIDENCE_MAX_FILES,
    value: 10,
    description: 'Maximum evidence files allowed per dispute',
  },
  {
    key: SETTING_KEYS.QUIET_HOURS_DEFAULT_START,
    value: '22:00',
    description: 'Default quiet hours start time (HH:mm IST)',
  },
  {
    key: SETTING_KEYS.QUIET_HOURS_DEFAULT_END,
    value: '07:00',
    description: 'Default quiet hours end time (HH:mm IST)',
  },
  {
    key: SETTING_KEYS.NOTIFICATION_MAX_PUSH_PER_DAY,
    value: 10,
    description: 'Daily push notification cap per user for non-urgent notifications',
  },
  {
    key: SETTING_KEYS.SMS_ENABLED_EVENTS,
    value: [
      'PAYOUT_PAID',
      'STRIKE_ISSUED',
      'ASSIGNMENT_TERMINATED',
      'BAN_STARTED',
      'DISPUTE_RESOLVED',
    ],
    description: 'Events permitted to dispatch SMS messages',
  },
  {
    key: SETTING_KEYS.NOTIFICATION_RETENTION_DAYS,
    value: 90,
    description: 'Days to retain notifications and deliveries before cleanup',
  },
  {
    key: SETTING_KEYS.ADMIN_DIGEST_TIME,
    value: '09:00',
    description: 'Time to dispatch daily admin digest (HH:mm IST)',
  },
  {
    key: SETTING_KEYS.PUSH_PROVIDER,
    value: 'expo',
    description: 'Push notification provider (expo or dev)',
  },
  {
    key: SETTING_KEYS.ANNOUNCEMENT_BATCH_SIZE,
    value: 500,
    description: 'Batch size for broadcasting announcements',
  },
  {
    key: SETTING_KEYS.STRIKE_LIMIT,
    value: 3,
    description: 'Maximum active strikes before temporary ban and termination',
  },
  {
    key: SETTING_KEYS.BAN_DAYS,
    value: 90,
    description: 'Duration in days for a temporary driver ban',
  },
  {
    key: SETTING_KEYS.DISPUTE_SLA_WORKING_DAYS,
    value: 3,
    description: 'Working days SLA to resolve an opened dispute',
  },
  {
    key: SETTING_KEYS.ADMIN_IDLE_TIMEOUT_MINUTES,
    value: 30,
    description: 'Minutes of inactivity before admin session expires and locks',
  },
  {
    key: SETTING_KEYS.STEP_UP_TTL_MINUTES,
    value: 10,
    description: 'Minutes validity for step-up two-factor verification',
  },
  {
    key: SETTING_KEYS.ADMIN_IP_ALLOWLIST,
    value: [],
    description: 'List of allowed CIDR IP blocks for admin access (empty means disabled)',
  },
  {
    key: SETTING_KEYS.SENSITIVE_SETTING_KEYS,
    value: [
      SETTING_KEYS.COMMISSION_RATE_BPS,
      SETTING_KEYS.GST_RATE_BPS,
      'commission_bps',
      'gst_bps',
      'strike_limit',
      'ban_days',
      'min_payout_paise',
      'max_withdrawal_per_day_paise',
      'auto_approve_withdrawal_max_paise',
      'auto_approve_settlements',
      'settlement_anomaly_cut_percent',
      'grace_days',
      'payout_change_hold_days',
      'settlement_delay_days',
    ],
    description: 'Settings keys requiring dual-authorization maker-checker workflow',
  },
  {
    key: SETTING_KEYS.EXPORT_MAX_ROWS,
    value: 100000,
    description: 'Maximum row count per report export job',
  },
  {
    key: SETTING_KEYS.EXPORT_LINK_TTL_HOURS,
    value: 24,
    description: 'Hours before signed export download links expire',
  },
  {
    key: SETTING_KEYS.SEARCH_MIN_CHARS,
    value: 3,
    description: 'Minimum characters required for global admin search',
  },
  {
    key: SETTING_KEYS.MAINTENANCE_MODE,
    value: false,
    description: 'System maintenance mode toggle for external applications',
  },
  {
    key: SETTING_KEYS.MAINTENANCE_MESSAGE,
    value: 'Platform is undergoing scheduled maintenance. Please check back shortly.',
    description: 'Maintenance banner message displayed to drivers and advertisers',
  },
  {
    key: SETTING_KEYS.METRICS_TIMEZONE,
    value: 'Asia/Kolkata',
    description: 'Timezone for computing daily rollups and KPI metrics',
  },
];


export const SYSTEM_LEDGER_ACCOUNTS = [
  {
    code: 'SYS_PLATFORM_REVENUE',
    accountType: LEDGER_ACCOUNT_TYPES.PLATFORM_REVENUE,
    currency: 'INR',
  },
  {
    code: 'SYS_GST_PAYABLE',
    accountType: LEDGER_ACCOUNT_TYPES.GST_PAYABLE,
    currency: 'INR',
  },
  {
    code: 'SYS_GATEWAY_CLEARING',
    accountType: LEDGER_ACCOUNT_TYPES.GATEWAY_CLEARING,
    currency: 'INR',
  },
  {
    code: 'SYS_GATEWAY_FEES',
    accountType: LEDGER_ACCOUNT_TYPES.GATEWAY_FEES,
    currency: 'INR',
  },
  {
    code: 'SYS_PAYOUT_IN_TRANSIT',
    accountType: LEDGER_ACCOUNT_TYPES.PAYOUT_IN_TRANSIT,
    currency: 'INR',
  },
  {
    code: 'SYS_COMPANY_REFUND',
    accountType: LEDGER_ACCOUNT_TYPES.COMPANY_REFUND,
    currency: 'INR',
  },
  {
    code: 'SYS_ADJUSTMENT',
    accountType: LEDGER_ACCOUNT_TYPES.ADJUSTMENT,
    currency: 'INR',
  },
];

export async function seedBase(): Promise<void> {
  logger.info('Starting base database seed (production-safe & idempotent)...');

  // 1. Seed Permissions
  logger.info('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      create: {
        key: perm.key,
        description: perm.description,
      },
      update: {
        description: perm.description,
      },
    });
  }

  // 2. Seed Role Permissions
  logger.info('Seeding role permissions...');
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.key, p.id]));

  for (const [role, permKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const key of permKeys) {
      const permissionId = permMap.get(key);
      if (permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            role_permissionId: {
              role: role as Role,
              permissionId,
            },
          },
          create: {
            role: role as Role,
            permissionId,
          },
          update: {},
        });
      }
    }
  }

  // 3. Seed Default System Settings
  logger.info('Seeding default system settings...');
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
      update: {
        description: setting.description,
      },
    });
  }

  // 4. Seed System Ledger Accounts
  logger.info('Seeding system ledger accounts...');
  for (const acc of SYSTEM_LEDGER_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: acc.code },
      create: {
        code: acc.code,
        accountType: acc.accountType,
        currency: acc.currency,
      },
      update: {},
    });
  }

  // 5. Seed Super Admin User (if none exists)
  logger.info('Checking super admin user...');
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: ROLES.SUPER_ADMIN },
  });

  if (!existingSuperAdmin) {
    const defaultPassword = 'AdminPassword123!';
    const passwordHash = await hashPassword(defaultPassword);

    await prisma.user.create({
      data: {
        role: ROLES.SUPER_ADMIN,
        mobile: '9999999999',
        email: 'admin@autoposter.in',
        passwordHash,
        status: ACCOUNT_STATUS.APPROVED,
        preferredLanguage: 'en',
        preferredTheme: 'system',
        mustChangePassword: true,
        mobileVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
    logger.info('Super admin user created (mobile: 9999999999, email: admin@autoposter.in)');
  } else {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        mustChangePassword: true,
        mobileVerifiedAt: existingSuperAdmin.mobileVerifiedAt ?? new Date(),
        emailVerifiedAt: existingSuperAdmin.emailVerifiedAt ?? new Date(),
      },
    });
    logger.info('Super admin user already exists (updated verification and mustChangePassword flags)');
  }

  logger.info('Base database seed completed successfully!');
}

// Allow direct CLI execution
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedBase()
    .catch((err) => {
      logger.error({ err }, 'Base seed failed');
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
