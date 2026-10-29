import React, { createContext, useContext, useMemo } from 'react';
import { ApiClient } from '@ap/api-client';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import type { Language } from '@ap/shared-constants';

const ApiContext = createContext<ApiClient | undefined>(undefined);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const { i18n } = useTranslation();

  const client = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
    return new ApiClient({
      baseUrl,
      getAuthToken: () => token,
      getLanguage: () => i18n.language as Language,
    });
  }, [token, i18n.language]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApiClient must be used within an ApiProvider');
  }
  return client;
}
