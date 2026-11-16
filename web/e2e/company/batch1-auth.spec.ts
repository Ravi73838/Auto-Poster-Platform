import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Batch 1: Public & Authentication', () => {
  let consoleGuard: ConsoleGuard;
  let networkRecorder: NetworkRecorder;

  test.beforeEach(async ({ page }) => {
    consoleGuard = new ConsoleGuard(page);
    networkRecorder = new NetworkRecorder(page);
  });

  test.afterEach(async ({ page }) => {
    consoleGuard.assertNoErrors();
    networkRecorder.assertNoServerError();
    await expectNoHorizontalOverflow(page);
  });

  test('1.1: Login Page elements, branding, accessibility, and no raw i18n keys', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form');

    // Branding & Header
    await expect(page.locator('h2')).toHaveText(/Company Sign In/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText(/Sign In/i);

    // Links
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/login"]')).toBeVisible();

    // Verify Environment Ribbon shows test / OTP status
    const ribbon = page.locator('text=OTP Authentication: OFF').or(page.locator('text=TEST'));
    if (await ribbon.count() > 0) {
      await expect(ribbon.first()).toBeVisible();
    }

    // Verify translations & a11y
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'login-page', { subfolder: 'batch1-auth' });
    await auditA11y(page, 'Login Page');
  });

  test('1.2: Login form validation errors for missing and malformed inputs', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form');

    // Click submit with empty fields
    await page.click('button[type="submit"]');

    // Expect validation errors
    await expect(page.locator('.text-danger').first()).toBeVisible();

    // Fill invalid email
    await page.fill('input[type="email"]', 'not-an-email');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Invalid email address.')).toBeVisible();

    await expectNoRawI18nKeys(page);
  });

  test('1.3: Language switcher toggles en, hi, and gu cleanly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('select, button:has-text("EN"), button:has-text("English")');

    // Find language switcher element
    const langSelect = page.locator('select').filter({ hasText: /English|Hindi|Gujarati/i });
    if (await langSelect.count() > 0) {
      // Switch to Hindi
      await langSelect.selectOption('hi');
      await page.waitForTimeout(500);
      await expectNoRawI18nKeys(page);

      // Switch to Gujarati
      await langSelect.selectOption('gu');
      await page.waitForTimeout(500);
      await expectNoRawI18nKeys(page);

      // Switch back to English
      await langSelect.selectOption('en');
      await page.waitForTimeout(500);
      await expectNoRawI18nKeys(page);
    }
  });

  test('1.4: Theme switcher toggles light and dark mode classes', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('button:has(.lucide-moon)');

    const darkBtn = page.locator('button:has(.lucide-moon)').first();
    const lightBtn = page.locator('button:has(.lucide-sun)').first();
    const htmlEl = page.locator('html');

    // Click dark mode
    await darkBtn.click();
    await page.waitForTimeout(300);
    const isDark = await htmlEl.evaluate((el) => el.classList.contains('dark'));
    expect(isDark).toBe(true);

    // Click light mode
    await lightBtn.click();
    await page.waitForTimeout(300);
    const isDarkAfterLight = await htmlEl.evaluate((el) => el.classList.contains('dark'));
    expect(isDarkAfterLight).toBe(false);
  });

  test('1.5: Forgot password flow navigation and submission', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForSelector('form');

    await expect(page.locator('h2')).toHaveText(/Forgot Password/i);
    await page.fill('input[type="email"]', 'demo.company@autoposter.in');
    await page.click('button[type="submit"]');

    // Should navigate to /reset-password with prefilled email
    await page.waitForURL(/\/reset-password/, { timeout: 15000 });
    await expect(page.locator('h2')).toHaveText(/Reset Password/i);
    await expect(page.locator('input[type="email"]')).toHaveValue('demo.company@autoposter.in');

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'reset-password-page', { subfolder: 'batch1-auth' });
  });

  test('1.6: Company registration with OTP off redirects to login', async ({ page }) => {
    await page.goto('/register');
    await page.waitForSelector('form');

    await expect(page.locator('h2')).toHaveText(/Register Company/i);

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const testEmail = `company.reg.${randomSuffix}@autoposter.in`;
    const testMobile = `98${randomSuffix}12`;

    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="tel"]', testMobile);
    await page.fill('input[type="password"]', 'CompanyPassword123!');

    await captureScreenshot(page, 'register-form', { subfolder: 'batch1-auth' });
    await page.click('button[type="submit"]');

    // With AUTH_OTP_ENABLED=false, should redirect to /login with success message
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.locator('text=/Registration successful/i')).toBeVisible();

    await expectNoRawI18nKeys(page);
  });

  test('1.7: Valid company sign-in navigates to dashboard and allows logout', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form');

    await page.fill('input[type="email"]', TEST_CREDENTIALS.OWNER.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.OWNER.password);

    await page.click('button[type="submit"]');

    // Navigates to dashboard
    await page.waitForURL(/\/company\/dashboard/, { timeout: 15000 });
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('header')).toContainText(TEST_CREDENTIALS.OWNER.email);

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'company-dashboard-after-login', { subfolder: 'batch1-auth' });

    // Perform Logout
    const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has(.lucide-log-out)').first();
    await logoutBtn.click();

    // Verify redirected back to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('1.8: Unauthenticated access to /company/dashboard redirects to /login', async ({ page }) => {
    // Clear any previous session
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());

    await page.goto('/company/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('1.9: Unknown route 404 fallback redirects to /login', async ({ page }) => {
    await page.goto('/random-nonexistent-path-12345');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
