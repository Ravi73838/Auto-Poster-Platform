import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Batch 4: Campaign & Photo Operations', () => {
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

  test('4.1: Campaign Artwork Review queue, filtering, and review modal', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/campaign-review');
    await page.waitForSelector('h1, h2');

    // Page Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Campaign.*Review/i);

    // Verify tabs
    const queueTab = page.locator('button:has-text("Review Queue")');
    const allTab = page.locator('button:has-text("All Platform Campaigns")');
    await expect(queueTab).toBeVisible();
    await expect(allTab).toBeVisible();

    // Verify campaigns table or empty state
    await page.waitForTimeout(500);

    // Switch to All Platform Campaigns tab
    await allTab.click();
    await page.waitForTimeout(600);
    await captureScreenshot(page, 'admin-campaign-all-tab', { subfolder: 'batch4-campaign-photo-ops' });

    // Switch back to Queue tab
    await queueTab.click();
    await page.waitForTimeout(600);

    // If campaign item exists in queue, open review modal
    const reviewBtn = page.locator('button:has-text("Review Poster")').first();
    if (await reviewBtn.count() > 0) {
      await reviewBtn.click();

      // Modal opens
      const modal = page.locator('div.fixed.inset-0.z-50').first();
      await expect(modal).toBeVisible({ timeout: 10000 });
      await expect(modal.locator('text=/Moderator Policy Checklist|Creative Poster Artwork/i').first()).toBeVisible({ timeout: 10000 });

      await captureScreenshot(page, 'admin-campaign-review-modal', { subfolder: 'batch4-campaign-photo-ops' });

      // Close modal
      const closeBtn = modal.locator('button:has(.lucide-x)').first();
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    } else {
      await captureScreenshot(page, 'admin-campaign-review-queue', { subfolder: 'batch4-campaign-photo-ops' });
    }

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Campaign Review Page');
  });

  test('4.2: Campaign Review rejection dialog and checklist controls', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/campaign-review');
    await page.waitForSelector('h1, h2');

    const reviewBtn = page.locator('button:has-text("Review Poster")').first();
    if (await reviewBtn.count() > 0) {
      await reviewBtn.click();

      const modal = page.locator('div.fixed.inset-0.z-50').first();
      await expect(modal).toBeVisible({ timeout: 10000 });

      // Check Reject Poster button
      const rejectBtn = modal.locator('button:has-text("Reject Poster")');
      if (await rejectBtn.count() > 0) {
        await rejectBtn.click();

        // Verify rejection sub-dialog opens
        await expect(modal.locator('text=/Select Rejection Reasons/i')).toBeVisible({ timeout: 5000 });
        await captureScreenshot(page, 'admin-campaign-reject-dialog', { subfolder: 'batch4-campaign-photo-ops' });

        // Cancel rejection
        const cancelBtn = modal.locator('button:has-text("Cancel")').first();
        await cancelBtn.click();
        await expect(modal.locator('text=/Select Rejection Reasons/i')).not.toBeVisible();
      }

      // Close modal
      const closeBtn = modal.locator('button:has(.lucide-x)').first();
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    }
  });

  test('4.3: Daily Photo Review queue, tabs, and inspector layout', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/photo-review');
    await page.waitForSelector('h1, h2');

    // Page Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Photo.*(Verification|Review)/i);

    // Verify tabs
    const dailyTab = page.locator('button:has-text("Daily Proof Queue"), button:has-text("Daily")').first();
    const installTab = page.locator('button:has-text("Installation Approvals"), button:has-text("Installation")').first();
    const fraudTab = page.locator('button:has-text("Fraud & Signals"), button:has-text("Fraud")').first();

    if (await dailyTab.count() > 0) {
      await dailyTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'admin-photo-review-daily', { subfolder: 'batch4-campaign-photo-ops' });
    }

    if (await installTab.count() > 0) {
      await installTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'admin-photo-review-install', { subfolder: 'batch4-campaign-photo-ops' });
    }

    if (await fraudTab.count() > 0) {
      await fraudTab.click();
      await page.waitForTimeout(400);
      await captureScreenshot(page, 'admin-photo-review-fraud', { subfolder: 'batch4-campaign-photo-ops' });
    }

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Photo Review Page');
  });

  test('4.4: Pilot Command Center real-time monitoring and guardrail metrics', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/pilot-command-center');
    await page.waitForSelector('h1, h2');

    // Header
    await expect(page.locator('main').locator('h1').first()).toHaveText(/Pilot Command Center/i);

    // Verify guardrail cards
    await expect(page.locator('text=/Driver Fleet/i').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Advertisers|Company/i').first()).toBeVisible({ timeout: 10000 });

    // Verify Readiness Gate link
    const readinessLink = page.locator('a[href*="launch-readiness"]').first();
    await expect(readinessLink).toBeVisible();

    // Verify Refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")').first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await page.waitForTimeout(500);

    await captureScreenshot(page, 'admin-pilot-command-center', { subfolder: 'batch4-campaign-photo-ops' });
    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Pilot Command Center');
  });
});
