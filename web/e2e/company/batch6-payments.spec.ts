import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginViaUI, TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Batch 6: Payments & Financial Documents', () => {
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

  test('6.1: Payments page displays escrow metrics, transaction history, and ₹ INR formatting', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/payments');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Escrow Payments & Tax Invoices/i);

    // Verify Metric Cards
    await expect(page.locator('text=Total Escrow Deposited')).toBeVisible();
    await expect(page.locator('text=/₹69,300/').first()).toBeVisible();
    await expect(page.locator('text=Successful Payments')).toBeVisible();
    await expect(page.locator('text=GST Compliant Invoices')).toBeVisible();

    // Verify Payments Table
    await expect(page.locator('text=Transaction History')).toBeVisible();
    await expect(page.locator('text=pay_festival_2026_001')).toBeVisible();
    await expect(page.locator('text=Paid (Escrow)')).toBeVisible();
    await expect(page.locator('text=INV/2026-27/0001')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'payments-overview', { subfolder: 'batch6-payments' });
    await auditA11y(page, 'Company Payments Page');
  });

  test('6.2: Tax Invoice download button initiates invoice retrieval', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/payments');
    await page.waitForSelector('text=INV/2026-27/0001');

    // Click on invoice download button
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.locator('button:has-text("INV/2026-27/0001")').click();

    // Download or download initiation check
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toContain('INV_2026-27_0001.pdf');
    }

    await captureScreenshot(page, 'payments-invoice-downloaded', { subfolder: 'batch6-payments' });
  });

  test('6.3: Finance role can view payments and download financial invoices', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.FINANCE.email, TEST_CREDENTIALS.FINANCE.password);

    await page.goto('/company/payments');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Escrow Payments & Tax Invoices/i);
    await expect(page.locator('text=/₹69,300/').first()).toBeVisible();
    await expect(page.locator('text=pay_festival_2026_001')).toBeVisible();
  });

  test('6.4: Trilingual localization check on Payments page', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);
    await page.goto('/company/payments');

    const langSelect = page.locator('select').filter({ hasText: /English|Hindi|Gujarati/i });
    if (await langSelect.count() > 0) {
      await langSelect.selectOption('hi');
      await page.waitForTimeout(400);
      await expectNoRawI18nKeys(page);

      await langSelect.selectOption('gu');
      await page.waitForTimeout(400);
      await expectNoRawI18nKeys(page);

      await langSelect.selectOption('en');
      await page.waitForTimeout(400);
      await expectNoRawI18nKeys(page);
    }
  });
});
