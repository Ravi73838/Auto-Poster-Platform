import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function expectMoneyAndDates(page: Page) {
  const result = await page.evaluate(() => {
    const text = document.body.innerText || '';
    // Look for money representations
    const hasRupee = text.includes('₹');
    // Check for negative money glitch or broken NaN
    const brokenValues = text.match(/₹\s*NaN|₹\s*undefined|₹\s*-\d+/g);
    return {
      hasRupee,
      brokenValues,
    };
  });

  if (result.brokenValues && result.brokenValues.length > 0) {
    expect(
      result.brokenValues,
      `Found broken currency values: ${result.brokenValues.join(', ')}`,
    ).toBeNull();
  }
}
