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
  refreshUser: () => Promise<AuthUser | null>;
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
      const [refreshToken, accessToken, cachedUser] = await Promise.all([
        tokenStorage.getRefreshToken().catch(() => null),
        tokenStorage.getAccessToken().catch(() => null),
        tokenStorage.getUserData().catch(() => null),
      ]);

      if (!refreshToken && !accessToken) {
        set({ isInitialized: true, isLoading: false, isAuthenticated: false, user: null, token: null });
        return;
      }

      // Immediately restore authenticated state from cache if user and token exist
      if (cachedUser) {
        set({
          user: cachedUser,
          token: accessToken || null,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });
      }

      // If we have an access token, check validity with getMe
      let verified = false;
      if (accessToken) {
        try {
          const me = await apiClient.getMe();
          if (me?.user) {
            await tokenStorage.saveUserData(me.user);
            set({
              user: me.user,
              token: accessToken,
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
            });
            verified = true;
          }
        } catch (meErr: any) {
          // If not 401, it may just be offline / transient; keep authenticated state
          if (meErr?.status !== 401 && cachedUser) {
            verified = true;
          }
        }
      }

      // If not verified with current access token, try refresh token
      if (!verified && refreshToken) {
        try {
          const newTokens = await apiClient.refreshTokens({ refreshToken });
          await tokenStorage.saveAccessToken(newTokens.accessToken);
          if (newTokens.refreshToken) {
            await tokenStorage.saveRefreshToken(newTokens.refreshToken);
          }

          const me = await apiClient.getMe();
          if (me?.user) {
            await tokenStorage.saveUserData(me.user);
            set({
              user: me.user,
              token: newTokens.accessToken,
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
            });
            verified = true;
          }
        } catch (refreshErr: any) {
          // Only clear if definitively rejected by auth server (401 / 403)
          if (refreshErr?.status === 401 || refreshErr?.status === 403) {
            await tokenStorage.clearAll();
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isInitialized: true,
              isLoading: false,
            });
            return;
          }
        }
      }

      // If still not verified but we had cached user and tokens, keep offline login active
      if (!verified && cachedUser) {
        set({
          user: cachedUser,
          token: accessToken || null,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });
      } else if (!verified) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
        });
      }
    } catch {
      // On any unexpected error during init, check if we have cached user to maintain session
      const cached = await tokenStorage.getUserData().catch(() => null);
      if (cached) {
        set({
          user: cached,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });
      } else {
        set({
          isInitialized: true,
          isLoading: false,
        });
      }
    }
  },

  login: async (res) => {
    await tokenStorage.saveAccessToken(res.accessToken);
    if (res.refreshToken) {
      await tokenStorage.saveRefreshToken(res.refreshToken);
    }
    if (res.user) {
      await tokenStorage.saveUserData(res.user);
    }
    set({
      user: res.user,
      token: res.accessToken,
      isAuthenticated: true,
      isInitialized: true,
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
    tokenStorage.saveUserData(user).catch(() => {});
    set({ user });
  },

  refreshUser: async () => {
    try {
      const me = await apiClient.getMe();
      if (me?.user) {
        await tokenStorage.saveUserData(me.user);
        set({ user: me.user });
        return me.user;
      }
    } catch {
      // Ignore network errors during silent refresh
    }
    return null;
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
