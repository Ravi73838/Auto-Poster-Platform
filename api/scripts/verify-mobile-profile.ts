import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

interface CheckItem {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

function main() {
  console.log('================================================================');
  console.log('   AUTO POSTER PLATFORM - DRIVER MOBILE RELEASE PROFILE AUDIT   ');
  console.log('================================================================');
  console.log(`Repository Root: ${REPO_ROOT}`);
  console.log(`Checked At:      ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  const checks: CheckItem[] = [];

  // 1. app.config.ts Check
  const appConfigPath = path.join(REPO_ROOT, 'mobile', 'app.config.ts');
  if (!fs.existsSync(appConfigPath)) {
    checks.push({
      name: 'app.config.ts Existence',
      status: 'FAIL',
      details: 'mobile/app.config.ts not found',
    });
  } else {
    const configContent = fs.readFileSync(appConfigPath, 'utf-8');

    // Package name
    if (configContent.includes("'com.autoposter.driver'")) {
      checks.push({
        name: 'Android Package Name',
        status: 'PASS',
        details: 'com.autoposter.driver (Google Play canonical ID)',
      });
    } else {
      checks.push({
        name: 'Android Package Name',
        status: 'FAIL',
        details: 'Canonical package name com.autoposter.driver missing',
      });
    }

    // Permissions
    const hasCamera = configContent.includes('android.permission.CAMERA');
    const hasLocation = configContent.includes('android.permission.ACCESS_FINE_LOCATION');
    const hasNotifs = configContent.includes('android.permission.POST_NOTIFICATIONS');
    if (hasCamera && hasLocation && hasNotifs) {
      checks.push({
        name: 'Android Permissions Set',
        status: 'PASS',
        details: 'CAMERA, FINE_LOCATION, and POST_NOTIFICATIONS configured',
      });
    } else {
      checks.push({
        name: 'Android Permissions Set',
        status: 'FAIL',
        details: 'Missing essential driver permissions (Camera/Location/Notifications)',
      });
    }

    // Scheme
    if (configContent.includes("scheme: 'autoposter'")) {
      checks.push({
        name: 'Deep Link Scheme',
        status: 'PASS',
        details: 'autoposter:// registered for invite codes & notifications',
      });
    } else {
      checks.push({
        name: 'Deep Link Scheme',
        status: 'FAIL',
        details: 'Custom URL scheme autoposter:// not registered',
      });
    }

    // Fonts
    const hasDevanagari = configContent.includes('NotoSansDevanagari');
    const hasGujarati = configContent.includes('NotoSansGujarati');
    if (hasDevanagari && hasGujarati) {
      checks.push({
        name: 'Indic Fonts Packaging',
        status: 'PASS',
        details: 'Hindi (Devanagari) & Gujarati fonts bundled for vernacular support',
      });
    } else {
      checks.push({
        name: 'Indic Fonts Packaging',
        status: 'WARN',
        details: 'Missing local font bundles for Hindi or Gujarati',
      });
    }
  }

  // 2. eas.json Check
  const easPath = path.join(REPO_ROOT, 'mobile', 'eas.json');
  if (fs.existsSync(easPath)) {
    const easContent = fs.readFileSync(easPath, 'utf-8');
    if (easContent.includes('"production"')) {
      checks.push({
        name: 'EAS Production Build Profile',
        status: 'PASS',
        details: 'Production AAB profile defined in mobile/eas.json',
      });
    } else {
      checks.push({
        name: 'EAS Production Build Profile',
        status: 'WARN',
        details: 'Production profile missing in eas.json',
      });
    }
  }

  // Output Report
  console.log('PROFILE VERIFICATION RESULTS:');
  for (const c of checks) {
    const badge =
      c.status === 'PASS'
        ? '\x1b[32m[PASS]\x1b[0m'
        : c.status === 'WARN'
        ? '\x1b[33m[WARN]\x1b[0m'
        : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`  ${badge} ${c.name.padEnd(32)} : ${c.details}`);
  }

  const failures = checks.filter((c) => c.status === 'FAIL');
  console.log('\n----------------------------------------------------------------');
  if (failures.length > 0) {
    console.log(`\x1b[31mMOBILE PROFILE CHECK FAILED: ${failures.length} check(s) failed.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mDRIVER MOBILE APP RELEASE PROFILE VERIFIED SUCCESSFULLY.\x1b[0m`);
    process.exit(0);
  }
}

main();

