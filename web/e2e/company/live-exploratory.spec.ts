import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginViaUI, TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Read-Only Exploratory Pass: Company Portal (Demo Data)', () => {
  let consoleGuard: ConsoleGuard;
  let networkRecorder: NetworkRecorder;

  test.beforeEach(async ({ page }) => {
    consoleGuard = new ConsoleGuard(page);
    networkRecorder = new NetworkRecorder(page);

    // STRICT READ-ONLY GUARD: Block any mutation request (POST, PUT, PATCH, DELETE)
    // Only allow login / auth endpoints for authentication and GET requests for data retrieval.
    await page.route('**/*', (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        if (url.includes('/api/v1/auth/') || url.includes('/price-preview')) {
          route.continue();
        } else {
          console.warn(`[READ-ONLY SAFETY GUARD] Aborted modifying request: ${method} ${url}`);
          route.abort('blockedbyclient');
        }
      } else {
        route.continue();
      }
    });
  });

  test.afterEach(async ({ page }) => {
    consoleGuard.assertNoErrors();
    await expectNoHorizontalOverflow(page);
  });

  test('Exploratory Pass: Dashboard & KPI Overview', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/dashboard');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toBeVisible();
    await expectNoRawI18nKeys(page);

    await captureScreenshot(page, 'live-01-dashboard', { subfolder: 'company-live' });
    await auditA11y(page, 'Live Dashboard');
  });

  test('Exploratory Pass: Business Profile & KYC Verification', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/business-profile');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Business Profile|Company Profile/i);
    await expectNoRawI18nKeys(page);

    await captureScreenshot(page, 'live-02-business-profile', { subfolder: 'company-live' });
  });

  test('Exploratory Pass: Campaigns Marketplace & Fleet Status', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Campaigns/i);
    await expectNoRawI18nKeys(page);

    await captureScreenshot(page, 'live-03-campaigns-list', { subfolder: 'company-live' });

    // Open first campaign detail if available
    const firstCampaign = page.locator('table tbody tr, .grid .cursor-pointer').first();
    if (await firstCampaign.count() > 0) {
      await firstCampaign.click();
      await page.waitForTimeout(500);
      await captureScreenshot(page, 'live-04-campaign-detail', { subfolder: 'company-live' });
    }
  });

  test('Exploratory Pass: Campaign Creation Wizard (Read/Navigate Only)', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/campaigns/new');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toBeVisible();
    await expectNoRawI18nKeys(page);

    await captureScreenshot(page, 'live-05-campaign-wizard', { subfolder: 'company-live' });
  });

  test('Exploratory Pass: Tracking & Proof Verification', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/tracking');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toBeVisible();
    await expectNoRawI18nKeys(page);

    await captureScreenshot(page, 'live-06-tracking', { subfolder: 'company-live' });
  });

  test('Exploratory Pass: Payments, Escrow & Invoices', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/payments');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Payments|Billing/i);
    await expectNoRawI18nKeys(page);

    await captureScreenshot(page, 'live-07-payments', { subfolder: 'company-live' });
  });

  test('Exploratory Pass: Disputes & Resolution', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/disputes');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Disputes & Claims/i);
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-08-disputes', { subfolder: 'company-live' });
  });

  test('Exploratory Pass: Support & Help Center', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/support');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Support & Help/i);
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-09-support', { subfolder: 'company-live' });
  });
});
