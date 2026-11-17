import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Batch 7: Platform Administration & System Operations', () => {
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

  test('7.1: Platform configuration, parameters & maker-checker setting rules', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/settings');
    await page.waitForSelector('h1, h2');

    // Header verification
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Platform Configuration/i);

    // Verify settings category tabs or controls
    await page.waitForSelector('button, [role="tab"]', { timeout: 10000 });
    await captureScreenshot(page, 'admin-settings-platform', { subfolder: 'batch7-platform-admin' });

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Platform Settings');
  });

  test('7.2: Staff members management & role permissions matrix', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/team-roles');
    await page.waitForSelector('h1, h2');

    // Header verification
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Team Roles & Permissions/i);

    // Verify Staff Members tab is active
    await expect(page.locator('button:has-text("Staff Members")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Admin User")')).toBeVisible();

    // Verify table has admins
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    await captureScreenshot(page, 'admin-team-roles-members', { subfolder: 'batch7-platform-admin' });

    // Switch to Permissions Matrix tab
    const matrixTab = page.locator('button:has-text("Role Permissions Matrix")');
    await matrixTab.click();
    await page.waitForTimeout(500);

    // Verify matrix section loaded
    await expect(page.locator('text=/Privilege Matrix|SUPER_ADMIN/i').first()).toBeVisible({ timeout: 10000 });
    await captureScreenshot(page, 'admin-team-roles-matrix', { subfolder: 'batch7-platform-admin' });

    // Switch back to members
    await page.locator('button:has-text("Staff Members")').click();
    await page.waitForTimeout(400);

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Team Roles & Permissions');
  });

  test('7.3: Security & compliance audit trail log and event inspector', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/audit-log');
    await page.waitForSelector('h1, h2');

    // Header verification
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Security & Compliance Audit Trail/i);

    // Verify entity filter dropdown
    const filterSelect = page.locator('select[aria-label="Filter audit log by entity type"]');
    await expect(filterSelect).toBeVisible();

    await page.waitForTimeout(600);
    await captureScreenshot(page, 'admin-audit-trail', { subfolder: 'batch7-platform-admin' });

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Security Audit Trail');
  });

  test('7.4: Legal agreements CMS and Knowledge Base Help Center', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');

    // Part A: Legal Agreements
    await page.goto('/admin/legal');
    await page.waitForSelector('h1, h2');
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Legal Agreements & Policy CMS/i);
    await expect(page.locator('button:has-text("New Version Draft")')).toBeVisible();

    await page.waitForTimeout(500);
    await captureScreenshot(page, 'admin-legal-docs', { subfolder: 'batch7-platform-admin' });
    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Legal Agreements CMS');

    // Part B: Help Articles
    await page.goto('/admin/help');
    await page.waitForSelector('h1, h2');
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Knowledge Base & Help Center CMS/i);
    await expect(page.locator('button:has-text("New Help Article")')).toBeVisible();

    await page.waitForTimeout(500);
    await captureScreenshot(page, 'admin-help-articles', { subfolder: 'batch7-platform-admin' });
    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Help Articles CMS');
  });

  test('7.5: System diagnostics, health checks & background job monitoring', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/system');
    await page.waitForSelector('h1, h2');

    // Header verification
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/System Diagnostics & Job Monitoring/i);

    // Health cards verification
    await expect(page.locator('text=/PostgreSQL Database/i')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Redis In-Memory Bus/i')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);
    await captureScreenshot(page, 'admin-system-diagnostics', { subfolder: 'batch7-platform-admin' });

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin System Diagnostics');
  });

  test('7.6: Pilot launch readiness gate & infrastructure pre-flight checks', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/launch-readiness');
    await page.waitForSelector('h1, h2');

    // Header verification
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Pilot Launch Readiness/i);

    // Verify readiness banner
    await expect(page.locator('text=/Launch Status/i')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);
    await captureScreenshot(page, 'admin-launch-readiness', { subfolder: 'batch7-platform-admin' });

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Pilot Launch Readiness');
  });
});
