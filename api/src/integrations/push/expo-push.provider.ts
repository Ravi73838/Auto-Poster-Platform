import {
  type PushProvider,
  type PushMessage,
  type PushTicket,
  type PushReceipt,
} from './push.interface.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../config/env.js';

export class ExpoPushProvider implements PushProvider {
  private static readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
  private static readonly EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
  private static readonly BATCH_SIZE = 100;

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    if (messages.length === 0) return [];

    const tickets: PushTicket[] = [];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };

    if (env.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
    }

    // Chunk into batches of 100
    for (let i = 0; i < messages.length; i += ExpoPushProvider.BATCH_SIZE) {
      const batch = messages.slice(i, i + ExpoPushProvider.BATCH_SIZE);

      try {
        const response = await fetch(ExpoPushProvider.EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          const errText = await response.text();
          logger.error({ status: response.status, errText }, '[ExpoPushProvider] HTTP error');
          batch.forEach(() => {
            tickets.push({
              status: 'error',
              message: `HTTP ${response.status}: ${errText}`,
            });
          });
          continue;
        }

        const json = (await response.json()) as { data?: PushTicket[]; errors?: unknown[] };
        if (json.data && Array.isArray(json.data)) {
          tickets.push(...json.data);
        } else {
          logger.warn({ json }, '[ExpoPushProvider] Unexpected response shape');
          batch.forEach(() => {
            tickets.push({
              status: 'error',
              message: 'Unexpected response from Expo',
            });
          });
        }
      } catch (err: unknown) {
        logger.error({ err }, '[ExpoPushProvider] Network error');
        batch.forEach(() => {
          tickets.push({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }

    return tickets;
  }

  async getReceipts(receiptIds: string[]): Promise<Record<string, PushReceipt>> {
    if (receiptIds.length === 0) return {};

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };

    if (env.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
    }

    try {
      const response = await fetch(ExpoPushProvider.EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: receiptIds }),
      });

      if (!response.ok) {
        return {};
      }

      const json = (await response.json()) as { data?: Record<string, PushReceipt> };
      return json.data ?? {};
    } catch (err) {
      logger.error({ err }, '[ExpoPushProvider] Error fetching push receipts');
      return {};
    }
  }
}

