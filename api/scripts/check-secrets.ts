import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export interface SecretFinding {
  file: string;
  line: number;
  rule: string;
}

// Ignore files that are examples, tests, documentation about examples, or lock files
const IGNORE_PATTERNS = [
  /\.env(\..+)?\.example$/,
  /\.example$/,
  /package-lock\.json$/,
  /check-secrets\.test\.ts$/,
  /check-secrets\.ts$/,
  /\.png$|\.jpg$|\.jpeg$|\.ico$|\.webp$|\.pdf$|\.zip$/i,
];

// Placeholders that are explicitly allowed
const PLACEHOLDER_STRINGS = [
  'YOUR_PASSWORD',
  'your-password',
  'password',
  'postgres',
  'postgres:postgres',
  'username:password',
  'autoposter_local_secret',
  'autoposter_ci_secret',
  'c1_very_secret_jwt_key',
  '<password>',
  '...',
  'dummy',
  'placeholder',
  'example',
  'AKIAIOSFODNN7EXAMPLE',
  'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  '00000000000000000000000000000000',
  'change-me',
  'changeme',
  'test-secret',
];

export function isPlaceholder(val: string): boolean {
  const lower = val.toLowerCase();
  return PLACEHOLDER_STRINGS.some((p) => lower.includes(p.toLowerCase()));
}

export function scanContent(content: string, filePath: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // 1. Private Key headers
    if (/-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/i.test(line)) {
      findings.push({
        file: filePath,
        line: lineNum,
        rule: 'Private key detected',
      });
      continue;
    }

    // 2. AWS Access Key (AKIA...)
    const awsMatch = line.match(/\b(AKIA[0-9A-Z]{16})\b/);
    if (awsMatch && !isPlaceholder(awsMatch[1]!)) {
      findings.push({
        file: filePath,
        line: lineNum,
        rule: 'AWS Access Key ID detected',
      });
      continue;
    }

    // 3. Database URL with non-placeholder password
    const dbUrlMatch = line.match(/postgres(?:ql)?:\/\/([^:\s'"`]+):([^@\s'"`]+)@([^\s'"`]+)/i);
    if (dbUrlMatch) {
      const user = dbUrlMatch[1]!;
      const pass = dbUrlMatch[2]!;
      if (!isPlaceholder(pass) && !isPlaceholder(user) && pass.length >= 6) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: 'Database connection string with credentials detected',
        });
        continue;
      }
    }

    // 4. Generic high-entropy string assigned to SECRET, KEY, TOKEN, PASSWORD
    const secretAssignMatch = line.match(
      /(?:SECRET|KEY|TOKEN|PASSWORD|API_KEY|AUTH_SECRET|JWT_SECRET)\s*[:=]\s*['"]([a-zA-Z0-9_\-+/=]{32,})['"]/i,
    );
    if (secretAssignMatch) {
      const val = secretAssignMatch[1]!;
      if (!isPlaceholder(val) && !isPlaceholder(line)) {
        findings.push({
          file: filePath,
          line: lineNum,
          rule: 'High-entropy secret token/key assignment detected',
        });
      }
    }
  }

  return findings;
}

export function checkSecrets(options?: { repoRoot?: string; files?: string[] }): SecretFinding[] {
  const root = options?.repoRoot || REPO_ROOT;
  let fileList: string[] = [];

  if (options?.files) {
    fileList = options.files;
  } else {
    try {
      const stdout = execSync('git ls-files', { cwd: root, encoding: 'utf-8' });
      fileList = stdout.split('\n').filter(Boolean);
    } catch {
      fileList = [];
    }
  }

  const allFindings: SecretFinding[] = [];

  for (const relPath of fileList) {
    const normalized = relPath.replace(/\\/g, '/');
    if (IGNORE_PATTERNS.some((pat) => pat.test(normalized))) {
      continue;
    }

    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > 2 * 1024 * 1024) continue; // Skip huge files > 2MB

      const content = fs.readFileSync(fullPath, 'utf-8');
      const findings = scanContent(content, normalized);
      allFindings.push(...findings);
    } catch {
      // Ignore binary / unreadable files
    }
  }

  return allFindings;
}

// CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const findings = checkSecrets();

  if (findings.length > 0) {
    console.error(`\x1b[31m[check:secrets] FAILED: ${findings.length} potential secret(s) found:\x1b[0m`);
    for (const f of findings) {
      // Safety rule: Print file and line ONLY, NEVER the value
      console.error(`  - ${f.file}:${f.line} [${f.rule}]`);
    }
    process.exit(1);
  } else {
    console.log('\x1b[32m[check:secrets] PASSED: No secrets detected in tracked files.\x1b[0m');
    process.exit(0);
  }
}
