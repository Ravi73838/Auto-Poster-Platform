import { ApiClient } from '@ap/api-client';
import { mobileConfig } from '../config/index.js';
import { useMobileAuthStore } from '../store/authStore.js';
import i18n from '../i18n/index.js';
import type { Language } from '@ap/shared-constants';

export const apiClient = new ApiClient({
  baseUrl: mobileConfig.apiBaseUrl,
  getAuthToken: () => useMobileAuthStore.getState().token,
  getLanguage: () => i18n.language as Language,
});
