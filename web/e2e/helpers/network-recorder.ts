import type { Page, Request, Response } from '@playwright/test';
import { expect } from '@playwright/test';

export interface RecordedRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
}

export class NetworkRecorder {
  private failedRequests: RecordedRequest[] = [];
  private allRequests: RecordedRequest[] = [];

  constructor(private page: Page) {
    this.page.on('response', (response: Response) => {
      const status = response.status();
      const url = response.url();
      const method = response.request().method();

      const record: RecordedRequest = {
        url,
        method,
        status,
        statusText: response.statusText(),
      };

      this.allRequests.push(record);

      // Track unexpected server errors (5xx) or unhandled 4xx (except legitimate 401s during auth probes)
      if (status >= 500) {
        this.failedRequests.push(record);
      }
    });
  }

  getFailedRequests(): RecordedRequest[] {
    return this.failedRequests;
  }

  getAllRequests(): RecordedRequest[] {
    return this.allRequests;
  }

  clear() {
    this.failedRequests = [];
    this.allRequests = [];
  }

  assertNoServerError() {
    const serverErrors = this.failedRequests.filter((r) => r.status >= 500);
    expect(serverErrors, `Detected 5xx server errors: ${JSON.stringify(serverErrors, null, 2)}`).toHaveLength(0);
  }
}
