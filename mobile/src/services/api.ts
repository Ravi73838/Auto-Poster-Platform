import { ApiClient } from '@ap/api-client';
import { tokenStorage } from './secureStore';
import { DEFAULT_LANGUAGE, type Language } from '@ap/shared-constants';
import { Platform } from 'react-native';

let currentLanguage: Language = DEFAULT_LANGUAGE;

export function setApiLanguage(lang: Language) {
  currentLanguage = lang;
}

// Android emulator loopback alias is 10.0.2.2, iOS simulator is localhost
const defaultBaseUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:4000/api/v1'
    : 'http://127.0.0.1:4000/api/v1';

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
  getLanguage: () => currentLanguage,
});

