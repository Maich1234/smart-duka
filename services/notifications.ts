import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PREFERENCE_KEY = '@smart_duka_notifications_enabled';

/** Local on/off preference shown in Profile — defaults to enabled. */
export const getNotificationsPreference = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(PREFERENCE_KEY);
  return value !== 'false';
};

export const setNotificationsPreference = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(PREFERENCE_KEY, String(enabled));
};

/**
 * Push notifications use @react-native-firebase/messaging, a native module
 * that's only present after an EAS/dev-client rebuild with the Firebase
 * config files in place. Every entry point here is defensive (dynamic
 * import + try/catch, no-op on web) so the rest of the app — including the
 * web export — keeps working before that rebuild happens.
 */
const loadMessaging = async () => {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('@react-native-firebase/messaging');
    return mod.default;
  } catch (e) {
    console.warn('Firebase messaging native module unavailable (requires a dev-client rebuild)', e);
    return null;
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  const messaging = await loadMessaging();
  if (!messaging) return false;
  try {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (e) {
    console.warn('Notification permission request failed', e);
    return false;
  }
};

const getDeviceToken = async (): Promise<string | null> => {
  const messaging = await loadMessaging();
  if (!messaging) return null;
  try {
    return await messaging().getToken();
  } catch (e) {
    console.warn('Failed to get FCM token', e);
    return null;
  }
};

/** Requests permission (if needed) and registers this device's token with the backend. Call on login. */
export const registerDeviceForNotifications = async (): Promise<void> => {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  const token = await getDeviceToken();
  if (!token) return;
  try {
    await api.post('/auth/device-token', { token });
  } catch (e) {
    console.warn('Failed to register device token with backend', e);
  }
};

/** Unregisters this device's token from the backend. Call on logout. */
export const unregisterDeviceFromNotifications = async (): Promise<void> => {
  const token = await getDeviceToken();
  if (!token) return;
  try {
    await api.delete('/auth/device-token', { data: { token } });
  } catch (e) {
    console.warn('Failed to unregister device token', e);
  }
};

/** Subscribes to foreground push messages. Returns an unsubscribe function (no-op if unavailable). */
export const onForegroundMessage = (handler: (message: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void): (() => void) => {
  let unsubscribe = () => {};
  loadMessaging().then((messaging) => {
    if (!messaging) return;
    unsubscribe = messaging().onMessage(async (msg) => handler(msg as unknown as { notification?: { title?: string; body?: string }; data?: Record<string, string> }));
  });
  return () => unsubscribe();
};

/**
 * Fires when the user TAPS a notification — either while the app was
 * backgrounded (onNotificationOpenedApp) or fully quit (getInitialNotification)
 * — so pushes can deep-link straight into the relevant screen.
 */
export const onNotificationOpened = (
  handler: (data: Record<string, string>) => void
): (() => void) => {
  let unsubscribe = () => {};
  loadMessaging().then((messaging) => {
    if (!messaging) return;
    unsubscribe = messaging().onNotificationOpenedApp((msg) => {
      if (msg?.data) handler(msg.data as Record<string, string>);
    });
    messaging()
      .getInitialNotification()
      .then((msg) => {
        if (msg?.data) handler(msg.data as Record<string, string>);
      })
      .catch(() => {});
  });
  return () => unsubscribe();
};

/** Keeps the backend's copy of the device token in sync when Firebase rotates it. */
export const onTokenRefresh = (): (() => void) => {
  let unsubscribe = () => {};
  loadMessaging().then((messaging) => {
    if (!messaging) return;
    unsubscribe = messaging().onTokenRefresh(async (token: string) => {
      try {
        await api.post('/auth/device-token', { token });
      } catch (e) {
        console.warn('Failed to re-register refreshed device token', e);
      }
    });
  });
  return () => unsubscribe();
};
