import path from 'path';
import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginViaUI, TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Batch 4: Campaigns Marketplace & Create Campaign Wizard', () => {
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

  test('4.1: Campaigns listing page displays seeded campaigns, status tabs, and correct ₹ INR pricing', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Campaigns/i);

    // Verify tabs are visible
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Draft")')).toBeVisible();
    await expect(page.locator('button:has-text("Under Review")')).toBeVisible();
    await expect(page.locator('button:has-text("Active")')).toBeVisible();

    // Verify seeded campaign is displayed with ₹69,300 pricing
    await expect(page.locator('text=Festival Mega Sale 2026')).toBeVisible();
    await expect(page.locator('text=/₹69,300/')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'campaigns-listing-overview', { subfolder: 'batch4-campaigns' });
    await auditA11y(page, 'Campaigns Listing Page');
  });

  test('4.2: Search filter filters campaigns by title in real-time', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.waitForSelector('input[placeholder*="Search"]');

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Festival Mega');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Festival Mega Sale 2026')).toBeVisible();

    // Search for non-existent campaign
    await searchInput.fill('NonExistentCampaignX99');
    await page.waitForTimeout(500);
    await expect(page.locator('text=No campaigns found')).toBeVisible();

    await searchInput.clear();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Festival Mega Sale 2026')).toBeVisible();
  });

  test('4.3: Create Campaign Wizard Step 1 to Step 4 verifies 50 slots = ₹69,300 live calculation', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns/new');
    await page.waitForSelector('h1');

    // Step 1: Basics
    await expect(page.locator('h3:has-text("1. Campaign Basics")')).toBeVisible();
    await page.fill('input[placeholder*="Diwali"]', 'Playwright Pricing Verification 2026');
    await page.fill('textarea', 'Automated testing of live pricing preview');
    await page.locator('button:has-text("Next")').click();

    // Step 2: Targeting
    await expect(page.locator('h3:has-text("2. Geographic Targeting")')).toBeVisible();
    await expect(page.locator('text=Verified Driver Availability')).toBeVisible();
    await page.locator('button:has-text("Next")').click();

    // Step 3: Schedule
    await expect(page.locator('h3:has-text("3. Campaign Schedule (IST)")')).toBeVisible();
    // Default duration is already set to 30 days
    await expect(page.locator('text=30 Days')).toBeVisible();
    await page.locator('button:has-text("Next")').click();

    // Step 4: Pricing
    await expect(page.locator('h3:has-text("4. Slots & Budget Configuration")')).toBeVisible();

    // Set slots to 50
    const slotsInput = page.locator('input[type="number"]').first();
    await slotsInput.fill('50');

    // Live pricing preview calculation check: 50 slots = ₹69,300 (6,930,000 paise)
    const pricingSummary = page.locator('text=/Total Campaign Budget \\(Escrow\\)/');
    await expect(pricingSummary).toBeVisible();
    await expect(page.locator('text=/₹69,300/')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'wizard-step4-pricing-69300', { subfolder: 'batch4-campaigns' });
  });

  test('4.4: Create Campaign Wizard complete flow (Step 1 to 6) creates new campaign draft', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns/new');
    await page.waitForSelector('h1');

    // Step 1: Basics
    await page.fill('input[placeholder*="Diwali"]', 'Complete E2E Campaign Draft');
    await page.fill('textarea', 'Complete campaign draft wizard flow');
    await page.locator('button:has-text("Next")').click();

    // Step 2: Targeting
    await page.locator('button:has-text("Next")').click();

    // Step 3: Schedule
    await page.locator('button:has-text("Next")').click();

    // Step 4: Pricing
    await page.locator('button:has-text("Next")').click();

    // Step 5: Poster & Print
    await expect(page.locator('h3:has-text("5. Artwork & Print Specifications")')).toBeVisible();

    const fixturePath = path.resolve(process.cwd(), 'e2e/fixtures/sample-poster.png');
    await page.setInputFiles('input[type="file"]', fixturePath);

    // Wait for upload & preview
    await expect(page.locator('img[alt="Uploaded Poster"]')).toBeVisible({ timeout: 15000 });
    await page.locator('button:has-text("Next")').click();

    // Step 6: Review & Submit
    await expect(page.locator('h3:has-text("6. Review Campaign Details")')).toBeVisible();
    await expect(page.locator('text=Complete E2E Campaign Draft')).toBeVisible();
    await expect(page.locator('text=/Resolution check passed/i')).toBeVisible();

    // Accept policy
    await page.check('#policy');

    // Save as Draft
    await page.locator('button:has-text("Save as Draft")').click();

    // Verify redirected to Campaign Detail page
    await expect(page).toHaveURL(/\/company\/campaigns\/[a-zA-Z0-9-]+/, { timeout: 15000 });
    await expect(page.locator('text=Complete E2E Campaign Draft')).toBeVisible();
    await expect(page.locator('text=/Draft/i').first()).toBeVisible();

    await captureScreenshot(page, 'campaign-created-detail-overview', { subfolder: 'batch4-campaigns' });
  });

  test('4.5: Trilingual localization check on Campaigns page', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);
    await page.goto('/company/campaigns');

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
