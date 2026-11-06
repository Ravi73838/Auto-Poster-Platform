import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawEnvSchema } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export interface EnvMismatch {
  scope: 'api' | 'web' | 'mobile';
  missingInExample: string[];
  extraInExample: string[];
}

export function parseEnvExampleKeys(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const keys: string[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=/);
    if (match) {
      keys.push(match[1]!);
    }
  }
  return keys;
}

export function getCodebaseEnvKeys(dir: string, pattern: RegExp): string[] {
  const keys = new Set<string>();

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === '.expo') {
        continue;
      }
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf-8');
        let match: RegExpExecArray | null;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(text)) !== null) {
          if (match[1]) keys.add(match[1]);
        }
      }
    }
  }

  walk(dir);
  return Array.from(keys);
}

export function checkEnv(): EnvMismatch[] {
  const results: EnvMismatch[] = [];

  // 1. API Check: compare rawEnvSchema.shape with api/.env.example
  const apiSchemaKeys = Object.keys(rawEnvSchema.shape);
  const apiExampleKeys = parseEnvExampleKeys(path.join(REPO_ROOT, 'api', '.env.example'));

  const apiMissingInExample = apiSchemaKeys.filter((k) => !apiExampleKeys.includes(k));
  const apiExtraInExample = apiExampleKeys.filter((k) => !apiSchemaKeys.includes(k));

  if (apiMissingInExample.length > 0 || apiExtraInExample.length > 0) {
    results.push({
      scope: 'api',
      missingInExample: apiMissingInExample,
      extraInExample: apiExtraInExample,
    });
  }

  // 2. Web Check: compare VITE_* in web/src with web/.env.example
  const webUsedKeys = getCodebaseEnvKeys(path.join(REPO_ROOT, 'web', 'src'), /\b(VITE_[A-Z0-9_]+)\b/g);
  const webExampleKeys = parseEnvExampleKeys(path.join(REPO_ROOT, 'web', '.env.example'));

  const webMissingInExample = webUsedKeys.filter((k) => !webExampleKeys.includes(k));
  const webExtraInExample = webExampleKeys.filter((k) => !webUsedKeys.includes(k));

  if (webMissingInExample.length > 0 || webExtraInExample.length > 0) {
    results.push({
      scope: 'web',
      missingInExample: webMissingInExample,
      extraInExample: webExtraInExample,
    });
  }

  // 3. Mobile Check: compare EXPO_PUBLIC_* in mobile/src & mobile/app.config.ts with mobile/.env.example
  const mobileSrcKeys = getCodebaseEnvKeys(path.join(REPO_ROOT, 'mobile', 'src'), /\b(EXPO_PUBLIC_[A-Z0-9_]+)\b/g);
  const mobileConfigKeys = getCodebaseEnvKeys(path.join(REPO_ROOT, 'mobile'), /\b(EXPO_PUBLIC_[A-Z0-9_]+)\b/g);
  const mobileUsedKeys = Array.from(new Set([...mobileSrcKeys, ...mobileConfigKeys]));
  const mobileExampleKeys = parseEnvExampleKeys(path.join(REPO_ROOT, 'mobile', '.env.example'));

  const mobileMissingInExample = mobileUsedKeys.filter((k) => !mobileExampleKeys.includes(k));
  const mobileExtraInExample = mobileExampleKeys.filter((k) => !mobileUsedKeys.includes(k));

  if (mobileMissingInExample.length > 0 || mobileExtraInExample.length > 0) {
    results.push({
      scope: 'mobile',
      missingInExample: mobileMissingInExample,
      extraInExample: mobileExtraInExample,
    });
  }

  return results;
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const mismatches = checkEnv();

  if (mismatches.length > 0) {
    console.error('\x1b[31m[check:env] FAILED: Environment variable mismatches detected:\x1b[0m\n');
    for (const m of mismatches) {
      console.error(`--- Scope: ${m.scope.toUpperCase()} ---`);
      if (m.missingInExample.length > 0) {
        console.error(`  Missing from .env.example:`);
        for (const k of m.missingInExample) console.error(`    - ${k}`);
      }
      if (m.extraInExample.length > 0) {
        console.error(`  Extra in .env.example (not in schema/code):`);
        for (const k of m.extraInExample) console.error(`    - ${k}`);
      }
    }
    process.exit(1);
  } else {
    console.log('\x1b[32m[check:env] PASSED: All environment variables match schemas and examples in api, web, and mobile.\x1b[0m');
    process.exit(0);
  }
}
