import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '@/context/AuthContext';
import { AlertProvider, useAlert } from '@/context/AlertContext';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { onForegroundMessage, onTokenRefresh } from '@/services/notifications';
import { initOfflineDb } from '@/utils/offlineDb';
import { setupOfflineListener } from '@/utils/offlineManager';
import { enqueueOperation } from '@/utils/offlineQueue';

// Initialise SQLite queue DB synchronously before any React render
initOfflineDb();
// Wire up NetInfo → React Query online state + queue flush on reconnect
setupOfflineListener();

/** One-time migration of any requests queued by the old AsyncStorage method. */
async function migrateAsyncStorageQueue() {
  try {
    const raw = await AsyncStorage.getItem('offline_mutations');
    if (!raw) return;
    const items: Array<{ method?: string; url?: string; data?: Record<string, unknown> }> =
      JSON.parse(raw);
    for (const item of items) {
      enqueueOperation(
        { method: item.method ?? 'POST', url: item.url ?? '', body: item.data ?? null },
        `migrate:${crypto.randomUUID()}`
      );
    }
    await AsyncStorage.removeItem('offline_mutations');
  } catch {
    // Malformed data — just clear it
    await AsyncStorage.removeItem('offline_mutations').catch(() => {});
  }
}

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

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

// Handles FCM foreground messages using the custom alert system.
// Must live inside AlertProvider so useAlert is available.
function NotificationListener() {
  const { alert } = useAlert();

  useEffect(() => {
    const unsubscribe = onForegroundMessage(({ notification, data }) => {
      if (!notification?.title) return;
      alert({
        type: 'info',
        title: notification.title ?? '',
        message: notification.body ?? undefined,
        buttons: [
          { label: 'Dismiss', variant: 'ghost' },
          {
            label: 'View',
            variant: 'primary',
            onPress: () =>
              router.push(
                data?.type === 'depletion_alert'
                  ? '/(owner)/inventory'
                  : '/(owner)/reports'
              ),
          },
        ],
      });
    });
    return unsubscribe;
  }, [alert]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const isAuthLoading = useAuthStore((s: AuthState) => s.isLoading);

  useEffect(() => {
    if (fontsLoaded && !isAuthLoading) {
      requestAnimationFrame(() => SplashScreen.hideAsync());
    }
  }, [fontsLoaded, isAuthLoading]);

  useEffect(() => {
    const unsubscribe = onTokenRefresh();
    return unsubscribe;
  }, []);

  useEffect(() => {
    migrateAsyncStorageQueue();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <SafeAreaProvider>
            <AlertProvider>
              <AuthProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="splash" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(owner)" />
                  <Stack.Screen name="(staff)" />
                  <Stack.Screen name="(public)" />
                  <Stack.Screen name="help" />
                </Stack>
                <OfflineIndicator />
                <NotificationListener />
              </AuthProvider>
            </AlertProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
