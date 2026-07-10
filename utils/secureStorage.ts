// expo-secure-store wraps the platform keychain/keystore so JWT tokens are
// encrypted at rest, unlike plain AsyncStorage which is readable via ADB on
// non-encrypted or rooted devices.
//
// NOTE: run `npx expo install expo-secure-store` before building.
// SecureStore has no web implementation (its calls throw), so web falls back
// to AsyncStorage (localStorage) — same at-rest exposure as any web app.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const secureStorage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
