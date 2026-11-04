import { ROLES, type Role } from '@ap/shared-constants';
import { useAuthStore } from '../store/authStore';

export type Permission =
  | 'kyc.approve'
  | 'campaign.approve'
  | 'photo.approve'
  | 'payout.approve'
  | 'dispute.resolve'
  | 'settings.manage'
  | 'audit.view'
  | 'team.manage'
  | 'strike.manage'
  | 'announcement.manage'
  | 'system.view'
  | 'system.manage';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.SUPER_ADMIN]: [
    'kyc.approve',
    'campaign.approve',
    'photo.approve',
    'payout.approve',
    'dispute.resolve',
    'settings.manage',
    'audit.view',
    'team.manage',
    'strike.manage',
    'announcement.manage',
    'system.view',
    'system.manage',
  ],
  [ROLES.MODERATOR]: [
    'kyc.approve',
    'campaign.approve',
    'photo.approve',
    'dispute.resolve',
    'audit.view',
    'strike.manage',
    'announcement.manage',
  ],
  [ROLES.FINANCE]: [
    'payout.approve',
    'audit.view',
    'dispute.resolve',
  ],
  [ROLES.COMPANY]: [],
  [ROLES.DRIVER]: [],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const storePermissions = useAuthStore.getState().permissions;
  if (storePermissions && storePermissions.length > 0) {
    return storePermissions.includes(permission);
  }
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function can(permission: Permission): boolean {
  const user = useAuthStore.getState().user;
  return hasPermission(user?.role, permission);
}

export function useCan(permission: Permission): boolean {
  const user = useAuthStore((s) => s.user);
  return hasPermission(user?.role, permission);
}

