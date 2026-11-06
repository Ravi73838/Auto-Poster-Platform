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
  if (role === ROLES.SUPER_ADMIN) return true;

  const storePermissions = useAuthStore.getState().permissions;
  if (storePermissions && storePermissions.length > 0) {
    if (storePermissions.includes('*') || storePermissions.includes('all')) {
      return true;
    }
    if (storePermissions.includes(permission)) {
      return true;
    }
    // Cross-mapping database permission keys to frontend permission keys
    if (permission === 'kyc.approve' && (storePermissions.includes('kyc.review') || storePermissions.includes('users:approve'))) {
      return true;
    }
    if (permission === 'campaign.approve' && (storePermissions.includes('campaign.review') || storePermissions.includes('campaigns:approve'))) {
      return true;
    }
    if (permission === 'photo.approve' && (storePermissions.includes('photos:review') || storePermissions.includes('photo.review'))) {
      return true;
    }
    if (permission === 'payout.approve' && (storePermissions.includes('payout.approve') || storePermissions.includes('payouts:approve'))) {
      return true;
    }
    if (permission === 'dispute.resolve' && (storePermissions.includes('dispute.resolve') || storePermissions.includes('disputes:resolve'))) {
      return true;
    }
    if (permission === 'settings.manage' && (storePermissions.includes('settings.update') || storePermissions.includes('settings:update'))) {
      return true;
    }
    if (permission === 'team.manage' && (storePermissions.includes('team.manage') || storePermissions.includes('team:manage') || storePermissions.includes('role.manage'))) {
      return true;
    }
    if (permission === 'audit.view' && (storePermissions.includes('audit.view') || storePermissions.includes('ledger:read'))) {
      return true;
    }
    if (permission === 'system.view' && (storePermissions.includes('system.view') || storePermissions.includes('system.manage'))) {
      return true;
    }
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

