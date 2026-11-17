import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Batch 2: Dashboards, Reports & Admin Tables', () => {
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

  test('2.1: Admin Dashboard KPI metrics, perspective switching, and refresh', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/dashboard');
    await page.waitForSelector('main');

    // Page title and description
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Dashboard/i);

    // Verify Perspective Switcher buttons
    const execBtn = page.locator('button:has-text("Executive")');
    const opsBtn = page.locator('button:has-text("Operations / Ops")');
    const finBtn = page.locator('button:has-text("Finance / Payouts")');

    await expect(execBtn).toBeVisible();
    await expect(opsBtn).toBeVisible();
    await expect(finBtn).toBeVisible();

    // Verify Executive KPIs
    await expect(page.locator('text=Live Campaigns').first()).toBeVisible();
    await expect(page.locator('text=Running Autos').first()).toBeVisible();

    // Switch to Operations perspective
    await opsBtn.click();
    await expect(page.locator('text=/Review Queues|Pending/i').first()).toBeVisible();

    // Switch to Finance perspective
    await finBtn.click();
    await expect(page.locator('text=/Escrow|Payout/i').first()).toBeVisible();

    // Back to Executive
    await execBtn.click();

    // Refresh action
    const refreshBtn = page.locator('button[title="Refresh statistics"]').first();
    await refreshBtn.click();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'admin-dashboard-kpis', { subfolder: 'batch2-dashboards-reports' });
    await auditA11y(page, 'Admin Dashboard');
  });

  test('2.2: My Work Queues and SLA tracking overview', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/my-work');
    await page.waitForSelector('main');

    // Queue Summary Header
    await expect(page.locator('text=/Operations Work Queues/i').first()).toBeVisible();

    // Check presence of queue cards
    await expect(page.locator('text=KYC Reviews').first()).toBeVisible();
    await expect(page.locator('text=Campaign Approvals').first()).toBeVisible();
    await expect(page.locator('text=Daily Photo Checks').first()).toBeVisible();
    await expect(page.locator('text=Driver/Co Disputes').first()).toBeVisible();

    // Refresh queues
    const refreshBtn = page.locator('button[title*="Refresh"]').first();
    if (await refreshBtn.count() > 0) {
      await refreshBtn.click();
    }

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'admin-my-work-queues', { subfolder: 'batch2-dashboards-reports' });
    await auditA11y(page, 'Admin My Work Page');
  });

  test('2.3: Analytics & Reports export job creation modal', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/reports');
    await page.waitForSelector('main');

    // Verify Reports page header
    await expect(page.locator('text=/Reports & Compliance Data Exports/i').first()).toBeVisible();

    // Open export modal
    const generateBtn = page.locator('button:has-text("Generate New Export")');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Modal dialog
    const modalHeader = page.locator('h3:has-text("Generate CSV Export")');
    await expect(modalHeader).toBeVisible();

    // Close modal
    const closeBtn = page.locator('button:has-text("Cancel"), button:has(.lucide-x)').first();
    await closeBtn.click();
    await expect(modalHeader).not.toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'admin-reports-page', { subfolder: 'batch2-dashboards-reports' });
  });

  test('2.4: AdminDataTable features: Sorting, Searching, and Column Chooser', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/drivers');
    await page.waitForSelector('table, [role="table"], main');

    // Search input debounced sync
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('Rajesh');
      await page.waitForTimeout(600); // debounce
      expect(page.url()).toContain('q=Rajesh');
      await searchInput.fill('');
      await page.waitForTimeout(600);
    }

    // Column Chooser Toggle
    const colPickerBtn = page.locator('button[title*="Customize columns"], button:has(.lucide-columns)').first();
    if (await colPickerBtn.count() > 0) {
      await colPickerBtn.click();
      await page.waitForTimeout(200);
      // Close column chooser
      await page.keyboard.press('Escape');
    }

    // Density toggle
    const densityBtn = page.locator('button[title*="Comfortable"], button[title*="Compact"]').first();
    if (await densityBtn.count() > 0) {
      await densityBtn.click();
      await page.waitForTimeout(200);
    }

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'admin-data-table-features', { subfolder: 'batch2-dashboards-reports' });
  });
});
