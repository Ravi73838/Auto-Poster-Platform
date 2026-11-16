import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const RAW_KEY_PATTERNS = [
  /\b(auth|common|errors|status|campaigns|disputes|payments)\.[a-zA-Z0-9_.-]+\b/,
  /\bundefined\b/,
  /\bNaN\b/,
  /\[object Object\]/,
];

export async function expectNoRawI18nKeys(page: Page, excludedSelectors: string[] = []) {
  // Extract visible body text
  const bodyText = await page.evaluate((exclusions) => {
    // Clone body or extract visible text while omitting excluded elements
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const sel of exclusions) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }
    // Remove scripts and styles
    clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
    return clone.innerText || '';
  }, excludedSelectors);

  for (const pattern of RAW_KEY_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match) {
      // Check if it's not a real code snippet or legitimate word
      expect(
        match[0],
        `Found raw untranslated i18n key or invalid token "${match[0]}" in page text:\n"${bodyText.slice(
          Math.max(0, (match.index || 0) - 40),
          Math.min(bodyText.length, (match.index || 0) + 40),
        )}"`,
      ).toBeUndefined();
    }
  }
}
