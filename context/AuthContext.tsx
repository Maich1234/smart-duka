import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { router } from 'expo-router';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { clearProductCache } from '@/utils/productCache';
import { useAuthStore } from '@/store/authStore';
import { login as loginApi, getProfile } from '@/services/auth';
import { API_BASE_URL } from '@/constants/config';
import { clearAll } from '@/utils/storage';
import { waitForHydration } from '@/utils/hydration';
import {
  registerDeviceForNotifications,
  unregisterDeviceFromNotifications,
  getNotificationsPreference,
} from '@/services/notifications';

interface AuthContextType {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{
    success: boolean;
    message?: string;
    role?: 'owner' | 'staff';
    needsVerification?: boolean;
    fieldErrors?: { field: string; message: string }[];
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level flag prevents the logout side-effects (token clear, navigation)
// from firing twice when both SessionExpiredHandler's timer and a route guard
// call logout() in the same tick.
let logoutInProgress = false;

// How long startup will wait for the server to confirm or reject a hydrated
// session before routing on it anyway. Sized against a measured warm API
// round trip (~550-870ms from Kenya), so a live connection almost always
// answers inside it. app/splash.tsx then runs its brand animation before
// choosing a route, and validation continues during that too — so the real
// window is this plus the animation, and only a backend cold start is likely
// to outrun both.
const SESSION_VALIDATION_DEADLINE = 900;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setAuth, logout: storeLogout, isLoading, setLoading } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Revalidates the hydrated session against the server. Resolves as soon as
    // the answer is known; a rejected session is torn down *before* this
    // settles, so whoever is waiting on it routes to login rather than
    // flashing a dashboard belonging to an account that is no longer valid.
    const validateSession = async (storedUser: NonNullable<typeof user>) => {
      try {
        await getProfile();
      } catch (error: any) {
        // Only clear the session when the server explicitly rejected it.
        // A network failure here just means the app started offline — the
        // cached session must survive, or offline-first is dead on arrival
        // (the login screen can't authenticate without a connection).
        if (error?.response?.status === 401) {
          // Same reasoning as the manual logout below: an invalid session
          // must not leave its cached shop data (payment methods, sales,
          // everything else) sitting in memory for whoever uses the device
          // next.
          queryClient.clear();
          await clearAll();
          storeLogout();
        }
        return;
      }
      // Re-registers this device's FCM token on every app start (not just at
      // login) — otherwise a token that rotated or never made it to the
      // backend (e.g. permission granted after first login) stays out of sync
      // until the user manually logs out/in again. Deliberately not awaited:
      // a confirmed-good session shouldn't wait on a notifications lookup.
      void (async () => {
        if (storedUser.role === 'owner' && (await getNotificationsPreference())) {
          registerDeviceForNotifications();
        }
      })().catch(() => {});
    };

    const initAuth = async () => {
      try {
        // SecureStore hydration is async — reading the store before it lands
        // sees a null user, skips the profile/FCM refresh, and flips
        // isLoading off while a real session is still on its way in.
        await waitForHydration(useAuthStore);
      } catch {
        // Hydration itself failed (corrupt store, SecureStore unavailable).
        // Fall through on whatever the store holds rather than stranding the
        // app on the splash screen forever.
      }

      const storedUser = useAuthStore.getState().user;
      if (storedUser) {
        // Bounded wait, not an open one. getProfile() carries a 12s timeout,
        // and holding the splash for that long on a stalled connection would
        // punish every cashier to spare the rare one with a dead token. So:
        // give the server a short window to reject the session, and if it
        // hasn't answered by then, route on the cached session and let
        // validation land in the background. Validation keeps running either
        // way, and the splash animation that follows this adds its own window
        // on top before any route is actually chosen.
        await Promise.race([
          // .catch is load-bearing: clearAll() can reject, and an unhandled
          // rejection here would skip setLoading(false) below and leave the
          // app on the splash screen permanently.
          validateSession(storedUser).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, SESSION_VALIDATION_DEADLINE)),
        ]);
      }

      setLoading(false);
    };
    initAuth();
    // setLoading/storeLogout are zustand actions (stable); queryClient is the
    // single app-wide instance from _layout.tsx (also stable) — listing it
    // keeps this mount-only rather than silencing the rule.
  }, [setLoading, storeLogout, queryClient]);

  const login = async (email: string, password: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const response = await loginApi(email, password);
      if (response.success) {
        const { token, refreshToken, ...userData } = response.data;
        setAuth(userData, token, refreshToken);
        // Only owners receive sales-anomaly/low-stock pushes — skip the
        // permission prompt for staff, who'd never get a notification.
        // Also respect a previously-saved "notifications off" preference.
        if (userData.role === 'owner' && (await getNotificationsPreference())) {
          registerDeviceForNotifications();
        }
        return { success: true, role: userData.role };
      }
      return { success: false, message: response.message };
    } catch (error: any) {
      if (__DEV__) console.error('[login] raw error:', error);
      // error.message carries the reason for failures without an HTTP
      // response (connection errors, interceptor rejections) — without it
      // every such failure masquerades as bad credentials.
      const message = error.response?.data?.message || error.message || 'Login failed';
      const needsVerification = error.response?.status === 401 && /verify your email/i.test(message);
      return { success: false, message, needsVerification, fieldErrors: error.response?.data?.fieldErrors };
    }
  };

  // Stable identity: SessionExpiredHandler in app/_layout.tsx depends on this
  // inside an effect, and an identity that changed on every provider render
  // would re-run it. Nothing reactive is captured — the store is read through
  // getState(), and storeLogout is a zustand action.
  const logout = useCallback(async () => {
    if (logoutInProgress) return;
    logoutInProgress = true;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Best-effort server-side revocation of the refresh token (raw axios:
      // must not be queued offline, and needs no auth header). Fire and
      // forget — logout must never hang on a dead connection.
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        axios
          .post(`${API_BASE_URL}/auth/logout`, { refreshToken }, { timeout: 5000 })
          .catch(() => {});
      }
      // Must run before clearAll/storeLogout — it needs the still-valid auth token.
      await unregisterDeviceFromNotifications();
      // Shop data on a shared device — a staff member signing out must not
      // leave the next person able to browse it. clearAll() only wipes the
      // AsyncStorage-persisted React Query cache; the live in-memory
      // queryClient (shop config incl. payment methods, sales, products,
      // everything) survives logout untouched unless cleared here too —
      // without this, a payment method removed and saved right before
      // logging out (or logging in as someone else on the same device)
      // could still read back from the stale in-memory cache.
      clearProductCache();
      queryClient.clear();
      await clearAll();
      storeLogout();
      router.replace('/(auth)/login');
    } finally {
      // Reset after navigation settles so a fresh login can log out again.
      setTimeout(() => { logoutInProgress = false; }, 2000);
    }
  }, [storeLogout, queryClient]);

  const refreshUser = async () => {
    try {
      const profile = await getProfile();
      if (profile.success) {
        const currentToken = useAuthStore.getState().token;
        setAuth(profile.data as any, currentToken!);
      }
    } catch {
      if (__DEV__) console.error('Failed to refresh user profile');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
