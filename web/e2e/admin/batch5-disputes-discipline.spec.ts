import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Batch 5: Disputes & Discipline', () => {
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

  test('5.1: Disputes queue, filtering, conversation thread & resolution modal', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/disputes');
    await page.waitForSelector('h1, h2');

    // Page Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Dispute/i);

    // Filter controls
    const statusSelect = page.locator('select[aria-label="Filter disputes by status"]');
    const queueSelect = page.locator('select[aria-label="Filter disputes by queue"]');
    await expect(statusSelect).toBeVisible();
    await expect(queueSelect).toBeVisible();

    // Verify Claim button
    const claimNextBtn = page.locator('button:has-text("Claim Next")').first();
    await expect(claimNextBtn).toBeVisible();

    await page.waitForTimeout(600);
    await captureScreenshot(page, 'admin-disputes-queue', { subfolder: 'batch5-disputes-discipline' });

    // Check if dispute items exist in queue
    const disputeItem = page.locator('.cursor-pointer:has-text("DSP-"), .cursor-pointer:has-text("Dispute")').first();
    if (await disputeItem.count() > 0) {
      await disputeItem.click();
      await page.waitForTimeout(600);

      // Verify detail pane
      await captureScreenshot(page, 'admin-dispute-detail', { subfolder: 'batch5-disputes-discipline' });

      // Check Request Info modal
      const requestInfoBtn = page.locator('button:has-text("Request Info")').first();
      if (await requestInfoBtn.count() > 0) {
        await requestInfoBtn.click();
        await expect(page.locator('text=/Request Additional Information/i')).toBeVisible({ timeout: 5000 });
        const cancelBtn = page.locator('button:has-text("Cancel")').first();
        await cancelBtn.click();
      }

      // Check Decision & Effects modal
      const resolveBtn = page.locator('button:has-text("Resolve & Execute Effects"), button:has-text("Resolve")').first();
      if (await resolveBtn.count() > 0) {
        await resolveBtn.click();
        await expect(page.locator('text=/Execute Dispute Decision & Effects/i')).toBeVisible({ timeout: 5000 });
        await captureScreenshot(page, 'admin-dispute-decision-modal', { subfolder: 'batch5-disputes-discipline' });
        const cancelBtn = page.locator('button:has-text("Cancel")').first();
        await cancelBtn.click();
      }
    }

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Disputes Page');
  });

  test('5.2: Driver discipline, strikes, and suspension controls', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/discipline');
    await page.waitForSelector('h1, h2');

    // Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Discipline/i);

    // Verify tabs
    const strikesTab = page.locator('button:has-text("Strikes"), button:has-text("Active Strikes")').first();
    const bansTab = page.locator('button:has-text("Bans"), button:has-text("Suspensions")').first();
    await expect(strikesTab).toBeVisible();
    await expect(bansTab).toBeVisible();

    await captureScreenshot(page, 'admin-discipline-strikes', { subfolder: 'batch5-disputes-discipline' });

    // Open Issue Strike Modal
    const issueBtn = page.locator('button:has-text("Issue Strike")').first();
    if (await issueBtn.count() > 0) {
      await issueBtn.click();
      await expect(page.locator('text=/Issue Manual Driver Strike/i')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, 'admin-discipline-issue-modal', { subfolder: 'batch5-disputes-discipline' });

      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      await cancelBtn.click();
      await expect(page.locator('text=/Issue Manual Driver Strike/i')).not.toBeVisible();
    }

    // Switch to Bans Tab
    await bansTab.click();
    await page.waitForTimeout(600);
    await captureScreenshot(page, 'admin-discipline-bans', { subfolder: 'batch5-disputes-discipline' });

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Discipline Page');
  });

  test('5.3: Trilingual announcements composer and broadcast management', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/announcements');
    await page.waitForSelector('h1, h2');

    // Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Announcements/i);

    await captureScreenshot(page, 'admin-announcements-list', { subfolder: 'batch5-disputes-discipline' });

    // Open Compose modal
    const composeBtn = page.locator('button:has-text("New Announcement"), button:has-text("Compose")').first();
    await expect(composeBtn).toBeVisible();
    await composeBtn.click();

    // Verify Modal
    const modalTitle = page.locator('h3:has-text("Compose Multilingual Announcement")');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Verify Language tabs
    const enTab = page.locator('button:has-text("English")').last();
    const hiTab = page.locator('button:has-text("Hindi")').first();
    const guTab = page.locator('button:has-text("Gujarati")').first();
    await expect(enTab).toBeVisible();
    await expect(hiTab).toBeVisible();
    await expect(guTab).toBeVisible();

    // Fill English title and body
    const titleInput = page.locator('input[placeholder*="title"]').first();
    const bodyInput = page.locator('textarea[placeholder*="body"]').first();
    if (await titleInput.count() > 0) {
      await titleInput.fill('Urgent: Platform System Maintenance');
    }
    if (await bodyInput.count() > 0) {
      await bodyInput.fill('Routine server maintenance scheduled tonight at 2:00 AM IST. All operations resume normally at 3:00 AM.');
    }

    await captureScreenshot(page, 'admin-announcement-composer-en', { subfolder: 'batch5-disputes-discipline' });

    // Switch to Hindi tab
    await hiTab.click();
    await page.waitForTimeout(300);
    await captureScreenshot(page, 'admin-announcement-composer-hi', { subfolder: 'batch5-disputes-discipline' });

    // Close modal
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    await cancelBtn.click();
    await expect(modalTitle).not.toBeVisible();

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Announcements Page');
  });
});
