import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root paths
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_ROOT = path.resolve(REPO_ROOT, 'api', 'src', 'contract');
const WEB_SHARED_ROOT = path.resolve(REPO_ROOT, 'web', 'src', 'shared');
const MOBILE_SHARED_ROOT = path.resolve(REPO_ROOT, 'mobile', 'src', 'shared');

// Contract modules to synchronize
export const CONTRACT_MODULES = [
  'constants',
  'types',
  'validation',
  'i18n',
  'tokens',
  'api-client',
  'money',
  'time',
] as const;

// Disallowed imports in contract files
const FORBIDDEN_IMPORT_PATTERNS = [
  /^node:/,
  /^(fs|path|crypto|os|child_process|http|https|net|tls|stream|buffer|process)(\/.*)?$/,
  /^@prisma/,
  /^(express|argon2|bullmq|ioredis|helmet|cors|cookie-parser|pino|nodemailer|pdf-lib)(\/.*)?$/,
  /^(react|react-dom|react-native|expo)(\/.*)?$/,
];

const ALLOWED_EXTERNAL_PACKAGES = ['zod'];

export interface PurityViolation {
  file: string;
  line: number;
  specifier: string;
  reason: string;
}

export interface SyncDifference {
  type: 'missing' | 'outdated' | 'extra';
  target: 'web' | 'mobile';
  filePath: string;
}

/**
 * Normalizes all line breaks to LF (\n).
 */
export function toLF(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Checks if a relative file path is a test file or test fixture.
 */
export function isTestFile(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  return (
    norm.includes('/__tests__/') ||
    norm.startsWith('__tests__/') ||
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(norm) ||
    /\.fixture\.(ts|js)$/.test(norm)
  );
}

/**
 * Scans a directory recursively and returns relative paths.
 */
export function getRelativeFiles(dir: string, baseDir = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getRelativeFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(relPath);
    }
  }

  return files;
}

/**
 * Analyzes contract files for purity violations.
 */
