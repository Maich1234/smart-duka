// expo-secure-store wraps the platform keychain/keystore so JWT tokens are
// encrypted at rest, unlike plain AsyncStorage which is readable via ADB on
// non-encrypted or rooted devices.
//
// NOTE: run `npx expo install expo-secure-store` before building.
// SecureStore is unavailable on web — if web support is needed, add a
// platform-conditional fallback to AsyncStorage here.
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
