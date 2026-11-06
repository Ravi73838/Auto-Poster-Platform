import { describe, it, expect, beforeEach } from 'vitest';
import { hasPermission } from '../index';
import { ROLES } from '@ap/shared-constants';
import { useAuthStore } from '../../store/authStore';

describe('Permissions - hasPermission', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      permissions: [],
      isAuthenticated: false,
    });
  });

  it('returns false when role is null or undefined', () => {
    expect(hasPermission(null, 'kyc.approve')).toBe(false);
    expect(hasPermission(undefined, 'kyc.approve')).toBe(false);
  });

  it('grants all permissions to SUPER_ADMIN regardless of store permissions', () => {
    // Empty store permissions
    useAuthStore.setState({ permissions: [] });
    expect(hasPermission(ROLES.SUPER_ADMIN, 'kyc.approve')).toBe(true);
    expect(hasPermission(ROLES.SUPER_ADMIN, 'campaign.approve')).toBe(true);
    expect(hasPermission(ROLES.SUPER_ADMIN, 'system.manage')).toBe(true);

    // Wildcard store permissions
    useAuthStore.setState({ permissions: ['*'] });
    expect(hasPermission(ROLES.SUPER_ADMIN, 'kyc.approve')).toBe(true);

    // Some specific non-kyc permission
    useAuthStore.setState({ permissions: ['dispute.resolve'] });
    expect(hasPermission(ROLES.SUPER_ADMIN, 'kyc.approve')).toBe(true);
  });

  it('grants permission when store contains wildcard * or all for non-superadmin', () => {
    useAuthStore.setState({ permissions: ['*'] });
    expect(hasPermission(ROLES.MODERATOR, 'system.manage')).toBe(true);

    useAuthStore.setState({ permissions: ['all'] });
    expect(hasPermission(ROLES.FINANCE, 'campaign.approve')).toBe(true);
  });

  it('correctly cross-maps backend permission strings to frontend permissions', () => {
    useAuthStore.setState({ permissions: ['kyc.review'] });
    expect(hasPermission(ROLES.MODERATOR, 'kyc.approve')).toBe(true);

    useAuthStore.setState({ permissions: ['campaign.review'] });
    expect(hasPermission(ROLES.MODERATOR, 'campaign.approve')).toBe(true);

    useAuthStore.setState({ permissions: ['photos:review'] });
    expect(hasPermission(ROLES.MODERATOR, 'photo.approve')).toBe(true);
  });

  it('falls back to default ROLE_PERMISSIONS when store permissions is empty', () => {
    useAuthStore.setState({ permissions: [] });
    expect(hasPermission(ROLES.MODERATOR, 'kyc.approve')).toBe(true);
    expect(hasPermission(ROLES.MODERATOR, 'system.manage')).toBe(false);
    expect(hasPermission(ROLES.FINANCE, 'payout.approve')).toBe(true);
    expect(hasPermission(ROLES.FINANCE, 'kyc.approve')).toBe(false);
  });
});

