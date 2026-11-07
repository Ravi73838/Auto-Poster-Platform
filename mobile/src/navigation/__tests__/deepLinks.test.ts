import { describe, it, expect } from 'vitest';
import { resolveDeepLink } from '../deepLinks';

describe('resolveDeepLink', () => {
  it('returns /(tabs) for empty or undefined payload', () => {
    expect(resolveDeepLink(null)).toBe('/(tabs)');
    expect(resolveDeepLink(undefined)).toBe('/(tabs)');
    expect(resolveDeepLink({})).toBe('/(tabs)');
  });

  it('maps campaign detail correctly when id is present', () => {
    expect(resolveDeepLink({ screen: 'CAMPAIGN_DETAIL', id: 'cmp-123' })).toBe('/campaigns/cmp-123');
    expect(resolveDeepLink({ screen: 'CAMPAIGN', campaignId: 'cmp-456' })).toBe('/campaigns/cmp-456');
    // Falls back to list if id is missing
    expect(resolveDeepLink({ screen: 'CAMPAIGN_DETAIL' })).toBe('/(tabs)/campaigns');
  });

  it('maps assignments correctly', () => {
    expect(resolveDeepLink({ screen: 'ASSIGNMENT_DETAIL', id: 'asg-1' })).toBe('/assignments/asg-1');
    expect(resolveDeepLink({ screen: 'INSTALLATION', assignmentId: 'asg-2' })).toBe('/assignments/asg-2/install');
    expect(resolveDeepLink({ screen: 'DAILY_PHOTO', assignmentId: 'asg-3' })).toBe('/assignments/asg-3/daily-camera');
    expect(resolveDeepLink({ screen: 'CALENDAR', assignmentId: 'asg-4' })).toBe('/assignments/asg-4/calendar');
  });

  it('maps wallet, discipline, disputes, and notifications', () => {
    expect(resolveDeepLink({ screen: 'WALLET' })).toBe('/(tabs)/wallet');
    expect(resolveDeepLink({ screen: 'PAYOUT' })).toBe('/wallet/payouts');
    expect(resolveDeepLink({ screen: 'DISCIPLINE' })).toBe('/discipline');
    expect(resolveDeepLink({ screen: 'STRIKE' })).toBe('/discipline');
    expect(resolveDeepLink({ screen: 'DISPUTES' })).toBe('/disputes');
    expect(resolveDeepLink({ screen: 'DISPUTE_DETAIL', id: 'dsp-99' })).toBe('/disputes/dsp-99');
    expect(resolveDeepLink({ screen: 'NOTIFICATIONS' })).toBe('/(tabs)/notifications');
    expect(resolveDeepLink({ screen: 'UPLOAD_QUEUE' })).toBe('/upload-queue');
  });

  it('falls back safely to /(tabs) for unknown screen names', () => {
    expect(resolveDeepLink({ screen: 'UNKNOWN_SCREEN_XYZ' })).toBe('/(tabs)');
  });
});

