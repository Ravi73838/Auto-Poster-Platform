import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ApiClient } from '@ap/api-client';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import type { Language } from '@ap/shared-constants';

let defaultClientInstance: ApiClient | null = null;

export function getDefaultApiClient(): ApiClient {
  if (!defaultClientInstance) {
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:4000/api/v1';
    defaultClientInstance = new ApiClient({
      baseUrl,
      getAuthToken: () => useAuthStore.getState().token,
      setAuthToken: (token) => useAuthStore.getState().setToken(token),
      getRefreshToken: () => useAuthStore.getState().refreshToken,
      getLanguage: () => 'en',
      onAuthLost: () => useAuthStore.getState().clearAuth(),
      credentials: 'include',
    });
  }
  return defaultClientInstance;
}

const ApiContext = createContext<ApiClient>(getDefaultApiClient());

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  const client = useMemo(() => {
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:4000/api/v1';
    return new ApiClient({
      baseUrl,
      getAuthToken: () => useAuthStore.getState().token,
      setAuthToken: (token) => useAuthStore.getState().setToken(token),
      getRefreshToken: () => useAuthStore.getState().refreshToken,
      getLanguage: () => (i18n.language as Language) || 'en',
      onAuthLost: () => useAuthStore.getState().clearAuth(),
      credentials: 'include',
    });
  }, [i18n.language]);

  const initRanRef = useRef(false);

  useEffect(() => {
    const current = useAuthStore.getState();
    if (current.isAuthenticated && current.user && current.token) {
      useAuthStore.getState().setInitialized(true);
    }

    if (initRanRef.current) return;
    initRanRef.current = true;

    async function initAuth() {
      const state = useAuthStore.getState();

      // 1. If we already have a valid session in localStorage, verify with getMe() first
      if (state.token && state.user) {
        try {
          const me = await client.getMe();
          useAuthStore.getState().setUser(me.user);
          if (me.permissions) {
            useAuthStore.getState().setPermissions(me.permissions);
          }
          useAuthStore.getState().setInitialized(true);
          return;
        } catch (err: any) {
          // If network error or transient glitch, keep the restored session!
          if (err?.status !== 401 && err?.statusCode !== 401) {
            useAuthStore.getState().setInitialized(true);
            return;
          }
          // Only fall through to refresh if token expired (401)
        }
      }

      // 2. If no tokens exist at all, user is not logged in — do not make unnecessary refresh request
      const rfToken = useAuthStore.getState().refreshToken;
      if (!rfToken && !state.token) {
        useAuthStore.getState().setInitialized(true);
        useAuthStore.getState().setLoading(false);
        return;
      }

      // 3. Token expired but refreshToken exists: attempt token refresh
      useAuthStore.getState().setLoading(true);
      try {
        const tokens = await client.refreshTokens(rfToken ? { refreshToken: rfToken } : undefined);
        if (tokens?.accessToken) {
          useAuthStore.getState().setToken(tokens.accessToken);
          if (tokens.refreshToken) {
            useAuthStore.getState().setRefreshToken(tokens.refreshToken);
          }
          const me = await client.getMe();
          useAuthStore.getState().setAuth({
            user: me.user,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken || rfToken,
            permissions: me.permissions,
          });
        }
      } catch (err: any) {
        if (
          err?.status === 401 ||
          err?.statusCode === 401 ||
          err?.code === 'SESSION_REVOKED' ||
          err?.code === 'TOKEN_INVALID'
        ) {
          useAuthStore.getState().clearAuth();
        }
      } finally {
        useAuthStore.getState().setInitialized(true);
        useAuthStore.getState().setLoading(false);
      }
    }

    initAuth();
  }, [client]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  return client || getDefaultApiClient();
}

export const useApi = useApiClient;
