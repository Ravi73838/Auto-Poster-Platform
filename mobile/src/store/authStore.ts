import { create } from 'zustand';
import { Platform } from 'react-native';
import { type Language, DEFAULT_LANGUAGE } from '@ap/shared-constants';
import type { AuthUser, LoginResponse } from '@ap/shared-types';
import { tokenStorage } from '../services/secureStore';
import { apiClient, setApiLanguage, registerAuthCallbacks } from '../services/api';

function safeAtob(b64: string): string {
  if (typeof atob === 'function') {
    return atob(b64);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = b64.replace(/=+$/, '');
  let output = '';
  for (
    let bc = 0, bs = 0, buffer: number, idx = 0;
    (buffer = chars.indexOf(str.charAt(idx++))) !== -1;
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {}
  return output;
}

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonStr = safeAtob(padded);
    const parsed = JSON.parse(jsonStr);
    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearProactiveRefresh() {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

function scheduleProactiveRefresh(accessToken: string | null) {
  clearProactiveRefresh();
  if (!accessToken) return;

  const expSec = parseJwtExp(accessToken);
  if (!expSec) return;

  const expMs = expSec * 1000;
  const now = Date.now();
  // Refresh 2 minutes (120,000 ms) before token expiration, or at least in 5 seconds
  const leadTimeMs = 120_000;
  const delayMs = Math.max(5_000, expMs - now - leadTimeMs);

  proactiveRefreshTimer = setTimeout(async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return;
      await apiClient.refreshTokens({ refreshToken });
    } catch {
      // If refresh fails (e.g. temporary offline/poor connection), retry in 30 seconds
      proactiveRefreshTimer = setTimeout(async () => {
        try {
          const refreshToken = await tokenStorage.getRefreshToken();
          if (!refreshToken) return;
          await apiClient.refreshTokens({ refreshToken });
        } catch {
          // ignore
        }
      }, 30_000);
    }
  }, delayMs);
}

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
        clearProactiveRefresh();
        set({ isInitialized: true, isLoading: false, isAuthenticated: false, user: null, token: null });
        return;
      }

      // Immediately restore authenticated state from cache if user exists
      if (cachedUser) {
        set({
          user: cachedUser,
          token: accessToken || null,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });
      }

      let activeToken = accessToken;

      // Check if access token is already expired or close to expiry (< 30s)
      const expSec = accessToken ? parseJwtExp(accessToken) : null;
      const isExpired = !expSec || (expSec * 1000 - Date.now() < 30_000);

      if (isExpired && refreshToken) {
        try {
          const newTokens = await apiClient.refreshTokens({ refreshToken });
          activeToken = newTokens.accessToken;
          await tokenStorage.saveAccessToken(newTokens.accessToken);
          if (newTokens.refreshToken) {
            await tokenStorage.saveRefreshToken(newTokens.refreshToken);
          }
        } catch (refreshErr: any) {
          // Only clear session if server explicitly rejected with 401 or 403 (revoked session)
          if (refreshErr?.status === 401 || refreshErr?.status === 403) {
            clearProactiveRefresh();
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
          // If network / offline error, keep cached session alive
        }
      }

      // Verify/refresh user data with getMe
      if (activeToken) {
        try {
          const me = await apiClient.getMe();
          if (me?.user) {
            await tokenStorage.saveUserData(me.user);
            set({
              user: me.user,
              token: activeToken,
              isAuthenticated: true,
              isInitialized: true,
              isLoading: false,
            });
            scheduleProactiveRefresh(activeToken);
            return;
          }
        } catch (meErr: any) {
          if (meErr?.status === 401 && refreshToken) {
            try {
              const refreshed = await apiClient.refreshTokens({ refreshToken });
              const meAfter = await apiClient.getMe();
              if (meAfter?.user) {
                await tokenStorage.saveUserData(meAfter.user);
                set({
                  user: meAfter.user,
                  token: refreshed.accessToken,
                  isAuthenticated: true,
                  isInitialized: true,
                  isLoading: false,
                });
                scheduleProactiveRefresh(refreshed.accessToken);
                return;
              }
            } catch (finalErr: any) {
              if (finalErr?.status === 401 || finalErr?.status === 403) {
                clearProactiveRefresh();
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
        }
      }

      // If network is offline or server returned non-401 error, keep offline session
      if (cachedUser) {
        set({
          user: cachedUser,
          token: activeToken || null,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });
        scheduleProactiveRefresh(activeToken);
      } else {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
        });
      }
    } catch {
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
    scheduleProactiveRefresh(res.accessToken);
  },

  logout: async () => {
    clearProactiveRefresh();
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

registerAuthCallbacks({
  onTokensRefreshed: (tokens) => {
    useMobileAuthStore.setState({ token: tokens.accessToken });
    scheduleProactiveRefresh(tokens.accessToken);
  },
  onAuthLost: () => {
    clearProactiveRefresh();
    tokenStorage.clearAll().catch(() => {});
    useMobileAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
});
