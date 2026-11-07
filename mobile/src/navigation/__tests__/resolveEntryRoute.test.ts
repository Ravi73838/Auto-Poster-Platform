import { describe, it, expect } from 'vitest';
import { resolveEntryRoute, isVersionBelow } from '../resolveEntryRoute';
import { ACCOUNT_STATUS, ROLES } from '@ap/shared-constants';
import type { AuthMeResponse, AuthUser } from '@ap/shared-types';

describe('resolveEntryRoute', () => {
  const baseUser: AuthUser = {
    id: 'drv-1',
    mobile: '+919988776655',
    email: null,
    role: ROLES.DRIVER,
    status: ACCOUNT_STATUS.APPROVED,
    preferredLanguage: 'en',
    preferredTheme: 'light',
    twoFactorEnabled: false,
    mustChangePassword: false,
    mobileVerifiedAt: new Date().toISOString(),
    emailVerifiedAt: null,
  };

  const baseMe: AuthMeResponse = {
    user: baseUser,
    role: ROLES.DRIVER,
    status: ACCOUNT_STATUS.APPROVED,
    permissions: [],
    preferences: { language: 'en', theme: 'light' },
    profileCompleteness: true,
    mustChangePassword: false,
  };

  it('routes to maintenance when appConfig.maintenance is true', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: baseMe,
      appConfig: { maintenance: true },
    });
    expect(route).toBe('/(public)/maintenance');
  });

  it('routes to update-required when app version is below minVersion', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: baseMe,
      currentAppVersion: '0.1.0',
      appConfig: { minVersion: '0.2.0' },
    });
    expect(route).toBe('/(public)/update-required');
  });

  it('does not route to update-required when app version equals or exceeds minVersion', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: baseMe,
      currentAppVersion: '1.2.0',
      appConfig: { minVersion: '1.2.0' },
    });
    expect(route).toBe('/(tabs)');
  });

  it('routes to language selection if hasChosenLanguage is false', () => {
    const route = resolveEntryRoute({
      isAuthenticated: false,
      hasChosenLanguage: false,
    });
    expect(route).toBe('/(public)/language');
  });

  it('routes to login if unauthenticated', () => {
    const route = resolveEntryRoute({
      isAuthenticated: false,
      hasChosenLanguage: true,
    });
    expect(route).toBe('/(public)/login');
  });

  it('routes to blocked if user status is BLOCKED', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        user: { ...baseUser, status: ACCOUNT_STATUS.BLOCKED },
      },
    });
    expect(route).toBe('/blocked');
  });

  it('routes to consent-gate if there are pendingConsents', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        pendingConsents: [
          {
            type: 'TERMS_AND_CONDITIONS',
            version: 2,
            title: 'Terms of Service',
            publishedAt: new Date().toISOString(),
          },
        ],
      },
    });
    expect(route).toBe('/consent-gate');
  });

  it('routes PENDING status without submitted KYC to onboarding wizard', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        user: { ...baseUser, status: ACCOUNT_STATUS.PENDING },
      },
      kycStatus: 'DRAFT',
    });
    expect(route).toBe('/(onboarding)/wizard');
  });

  it('routes PENDING status with SUBMITTED KYC to onboarding status screen', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        user: { ...baseUser, status: ACCOUNT_STATUS.PENDING },
      },
      kycStatus: 'SUBMITTED',
    });
    expect(route).toBe('/(onboarding)/status');
  });

  it('routes NEED_MORE_INFO status to onboarding wizard to correct items', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        user: { ...baseUser, status: 'NEED_MORE_INFO' as any },
      },
      kycStatus: 'NEED_MORE_INFO',
    });
    expect(route).toBe('/(onboarding)/wizard');
  });

  it('routes REJECTED status to onboarding status screen with rejection reason', () => {
    const route = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        user: { ...baseUser, status: 'REJECTED' as any },
      },
      kycStatus: 'REJECTED',
    });
    expect(route).toBe('/(onboarding)/status');
  });

  it('routes APPROVED or SUSPENDED drivers to tabs', () => {
    const approvedRoute = resolveEntryRoute({
      isAuthenticated: true,
      me: baseMe,
    });
    expect(approvedRoute).toBe('/(tabs)');

    const suspendedRoute = resolveEntryRoute({
      isAuthenticated: true,
      me: {
        ...baseMe,
        user: { ...baseUser, status: ACCOUNT_STATUS.SUSPENDED },
      },
    });
    expect(suspendedRoute).toBe('/(tabs)');
  });
});

describe('isVersionBelow', () => {
  it('correctly compares version components', () => {
    expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionBelow('0.9.9', '1.0.0')).toBe(true);
    expect(isVersionBelow('1.1.0', '1.0.9')).toBe(false);
    expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
  });
});
