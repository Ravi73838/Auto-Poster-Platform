import { describe, it, expect } from 'vitest';
import { lightColors, darkColors } from '../tokens.js';
import { getContrastRatio } from '../contrast.js';

describe('Design Tokens Contrast Ratio (WCAG AA requirement >= 4.5:1)', () => {
  it('Light mode: textPrimary on background should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(lightColors.textPrimary, lightColors.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Light mode: textPrimary on surface should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(lightColors.textPrimary, lightColors.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Light mode: textSecondary on background should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(lightColors.textSecondary, lightColors.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Light mode: primaryText on primary should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(lightColors.primaryText, lightColors.primary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Dark mode: textPrimary on background should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(darkColors.textPrimary, darkColors.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Dark mode: textPrimary on surface should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(darkColors.textPrimary, darkColors.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Dark mode: textSecondary on background should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(darkColors.textSecondary, darkColors.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Dark mode: primaryText on primary should have contrast >= 4.5:1', () => {
    const ratio = getContrastRatio(darkColors.primaryText, darkColors.primary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

