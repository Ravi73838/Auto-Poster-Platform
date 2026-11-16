import { test, expect } from '@playwright/test';
import { ConsoleGuard } from '../helpers/console-guard';
import { NetworkRecorder } from '../helpers/network-recorder';
import { expectNoRawI18nKeys } from '../helpers/i18n-guard';
import { expectNoHorizontalOverflow } from '../helpers/overflow-guard';
import { auditA11y } from '../helpers/a11y';
import { captureScreenshot } from '../helpers/screenshot';
import { loginViaUI, TEST_CREDENTIALS } from '../helpers/auth-fixture';

test.describe('Batch 7: Disputes, Support, Team & Collaboration', () => {
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

  test('7.1: Disputes page lists active disputes and renders conversation workspace', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/disputes');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Disputes & Claims/i);
    await expect(page.locator('button:has-text("File New Dispute")')).toBeVisible();

    // Verify seeded dispute exists in list
    const disputeItem = page.locator('.cursor-pointer').first();
    await expect(disputeItem).toBeVisible();

    // Select the seeded dispute if not already selected
    const seedDispute = page.locator('text=The driver uploaded a verification photo');
    if (await seedDispute.count() > 0) {
      await seedDispute.click();
    }

    // Verify detail pane has dispute message
    await expect(page.locator('text=/Hello, please review|Poster frame was damaged/').first()).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'disputes-overview', { subfolder: 'batch7-collaboration' });
    await auditA11y(page, 'Disputes Page');
  });

  test('7.2: Message Composer sends reply in active dispute thread', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/disputes');
    const composer = page.locator('input[placeholder*="Type a message"], textarea').first();
    await composer.waitFor({ state: 'visible', timeout: 10000 });

    // Type reply in message composer
    const testMessage = `E2E Playwright verification reply at ${Date.now()}`;
    await composer.fill(testMessage);
    await page.locator('button:has-text("Send")').click();

    // Verify new message is visible in conversation
    await expect(page.locator(`text=${testMessage}`)).toBeVisible();
    await captureScreenshot(page, 'disputes-reply-sent', { subfolder: 'batch7-collaboration' });
  });

  test('7.3: File New Dispute modal opens and submits claim', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/disputes');
    await page.locator('button:has-text("File New Dispute")').click();

    // Verify modal is open
    const modalHeading = page.getByRole('heading', { name: /File Campaign Dispute/i });
    await expect(modalHeading).toBeVisible();

    // Fill form inside modal overlay
    const modal = page.locator('.fixed.inset-0');
    await modal.locator('textarea').fill('Poster frame was damaged during monsoon rainstorm. Requesting review.');

    const claimInput = modal.locator('input[type="number"]');
    if (await claimInput.count() > 0) {
      await claimInput.fill('500');
    }

    // Submit dispute
    await modal.locator('button:has-text("Submit Claim"), button:has-text("Submit Dispute")').first().click();

    // Verify modal closed and dispute list refreshed
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Poster frame was damaged').first()).toBeVisible();
    await captureScreenshot(page, 'disputes-created-claim', { subfolder: 'batch7-collaboration' });
  });

  test('7.4: Support & Help page renders correctly', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/support');
    await page.waitForSelector('h1');

    await expect(page.locator('h1')).toHaveText(/Support & Help/i);
    await expect(page.locator('text=Contact platform support and submit inquiries')).toBeVisible();

    await expectNoRawI18nKeys(page);
    await captureScreenshot(page, 'support-overview', { subfolder: 'batch7-collaboration' });
    await auditA11y(page, 'Company Support Page');
  });

  test('7.5: Trilingual localization check on Disputes and Support pages', async ({ page }) => {
    await loginViaUI(page, TEST_CREDENTIALS.OWNER.email, TEST_CREDENTIALS.OWNER.password);

    await page.goto('/company/disputes');
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

    await page.goto('/company/support');
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
