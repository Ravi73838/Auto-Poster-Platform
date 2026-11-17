import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const ADMIN_CREDENTIALS = {
  SUPER_ADMIN: {
    email: 'admin@autoposter.in',
    password: 'AdminPassword123!',
    role: 'SUPER_ADMIN',
  },
  SUPER_ADMIN_2: {
    email: 'admin2@autoposter.in',
    password: 'AdminPassword123!',
    role: 'SUPER_ADMIN',
  },
  MODERATOR: {
    email: 'moderator@autoposter.in',
    password: 'ModeratorPassword123!',
    role: 'MODERATOR',
  },
  MODERATOR_2: {
    email: 'moderator2@autoposter.in',
    password: 'ModeratorPassword123!',
    role: 'MODERATOR',
  },
  FINANCE: {
    email: 'finance@autoposter.in',
    password: 'FinancePassword123!',
    role: 'FINANCE',
  },
  MUST_CHANGE: {
    email: 'mustchange.admin@autoposter.in',
    password: 'AdminPassword123!',
    role: 'SUPER_ADMIN',
  },
  MUST_CHANGE_TABLET: {
    email: 'mustchange.tablet@autoposter.in',
    password: 'AdminPassword123!',
    role: 'SUPER_ADMIN',
  },
};

export async function loginAdminViaUI(
  page: Page,
  email = ADMIN_CREDENTIALS.SUPER_ADMIN.email,
  password = ADMIN_CREDENTIALS.SUPER_ADMIN.password,
  expectedUrlPattern: RegExp = /\/admin\/dashboard/,
) {
  await page.goto('/admin/login');
  await page.waitForSelector('input[type="email"]');

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  await page.click('button[type="submit"]');

  await page.waitForURL(expectedUrlPattern, { timeout: 15000 });
  await expect(page.locator('header')).toBeVisible();
}

export async function loginAdminAs(
  page: Page,
  role: 'SUPER_ADMIN' | 'SUPER_ADMIN_2' | 'MODERATOR' | 'MODERATOR_2' | 'FINANCE',
) {
  const creds = ADMIN_CREDENTIALS[role];
  await loginAdminViaUI(page, creds.email, creds.password);
}
