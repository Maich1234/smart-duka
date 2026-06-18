import React, { createContext, useContext, useEffect } from 'react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { login as loginApi, getProfile } from '@/services/auth';
import { clearAll } from '@/utils/storage';

interface AuthContextType {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
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
        if (userData.role === 'owner') {
          router.replace('/(owner)/dashboard');
        } else {
          router.replace('/(staff)/dashboard');
        }
        return { success: true };
      }
      return { success: false, message: response.message };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const logout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
