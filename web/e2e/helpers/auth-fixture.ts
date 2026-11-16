import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const TEST_CREDENTIALS = {
  OWNER: {
    email: 'demo.company@autoposter.in',
    password: 'CompanyPassword123!',
    role: 'OWNER',
  },
  MANAGER: {
    email: 'manager.company@autoposter.in',
    password: 'CompanyPassword123!',
    role: 'MANAGER',
  },
  FINANCE: {
    email: 'finance.company@autoposter.in',
    password: 'CompanyPassword123!',
    role: 'FINANCE',
  },
  VIEWER: {
    email: 'viewer.company@autoposter.in',
    password: 'CompanyPassword123!',
    role: 'VIEWER',
  },
  PENDING: {
    email: 'pending.company@autoposter.in',
    password: 'CompanyPassword123!',
    role: 'OWNER',
  },
  SUSPENDED: {
    email: 'suspended.company@autoposter.in',
    password: 'CompanyPassword123!',
    role: 'OWNER',
  },
};

export async function loginViaUI(
  page: Page,
  email = TEST_CREDENTIALS.OWNER.email,
  password = TEST_CREDENTIALS.OWNER.password,
) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]');

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  await page.click('button:has-text("Sign In")');

  // Verify URL moved to company portal
  await page.waitForURL(/\/company\/dashboard/, { timeout: 15000 });
  await expect(page.locator('header')).toBeVisible();
}

export async function loginViaApi(
  page: Page,
  email = TEST_CREDENTIALS.OWNER.email,
  password = TEST_CREDENTIALS.OWNER.password,
) {
  // Use request context to hit API
  const response = await page.request.post('http://localhost:4000/api/v1/auth/company/login', {
    data: { email, password },
  });

  expect(response.ok(), `API login failed for ${email}: ${await response.text()}`).toBe(true);
  const data = await response.json();
  const token = data.data.accessToken;
  const user = data.data.user;

  // Navigate to root to attach localStorage
  await page.goto('/login');

  await page.evaluate(
    ({ session }) => {
      window.localStorage.setItem(
        'ap_auth_session',
        JSON.stringify({
          state: session,
          version: 0,
        }),
      );
    },
    {
      session: {
        user,
        token,
        permissions: [],
        isAuthenticated: true,
      },
    },
  );

  await page.goto('/company/dashboard');
  await page.waitForSelector('main', { timeout: 15000 });
}
