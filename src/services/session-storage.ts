import * as SecureStore from 'expo-secure-store';

const key = 'nele-auth-session-v1';

export const sessionStorage = {
  cookieSessionFallback: false,
  read: () => SecureStore.getItemAsync(key),
  write: (value: string) => SecureStore.setItemAsync(key, value),
  remove: () => SecureStore.deleteItemAsync(key),
};
