import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginViaUI, TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Batch 2: Company Onboarding & Business Profile / KYC', () => {
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

  test('2.1: Business profile page renders correctly with header and cards', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/business-profile');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Business Profile/i);
    await expect(page.locator('text=Company profile details and KYC verification')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'business-profile-overview', { subfolder: 'batch2-kyc' });
    await auditA11y(page, 'Business Profile Page');
  });

  test('2.2: Profile status banner reflects account state for pending company', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.PENDING.email, TEST_CREDENTIALS.PENDING.password);

    // Verify Pending Account Banner is displayed at top of portal
    const pendingBanner = page.locator('.bg-warning\\/10').first();
    await expect(pendingBanner).toBeVisible();
    await expect(pendingBanner).toContainText(/pending review/i);

    await page.goto('/company/business-profile');
    await expect(page.locator('h1')).toHaveText(/Business Profile/i);

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'business-profile-pending-state', { subfolder: 'batch2-kyc' });
  });

  test('2.3: Suspended company sees warning banner in layout', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.SUSPENDED.email, TEST_CREDENTIALS.SUSPENDED.password);

    // Verify Suspended Account Banner is displayed
    const suspendedBanner = page.locator('.bg-danger\\/10').first();
    await expect(suspendedBanner).toBeVisible();
    await expect(suspendedBanner).toContainText(/suspended/i);

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'business-profile-suspended-state', { subfolder: 'batch2-kyc' });
  });

  test('2.4: Business Profile page trilingual check in Hindi and Gujarati', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);
    await page.goto('/company/business-profile');

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
