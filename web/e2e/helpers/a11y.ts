import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

export async function auditA11y(page: Page, contextName: string = 'Page') {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast']) // avoid false positives on subtle brand tinting in dark mode
    .analyze();

  const criticalViolations = accessibilityScanResults.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (criticalViolations.length > 0) {
    const summary = criticalViolations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      nodes: v.nodes.length,
    }));
    console.warn(`[A11y ${contextName}] Found ${criticalViolations.length} serious/critical accessibility issues:`, JSON.stringify(summary, null, 2));
  }

  // Ensure zero critical violations
  const strictlyCritical = accessibilityScanResults.violations.filter((v) => v.impact === 'critical');
  expect(
    strictlyCritical,
    `Critical accessibility violations found in ${contextName}: ${JSON.stringify(strictlyCritical, null, 2)}`,
  ).toHaveLength(0);
}
