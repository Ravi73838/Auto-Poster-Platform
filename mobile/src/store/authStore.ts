import { create } from 'zustand';
import { Platform } from 'react-native';
import { type Language, DEFAULT_LANGUAGE } from '@ap/shared-constants';
import type { AuthUser, LoginResponse } from '@ap/shared-types';
import { tokenStorage } from '../services/secureStore';
import { apiClient, setApiLanguage } from '../services/api';

interface MobileAuthState {
  user: AuthUser | null;
  token: string | null;
  language: Language;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;

  setLanguage: (lang: Language) => void;
  initialize: () => Promise<void>;
  login: (res: LoginResponse) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
  registerPushToken: (expoToken: string) => Promise<void>;
}

export const useMobileAuthStore = create<MobileAuthState>((set) => ({
  user: null,
  token: null,
  language: DEFAULT_LANGUAGE,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,

  setLanguage: (lang) => {
    setApiLanguage(lang);
    set({ language: lang });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        set({ isInitialized: true, isLoading: false });
        return;
      }

      // Refresh tokens
      const newTokens = await apiClient.refreshTokens({ refreshToken });
      await tokenStorage.saveAccessToken(newTokens.accessToken);
      if (newTokens.refreshToken) {
        await tokenStorage.saveRefreshToken(newTokens.refreshToken);
      }

      // Fetch user profile
      const me = await apiClient.getMe();
      set({
        user: me.user,
        token: newTokens.accessToken,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
    } catch {
      await tokenStorage.clearAll();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  login: async (res) => {
    await tokenStorage.saveAccessToken(res.accessToken);
    if (res.refreshToken) {
      await tokenStorage.saveRefreshToken(res.refreshToken);
    }
    set({
      user: res.user,
      token: res.accessToken,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await apiClient.logout();
    } catch {
      // ignore
    } finally {
      await tokenStorage.clearAll();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  updateUser: (user) => {
    set({ user });
  },

  registerPushToken: async (expoToken: string) => {
    try {
      await apiClient.registerDeviceToken({
        token: expoToken,
        platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
        provider: 'EXPO',
      });
    } catch {
      // Ignore push registration failure
    }
  },
}));
