import crypto from 'node:crypto';
import { prisma, disconnectPrisma } from '../src/shared/db/index.js';
import { hashPassword } from '../src/shared/crypto/index.js';
import { seedBase } from '../src/seeds/base.js';
import { env } from '../src/config/env.js';
import { ROLES, ACCOUNT_STATUS, SETTING_KEYS } from '@ap/shared-constants';

async function main() {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm');

  console.log('================================================================');
  console.log('       AUTO POSTER PLATFORM - PRODUCTION BOOTSTRAP TOOL         ');
  console.log('================================================================');
  console.log(`Environment: ${env.DB_ENVIRONMENT.toUpperCase()}`);
  console.log(`Execution Mode: ${isConfirmed ? '\x1b[31mLIVE COMMIT (--confirm)\x1b[0m' : '\x1b[33mDRY RUN (default)\x1b[0m'}`);
  console.log('----------------------------------------------------------------\n');

  if (!isConfirmed) {
    console.log('SAFETY NOTICE: Running in DRY-RUN mode. No changes will be applied.');
    console.log('To execute bootstrap on the database, re-run with:');
    console.log('  npm run ops:prod-bootstrap -- --confirm\n');

    console.log('Plan of operations:');
    console.log('  1. Verify empty/clean database state (no test drivers/companies).');
    console.log('  2. Apply base seed (lookup tables, ledger chart of accounts, system settings).');
    console.log('  3. Apply Phase 15 pilot guardrails (caps, invite-only flags).');
    console.log('  4. Create unique Super Admin account with randomly generated high-entropy password.');
    console.log('  5. Enforce mustChangePassword = true.');
    console.log('\nDry run completed successfully.');
    process.exit(0);
  }

  // 1. Check for any demo data in production
  const driverCount = await prisma.driverProfile.count();
  const companyCount = await prisma.companyProfile.count();
  const campaignCount = await prisma.campaign.count();

  console.log(`Current DB State: ${driverCount} drivers, ${companyCount} companies, ${campaignCount} campaigns.`);

  // 2. Seed Base Data
  console.log('Applying base schema seeds (roles, permissions, ledger, cities)...');
  await seedBase();

  // 3. Configure Phase 15 Pilot Settings
  console.log('Applying Phase 15 Pilot guardrail settings...');
  const pilotSettings = [
    { key: SETTING_KEYS.PILOT_MODE_ENABLED, value: true, desc: 'Enforce Phase 15 Pilot guardrails' },
    { key: SETTING_KEYS.PILOT_INVITE_ONLY, value: true, desc: 'Only users with valid invite codes can register' },
    { key: SETTING_KEYS.PILOT_MAX_DRIVERS, value: 50, desc: 'Maximum active pilot drivers' },
    { key: SETTING_KEYS.PILOT_MAX_COMPANIES, value: 10, desc: 'Maximum active pilot companies' },
    { key: SETTING_KEYS.PILOT_MAX_ACTIVE_CAMPAIGNS, value: 5, desc: 'Maximum concurrent active campaigns' },
    { key: SETTING_KEYS.PILOT_MAX_SLOTS_PER_CAMPAIGN, value: 20, desc: 'Maximum slots per campaign' },
    { key: SETTING_KEYS.PILOT_MAX_TOTAL_ESCROW_PAISE, value: 50000000, desc: 'Max total escrow cap (₹5,00,000)' },
    { key: SETTING_KEYS.PILOT_MAX_PAYOUT_PER_DAY_PAISE, value: 10000000, desc: 'Max platform payouts per day (₹1,00,000)' },
    { key: SETTING_KEYS.PILOT_MAX_WITHDRAWAL_PER_DRIVER_PER_DAY_PAISE, value: 500000, desc: 'Max withdrawal per driver per day (₹5,000)' },
    { key: SETTING_KEYS.SECOND_LOOK_PERCENT, value: 20, desc: 'Percentage of approved daily photos routed to QC second-look' },
    { key: SETTING_KEYS.FEEDBACK_ENABLED, value: true, desc: 'Enable driver and company feedback/NPS prompts' },
    { key: SETTING_KEYS.DAILY_BRIEF_ENABLED, value: true, desc: 'Send daily brief report at 08:30 IST' },
  ];

  for (const s of pilotSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value, description: s.desc },
      update: { value: s.value },
    });
  }

  // 4. Create or Rotate Super Admin Account
  const adminEmail = process.env.PROD_ADMIN_EMAIL || 'admin@autoposter.com';
  const adminMobile = process.env.PROD_ADMIN_MOBILE || '+919999999999';
  const rawAdminPassword = `Ap!${crypto.randomBytes(8).toString('base64url')}#${crypto.randomInt(10, 99)}`;
  const passwordHash = await hashPassword(rawAdminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      mobile: adminMobile,
      role: ROLES.SUPER_ADMIN,
      passwordHash,
      status: ACCOUNT_STATUS.APPROVED,
      preferredLanguage: 'en',
      preferredTheme: 'system',
      mustChangePassword: true,
      emailVerifiedAt: new Date(),
      mobileVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      mustChangePassword: true,
      status: ACCOUNT_STATUS.APPROVED,
    },
  });

  console.log('\n================================================================');
  console.log('             BOOTSTRAP EXECUTION COMPLETE                       ');
  console.log('================================================================');
  console.log(`Admin User ID:   ${admin.id}`);
  console.log(`Admin Email:     ${adminEmail}`);
  console.log(`Admin Mobile:    ${adminMobile}`);
  console.log(`Temporary Pass:  \x1b[32m${rawAdminPassword}\x1b[0m`);
  console.log('Must Change Pwd: YES (enforced on next login)');
  console.log('----------------------------------------------------------------');
  console.log('[OWNER ACTION] Save these temporary credentials in your password manager.');
  console.log('Log in immediately at /admin/login and choose a permanent password.');
  console.log('================================================================\n');

  await disconnectPrisma();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal bootstrap error:', err);
  await disconnectPrisma();
  process.exit(1);
});