export function checkContractPurity(contractDir = CONTRACT_ROOT): PurityViolation[] {
  const violations: PurityViolation[] = [];
  const files = getRelativeFiles(contractDir).filter((f) => !isTestFile(f) && (f.endsWith('.ts') || f.endsWith('.tsx')));

  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;

  for (const relFile of files) {
    const fullPath = path.join(contractDir, relFile);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]!;
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;

      while ((match = importRegex.exec(lineText)) !== null) {
        const specifier = match[1]!;

        // 1. Check relative imports that escape the contract folder
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(fullPath), specifier);
          const relToContract = path.relative(contractDir, resolved);
          if (relToContract.startsWith('..') || path.isAbsolute(relToContract)) {
            violations.push({
              file: relFile,
              line: i + 1,
              specifier,
              reason: 'Relative import escapes contract directory',
            });
          }
          continue;
        }

        // 2. Allow @ap/* workspace specifiers (they map to contract folders)
        if (specifier.startsWith('@ap/')) {
          continue;
        }

        // 3. Check forbidden patterns (Node built-ins, servers, React)
        const isForbidden = FORBIDDEN_IMPORT_PATTERNS.some((pat) => pat.test(specifier));
        if (isForbidden) {
          violations.push({
            file: relFile,
            line: i + 1,
            specifier,
            reason: 'Import is not allowed in pure contract folder',
          });
          continue;
        }

        // 4. Check external packages: only zod is allowed
        const rootPkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
        if (!ALLOWED_EXTERNAL_PACKAGES.includes(rootPkg)) {
          violations.push({
            file: relFile,
            line: i + 1,
            specifier,
            reason: `External package "${rootPkg}" is not allowed in contract. Only ${ALLOWED_EXTERNAL_PACKAGES.join(', ')} permitted.`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Computes SHA-256 hash of a string content.
 */
function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Formats file with the generated header comment if it is TypeScript/JavaScript.
 */
export function formatGeneratedContent(relPath: string, sourceContent: string): string {
  const contentLF = toLF(sourceContent);
  if (relPath.endsWith('.ts') || relPath.endsWith('.tsx') || relPath.endsWith('.js')) {
    const header = [
      '// GENERATED FILE. DO NOT EDIT.',
      `// Source: api/src/contract/${relPath}`,
      '// Run `npm run sync:shared` in api.',
      '',
    ].join('\n');
    return header + contentLF;
  }
  return contentLF;
}

/**
 * Generates expected files map: Map<relPath, { content: string, hash: string }>
 */
export function buildExpectedOutputs(contractDir = CONTRACT_ROOT): Map<string, { content: string; hash: string }> {
  const allFiles = getRelativeFiles(contractDir);
  const contractFiles = allFiles.filter((f) => !isTestFile(f));
  const outputs = new Map<string, { content: string; hash: string }>();

  for (const relPath of contractFiles) {
    const fullSourcePath = path.join(contractDir, relPath);
    const rawContent = fs.readFileSync(fullSourcePath, 'utf-8');
    const generated = formatGeneratedContent(relPath, rawContent);
    const hash = sha256(generated);
    outputs.set(relPath, { content: generated, hash });
  }

  return outputs;
}

/**
 * Synchronizes contract folder to web/src/shared and mobile/src/shared.
 */
export function syncShared(options: {
  contractDir?: string;
  webTargetDir?: string;
  mobileTargetDir?: string;
  checkOnly?: boolean;
} = {}): { success: boolean; differences: SyncDifference[]; violations: PurityViolation[] } {
  const contractDir = options.contractDir ?? CONTRACT_ROOT;
  const webTargetDir = options.webTargetDir ?? WEB_SHARED_ROOT;
  const mobileTargetDir = options.mobileTargetDir ?? MOBILE_SHARED_ROOT;
  const checkOnly = options.checkOnly ?? false;

  // 1. Run Purity Check
  const violations = checkContractPurity(contractDir);
  if (violations.length > 0) {
    console.error('❌ Purity check failed in contract folder:');
    for (const v of violations) {
      console.error(`   ${v.file}:${v.line} -> import "${v.specifier}" (${v.reason})`);
    }
    return { success: false, differences: [], violations };
  }

  const expectedOutputs = buildExpectedOutputs(contractDir);
  const differences: SyncDifference[] = [];

  const targets: Array<{ name: 'web' | 'mobile'; dir: string }> = [
    { name: 'web', dir: webTargetDir },
    { name: 'mobile', dir: mobileTargetDir },
  ];

  for (const target of targets) {
    const targetDir = target.dir;

    // Detect missing or outdated files
    for (const [relPath, expected] of expectedOutputs.entries()) {
      const destPath = path.join(targetDir, relPath);
      if (!fs.existsSync(destPath)) {
        differences.push({ type: 'missing', target: target.name, filePath: relPath });
        if (!checkOnly) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, expected.content, 'utf-8');
        }
      } else {
        const actualContent = toLF(fs.readFileSync(destPath, 'utf-8'));
        if (actualContent !== expected.content) {
          differences.push({ type: 'outdated', target: target.name, filePath: relPath });
          if (!checkOnly) {
            fs.writeFileSync(destPath, expected.content, 'utf-8');
          }
        }
      }
    }

    // Detect extra / stale files in managed modules
    for (const mod of CONTRACT_MODULES) {
      const modDir = path.join(targetDir, mod);
      if (fs.existsSync(modDir)) {
        const actualModFiles = getRelativeFiles(modDir, targetDir);
        for (const actualRel of actualModFiles) {
          if (!expectedOutputs.has(actualRel)) {
            differences.push({ type: 'extra', target: target.name, filePath: actualRel });
            if (!checkOnly) {
              const fullStalePath = path.join(targetDir, actualRel);
              fs.unlinkSync(fullStalePath);
              // Clean up empty directories
              let parent = path.dirname(fullStalePath);
              while (parent !== targetDir && fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
                fs.rmdirSync(parent);
                parent = path.dirname(parent);
              }
            }
          }
        }
      }
    }

    // Write manifest and readme if syncing
    if (!checkOnly) {
      const manifest: Record<string, string> = {};
      for (const [relPath, exp] of expectedOutputs.entries()) {
        manifest[relPath] = exp.hash;
      }

      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(
        path.join(targetDir, '.generated-manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf-8',
      );

      const readmeContent = [
        '# Shared Contract (GENERATED)',
        '',
        '> **DO NOT EDIT FILES IN THIS FOLDER DIRECTLY.**',
        '',
        'These files are automatically synchronized from `api/src/contract/`.',
        'To make changes, edit the source code in `api/src/contract/` and run:',
        '',
        '```bash',
        '# inside api folder:',
        'npm run sync:shared',
        '',
        '# or from repository root:',
        'npm run sync',
        '```',
        '',
        'All `.ts` and `.tsx` files carry a generated header. Manifest with SHA-256 hashes is in `.generated-manifest.json`.',
      ].join('\n') + '\n';

      fs.writeFileSync(path.join(targetDir, 'README.generated.md'), readmeContent, 'utf-8');
    }
  }

  const success = violations.length === 0 && (checkOnly ? differences.length === 0 : true);
  return { success, differences, violations };
}

/**
 * Watch mode for continuous sync during development.
 */
export function watchShared(contractDir = CONTRACT_ROOT): void {
  console.log(`👀 Watching ${contractDir} for changes...`);
  let debounceTimer: NodeJS.Timeout | null = null;

  fs.watch(contractDir, { recursive: true }, (_eventType, filename) => {
    if (!filename || isTestFile(filename)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`\n🔄 Change detected in contract: ${filename}. Syncing...`);
      const res = syncShared();
      if (res.success) {
        console.log('✅ Synchronized successfully.');
      } else {
        console.error('❌ Sync failed.');
      }
    }, 200);
  });
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isWatch = args.includes('--watch');

  if (isWatch) {
    syncShared();
    watchShared();
  } else if (isCheck) {
    console.log('🔍 Checking synchronization of shared contract...');
    const result = syncShared({ checkOnly: true });

    if (!result.success) {
      if (result.violations.length > 0) {
        console.error(`\n❌ Found ${result.violations.length} purity violations in contract folder.`);
      }
      if (result.differences.length > 0) {
        console.error(`\n❌ Out of sync: found ${result.differences.length} differences:`);
        for (const diff of result.differences) {
          console.error(`   [${diff.target}] ${diff.type.toUpperCase()}: ${diff.filePath}`);
        }
        console.error('\nRun "npm run sync:shared" in api to re-synchronize.');
      }
      process.exit(1);
    } else {
      console.log('✅ Shared contract is synchronized and pure.');
      process.exit(0);
    }
  } else {
    console.log('🔄 Synchronizing shared contract to web and mobile...');
    const result = syncShared();
    if (!result.success) {
      process.exit(1);
    } else {
      console.log('✅ Synchronized successfully.');
      process.exit(0);
    }
  }
}

