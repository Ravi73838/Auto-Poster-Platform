import { clock } from '../src/shared/clock/index.js';
import { env } from '../src/config/env.js';

async function main() {
  if (env.DB_ENVIRONMENT === 'production') {
    console.error('ERROR: Clock manipulation is strictly prohibited in production!');
    process.exit(1);
  }

  await clock.init();

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'status': {
      console.log('--- Application Clock Status ---');
      console.log(`Environment:      ${env.DB_ENVIRONMENT}`);
      console.log(`Simulated Time:   ${clock.nowIso()}`);
      console.log(`IST Time:         ${clock.formatIst()}`);
      console.log(`Today (IST):      ${clock.todayIst()}`);
      console.log(`Offset (ms):      ${clock.getOffsetMs()}`);
      console.log(`Is Real Time:     ${!clock.isShifted()}`);
      break;
    }

    case 'advance': {
      const durationStr = args[1];
      if (!durationStr) {
        console.error('Usage: ops:clock advance <duration> (e.g. 1d, 12h, 30m, 60s)');
        process.exit(1);
      }

      let deltaMs = 0;
      const match = durationStr.match(/^(\d+)(d|h|m|s)$/i);
      if (!match) {
        console.error('Invalid duration format. Use 1d, 2h, 30m, or 60s.');
        process.exit(1);
      }

      const val = parseInt(match[1]!, 10);
      const unit = match[2]!.toLowerCase();
      if (unit === 'd') deltaMs = val * 86400 * 1000;
      else if (unit === 'h') deltaMs = val * 3600 * 1000;
      else if (unit === 'm') deltaMs = val * 60 * 1000;
      else if (unit === 's') deltaMs = val * 1000;

      const newOffset = await clock.advance(deltaMs);
      console.log(`Advanced clock by ${durationStr} (+${deltaMs}ms).`);
      console.log(`New Simulated Time: ${clock.nowIso()} (${clock.formatIst()})`);
      console.log(`Total Offset:       ${newOffset}ms`);
      break;
    }

    case 'reset': {
      await clock.reset();
      console.log('Clock reset to true real-time.');
      console.log(`Current Time: ${clock.nowIso()}`);
      break;
    }

    default: {
      console.log(`Unknown command: ${command}`);
      console.log('Available commands: status, advance <duration>, reset');
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Clock script error:', err);
  process.exit(1);
});

