import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('AG-5 Guard Tests: Security, Integrity & Placement Invariants', () => {
  const mobileSrcDir = path.resolve(__dirname, '..');
  const mobileAppDir = path.resolve(__dirname, '../../app');

  function getAllTsFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '__tests__' && entry.name !== 'dist') {
          results.push(...getAllTsFiles(fullPath));
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allFiles = [...getAllTsFiles(mobileSrcDir), ...getAllTsFiles(mobileAppDir)];

  it('Guard 1: No dev-sim or test-only bypass strings present in production source code', () => {
    const forbiddenPatterns = [
      /\bdev-sim\b/i,
      /\btest-bypass\b/i,
      /\bdisable-safety\b/i,
    ];

    const violations: { file: string; match: string }[] = [];

    for (const file of allFiles) {
      // Exclude test files, fakes, and simulator
      if (file.includes('fakes.ts') || file.includes('__tests__') || file.includes('tools')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push({ file: path.relative(mobileSrcDir, file), match: pattern.toString() });
        }
      }
    }

    expect(violations, `Found forbidden test bypass tokens in production source: ${JSON.stringify(violations)}`).toEqual([]);
  });

  it('Guard 2: No literal isMockLocation: false hard-coded in capture or queue files', () => {
    // isMockLocation must be read dynamically from location provider/adapter or input, never hard-coded false
    const captureFiles = allFiles.filter(
      (f) =>
        f.includes('DailyPhoto') ||
        f.includes('Installation') ||
        f.includes('daily-photo') ||
        f.includes('installation'),
    );

    const violations: string[] = [];
    for (const file of captureFiles) {
      if (file.includes('__tests__')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (/isMockLocation\s*:\s*false/i.test(content)) {
        violations.push(path.relative(mobileSrcDir, file));
      }
    }

    expect(violations, `Hard-coded isMockLocation: false found in capture files: ${violations.join(', ')}`).toEqual([]);
  });

  it('Guard 3: Auth tokens never written to plain AsyncStorage (SecureStore only)', () => {
    const asyncStorageFiles = allFiles.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return content.includes('@react-native-async-storage/async-storage') || content.includes('AsyncStorage');
    });

    const violations: string[] = [];
    for (const file of asyncStorageFiles) {
      if (file.includes('__tests__') || file.includes('fakes.ts') || file.includes('adapters/production.ts')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      // Detect saving auth tokens directly to AsyncStorage
      if (
        /AsyncStorage\.setItem\s*\([^)]*(auth_token|access_token|refresh_token|accessToken|refreshToken)/i.test(content)
      ) {
        violations.push(path.relative(mobileSrcDir, file));
      }
    }

    expect(violations, `Auth tokens written to AsyncStorage detected in: ${violations.join(', ')}`).toEqual([]);
  });

  it('Guard 4: AdSlot or AdMob libraries are NOT imported by forbidden sensitive screens', () => {
    const forbiddenScreenPatterns = [
      /camera/i,
      /kyc/i,
      /payout/i,
      /withdraw/i,
      /login/i,
      /register/i,
      /consent/i,
      /dispute/i,
      /discipline/i,
    ];

    const violations: string[] = [];

    for (const file of allFiles) {
      const isForbiddenScreen = forbiddenScreenPatterns.some((pattern) => pattern.test(file));
      if (isForbiddenScreen) {
        const content = fs.readFileSync(file, 'utf-8');
        if (
          content.includes('react-native-google-mobile-ads') ||
          content.includes('AdSlot') ||
          content.includes('BannerAd') ||
          content.includes('RewardedAd')
        ) {
          violations.push(path.relative(mobileSrcDir, file));
        }
      }
    }

    expect(violations, `Forbidden screens importing AdMob or AdSlot: ${violations.join(', ')}`).toEqual([]);
  });

  it('Guard 5: AdMob IDs in app configuration match Google official test ad unit IDs', () => {
    const appConfigPath = path.resolve(__dirname, '../../app.config.ts');
    expect(fs.existsSync(appConfigPath)).toBe(true);
    const content = fs.readFileSync(appConfigPath, 'utf-8');

    // Google Test App ID for Android: ca-app-pub-3940256099942544~3347511713
    // or test banner ad id
    if (content.includes('react-native-google-mobile-ads')) {
      expect(content).toContain('ca-app-pub-3940256099942544');
    }
  });
});
