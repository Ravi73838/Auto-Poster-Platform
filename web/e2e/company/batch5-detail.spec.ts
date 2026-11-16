import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginViaUI, TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Batch 5: Campaign Detail & Progress Tracking (with Privacy Leaks Scan)', () => {
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

  test('5.1: Campaign Detail Overview displays specifications, slot progress, and ₹ INR financials', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.getByRole('heading', { name: 'Festival Mega Sale 2026', exact: true }).click();

    // Verify detail header
    await expect(page.locator('h1')).toHaveText(/Festival Mega Sale 2026/);
    await expect(page.locator('text=/₹69,300/').first()).toBeVisible();

    // Verify Overview tab is selected by default
    await expect(page.locator('button:has-text("Campaign Overview")')).toBeVisible();
    await expect(page.locator('text=Campaign Configuration')).toBeVisible();
    await expect(page.locator('text=Auto-Rickshaw Slots')).toBeVisible();

    // Verify target 50 and available 50
    await expect(page.locator('text=Target').locator('..').locator('text=50')).toBeVisible();
    await expect(page.locator('text=Available').locator('..').locator('text=50')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'campaign-detail-overview', { subfolder: 'batch5-detail' });
    await auditA11y(page, 'Campaign Detail Overview');
  });

  test('5.2: Campaign Progress Tab renders verified daily proof gallery and metrics', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.getByRole('heading', { name: 'Festival Mega Sale 2026', exact: true }).click();

    // Switch to Progress tab (Daily Proof & Verification)
    await page.locator('button:has-text("Daily Proof & Verification")').click();

    // Verify Progress KPIs & gallery elements
    await expect(page.locator('text=Campaign Verification & Proof')).toBeVisible();
    await expect(page.locator('text=Active Autos')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'campaign-detail-progress-tab', { subfolder: 'batch5-detail' });
  });

  test('5.3: Cancel Campaign Modal flow on a draft campaign', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    // Click on a draft campaign
    await page.locator('button:has-text("Draft")').click();
    await page.waitForTimeout(400);

    const firstDraftCard = page.locator('.cursor-pointer').first();
    await firstDraftCard.click();

    // Verify detail page
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await page.locator('button:has-text("Cancel")').click();

    // Modal should be open
    await expect(page.locator('text=Cancel Campaign')).toBeVisible();
    const reasonTextarea = page.locator('textarea');
    if (await reasonTextarea.count() > 0) {
      await reasonTextarea.fill('Cancelled via automated E2E test verification');
    }

    await page.locator('button:has-text("Confirm Cancellation")').click();
    await page.waitForTimeout(1000);

    // Verify status changed to CANCELLED
    await expect(page.locator('text=/CANCELLED/i').first()).toBeVisible();
    await captureScreenshot(page, 'campaign-cancelled-state', { subfolder: 'batch5-detail' });
  });

  test('5.4: Clone Campaign flow creates duplicate draft', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.getByRole('heading', { name: 'Festival Mega Sale 2026', exact: true }).first().click();

    // Click Clone button
    await page.locator('button:has-text("Clone")').click();

    // Verify redirected to new campaign
    await expect(page).toHaveURL(/\/company\/campaigns\/[a-zA-Z0-9-]+/);
    await expect(page.locator('text=/DRAFT/i').first()).toBeVisible();

    await captureScreenshot(page, 'campaign-cloned-state', { subfolder: 'batch5-detail' });
  });

  test('5.5: Privacy Leak Scan - Ensure zero driver PII leaks in company DOM', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.getByRole('heading', { name: 'Festival Mega Sale 2026', exact: true }).first().click();

    // 1. Scan Overview tab HTML
    const overviewHtml = await page.content();

    // Strict checks for driver mobile numbers (+919...)
    const mobileMatches = overviewHtml.match(/\+91[6-9]\d{9}/g) || [];
    // Filter out the company's own contact number (+919666666666)
    const leakingMobiles = mobileMatches.filter((m) => m !== '+919666666666');
    expect(leakingMobiles).toHaveLength(0);

    // Strict checks for vehicle plates (e.g. GJ01AB1234)
    const plateMatches = overviewHtml.match(/\bGJ\d{2}[A-Z]{1,2}\d{4}\b/gi) || [];
    expect(plateMatches).toHaveLength(0);

    // 2. Scan Progress tab HTML
    await page.locator('button:has-text("Daily Proof & Verification")').click();
    await page.waitForTimeout(500);

    const progressHtml = await page.content();
    const progressMobileMatches = (progressHtml.match(/\+91[6-9]\d{9}/g) || []).filter(
      (m) => m !== '+919666666666',
    );
    expect(progressMobileMatches).toHaveLength(0);

    const progressPlateMatches = progressHtml.match(/\bGJ\d{2}[A-Z]{1,2}\d{4}\b/gi) || [];
    expect(progressPlateMatches).toHaveLength(0);
  });
});
