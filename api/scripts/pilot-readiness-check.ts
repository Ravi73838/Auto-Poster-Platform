import { LaunchService } from '../src/modules/admin/launch/launch.service.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/db/index.js';

async function main() {
  console.log('================================================================');
  console.log('         AUTO POSTER PLATFORM - PILOT READINESS CHECK           ');
  console.log('================================================================');
  console.log(`Timestamp:    ${new Date().toISOString()}`);
  console.log(`Environment:  ${env.DB_ENVIRONMENT.toUpperCase()}`);
  console.log(`Node Version: ${process.version}`);
  console.log('----------------------------------------------------------------\n');

  const readiness = await LaunchService.getLaunchReadiness();

  console.log('1. INFRASTRUCTURE & SERVICE HEALTH CHECKS:');
  for (const check of readiness.checks) {
    const badge =
      check.status === 'PASS'
        ? '\x1b[32m[PASS]\x1b[0m'
        : check.status === 'WARN'
        ? '\x1b[33m[WARN]\x1b[0m'
        : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`  ${badge} ${check.name.padEnd(35)} : ${check.message}`);
  }

  console.log('\n2. PHASE 15 PILOT LAUNCH SIGN-OFFS GATE:');
  for (const signOff of readiness.signOffs) {
    const badge = signOff.attested
      ? '\x1b[32m[SIGNED]\x1b[0m'
      : '\x1b[33m[PENDING]\x1b[0m';
    const detail = signOff.attested
      ? `by ${signOff.attestedByEmail || signOff.attestedBy} on ${signOff.attestedAt}`
      : 'Sign-off required prior to production execution';
    console.log(`  ${badge} ${signOff.label.padEnd(35)} : ${detail}`);
  }

  console.log('\n----------------------------------------------------------------');
  const statusColor =
    readiness.overallStatus === 'READY'
      ? '\x1b[32m'
      : readiness.overallStatus === 'WARNING'
      ? '\x1b[33m'
      : '\x1b[31m';
  console.log(`OVERALL READINESS STATUS: ${statusColor}${readiness.overallStatus}\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (env.DB_ENVIRONMENT === 'production' && readiness.overallStatus === 'BLOCKED') {
    console.error('CRITICAL: Production launch readiness checks failed or sign-offs are missing!');
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal readiness check error:', err);
  process.exit(1);
});

