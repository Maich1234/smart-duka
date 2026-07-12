import React, { useEffect, useCallback, useRef } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PressablesConfig } from 'pressto';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
// Subpath imports so Metro bundles only these three weights, not all 18 Inter fonts.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AlertProvider, useAlert } from '@/context/AlertContext';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { onForegroundMessage, onNotificationOpened, onTokenRefresh } from '@/services/notifications';
import { initOfflineDb } from '@/utils/offlineDb';
import { setupOfflineListener } from '@/utils/offlineManager';
import { enqueueOperation } from '@/utils/offlineQueue';
import { randomUUID } from '@/utils/uuid';
import { getProducts } from '@/services/products';
import { getShopConfig } from '@/services/shop';
import { getPaymentStatus } from '@/services/paymentConfig';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Motion } from '@/constants/Motion';

// Initialise SQLite queue DB synchronously before any React render
initOfflineDb();
// Wire up NetInfo → React Query online state + queue flush on reconnect
setupOfflineListener();

/** One-time migration of any requests queued by the old AsyncStorage method. */
async function migrateAsyncStorageQueue() {
  try {
    const raw = await AsyncStorage.getItem('offline_mutations');
    if (!raw) return;
    const items: { method?: string; url?: string; data?: Record<string, unknown> }[] =
      JSON.parse(raw);
    for (const item of items) {
      enqueueOperation(
        { method: item.method ?? 'POST', url: item.url ?? '', body: item.data ?? null },
        `migrate:${randomUUID()}`
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
      // 6 hours in-memory GC — enough for an 8-hour shift without memory bloat.
      gcTime: 1000 * 60 * 60 * 6,
      // POS data (stock levels, sales) changes with every transaction.
      // 1 minute gives a reasonable background-refetch cadence without
      // hammering the API on every re-render.
      staleTime: 1000 * 60 * 1,
      retry: 1,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'smartduka.cache',
  throttleTime: 3000,
  // Hard cap: ~4 MB of JSON. Keeps the serialised cache manageable on
  // low-storage Android devices (2 GB RAM, 16 GB ROM tier).
  // If the cap is hit, React Query drops the least-recently-used queries first.
  serialize: (data) => {
    const json = JSON.stringify(data);
    // ~4 MB safety valve — if serialised cache exceeds this, clear persisted
    // cache so the app never fills up small-storage devices.
    if (json.length > 4 * 1024 * 1024) {
      AsyncStorage.removeItem('smartduka.cache').catch(() => {});
      return '{}';
    }
    return json;
  },
  deserialize: (str) => {
    try { return JSON.parse(str); } catch { return {}; }
  },
});

// Proactively caches data that staff need to work offline.
// Runs once on mount (if online) and again whenever connectivity is restored.
// React Query's AsyncStorage persister keeps these payloads across app restarts,
// so users who opened the app while online can work through a connection drop.
function CriticalDataPrefetch() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s: AuthState) => s.user);

  const prefetch = useCallback(async () => {
    if (!user) return;
    // Products: first page. Must fetch exactly what the sales/inventory
    // screens fetch — this shares their ['products', '', 1] cache key, so a
    // different limit here makes the visible list flip sizes (and the page
    // count jump) every time a prefetch lands.
    queryClient.prefetchQuery({
      queryKey: ['products', '', 1],
      queryFn: () => getProducts({ search: '', page: 1, limit: 10 }),
      staleTime: 1000 * 60 * 2,
    });
    // Shop config: receipt header, logo, motto, thank-you note.
    queryClient.prefetchQuery({
      queryKey: ['shopConfig'],
      queryFn: getShopConfig,
      staleTime: 1000 * 60 * 10,
    });
    // Payment config: whether M-Pesa is active (affects checkout UI).
    queryClient.prefetchQuery({
      queryKey: ['paymentStatus'],
      queryFn: getPaymentStatus,
      staleTime: 1000 * 60 * 10,
    });
  }, [queryClient, user]);

  useEffect(() => {
    // Prefetch on mount if already online.
    NetInfo.fetch().then(state => {
      if (state.isConnected) prefetch();
    });

    // Re-prefetch whenever connectivity is restored (covers the case where the
    // app was launched offline and the user later connects).
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) prefetch();
    });
    return unsubscribe;
  }, [prefetch]);

  return null;
}

