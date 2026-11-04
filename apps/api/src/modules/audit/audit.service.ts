import { ACTOR_TYPES, type ActorType } from '@ap/shared-constants';
import { prisma, type TransactionClient } from '../../shared/db/index.js';
import { logger } from '../../shared/logger/index.js';

const SENSITIVE_KEY_PATTERNS = [
  /pass/i,
  /secret/i,
  /token/i,
  /hash/i,
  /key/i,
  /upi/i,
  /bank/i,
  /card/i,
  /cvv/i,
  /auth/i,
];

export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    return data.toString();
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) =>
        pattern.test(key),
      );
      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(val);
      }
    }
    return redacted;
  }

  return data;
}

export function computeShallowDiff(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined,
): {
  oldDiff: Record<string, unknown> | null;
  newDiff: Record<string, unknown> | null;
} {
  if (!oldValues && !newValues) {
    return { oldDiff: null, newDiff: null };
  }
  if (!oldValues) {
    return { oldDiff: null, newDiff: newValues ?? null };
  }
  if (!newValues) {
    return { oldDiff: oldValues ?? null, newDiff: null };
  }

  const oldDiff: Record<string, unknown> = {};
  const newDiff: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      if (oldVal !== undefined) oldDiff[key] = oldVal;
      if (newVal !== undefined) newDiff[key] = newVal;
    }
  }

  return {
    oldDiff: Object.keys(oldDiff).length > 0 ? oldDiff : null,
    newDiff: Object.keys(newDiff).length > 0 ? newDiff : null,
  };
}

export interface AuditLogInput {
  actorId?: string | null;
  actorType?: ActorType;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Logs an audit entry with sensitive data redaction.
   * Safe to call inside or outside a database transaction.
   */
  static async log(
    input: AuditLogInput,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma;
    const actorType = input.actorType ?? (input.actorId ? ACTOR_TYPES.USER : ACTOR_TYPES.SYSTEM);

    const redactedOld = input.oldValues ? redactSensitiveData(input.oldValues) : null;
    const redactedNew = input.newValues ? redactSensitiveData(input.newValues) : null;

    const isUuid = typeof input.actorId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.actorId);
    const actorId = isUuid ? input.actorId : null;

    try {
      await client.auditLog.create({
        data: {
          actorId,
          actorType,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValues: (redactedOld as object) ?? undefined,
          newValues: (redactedNew as object) ?? undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      // Audit log failure should be captured by logger
      logger.error(
        { error, auditInput: { action: input.action, entityType: input.entityType, entityId: input.entityId } },
        'Failed to record audit log entry',
      );
    }
  }
}
