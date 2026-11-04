import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  syncShared,
  checkContractPurity,
  buildExpectedOutputs,
  formatGeneratedContent,
} from '../sync-shared.js';

describe('Shared Contract Sync & Purity Tests', () => {
  let tempDir: string;
  let contractDir: string;
  let webDir: string;
  let mobileDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-sync-test-'));
    contractDir = path.join(tempDir, 'contract');
    webDir = path.join(tempDir, 'web');
    mobileDir = path.join(tempDir, 'mobile');

    fs.mkdirSync(path.join(contractDir, 'constants'), { recursive: true });
    fs.mkdirSync(webDir, { recursive: true });
    fs.mkdirSync(mobileDir, { recursive: true });

    // Seed a valid pure contract file
    fs.writeFileSync(
      path.join(contractDir, 'constants', 'index.ts'),
      'export const APP_NAME = "Auto Poster Platform";\n',
      'utf-8',
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates copies in targets with header comment and manifest', () => {
    const res = syncShared({
      contractDir,
      webTargetDir: webDir,
      mobileTargetDir: mobileDir,
    });

    expect(res.success).toBe(true);
    expect(res.violations).toHaveLength(0);

    const webTargetFile = path.join(webDir, 'constants', 'index.ts');
    const mobileTargetFile = path.join(mobileDir, 'constants', 'index.ts');

    expect(fs.existsSync(webTargetFile)).toBe(true);
    expect(fs.existsSync(mobileTargetFile)).toBe(true);

    const content = fs.readFileSync(webTargetFile, 'utf-8');
    expect(content).toContain('// GENERATED FILE. DO NOT EDIT.');
    expect(content).toContain('APP_NAME');

    // Manifest exists and contains entry
    const manifestPath = path.join(webDir, '.generated-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest['constants/index.ts']).toBeDefined();
  });

  it('passes --check mode when targets are in sync', () => {
    // 1. Initial sync
    syncShared({ contractDir, webTargetDir: webDir, mobileTargetDir: mobileDir });

    // 2. Check mode
    const checkRes = syncShared({
      contractDir,
      webTargetDir: webDir,
      mobileTargetDir: mobileDir,
      checkOnly: true,
    });

    expect(checkRes.success).toBe(true);
    expect(checkRes.differences).toHaveLength(0);
  });

  it('fails --check mode when a generated file is modified', () => {
    syncShared({ contractDir, webTargetDir: webDir, mobileTargetDir: mobileDir });

    // Tamper with a generated file
    const webTargetFile = path.join(webDir, 'constants', 'index.ts');
    fs.appendFileSync(webTargetFile, '\n// Unauthorized local edit\n', 'utf-8');

    const checkRes = syncShared({
      contractDir,
      webTargetDir: webDir,
      mobileTargetDir: mobileDir,
      checkOnly: true,
    });

    expect(checkRes.success).toBe(false);
    expect(checkRes.differences.some((d) => d.target === 'web' && d.type === 'outdated')).toBe(true);
  });

  it('fails --check mode when a source file is updated but targets are not re-synced', () => {
    syncShared({ contractDir, webTargetDir: webDir, mobileTargetDir: mobileDir });

    // Update contract source file
    fs.writeFileSync(
      path.join(contractDir, 'constants', 'index.ts'),
      'export const APP_NAME = "Updated Name";\n',
      'utf-8',
    );

    const checkRes = syncShared({
      contractDir,
      webTargetDir: webDir,
      mobileTargetDir: mobileDir,
      checkOnly: true,
    });

    expect(checkRes.success).toBe(false);
    expect(checkRes.differences.length).toBeGreaterThan(0);
  });

  it('removes stale files from managed module directories in targets', () => {
    syncShared({ contractDir, webTargetDir: webDir, mobileTargetDir: mobileDir });

    // Introduce a stale file inside managed module directory in web
    const staleFile = path.join(webDir, 'constants', 'old-file.ts');
    fs.writeFileSync(staleFile, 'export const OLD = 1;\n', 'utf-8');

    // Check mode detects extra file
    const checkRes = syncShared({
      contractDir,
      webTargetDir: webDir,
      mobileTargetDir: mobileDir,
      checkOnly: true,
    });
    expect(checkRes.success).toBe(false);
    expect(checkRes.differences.some((d) => d.type === 'extra' && d.filePath.includes('old-file.ts'))).toBe(true);

    // Sync removes it
    syncShared({ contractDir, webTargetDir: webDir, mobileTargetDir: mobileDir });
    expect(fs.existsSync(staleFile)).toBe(false);
  });

  it('detects purity violations for forbidden imports in contract', () => {
    fs.writeFileSync(
      path.join(contractDir, 'constants', 'impure.ts'),
      'import fs from "fs";\nimport { PrismaClient } from "@prisma/client";\n',
      'utf-8',
    );

    const violations = checkContractPurity(contractDir);
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some((v) => v.specifier === 'fs')).toBe(true);
    expect(violations.some((v) => v.specifier === '@prisma/client')).toBe(true);

    const res = syncShared({ contractDir, webTargetDir: webDir, mobileTargetDir: mobileDir });
    expect(res.success).toBe(false);
    expect(res.violations.length).toBeGreaterThanOrEqual(2);
  });
});

