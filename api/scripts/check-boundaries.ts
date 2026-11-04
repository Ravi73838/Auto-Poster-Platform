import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.resolve(REPO_ROOT, 'api');
const WEB_ROOT = path.resolve(REPO_ROOT, 'web');
const MOBILE_ROOT = path.resolve(REPO_ROOT, 'mobile');

export interface BoundaryViolation {
  scope: string;
  file: string;
  line: number;
  specifier: string;
  reason: string;
}

function getSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

export function checkBoundaries(): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;

  // 1. Check API files
  const apiFiles = getSourceFiles(path.join(API_ROOT, 'src'));
  for (const file of apiFiles) {
    const relFile = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;

      while ((match = importRegex.exec(line)) !== null) {
        const specifier = match[1]!;
        if (specifier.includes('web/') || specifier.includes('mobile/')) {
          violations.push({
            scope: 'api',
            file: relFile,
            line: i + 1,
            specifier,
            reason: 'API cannot import from web or mobile',
          });
        }
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), specifier);
          if (resolved.startsWith(WEB_ROOT) || resolved.startsWith(MOBILE_ROOT)) {
            violations.push({
              scope: 'api',
              file: relFile,
              line: i + 1,
              specifier,
              reason: 'Relative import in API resolves into web or mobile',
            });
          }
        }
      }
    }
  }

  // 2. Check Web files
  const webFiles = getSourceFiles(path.join(WEB_ROOT, 'src'));
  for (const file of webFiles) {
    const relFile = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    const isCompanyPortal = relFile.includes('src/portals/company');
    const isAdminPortal = relFile.includes('src/portals/admin');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;

      while ((match = importRegex.exec(line)) !== null) {
        const specifier = match[1]!;

        // Cannot import from API or Mobile
        if (specifier.includes('api/') || specifier.includes('mobile/')) {
          violations.push({
            scope: 'web',
            file: relFile,
            line: i + 1,
            specifier,
            reason: 'Web cannot import from api or mobile',
          });
        }
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), specifier);
          if (resolved.startsWith(API_ROOT) || resolved.startsWith(MOBILE_ROOT)) {
            violations.push({
              scope: 'web',
              file: relFile,
              line: i + 1,
              specifier,
              reason: 'Relative import in Web resolves into api or mobile',
            });
          }

          // Portal cross-import isolation
          if (isCompanyPortal) {
            const relResolved = path.relative(WEB_ROOT, resolved).replace(/\\/g, '/');
            if (relResolved.includes('portals/admin')) {
              violations.push({
                scope: 'web-portal',
                file: relFile,
                line: i + 1,
                specifier,
                reason: 'Company portal cannot import from Admin portal',
              });
            }
          }

          if (isAdminPortal) {
            const relResolved = path.relative(WEB_ROOT, resolved).replace(/\\/g, '/');
            if (relResolved.includes('portals/company')) {
              violations.push({
                scope: 'web-portal',
                file: relFile,
                line: i + 1,
                specifier,
                reason: 'Admin portal cannot import from Company portal',
              });
            }
          }
        }
      }
    }
  }

  // 3. Check Mobile files
  const mobileFiles = getSourceFiles(path.join(MOBILE_ROOT, 'src'));
  for (const file of mobileFiles) {
    const relFile = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;

      while ((match = importRegex.exec(line)) !== null) {
        const specifier = match[1]!;
        if (specifier.includes('api/') || specifier.includes('web/')) {
          violations.push({
            scope: 'mobile',
            file: relFile,
            line: i + 1,
            specifier,
            reason: 'Mobile cannot import from api or web',
          });
        }
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), specifier);
          if (resolved.startsWith(API_ROOT) || resolved.startsWith(WEB_ROOT)) {
            violations.push({
              scope: 'mobile',
              file: relFile,
              line: i + 1,
              specifier,
              reason: 'Relative import in Mobile resolves into api or web',
            });
          }
        }
      }
    }
  }

  return violations;
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🛡️  Checking architectural boundaries between api, web, and mobile...');
  const violations = checkBoundaries();

  if (violations.length > 0) {
    console.error(`\n❌ Found ${violations.length} boundary violations:`);
    for (const v of violations) {
      console.error(`   [${v.scope}] ${v.file}:${v.line} -> "${v.specifier}" (${v.reason})`);
    }
    process.exit(1);
  } else {
    console.log('✅ All architectural boundaries respected (zero cross-app and zero cross-portal leaks).');
    process.exit(0);
  }
}

