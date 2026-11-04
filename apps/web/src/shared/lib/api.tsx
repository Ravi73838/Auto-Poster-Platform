import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ApiClient } from '@ap/api-client';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import type { Language } from '@ap/shared-constants';

const ApiContext = createContext<ApiClient | undefined>(undefined);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const initAttempted = useRef(false);

  const client = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
    return new ApiClient({
      baseUrl,
      getAuthToken: () => useAuthStore.getState().token,
      setAuthToken: (token) => useAuthStore.getState().setToken(token),
      getLanguage: () => i18n.language as Language,
      onAuthLost: () => useAuthStore.getState().clearAuth(),
      credentials: 'include',
    });
  }, [i18n.language]);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    let isMounted = true;
    async function initAuth() {
      useAuthStore.getState().setLoading(true);
      try {
        // Attempt silent refresh via httpOnly cookie
        const tokens = await client.refreshTokens();
        if (tokens.accessToken) {
          useAuthStore.getState().setToken(tokens.accessToken);
          const me = await client.getMe();
          if (isMounted) {
            useAuthStore.getState().setAuth({
              user: me.user,
              token: tokens.accessToken,
              permissions: me.permissions,
            });
          }
        }
      } catch {
        if (isMounted) {
          useAuthStore.getState().clearAuth();
        }
      } finally {
        if (isMounted) {
          useAuthStore.getState().setInitialized(true);
          useAuthStore.getState().setLoading(false);
        }
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
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
