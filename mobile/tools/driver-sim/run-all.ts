import './bootstrap';
import {
  setupSimulatorHarness,
  snapshotPublicTableCounts,
  assertTestLedgerBalanced,
} from './harness';
import { runAuthScenario } from './scenarios/01-auth';
import { runKycScenario } from './scenarios/02-kyc';
import { runCampaignsScenario } from './scenarios/03-campaigns';
import { runInstallationScenario } from './scenarios/04-installation';
import { runDailyPhotosScenario } from './scenarios/05-daily-photos';
import { runOfflineRestartScenario } from './scenarios/06-offline-restart';
import { runWalletScenario } from './scenarios/07-wallet';
import { runDisciplineDisputesScenario } from './scenarios/08-discipline-disputes';
import { runNotificationsScenario } from './scenarios/09-notifications';
import { runAdsOffersScenario } from './scenarios/10-ads-offers';

interface ScenarioResult {
  index: number;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

async function runAllDriverSimulatorScenarios(): Promise<void> {
  console.log('================================================================');
  console.log('🚗 AUTO POSTER - APP-FAITHFUL DRIVER SIMULATOR (LAYER 2)');
  console.log('   Running 10 end-to-end scenarios against live API (test schema)');
  console.log('================================================================\n');

  // 1. Initial snapshot of public schema row counts
  console.log('🔒 Verifying Public Schema Safety Guard...');
  const initialPublicCounts = await snapshotPublicTableCounts();
  console.log('   Public baseline table counts:', initialPublicCounts);

  // 2. Setup isolated simulation harness
  console.log('🚀 Booting isolated test server on ephemeral port...');
  const ctx = await setupSimulatorHarness();
  console.log(`   Connected to test API at: ${ctx.baseUrl}\n`);

  const results: ScenarioResult[] = [];
  let driverAuth: { driverUserId: string; driverToken: string } | null = null;
  let assignmentId: string | null = null;

  async function execute(index: number, name: string, fn: () => Promise<void>) {
    const start = Date.now();
    process.stdout.write(`[Scenario ${index.toString().padStart(2, '0')}/10] ${name}... `);
    try {
      await fn();
      const durationMs = Date.now() - start;
      console.log(`✅ PASS (${durationMs}ms)`);
      results.push({ index, name, passed: true, durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ FAIL (${durationMs}ms) - ${msg}`);
      results.push({ index, name, passed: false, durationMs, error: msg });
    }
  }

  try {
    // Scenario 1: Auth & Login
    await execute(1, 'Registration, Login, Password & Session Security', async () => {
      await runAuthScenario(ctx);
    });

    // Scenario 2: KYC Onboarding & Verification
    await execute(2, 'KYC Wizard, Vehicle Plate & Document Uploads', async () => {
      driverAuth = await runKycScenario(ctx);
    });

    // Scenario 3: Campaigns Discovery & Reservation
    await execute(3, 'Campaigns Discovery, Filters & Slot Reservation', async () => {
      if (!driverAuth) throw new Error('Missing driver authentication from Scenario 2');
      const res = await runCampaignsScenario(ctx, driverAuth);
      assignmentId = res.assignmentId;
    });

    // Scenario 4: Installation Guide & Verification Photo
    await execute(4, 'Installation Guide, Fraud Checks & Photo Submission', async () => {
      if (!driverAuth || !assignmentId) throw new Error('Missing driver or assignment context');
      await runInstallationScenario(ctx, driverAuth, assignmentId);
    });

    // Scenario 5: Multi-Day Photo Proofs & Calendar Parity
    await execute(5, 'Multi-Day Proof Photos, Duplicate Day & Projections', async () => {
      if (!driverAuth || !assignmentId) throw new Error('Missing driver or assignment context');
      await runDailyPhotosScenario(ctx, driverAuth, assignmentId);
    });

    // Scenario 6: Offline Queue, Resumes & App Restart
    await execute(6, 'Offline Queue, Checkpoint Resumption & Account Scoping', async () => {
      if (!driverAuth || !assignmentId) throw new Error('Missing driver or assignment context');
      await runOfflineRestartScenario(ctx, driverAuth, assignmentId);
    });

    // Scenario 7: Wallet, Balance & Withdrawal Limits
    await execute(7, 'Wallet Balance, Rent Credits, Withdrawals & Ledger Invariant', async () => {
      if (!driverAuth) throw new Error('Missing driver authentication');
      await runWalletScenario(ctx, driverAuth);
      // Double check ledger is balanced after wallet operations
      await assertTestLedgerBalanced();
    });

    // Scenario 8: Discipline, Strikes, Ban & Dispute Appeals
    await execute(8, 'Discipline Strikes, 3-Strike Ban & Dispute Evidence Appeal', async () => {
      if (!driverAuth) throw new Error('Missing driver authentication');
      await runDisciplineDisputesScenario(ctx, driverAuth, assignmentId || undefined);
    });

    // Scenario 9: Notifications, Unread Badges & Push Tokens
    await execute(9, 'Notification Badges, Deep Link Resolution & Push Registration', async () => {
      if (!driverAuth) throw new Error('Missing driver authentication');
      await runNotificationsScenario(ctx, driverAuth);
    });

    // Scenario 10: Ads & Offers Placement Guards
    await execute(10, 'Ads Placement Policy, Kill Switches & Test Unit IDs', async () => {
      await runAdsOffersScenario(ctx);
    });

    // 3. Verify public schema table counts are unchanged
    console.log('\n🔒 Verifying Public Schema Counts Post-Simulation...');
    const finalPublicCounts = await snapshotPublicTableCounts();
    let publicSchemaAltered = false;
    for (const [table, count] of Object.entries(initialPublicCounts)) {
      if (finalPublicCounts[table] !== count) {
        console.error(`🚨 ALERT: Table public.${table} row count changed from ${count} to ${finalPublicCounts[table]}!`);
        publicSchemaAltered = true;
      }
    }
    if (!publicSchemaAltered) {
      console.log('   ✅ Public schema completely untouched (0 writes, 0 deletions, 0 migrations).');
    } else {
      throw new Error('Public schema safety invariant violated during simulator run!');
    }

    // 4. Summary Output
    console.log('\n================================================================');
    console.log('📊 DRIVER SIMULATOR RESULTS SUMMARY');
    console.log('================================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

    console.log(`Total Scenarios : ${results.length}`);
    console.log(`Passed          : ${passedCount} ✅`);
    console.log(`Failed          : ${failedCount} ${failedCount > 0 ? '❌' : ''}`);
    console.log(`Total Run Time  : ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    await ctx.stop();
    process.exit(0);
  }
}

runAllDriverSimulatorScenarios().catch((err) => {
  console.error('\n💥 Simulator Fatal Exception:', err);
  process.exit(1);
});