// Watches the sessionExpired flag set by the 401 interceptor.
// Shows an animated toast explaining why the user is being logged out,
// then calls logout() after a short delay so they can read the message.
function SessionExpiredHandler() {
  const { toast } = useAlert();
  const { logout: storeLogout } = useAuth();
  const sessionExpired = useAuthStore((s: AuthState) => s.sessionExpired);
  const setSessionExpired = useAuthStore((s: AuthState) => s.setSessionExpired);

  useEffect(() => {
    if (!sessionExpired) return;
    // Reset flag first so a double-fire can't trigger twice
    setSessionExpired(false);
    toast({
      type: 'warning',
      message: 'Your session has expired. Please sign in again.',
      duration: 3000,
    });
    // Give the toast a moment to render before navigating away
    const timer = setTimeout(() => {
      storeLogout();
    }, 1200);
    return () => clearTimeout(timer);
  }, [sessionExpired]);

  return null;
}

// Re-shows the splash animation when the app returns from a long stay in the
// background. Two guards keep it from destroying in-progress state:
//  - Signed-out users are never redirected — on Android, the Google Password
//    Manager sheet and system permission dialogs briefly background the app,
//    and replaying the splash from there wiped the login/onboarding forms and
//    bounced people back to the start of the welcome journey.
//  - Short background stints (quick app switches, those same system dialogs
//    for signed-in users) don't count; only a genuinely stale session replays
//    the splash and re-routes to the dashboard.
const RESUME_SPLASH_AFTER_MS = 5 * 60 * 1000;

function AppResumeHandler() {
  const backgroundedAtRef = useRef<number | null>(null);
  const pathnameRef = useRef('');
  const pathname = usePathname();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        backgroundedAtRef.current ??= Date.now();
        return;
      }
      // iOS can resume via background → inactive → active, so a recorded
      // background timestamp (not the previous state) is what marks a resume.
      if (nextState !== 'active') return;
      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (backgroundedAt === null || Date.now() - backgroundedAt < RESUME_SPLASH_AFTER_MS) return;
      if (!useAuthStore.getState().user) return;
      if (pathnameRef.current !== '/splash') {
        router.replace('/splash');
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

// Every push type's in-app destination — shared by the foreground alert's
// "View" button and by taps on system notifications (background/quit).
const routeForNotification = (data?: Record<string, string>) => {
  switch (data?.type) {
    case 'shift_closed':
      return data.shiftId
        ? (`/(owner)/shifts/${data.shiftId}` as const)
        : ('/(owner)/shifts' as const);
    case 'daily_summary':
      return {
        pathname: '/(owner)/summary',
        params: data.date ? { date: data.date } : {},
      } as const;
    case 'depletion_alert':
      return '/(owner)/inventory' as const;
    default:
      return '/(owner)/reports' as const;
  }
};

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
            onPress: () => router.push(routeForNotification(data) as never),
          },
        ],
      });
    });
    return unsubscribe;
  }, [alert]);

  // Taps on system notifications (app backgrounded or quit) deep-link
  // straight to the report the push was about.
  useEffect(() => {
    const unsubscribe = onNotificationOpened((data) => {
      router.push(routeForNotification(data) as never);
    });
    return unsubscribe;
  }, []);

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
      persistOptions={{
        persister: asyncStoragePersister,
        // Persist for 8 hours — one business shift. Expired cache is
        // dropped on startup so stale data never surfaces after overnight.
        maxAge: 1000 * 60 * 60 * 8,
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PressablesConfig
          animationType="spring"
          animationConfig={Motion.spring.press}
          config={{ minScale: Motion.press.scale, activeOpacity: 0.7 }}
          defaultProps={{ rippleColor: 'transparent' }}
        >
        <KeyboardProvider>
          <SafeAreaProvider>
            <AlertProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="splash" />
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(owner)" />
                    <Stack.Screen name="(staff)" />
                    <Stack.Screen name="(public)" />
                    <Stack.Screen name="help" />
                  </Stack>
                  <OfflineIndicator />
                  <CriticalDataPrefetch />
                  <AppResumeHandler />
                  <NotificationListener />
                  <SessionExpiredHandler />
                </ErrorBoundary>
              </AuthProvider>
            </AlertProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
        </PressablesConfig>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
