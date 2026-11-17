import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginAdminAs } from '../helpers/admin-auth-fixture';

test.describe('Read-Only Exploratory Pass: Admin Portal', () => {
  let consoleGuard: ConsoleGuard;
  let networkRecorder: NetworkRecorder;

  test.beforeEach(async ({ page }) => {
    consoleGuard = new ConsoleGuard(page);
    networkRecorder = new NetworkRecorder(page);

    // STRICT ZERO MUTATION POLICY: Block any modifying HTTP request (POST, PUT, PATCH, DELETE)
    // Only allow login / auth endpoints for authentication and GET requests for data retrieval.
    await page.route('**/*', (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        if (url.includes('/api/v1/auth/')) {
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

  test('Walkthrough 1: Core Operations & KYC Flow', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');

    // 1. Dashboard
    await page.goto('/admin/dashboard');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-01-dashboard', { subfolder: 'admin-live' });
    await auditA11y(page, 'Live Operations Dashboard');

    // 2. My Work
    await page.goto('/admin/my-work');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-02-my-work', { subfolder: 'admin-live' });

    // 3. Drivers
    await page.goto('/admin/drivers');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-03-drivers', { subfolder: 'admin-live' });

    // 4. Companies
    await page.goto('/admin/companies');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-04-companies', { subfolder: 'admin-live' });

    // 5. Campaign Review
    await page.goto('/admin/campaign-review');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-05-campaign-review', { subfolder: 'admin-live' });

    // 6. Photo Review
    await page.goto('/admin/photo-review');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-06-photo-review', { subfolder: 'admin-live' });
  });

  test('Walkthrough 2: Financials, Discipline & Communications', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');

    // 7. Payments / Ledger
    await page.goto('/admin/payments');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-07-payments', { subfolder: 'admin-live' });

    // 8. Payouts
    await page.goto('/admin/payouts');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-08-payouts', { subfolder: 'admin-live' });

    // 9. Disputes
    await page.goto('/admin/disputes');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-09-disputes', { subfolder: 'admin-live' });

    // 10. Discipline
    await page.goto('/admin/discipline');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-10-discipline', { subfolder: 'admin-live' });

    // 11. Announcements
    await page.goto('/admin/announcements');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-11-announcements', { subfolder: 'admin-live' });

    // 12. Reports
    await page.goto('/admin/reports');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-12-reports', { subfolder: 'admin-live' });
  });

  test('Walkthrough 3: Platform Governance, Diagnostics & Readiness', async ({ page }) => {
    await loginAdminAs(page, 'SUPER_ADMIN');

    // 13. Audit Log
    await page.goto('/admin/audit-log');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-13-audit-log', { subfolder: 'admin-live' });

    // 14. Team Roles
    await page.goto('/admin/team-roles');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-14-team-roles', { subfolder: 'admin-live' });

    // 15. Settings
    await page.goto('/admin/settings');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-15-settings', { subfolder: 'admin-live' });

    // 16A. Legal Docs
    await page.goto('/admin/legal');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-16-legal-docs', { subfolder: 'admin-live' });

    // 16B. Help Articles
    await page.goto('/admin/help');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-16-help-articles', { subfolder: 'admin-live' });

    // 17. System Diagnostics
    await page.goto('/admin/system');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-17-system-diagnostics', { subfolder: 'admin-live' });

    // 18. Launch Readiness
    await page.goto('/admin/launch-readiness');
    await page.waitForSelector('main h1, main h2');
    await expect(page.locator('main').locator('h1, h2').first()).toBeVisible();
    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'live-18-launch-readiness', { subfolder: 'admin-live' });
  });
});
