import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Batch 6: Money & Financial Controls', () => {
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

  test('6.1: Escrow balances, ledger, settlements queue & refund requests', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/payments');
    await page.waitForSelector('h1, h2');

    // Page Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Financial Ledger|Treasury/i);

    // Verify key metrics
    await expect(page.locator('text=/Campaign Escrow/i').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Platform Revenue/i').first()).toBeVisible({ timeout: 10000 });

    // Verify Tab buttons
    const trialTab = page.locator('button:has-text("Trial Balance & Ledger")').first();
    const settlementsTab = page.locator('button:has-text("Settlements Queue")').first();
    const refundsTab = page.locator('button:has-text("Maker-Checker Refunds")').first();

    await expect(trialTab).toBeVisible();
    await expect(settlementsTab).toBeVisible();
    await expect(refundsTab).toBeVisible();

    await captureScreenshot(page, 'admin-payments-ledger', { subfolder: 'batch6-money' });

    // Switch to Settlements tab
    await settlementsTab.click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, 'admin-payments-settlements', { subfolder: 'batch6-money' });

    // Switch to Refunds tab
    await refundsTab.click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, 'admin-payments-refunds', { subfolder: 'batch6-money' });

    // Switch back to Overview
    await trialTab.click();
    await page.waitForTimeout(400);

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Financial Ledger & Treasury');
  });

  test('6.2: Driver Payouts batch disbursal, queue & export controls', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');
    await page.goto('/admin/payouts');
    await page.waitForSelector('h1, h2');

    // Page Header
    await expect(page.locator('main').locator('h1, h2').first()).toHaveText(/Driver Payouts/i);

    // Verify Action Buttons
    const importBtn = page.locator('button:has-text("Import Bank UTR")').first();
    const exportBtn = page.locator('button:has-text("Export Batch CSV")').first();
    const refreshBtn = page.locator('button[aria-label="Refresh payouts"]').first();

    await expect(importBtn).toBeVisible();
    await expect(exportBtn).toBeVisible();
    await expect(refreshBtn).toBeVisible();

    // Verify payouts list or empty state
    await page.waitForTimeout(600);
    await captureScreenshot(page, 'admin-payouts-queue', { subfolder: 'batch6-money' });

    await expectNoRawI18nKeys(page);
    await auditA11y(page, 'Admin Driver Payouts');
  });
});
