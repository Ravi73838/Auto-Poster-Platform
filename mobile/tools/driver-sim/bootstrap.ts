import fs from 'node:fs';
import path from 'node:path';

// Explicitly load api/.env when running from mobile workspace
const apiEnv = path.resolve(__dirname, '../../../api/.env');
if (fs.existsSync(apiEnv)) {
  process.loadEnvFile(apiEnv);
}

process.env.NODE_ENV = 'test';
process.env.AUTH_OTP_ENABLED = 'false';
process.env.CLOCK_CONTROL_ENABLED = 'true';
