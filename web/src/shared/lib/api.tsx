import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ApiClient } from '@ap/api-client';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import type { Language } from '@ap/shared-constants';

const ApiContext = createContext<ApiClient | undefined>(undefined);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  const client = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
    return new ApiClient({
      baseUrl,
      getAuthToken: () => useAuthStore.getState().token,
      setAuthToken: (token) => useAuthStore.getState().setToken(token),
      getLanguage: () => i18n.language as Language,
      onAuthLost: () => useAuthStore.getState().clearAuth(),
      credentials: 'include',
    });
  }, [i18n.language]);

  const initRanRef = useRef(false);

  useEffect(() => {
    // If we already have restored auth state from localStorage, initialize immediately
    const current = useAuthStore.getState();
    if (current.isAuthenticated && current.user && current.token) {
      useAuthStore.getState().setInitialized(true);
    }

    if (initRanRef.current) return;
    initRanRef.current = true;

    async function initAuth() {
      useAuthStore.getState().setLoading(true);
      try {
        // Validate or refresh tokens via cookie
        const tokens = await client.refreshTokens();
        if (tokens?.accessToken) {
          useAuthStore.getState().setToken(tokens.accessToken);
          const me = await client.getMe();
          useAuthStore.getState().setAuth({
            user: me.user,
            token: tokens.accessToken,
            permissions: me.permissions,
          });
        }
      } catch (err: any) {
        // Only clear credentials if the session was explicitly rejected/revoked
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
  if (!client) {
    throw new Error('useApiClient must be used within an ApiProvider');
  }
  return client;
}

export const useApi = useApiClient;
