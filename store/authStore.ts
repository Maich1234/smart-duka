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
  isLoading: boolean;
  /** Set to true by the API interceptor when a 401 arrives. A React component
   *  (SessionExpiredHandler) watches this, shows the animated toast, then
   *  calls logout() — keeping side-effects out of the axios layer. */
  sessionExpired: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setSessionExpired: (expired: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      sessionExpired: false,
      setAuth: (user, token) => set({ user, token, isLoading: false, sessionExpired: false }),
      logout: () => set({ user: null, token: null, isLoading: false, sessionExpired: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      // sessionExpired is transient — never persist it
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
