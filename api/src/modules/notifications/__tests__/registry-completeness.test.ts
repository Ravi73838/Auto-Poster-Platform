import { describe, it, expect } from 'vitest';
import { NOTIFICATION_REGISTRY } from '../notification.registry.js';
import { resolveNotificationText } from '../notifications.helpers.js';
import { SUPPORTED_LANGUAGES } from '@ap/shared-constants';

describe('Notification Registry Completeness Tests', () => {
  it('ensures all notification keys have valid definitions in registry', () => {
    const keys = Object.keys(NOTIFICATION_REGISTRY);
    expect(keys.length).toBeGreaterThan(15);

    for (const [key, def] of Object.entries(NOTIFICATION_REGISTRY) as [string, any][]) {
      expect(def.key, `Key in entry ${key} should match key prop`).toBe(key);
      expect(def.category).toBeDefined();
      expect(def.priority).toBeDefined();
      expect(def.defaultChannels).toBeDefined();
      expect(def.titleKey).toBeDefined();
      expect(def.bodyKey).toBeDefined();
    }
  });

  it('ensures every registered notification resolves for EN, HI, and GU', () => {
    for (const [key, def] of Object.entries(NOTIFICATION_REGISTRY) as [string, any][]) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const resolved = resolveNotificationText(def.titleKey, def.bodyKey, lang, {
          title: 'Test Campaign',
          reason: 'Test Reason',
          name: 'Test Driver',
          code: '123456',
        });

        expect(
          resolved.title,
          `Notification key "${key}" title must resolve for "${lang}"`,
        ).toBeDefined();
        expect(
          resolved.title.length,
          `Notification key "${key}" has empty title for "${lang}"`,
        ).toBeGreaterThan(0);

        expect(
          resolved.body,
          `Notification key "${key}" body must resolve for "${lang}"`,
        ).toBeDefined();
        expect(
          resolved.body.length,
          `Notification key "${key}" has empty body for "${lang}"`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('ensures mandatory notifications cannot be muted (mandatory is true)', () => {
    const criticalKeys = [
      'auth.otp',
      'strike.issued',
      'ban.started',
      'dispute.opened',
      'dispute.resolved',
    ];

    for (const key of criticalKeys) {
      const def = (NOTIFICATION_REGISTRY as any)[key];
      expect(def, `Expected critical notification ${key} to exist`).toBeDefined();
      expect(def.mandatory).toBe(true);
    }
  });
});
