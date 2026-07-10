import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/utils/secureStorage';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  shop: {
    _id: string;
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    currency?: string;
  };
  permissions?: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  /** Rotating 30-day refresh token — exchanged (and replaced) at
   *  POST /auth/refresh whenever the short-lived access token expires. */
  refreshToken: string | null;
  isLoading: boolean;
  /** Set to true by the API interceptor when a 401 arrives AND the token
   *  refresh failed. A React component (SessionExpiredHandler) watches this,
   *  shows the animated toast, then calls logout() — keeping side-effects
   *  out of the axios layer. */
  sessionExpired: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setSessionExpired: (expired: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: true,
      sessionExpired: false,
      // refreshToken omitted → keep the existing one (refreshUser() re-seeds
      // the profile with the current access token and must not drop it).
      setAuth: (user, token, refreshToken) =>
        set((state) => ({
          user,
          token,
          refreshToken: refreshToken ?? state.refreshToken,
          isLoading: false,
          sessionExpired: false,
        })),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      logout: () => set({ user: null, token: null, refreshToken: null, isLoading: false, sessionExpired: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      // sessionExpired is transient — never persist it
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
);
