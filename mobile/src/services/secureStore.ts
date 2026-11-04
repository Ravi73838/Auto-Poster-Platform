import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'ap_driver_refresh_token';
const ACCESS_TOKEN_KEY = 'ap_driver_access_token';

// In-memory fallback for web/testing environments where SecureStore native module isn't available
const memoryStorage = new Map<string, string>();

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function saveSecureItem(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } else {
    memoryStorage.set(key, value);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    return await SecureStore.getItemAsync(key);
  }
  return memoryStorage.get(key) ?? null;
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
  } else {
    memoryStorage.delete(key);
  }
}

export const tokenStorage = {
  saveRefreshToken: (token: string) => saveSecureItem(REFRESH_TOKEN_KEY, token),
  getRefreshToken: () => getSecureItem(REFRESH_TOKEN_KEY),
  deleteRefreshToken: () => deleteSecureItem(REFRESH_TOKEN_KEY),

  saveAccessToken: (token: string) => saveSecureItem(ACCESS_TOKEN_KEY, token),
  getAccessToken: () => getSecureItem(ACCESS_TOKEN_KEY),
  deleteAccessToken: () => deleteSecureItem(ACCESS_TOKEN_KEY),

  clearAll: async () => {
    await deleteSecureItem(REFRESH_TOKEN_KEY);
    await deleteSecureItem(ACCESS_TOKEN_KEY);
  },
};

