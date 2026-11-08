import { clock } from '../src/shared/clock/index.js';
import { env } from '../src/config/env.js';
import { prisma, disconnectPrisma } from '../src/shared/db/index.js';
import { InviteCodeService } from '../src/modules/pilot/invite-code.service.js';
import { PilotCountersService } from '../src/modules/pilot/pilot-counters.service.js';
import { ROLES, ACCOUNT_STATUS } from '@ap/shared-constants';

interface RehearsalStep {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
  durationMs: number;
}

async function runStep(
  name: string,
  fn: () => Promise<string>,
): Promise<RehearsalStep> {
  const start = Date.now();
  try {
    const details = await fn();
    return {
      name,
      status: 'PASS',
      details,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name,
      status: 'FAIL',
      details: err.message,
      durationMs: Date.now() - start,
    };
  }
}

async function main() {
  console.log('================================================================');
  console.log('      AUTO POSTER PLATFORM - PILOT DRESS REHEARSAL DRILL        ');
  console.log('================================================================');
  console.log(`Environment: ${env.DB_ENVIRONMENT.toUpperCase()}`);
  console.log(`Started At:  ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  if (env.DB_ENVIRONMENT === 'production') {
    console.error('ERROR: ops:rehearsal is prohibited from running directly on production DB.');
    process.exit(1);
  }

  const steps: RehearsalStep[] = [];

  // Step 1: Clock State Check
  steps.push(
    await runStep('1. Initialize Simulated Clock', async () => {
      await clock.init();
      await clock.reset();
      return `Clock initialized at real-time (${clock.todayIst()})`;
    }),
  );

  // Step 2: Pilot Counters & Hard Caps Verification
  steps.push(
    await runStep('2. Verify Pilot Guardrail Hard Caps', async () => {
      const counters = await PilotCountersService.getCounters();
      return `Caps active: ${counters.maxDrivers} drivers, ${counters.maxCompanies} companies, ₹${(Number(counters.maxTotalEscrowPaise) / 100).toLocaleString('en-IN')} escrow max`;
    }),
  );

  // Step 3: Invite Code Generation & Validation
  let testCode = '';
  steps.push(
    await runStep('3. Generate & Validate Driver Invite Code', async () => {
      const invite = await InviteCodeService.createCode({
        role: ROLES.DRIVER,
        maxUses: 1,
        metadata: { rehearsalRunId: Date.now() },
      });
      testCode = invite.code;
      const val = await InviteCodeService.validateCode(testCode, ROLES.DRIVER);
      if (!val.valid) throw new Error(val.reason || 'Validation failed');
      return `Code generated: ${testCode} (Valid: ${val.valid})`;
    }),
  );

  // Step 4: Consume Invite Code
  steps.push(
    await runStep('4. Consume Invite Code & Enforce Single Use', async () => {
      await InviteCodeService.consumeCode(testCode);
      const val = await InviteCodeService.validateCode(testCode, ROLES.DRIVER);
      if (val.valid) throw new Error('Code should be exhausted after 1 use');
      return `Code successfully exhausted: status = ${val.reason}`;
    }),
  );

  // Step 5: Advance Application Clock (Simulate Day Rollover)
  steps.push(
    await runStep('5. Advance Application Clock (+1 Day)', async () => {
      const delta = 86400 * 1000;
      await clock.advance(delta);
      return `Simulated clock advanced to ${clock.todayIst()} (+24h)`;
    }),
  );

  // Step 6: Verify Ledger Balance Consistency
  steps.push(
    await runStep('6. Verify System Financial Ledger Integrity', async () => {
      const debitSum = await prisma.ledgerEntry.aggregate({
        _sum: { amountPaise: true },
        where: { direction: 'DEBIT' },
      });
      const creditSum = await prisma.ledgerEntry.aggregate({
        _sum: { amountPaise: true },
        where: { direction: 'CREDIT' },
      });

      const totalDebits = debitSum._sum?.amountPaise ?? BigInt(0);
      const totalCredits = creditSum._sum?.amountPaise ?? BigInt(0);

      if (totalDebits !== totalCredits) {
        throw new Error(
          `Ledger imbalance detected! Total Debits: ${totalDebits}, Total Credits: ${totalCredits}`,
        );
      }
      return `Ledger balanced: ₹${(Number(totalDebits) / 100).toFixed(2)} debits == ₹${(Number(totalCredits) / 100).toFixed(2)} credits`;
    }),
  );

  // Reset clock back
  await clock.reset();

  // Print Summary
  console.log('\nREHEARSAL EXECUTION SUMMARY:');
  for (const s of steps) {
    const badge =
      s.status === 'PASS'
        ? '\x1b[32m[PASS]\x1b[0m'
        : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`  ${badge} ${s.name.padEnd(45)} (${s.durationMs}ms) : ${s.details}`);
  }

  const failures = steps.filter((s) => s.status === 'FAIL');
  console.log('\n----------------------------------------------------------------');
  if (failures.length > 0) {
    console.log(`\x1b[31mREHEARSAL DRILL FAILED: ${failures.length} step(s) encountered errors.\x1b[0m`);
    await disconnectPrisma();
    process.exit(1);
  } else {
    console.log(`\x1b[32mALL REHEARSAL DRILL STEPS PASSED SUCCESSFULLY (${steps.length}/${steps.length}).\x1b[0m`);
    await disconnectPrisma();
    process.exit(0);
  }
}

main().catch(async (err) => {
  console.error('Fatal rehearsal error:', err);
  await disconnectPrisma();
  process.exit(1);
});

