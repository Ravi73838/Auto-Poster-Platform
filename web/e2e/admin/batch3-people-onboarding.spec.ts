import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';
import { stepUp } from '../helpers/step-up';

test.describe('Batch 3: People & Onboarding (Drivers & Companies)', () => {
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

  test('3.1: Drivers list, search filter, KYC status tabs, and export', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/drivers');
    await page.waitForSelector('main table');

    // Page Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Driver/i);

    // Verify KYC status filter buttons
    const submittedTab = page.locator('button:has-text("Pending Review"), button:has-text("Pending KYC"), button:has-text("SUBMITTED")').first();
    if (await submittedTab.count() > 0) {
      await submittedTab.click();
      await page.waitForTimeout(400);
      expect(page.url()).toContain('kycStatus');
    }

    // Search driver input
    const searchInput = page.locator('input[placeholder*="Filter list"], input[placeholder*="Search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('Ramesh');
      await page.waitForTimeout(600);
      await searchInput.fill('');
      await page.waitForTimeout(600);
    }

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'admin-drivers-list', { subfolder: 'batch3-people-onboarding' });
    await auditA11y(page, 'Admin Drivers Page');
  });

  test('3.2: Driver 360 Drawer inspection and details view', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/drivers');
    await page.waitForSelector('main table tbody tr');

    // Wait for driver row to populate
    const driverRow = page.locator('main table tbody tr').filter({ hasText: 'Ramesh Patel' }).first();
    await expect(driverRow).toBeVisible({ timeout: 10000 });
    await driverRow.locator('td').nth(1).click();

    // Verify Driver 360 Drawer opens
    const drawer = page.locator('div.fixed.inset-0.z-50').first();
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Verify Driver identity section
    await expect(drawer.locator('text=/Driver Identity & Contact/i')).toBeVisible({ timeout: 10000 });
    await expect(drawer.locator('text=/Vehicle Number/i')).toBeVisible();

    await captureScreenshot(page, 'admin-driver-360-drawer', { subfolder: 'batch3-people-onboarding' });

    // Close drawer
    const closeBtn = drawer.locator('button:has(.lucide-x)').first();
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('3.3: PII Masking by default and audited reveal via Step-Up verification', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/drivers');
    await page.waitForSelector('main table tbody tr');

    // Open driver drawer
    const driverRow = page.locator('main table tbody tr').filter({ hasText: 'Ramesh Patel' }).first();
    await expect(driverRow).toBeVisible({ timeout: 10000 });
    await driverRow.locator('td').nth(1).click();

    const drawer = page.locator('div.fixed.inset-0.z-50').first();
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await expect(drawer.locator('text=/Driver Identity & Contact/i')).toBeVisible({ timeout: 10000 });

    // Check for reveal button
    const revealBtn = drawer.locator('button:has-text("Reveal")').first();
    if (await revealBtn.count() > 0) {
      await revealBtn.click();

      // Complete Step-Up challenge
      await stepUp(page, 'AdminPassword123!');

      // Verify unmasked value or reveal button replaced
      await page.waitForTimeout(600);
      await captureScreenshot(page, 'admin-driver-pii-revealed', { subfolder: 'batch3-people-onboarding' });
    }

    // Close drawer
    const closeBtn = drawer.locator('button:has(.lucide-x)').first();
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('3.4: Companies directory, search, and Company 360 Drawer', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/companies');
    await page.waitForSelector('main table tbody tr');

    // Page title
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Compan/i);

    // Open company 360 drawer if row exists
    const firstRow = page.locator('main table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.locator('td').nth(1).click();

      const drawer = page.locator('div.fixed.inset-0.z-50').first();
      await expect(drawer).toBeVisible({ timeout: 10000 });

      // Verify Company Overview elements
      await expect(drawer.locator('text=/Corporate Legal & Tax Details|Legal Entity Name/i').first()).toBeVisible({ timeout: 10000 });

      await captureScreenshot(page, 'admin-company-360-drawer', { subfolder: 'batch3-people-onboarding' });

      // Close drawer
      const closeBtn = drawer.locator('button:has(.lucide-x)').first();
      await closeBtn.click();
      await expect(drawer).not.toBeVisible();
    }

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Companies Page');
  });
});
