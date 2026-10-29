import { create } from 'zustand';
import { ROLES, ACCOUNT_STATUS } from '@ap/shared-constants';
import type { AuthUser } from '@ap/shared-types';

interface MobileAuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loginAsDriver: () => void;
  logout: () => void;
}

export const useMobileAuthStore = create<MobileAuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loginAsDriver: () => {
    set({
      user: {
        id: 'drv-001',
        role: ROLES.DRIVER,
        status: ACCOUNT_STATUS.APPROVED,
        name: 'Ramesh Patel',
        phone: '9876543210',
      },
      token: 'fake-driver-jwt-token',
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
