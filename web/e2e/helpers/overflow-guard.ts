import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
    const clientWidth = docEl.clientWidth;
    return {
      hasOverflow: scrollWidth > clientWidth + 1, // allow 1px subpixel rounding
      scrollWidth,
      clientWidth,
    };
  });

  expect(
    overflow.hasOverflow,
    `Detected horizontal viewport overflow! scrollWidth: ${overflow.scrollWidth}px > clientWidth: ${overflow.clientWidth}px`,
  ).toBe(false);
}
