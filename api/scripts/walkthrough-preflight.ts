import { prisma as publicPrisma } from '../src/shared/db/index.js';
import { SettingsService } from '../src/modules/settings/settings.service.js';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('================================================================');
  console.log('🔍 AG-6 PREFLIGHT: PUBLIC SCHEMA BASELINE INSPECTION (READ-ONLY)');
  console.log('================================================================\n');

  // 1. Snapshot main table counts and max timestamps
  const tables = [
    'users',
    'company_profiles',
    'company_members',
    'driver_profiles',
    'vehicles',
    'documents',
    'consent_records',
    'kyc_submissions',
    'campaigns',
    'campaign_zones',
    'campaign_payments',
    'assignments',
    'assignment_days',
    'photos',
    'photo_flags',
    'ledger_transactions',
    'ledger_entries',
    'payouts',
    'refunds',
    'disputes',
    'dispute_messages',
    'strikes',
    'poster_fix_notices',
    'notifications',
    'setting_change_requests',
    'audit_logs',
  ];

  const tableStats: Record<string, { count: number; maxCreatedAt: string | null }> = {};

  for (const table of tables) {
    try {
      const countRes: any = await publicPrisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "public"."${table}"`
      );
      // Check if table has created_at
      let maxTime: string | null = null;
      try {
        const maxTimeRes: any = await publicPrisma.$queryRawUnsafe(
          `SELECT MAX(created_at) as max_time FROM "public"."${table}"`
        );
        maxTime = maxTimeRes[0]?.max_time ? new Date(maxTimeRes[0].max_time).toISOString() : null;
      } catch {
        maxTime = null;
      }

      tableStats[table] = {
        count: countRes[0]?.count ?? 0,
        maxCreatedAt: maxTime,
      };
    } catch {
      tableStats[table] = { count: 0, maxCreatedAt: null };
    }
  }

  console.log('📊 Table Baseline Stats:');
  console.table(tableStats);

  // 2. Query target settings to be compressed during walkthrough
  const targetKeys = [
    'min_lead_days',
    'min_campaign_days',
    'settlement_delay_days',
    'daily_photo_late_grace_hours',
    'platform.commission_rate_bps',
    'platform.gst_rate_bps',
    'campaign.default_daily_rent_paise',
    'campaign.default_printing_allowance_paise',
  ];

  const currentSettings: Record<string, any> = {};
  for (const key of targetKeys) {
    try {
      const val = await SettingsService.get(key);
      currentSettings[key] = val;
    } catch {
      currentSettings[key] = null;
    }
  }

  console.log('\n⚙️ Current Settings Values (Baseline):');
  console.table(currentSettings);

  // 3. Inspect existing admin accounts
  const adminUsers = await publicPrisma.user.findMany({
    where: {
      role: { in: ['SUPER_ADMIN', 'MODERATOR', 'FINANCE'] },
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  console.log('\n👤 Existing Admin Users:');
  console.table(adminUsers);

  // 4. Save baseline snapshot to api/.local/walkthrough/preflight-baseline.json
  const outDir = path.resolve(process.cwd(), '.local/walkthrough');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const baselineData = {
    timestamp: new Date().toISOString(),
    tableStats,
    currentSettings,
    adminUsers,
  };

  fs.writeFileSync(
    path.join(outDir, 'preflight-baseline.json'),
    JSON.stringify(baselineData, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Preflight baseline recorded to: ${path.join(outDir, 'preflight-baseline.json')}`);
}

main()
  .catch((err) => {
    console.error('Preflight error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await publicPrisma.$disconnect();
  });
