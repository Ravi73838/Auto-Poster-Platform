import { env } from '../../config/env.js';
import { logger } from '../logger/index.js';

/**
 * Checks whether a recipient (phone number or email) is permitted to receive
 * real notification deliveries (SMS, Email, Push) in the current environment.
 *
 * Rules:
 * - When DB_ENVIRONMENT === 'production', the allowlist is bypassed and all recipients are permitted.
 * - When DB_ENVIRONMENT !== 'production' (development, staging):
 *     - Only recipients explicitly listed in NOTIFY_ALLOWLIST (env) are permitted.
 *     - If NOTIFY_ALLOWLIST is empty, no real messages are sent.
 */
export function isRecipientAllowlisted(recipient: string): boolean {
  if (env.DB_ENVIRONMENT === 'production') {
    return true;
  }

  if (!recipient || typeof recipient !== 'string') {
    return false;
  }

  const normalized = recipient.trim().toLowerCase().replace(/[\s\-().]/g, '');
  if (!env.notifyAllowlist || env.notifyAllowlist.length === 0) {
    logger.info(
      { recipient, env: env.DB_ENVIRONMENT },
      '[NotificationAllowlist] Delivery SKIPPED: NOTIFY_ALLOWLIST is empty in non-production',
    );
    return false;
  }

  const isAllowed = env.notifyAllowlist.some((allowed) => {
    const cleanAllowed = allowed.trim().toLowerCase().replace(/[\s\-().]/g, '');
    if (!cleanAllowed) return false;
    // Direct match, or phone number suffix match (+919876543210 matching 9876543210)
    return (
      cleanAllowed === normalized ||
      normalized.endsWith(cleanAllowed) ||
      cleanAllowed.endsWith(normalized)
    );
  });

  if (!isAllowed) {
    logger.info(
      { recipient, env: env.DB_ENVIRONMENT },
      '[NotificationAllowlist] Delivery SKIPPED: Recipient not on NOTIFY_ALLOWLIST',
    );
  }

  return isAllowed;
}

