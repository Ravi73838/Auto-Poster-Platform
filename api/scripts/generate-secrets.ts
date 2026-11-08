import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateSecureHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function main() {
  console.log('================================================================');
  console.log('   AUTO POSTER PLATFORM - SECURE SECRETS GENERATOR (PHASE 15)   ');
  console.log('================================================================');
  console.log('Generating high-entropy cryptographic keys for production/staging...\n');

  const secrets = {
    JWT_ACCESS_SECRET: generateSecureHex(64),
    JWT_REFRESH_SECRET: generateSecureHex(64),
    SESSION_SECRET: generateSecureHex(32),
    DATA_ENCRYPTION_KEY: generateSecureHex(32),
    INTERNAL_API_KEY: generateSecureHex(32),
    METRICS_TOKEN: generateSecureHex(24),
  };

  const outputLines = [
    '# ================================================================',
    '# GENERATED SECRETS - KEEP CONFIDENTIAL AND NEVER COMMIT TO GIT',
    `# Generated at: ${new Date().toISOString()}`,
    '# ================================================================',
    `JWT_ACCESS_SECRET="${secrets.JWT_ACCESS_SECRET}"`,
    `JWT_REFRESH_SECRET="${secrets.JWT_REFRESH_SECRET}"`,
    `SESSION_SECRET="${secrets.SESSION_SECRET}"`,
    `DATA_ENCRYPTION_KEY="${secrets.DATA_ENCRYPTION_KEY}"`,
    `INTERNAL_API_KEY="${secrets.INTERNAL_API_KEY}"`,
    `METRICS_TOKEN="${secrets.METRICS_TOKEN}"`,
    '',
  ];

  const content = outputLines.join('\n');
  const targetDir = path.resolve(__dirname, '..');
  const fileName = `.env.secrets.${Date.now()}`;
  const targetPath = path.join(targetDir, fileName);

  fs.writeFileSync(targetPath, content, { encoding: 'utf-8', mode: 0o600 });

  console.log(`Successfully generated secrets file: \x1b[32m${fileName}\x1b[0m`);
  console.log(`Path: ${targetPath}`);
  console.log('\nKeys Generated:');
  console.log('  - JWT_ACCESS_SECRET   : 64 bytes (128 hex chars)');
  console.log('  - JWT_REFRESH_SECRET  : 64 bytes (128 hex chars)');
  console.log('  - SESSION_SECRET      : 32 bytes (64 hex chars)');
  console.log('  - DATA_ENCRYPTION_KEY : 32 bytes (64 hex chars)');
  console.log('  - INTERNAL_API_KEY    : 32 bytes (64 hex chars)');
  console.log('  - METRICS_TOKEN       : 24 bytes (48 hex chars)');
  console.log('\n[OWNER ACTION] Copy these secrets to your production secret manager or hosting environment.');
  console.log('NEVER commit this file to GitHub.');
}

main();

