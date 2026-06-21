import React, { createContext, useContext, useEffect } from 'react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { login as loginApi, getProfile } from '@/services/auth';
import { clearAll } from '@/utils/storage';
import { registerDeviceForNotifications, unregisterDeviceFromNotifications } from '@/services/notifications';

interface AuthContextType {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{
    success: boolean;
    message?: string;
    role?: 'owner' | 'staff';
    needsVerification?: boolean;
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setAuth, logout: storeLogout, isLoading, setLoading } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = useAuthStore.getState().user;
        if (storedUser) {
          await getProfile();
        }
      } catch {
        await clearAll();
        storeLogout();
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const response = await loginApi(email, password);
      if (response.success) {
        const { token, ...userData } = response.data;
        setAuth(userData, token);
        // Only owners receive sales-anomaly/low-stock pushes — skip the
        // permission prompt for staff, who'd never get a notification.
        if (userData.role === 'owner') {
          registerDeviceForNotifications();
        }
        return { success: true, role: userData.role };
      }
      return { success: false, message: response.message };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      const needsVerification = error.response?.status === 401 && /verify your email/i.test(message);
      return { success: false, message, needsVerification };
    }
  };

  const logout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Must run before clearAll/storeLogout — it needs the still-valid auth token.
    await unregisterDeviceFromNotifications();
    await clearAll();
    storeLogout();
    router.replace('/(auth)/login');
  };

  const refreshUser = async () => {
    try {
      const profile = await getProfile();
      if (profile.success) {
        const currentToken = useAuthStore.getState().token;
        setAuth(profile.data as any, currentToken!);
      }
    } catch {
      console.error('Failed to refresh user');
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
