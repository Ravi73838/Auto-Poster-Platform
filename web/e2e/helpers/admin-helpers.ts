import type { Page, Browser } from '@playwright/test';
import { expect } from '@playwright/test';
import { ADMIN_CREDENTIALS, loginAdminViaUI } from './admin-auth-fixture';

/**
 * Asserts that a text element contains masked mobile or email (e.g. +91 99****9999 or a***@domain)
 */
export async function expectMasked(page: Page, textPattern: RegExp = /\*{3,}/) {
  await expect(page.locator(`text=${textPattern}`).first()).toBeVisible();
}

/**
 * Verifies that the provided HTML does not contain exposed unmasked Indian mobile numbers.
 */
export function expectNoExposedPii(html: string, allowedMobiles: string[] = []) {
  const matches = html.match(/\+91[6-9]\d{9}/g) || [];
  const unauthorized = matches.filter((m) => !allowedMobiles.includes(m));
  expect(unauthorized).toHaveLength(0);
}

/**
 * Executes a test function with two distinct admin browser contexts (for maker-checker flows).
 */
export async function withTwoAdmins(
  browser: Browser,
  adminRole1: 'SUPER_ADMIN' | 'MODERATOR' | 'FINANCE',
  adminRole2: 'SUPER_ADMIN_2' | 'MODERATOR_2' | 'FINANCE',
  testFn: (page1: Page, page2: Page) => Promise<void>,
) {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  try {
    const creds1 = ADMIN_CREDENTIALS[adminRole1];
    const creds2 = ADMIN_CREDENTIALS[adminRole2];

    await loginAdminViaUI(page1, creds1.email, creds1.password);
    await loginAdminViaUI(page2, creds2.email, creds2.password);

    await testFn(page1, page2);
  } finally {
    await context1.close();
    await context2.close();
  }
}
