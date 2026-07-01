import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clear all persisted app data on logout.
 * Targets the Zustand persist key and the React Query offline cache.
 */
export const clearAll = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    'auth-storage',    // Zustand persist key (authStore.ts)
    'smartduka.cache', // React Query persist key (_layout.tsx)
  ]);
};
