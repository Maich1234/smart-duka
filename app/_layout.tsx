import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '@/context/AuthContext';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useAuthStore, type AuthState } from '@/store/authStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'smartduka.cache',
  throttleTime: 2000,
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const isAuthLoading = useAuthStore((s: AuthState) => s.isLoading);

  useEffect(() => {
    if (fontsLoaded && !isAuthLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAuthLoading]);

  if (!fontsLoaded) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="splash" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(owner)" />
              <Stack.Screen name="(staff)" />
            </Stack>
            <OfflineIndicator />
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
