import type { Page, ConsoleMessage } from '@playwright/test';
import { expect } from '@playwright/test';

export class ConsoleGuard {
  private errors: string[] = [];
  private pageErrors: string[] = [];

  constructor(private page: Page) {
    this.page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign 401s/403s from background auth/clock checks or harmless favicon warnings
        if (
          text.includes('favicon.ico') ||
          text.includes('Failed to load resource: the server responded with a status of 401') ||
          text.includes('Failed to load resource: the server responded with a status of 403') ||
          (text.includes('net::ERR_FAILED') && text.includes('/auth/refresh'))
        ) {
          return;
        }
        this.errors.push(text);
      }
    });

    this.page.on('pageerror', (err: Error) => {
      this.pageErrors.push(err.message || String(err));
    });
  }

  getErrors(): string[] {
    return [...this.errors, ...this.pageErrors];
  }

  clear() {
    this.errors = [];
    this.pageErrors = [];
  }

  assertNoErrors() {
    const combined = [...this.errors, ...this.pageErrors];
    expect(
      combined,
      `Detected unexpected browser console/page errors:\n${combined.join('\n')}`,
    ).toHaveLength(0);
  }
}
