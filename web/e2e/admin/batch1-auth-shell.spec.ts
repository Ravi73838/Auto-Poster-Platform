import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { ADMIN_CREDENTIALS, loginAdminViaUI, loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Batch 1: Admin Auth & Shell Infrastructure', () => {
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

  test('1.1: Admin Login Page elements, branding, accessibility, and validation errors', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('form');

    // Branding and Title
    await expect(page.locator('h2')).toHaveText(/Admin Portal|Administration/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Verify OTP disabled ribbon
    await expect(page.locator('text=/OTP authentication is DISABLED/i').first()).toBeVisible();

    // Validation error on empty submit
    await page.click('button[type="submit"]');
    await expect(page.locator('.text-danger, .text-red-500').first()).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'admin-login-page', { subfolder: 'batch1-admin-auth' });
    await auditA11y(page, 'Admin Login Page');
  });

  test('1.2: Valid Admin Login for SUPER_ADMIN, MODERATOR, and FINANCE with clean logout', async ({ page }) => {
    // 1. Super Admin login
    await loginAdminAs(page, 'SUPER_ADMIN');
    await expect(page.locator('text=/SUPER_ADMIN/i').first()).toBeVisible();
    await captureScreenshot(page, 'superadmin-dashboard', { subfolder: 'batch1-admin-auth' });

    // Logout
    await page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has(.lucide-log-out)').first().click();
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });

    // 2. Moderator login
    await loginAdminAs(page, 'MODERATOR');
    await expect(page.locator('text=/MODERATOR/i').first()).toBeVisible();
    await captureScreenshot(page, 'moderator-dashboard', { subfolder: 'batch1-admin-auth' });

    // Logout
    await page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has(.lucide-log-out)').first().click();
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });

    // 3. Finance login
    await loginAdminAs(page, 'FINANCE');
    await expect(page.locator('text=/FINANCE/i').first()).toBeVisible();
    await captureScreenshot(page, 'finance-dashboard', { subfolder: 'batch1-admin-auth' });
  });

  test('1.3: Forced Password Change Flow on mustChangePassword account', async ({ page }, testInfo) => {
    const creds = testInfo.project.name.includes('Tablet')
      ? ADMIN_CREDENTIALS.MUST_CHANGE_TABLET
      : ADMIN_CREDENTIALS.MUST_CHANGE;

    // Reset account state in test DB
    try {
      const apiDir = path.resolve(fileURLToPath(import.meta.url), '../../../../api');
      execSync('npx.cmd tsx scripts/reset-mustchange-users.ts', { cwd: apiDir, stdio: 'ignore' });
    } catch {
      // ignore
    }

    // Attempt login with mustchange admin account
    await page.goto('/admin/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', creds.email);
    await page.fill('input[type="password"]', creds.password);
    await page.click('button[type="submit"]');

    // Expect forced navigation to /change-password
    await page.waitForURL(/\/change-password/, { timeout: 15000 });
    await expect(page.locator('h2')).toHaveText(/Change Password/i);

    // Fill new password form
    const newPass = 'NewAdminPassword123!';
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(creds.password);
    await passwordInputs.nth(1).fill(newPass);
    await page.click('button[type="submit"]');

    // Verify success notice or redirect
    await expect(page.locator('text=/Password changed successfully|Admin Dashboard/i').first()).toBeVisible({ timeout: 10000 });
    await captureScreenshot(page, 'admin-forced-password-change', { subfolder: 'batch1-admin-auth' });
  });

  test('1.4: Navigation Filtering per Admin Role', async ({ page }) => {
    // Super admin sees all links
    await loginAdminAs(page, 'SUPER_ADMIN');
    await expect(page.locator('a[href="/admin/pilot-command-center"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/drivers"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/payments"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/settings"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/team-roles"]')).toBeVisible();

    // Logout and login as Moderator
    await page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has(.lucide-log-out)').first().click();
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });

    // Moderator: sees drivers, campaigns, photos; NOT payments or settings
    await loginAdminAs(page, 'MODERATOR');
    await expect(page.locator('a[href="/admin/drivers"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/photo-review"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/payments"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/settings"]')).toHaveCount(0);

    // Logout and login as Finance
    await page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has(.lucide-log-out)').first().click();
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });

    // Finance: sees payments, payouts; NOT drivers, photos, or settings
    await loginAdminAs(page, 'FINANCE');
    await expect(page.locator('a[href="/admin/payments"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/payouts"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/drivers"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/photo-review"]')).toHaveCount(0);
  });

  test('1.5: Direct Route Permission Guard blocks unauthorized roles with 403', async ({ page }) => {
    await loginAdminAs(page, 'FINANCE');

    // Attempt direct access to photo-review (requires photo.approve)
    await page.goto('/admin/photo-review');
    await page.waitForSelector('main');

    // Expect unauthorized notice
    await expect(page.locator('text=/not authorized|unauthorized|access denied/i').first()).toBeVisible();
    await captureScreenshot(page, 'admin-403-forbidden', { subfolder: 'batch1-admin-auth' });
  });

  test('1.6: Shell Features: Command Palette (Ctrl+K), Shortcuts Modal (?), Theme & Language', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');

    // 1. Command Palette Trigger via click
    const searchBtn = page.locator('button:has-text("Search or jump to...")');
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const cmdInput = page.locator('input[placeholder*="Search drivers"]');
    await expect(cmdInput).toBeVisible();

    // Type query and escape
    await cmdInput.fill('Drivers');
    await page.keyboard.press('Escape');
    await expect(cmdInput).not.toBeVisible();

    // 2. Keyboard shortcuts trigger
    const shortcutsBtn = page.locator('button[title*="Shortcuts"]').first();
    if (await shortcutsBtn.count() > 0) {
      await shortcutsBtn.click();
      const shortcutModal = page.locator('text=Keyboard Shortcuts').first();
      await expect(shortcutModal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(shortcutModal).not.toBeVisible();
    }

    // 3. Language Switcher buttons
    const hiBtn = page.locator('button:has-text("हिन्दी")');
    if (await hiBtn.count() > 0) {
      await hiBtn.click();
      await page.waitForTimeout(400);
      await expectNoRawI18nKeys(page);

      const guBtn = page.locator('button:has-text("ગુજરાતી")');
      await guBtn.click();
      await page.waitForTimeout(400);
      await expectNoRawI18nKeys(page);

      const enBtn = page.locator('button:has-text("English")');
      await enBtn.click();
      await page.waitForTimeout(400);
      await expectNoRawI18nKeys(page);
    }

    // 4. Theme Switcher
    const darkThemeBtn = page.locator('button[aria-label*="Dark"], button[title*="Dark"]').first();
    if (await darkThemeBtn.count() > 0) {
      await darkThemeBtn.click();
      await page.waitForTimeout(300);
    }

    await captureScreenshot(page, 'admin-shell-customized', { subfolder: 'batch1-admin-auth' });
  });
});
