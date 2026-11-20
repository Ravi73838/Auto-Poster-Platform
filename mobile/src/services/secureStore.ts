import { container } from './container';

const REFRESH_TOKEN_KEY = 'ap_driver_refresh_token';
const ACCESS_TOKEN_KEY = 'ap_driver_access_token';
const USER_DATA_KEY = 'ap_driver_user_data';

export async function saveSecureItem(key: string, value: string): Promise<void> {
  await container.secureStore.setItem(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  return await container.secureStore.getItem(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  await container.secureStore.deleteItem(key);
}

export const tokenStorage = {
  saveRefreshToken: (token: string) => saveSecureItem(REFRESH_TOKEN_KEY, token),
  getRefreshToken: () => getSecureItem(REFRESH_TOKEN_KEY),
  deleteRefreshToken: () => deleteSecureItem(REFRESH_TOKEN_KEY),

  saveAccessToken: (token: string) => saveSecureItem(ACCESS_TOKEN_KEY, token),
  getAccessToken: () => getSecureItem(ACCESS_TOKEN_KEY),
  deleteAccessToken: () => deleteSecureItem(ACCESS_TOKEN_KEY),

  saveUserData: (user: any) => saveSecureItem(USER_DATA_KEY, JSON.stringify(user)),
  getUserData: async (): Promise<any | null> => {
    try {
      const data = await getSecureItem(USER_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  deleteUserData: () => deleteSecureItem(USER_DATA_KEY),

  clearAll: async () => {
    await deleteSecureItem(REFRESH_TOKEN_KEY);
    await deleteSecureItem(ACCESS_TOKEN_KEY);
    await deleteSecureItem(USER_DATA_KEY);
  },
};
