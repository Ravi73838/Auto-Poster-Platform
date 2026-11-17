import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getContrastRatio } from '../shared/tokens/contrast';
import { lightColors, darkColors } from '../shared/tokens';

describe('Layer 1 Category 8: i18n & Theme Testing', () => {
  const localesDir = path.resolve(__dirname, '../shared/i18n/locales');
  const namespaces = [
    'auth',
    'campaigns',
    'common',
    'errors',
    'kyc',
    'notifications',
    'settings',
    'status',
  ];

  function getKeys(obj: Record<string, any>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys.push(...getKeys(v, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  it('All 8 driver namespaces exist for en, hi, and gu', () => {
    for (const lang of ['en', 'hi', 'gu']) {
      for (const ns of namespaces) {
        const filePath = path.join(localesDir, lang, `${ns}.json`);
        expect(
          fs.existsSync(filePath),
          `Missing translation file: locales/${lang}/${ns}.json`,
        ).toBe(true);
      }
    }
  });

  it('No missing translation keys in Hindi (hi) compared to English (en)', () => {
    const missingKeys: string[] = [];

    for (const ns of namespaces) {
      const enContent = JSON.parse(
        fs.readFileSync(path.join(localesDir, 'en', `${ns}.json`), 'utf-8'),
      );
      const hiContent = JSON.parse(
        fs.readFileSync(path.join(localesDir, 'hi', `${ns}.json`), 'utf-8'),
      );

      const enKeys = getKeys(enContent);
      const hiKeys = new Set(getKeys(hiContent));

      for (const key of enKeys) {
        if (!hiKeys.has(key)) {
          missingKeys.push(`hi:${ns}:${key}`);
        }
      }
    }

    expect(missingKeys, `Missing keys in Hindi: ${missingKeys.join(', ')}`).toEqual([]);
  });

  it('No missing translation keys in Gujarati (gu) compared to English (en)', () => {
    const missingKeys: string[] = [];

    for (const ns of namespaces) {
      const enContent = JSON.parse(
        fs.readFileSync(path.join(localesDir, 'en', `${ns}.json`), 'utf-8'),
      );
      const guContent = JSON.parse(
        fs.readFileSync(path.join(localesDir, 'gu', `${ns}.json`), 'utf-8'),
      );

      const enKeys = getKeys(enContent);
      const guKeys = new Set(getKeys(guContent));

      for (const key of enKeys) {
        if (!guKeys.has(key)) {
          missingKeys.push(`gu:${ns}:${key}`);
        }
      }
    }

    expect(missingKeys, `Missing keys in Gujarati: ${missingKeys.join(', ')}`).toEqual([]);
  });

  it('No empty translation values in en, hi, or gu', () => {
    const emptyValues: string[] = [];

    for (const lang of ['en', 'hi', 'gu']) {
      for (const ns of namespaces) {
        const content = JSON.parse(
          fs.readFileSync(path.join(localesDir, lang, `${ns}.json`), 'utf-8'),
        );
        const keys = getKeys(content);
        for (const key of keys) {
          const parts = key.split('.');
          let val = content;
          for (const p of parts) val = val?.[p];
          if (typeof val === 'string' && val.trim().length === 0) {
            emptyValues.push(`${lang}:${ns}:${key}`);
          }
        }
      }
    }

    expect(emptyValues, `Empty translation strings found: ${emptyValues.join(', ')}`).toEqual([]);
  });

  describe('Theme Contrast & Visual Readability', () => {
    it('Light mode primary button text contrast meets WCAG AA (>= 4.5:1)', () => {
      const ratio = getContrastRatio(lightColors.primary, lightColors.primaryText);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('Light mode primary text against background meets WCAG AA (>= 4.5:1)', () => {
      const ratio = getContrastRatio(lightColors.textPrimary, lightColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('Dark mode primary text against surface meets WCAG AA (>= 4.5:1)', () => {
      const ratio = getContrastRatio(darkColors.textPrimary, darkColors.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('Dark mode text secondary meets readable contrast ratio (>= 3.0:1)', () => {
      const ratio = getContrastRatio(darkColors.textSecondary, darkColors.background);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });
});
