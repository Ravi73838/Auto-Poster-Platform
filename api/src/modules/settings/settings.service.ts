import {
  type SettingKey,
} from '@ap/shared-constants';
import {
  validateSettingValue,
  type SettingSchemas,
} from '@ap/shared-validation';
import { type z } from 'zod';
import { type Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/index.js';
import { SettingNotFoundError } from '../../shared/errors/index.js';
import { AuditService } from '../audit/audit.service.js';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class SettingsService {
  private static cache = new Map<string, CacheEntry>();
  private static readonly TTL_MS = 60_000; // 60 seconds cache TTL

  /**
   * Clears the in-memory cache (useful for testing and invalidation).
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retrieves a strongly-typed setting value by key.
   */
  static async get<K extends SettingKey>(
    key: K,
    defaultValue?: z.infer<SettingSchemas[K]>,
  ): Promise<z.infer<SettingSchemas[K]>> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as z.infer<SettingSchemas[K]>;
    }

    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new SettingNotFoundError(`Setting "${key}" not found in database`);
    }

    const validated = validateSettingValue(key, setting.value);
    this.cache.set(key, {
      value: validated,
      expiresAt: Date.now() + this.TTL_MS,
    });

    return validated as z.infer<SettingSchemas[K]>;
  }

  /**
   * Retrieves all configuration settings as a key-value record.
   */
  static async getAll(): Promise<Record<string, unknown>> {
    const settings = await prisma.setting.findMany();
    const result: Record<string, unknown> = {};

    for (const item of settings) {
      result[item.key] = item.value;
    }

    return result;
  }

  /**
   * Alias for update.
   */
  static async set<K extends SettingKey>(
    key: K,
    value: unknown,
    updatedByUserId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<z.infer<SettingSchemas[K]>> {
    return this.update(key, value, updatedByUserId, context);
  }

  /**
   * Updates or inserts a setting value, invalidates cache, and logs to audit.
   */
  static async update<K extends SettingKey>(
    key: K,
    value: unknown,
    updatedByUserId: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<z.infer<SettingSchemas[K]>> {
    const validated = validateSettingValue(key, value);

    const oldSetting = await prisma.setting.findUnique({
      where: { key },
    });

    const updated = await prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: validated as Prisma.InputJsonValue,
        updatedByUserId,
      },
      update: {
        value: validated as Prisma.InputJsonValue,
        updatedByUserId,
      },
    });

    // Invalidate local cache
    this.cache.delete(key);

    // Audit log
    await AuditService.log({
      actorId: updatedByUserId,
      action: 'setting.update',
      entityType: 'Setting',
      entityId: key,
      oldValues: oldSetting ? { value: oldSetting.value } : null,
      newValues: { value: validated },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated.value as z.infer<SettingSchemas[K]>;
  }
}
