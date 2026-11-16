import type { Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

export async function captureScreenshot(
  page: Page,
  name: string,
  options?: { subfolder?: string; fullPage?: boolean },
) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 600;
  const viewportTag = isMobile ? 'mobile' : 'desktop';
  const subfolder = options?.subfolder ? options.subfolder : 'general';
  
  const targetDir = path.resolve(process.cwd(), 'e2e/__screenshots__', subfolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filename = `${viewportTag}-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.png`;
  const fullPath = path.join(targetDir, filename);

  await page.screenshot({
    path: fullPath,
    fullPage: options?.fullPage ?? false,
  });

  return fullPath;
}
