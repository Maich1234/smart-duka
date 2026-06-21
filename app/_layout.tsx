import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, router } from 'expo-router';
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
import { onForegroundMessage } from '@/services/notifications';

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

  useEffect(() => {
    const unsubscribe = onForegroundMessage(({ notification, data }) => {
      if (!notification?.title) return;
      Alert.alert(notification.title, notification.body, [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'View',
          onPress: () => router.push(data?.type === 'depletion_alert' ? '/(owner)/inventory' : '/(owner)/reports'),
        },
      ]);
    });
    return unsubscribe;
  }, []);

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
              <Stack.Screen name="(public)" />
            </Stack>
            <OfflineIndicator />
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
