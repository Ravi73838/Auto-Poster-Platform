import { ROLES, type Role } from '@ap/shared-constants';
import { useAuthStore } from '../store/authStore';

export type Permission =
  | 'kyc.approve'
  | 'campaign.approve'
  | 'photo.approve'
  | 'payout.approve'
  | 'dispute.resolve'
  | 'settings.manage'
  | 'audit.view';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.SUPER_ADMIN]: [
    'kyc.approve',
    'campaign.approve',
    'photo.approve',
    'payout.approve',
    'dispute.resolve',
    'settings.manage',
    'audit.view',
  ],
  [ROLES.MODERATOR]: [
    'kyc.approve',
    'campaign.approve',
    'photo.approve',
    'dispute.resolve',
    'audit.view',
  ],
  [ROLES.FINANCE]: [
    'payout.approve',
    'audit.view',
  ],
  [ROLES.COMPANY]: [],
  [ROLES.DRIVER]: [],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
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
