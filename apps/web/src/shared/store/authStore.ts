import { create } from 'zustand';
import { ROLES, ACCOUNT_STATUS, type Role } from '@ap/shared-constants';
import type { AuthUser } from '@ap/shared-types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loginAs: (role: Role) => void;
  logout: () => void;
}

const mockUsers: Record<Role, AuthUser> = {
  [ROLES.COMPANY]: {
    id: 'user-comp-001',
    role: ROLES.COMPANY,
    status: ACCOUNT_STATUS.APPROVED,
    name: 'Acme Advertising Ltd',
    phone: '9876543210',
  },
  [ROLES.SUPER_ADMIN]: {
    id: 'user-admin-001',
    role: ROLES.SUPER_ADMIN,
    status: ACCOUNT_STATUS.APPROVED,
    name: 'Super Admin User',
    phone: '9876543211',
  },
  [ROLES.MODERATOR]: {
    id: 'user-mod-001',
    role: ROLES.MODERATOR,
    status: ACCOUNT_STATUS.APPROVED,
    name: 'Content Moderator',
    phone: '9876543212',
  },
  [ROLES.FINANCE]: {
    id: 'user-fin-001',
    role: ROLES.FINANCE,
    status: ACCOUNT_STATUS.APPROVED,
    name: 'Finance Manager',
    phone: '9876543213',
  },
  [ROLES.DRIVER]: {
    id: 'user-drv-001',
    role: ROLES.DRIVER,
    status: ACCOUNT_STATUS.APPROVED,
    name: 'Ramesh Patel',
    phone: '9876543214',
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loginAs: (role: Role) => {
    const user = mockUsers[role];
    set({
      user,
      token: `fake-jwt-token-for-${role}`,
      isAuthenticated: true,
    });
  },
  logout: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
}));
