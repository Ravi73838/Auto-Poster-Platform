import { ApiClient } from '@ap/api-client';
import type { AuthTokens } from '@ap/shared-types';
import { tokenStorage } from './secureStore';
import { DEFAULT_LANGUAGE, type Language } from '@ap/shared-constants';
import { Platform } from 'react-native';

let currentLanguage: Language = DEFAULT_LANGUAGE;

export function setApiLanguage(lang: Language) {
  currentLanguage = lang;
}

let onTokensRefreshedCb: ((tokens: AuthTokens) => void) | null = null;
let onAuthLostCb: (() => void) | null = null;

export function registerAuthCallbacks(callbacks: {
  onTokensRefreshed?: (tokens: AuthTokens) => void;
  onAuthLost?: () => void;
}) {
  if (callbacks.onTokensRefreshed) {
    onTokensRefreshedCb = callbacks.onTokensRefreshed;
  }
  if (callbacks.onAuthLost) {
    onAuthLostCb = callbacks.onAuthLost;
  }
}

// Support EXPO_PUBLIC_API_URL if set; fallback: Android emulator 10.0.2.2, iOS simulator localhost
const defaultBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:4000/api/v1'
    : 'http://127.0.0.1:4000/api/v1');

export const apiClient = new ApiClient({
  baseUrl: defaultBaseUrl,
  getAuthToken: () => tokenStorage.getAccessToken(),
  setAuthToken: async (token) => {
    if (token) {
      await tokenStorage.saveAccessToken(token);
    } else {
      await tokenStorage.deleteAccessToken();
    }
  },
  getRefreshToken: () => tokenStorage.getRefreshToken(),
  setRefreshToken: async (token) => {
    if (token) {
      await tokenStorage.saveRefreshToken(token);
    } else {
      await tokenStorage.deleteRefreshToken();
    }
  },
  onTokensRefreshed: async (tokens) => {
    if (tokens.accessToken) {
      await tokenStorage.saveAccessToken(tokens.accessToken);
    }
    if (tokens.refreshToken) {
      await tokenStorage.saveRefreshToken(tokens.refreshToken);
    }
    onTokensRefreshedCb?.(tokens);
  },
  onAuthLost: () => {
    onAuthLostCb?.();
  },
  getLanguage: () => currentLanguage,
});

