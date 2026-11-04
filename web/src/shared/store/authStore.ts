import { create } from 'zustand';
import type { AuthUser } from '@ap/shared-types';

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  setAuth: (payload: {
    user: AuthUser;
    token: string;
    permissions?: string[];
  }) => void;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser) => void;
  setPermissions: (permissions: string[]) => void;
  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  permissions: [],
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,

  setAuth: ({ user, token, permissions = [] }) => {
    set({
      user,
      token,
      permissions,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setToken: (token) => {
    set({
      token,
      isAuthenticated: Boolean(token),
    });
  },

  setUser: (user) => {
    set({ user });
  },

  setPermissions: (permissions) => {
    set({ permissions });
  },

  setInitialized: (isInitialized) => {
    set({ isInitialized });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  clearAuth: () => {
    set({
      user: null,
      token: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
    });
  },

  logout: () => {
    set({
      user: null,
      token: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
