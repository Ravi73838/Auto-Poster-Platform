import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Handles the StepUpModal password confirmation prompt.
 * Enters the password and confirms the sensitive operation.
 */
export async function stepUp(page: Page, password = 'AdminPassword123!') {
  // Wait for StepUp modal
  const modal = page.locator('div.fixed.inset-0').filter({
    hasText: /Security Verification Required|Identity Verification Required|Verification Required/i,
  }).first();
  await expect(modal).toBeVisible({ timeout: 10000 });

  const passwordInput = modal.locator('input[type="password"]');
  await passwordInput.fill(password);

  const confirmBtn = modal.locator(
    'button:has-text("Verify & Continue"), button:has-text("Verify Password & Proceed"), button:has-text("Confirm"), button[type="submit"]',
  ).first();
  await confirmBtn.click();

  // Verify modal dismissed
  await expect(modal).not.toBeVisible({ timeout: 10000 });
}
