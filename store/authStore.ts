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
  /** Set by the API interceptor when a 401 arrives AND the token refresh
   *  failed, or by a force-logout push. A React component
   *  (SessionExpiredHandler) watches this, shows a toast tailored to the
   *  reason, then calls logout() — keeping side-effects out of the axios
   *  layer. 'revoked_elsewhere' means another device signed into this staff
   *  account (server-side single-session enforcement); 'expired' is the
   *  generic case (refresh token expired/invalid). null = not expired. */
  sessionExpiredReason: 'expired' | 'revoked_elsewhere' | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  // zustand's persist middleware wraps `set` to return the underlying
  // storage write's promise (see setItem() in zustand/middleware persist) —
  // callers that need the new refresh token durably on disk before
  // proceeding (see utils/tokenRefresh.ts) must await this.
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setSessionExpired: (reason: 'expired' | 'revoked_elsewhere') => void;
  clearSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: true,
      sessionExpiredReason: null,
      // refreshToken omitted → keep the existing one (refreshUser() re-seeds
      // the profile with the current access token and must not drop it).
      setAuth: (user, token, refreshToken) =>
        set((state) => ({
          user,
          token,
          refreshToken: refreshToken ?? state.refreshToken,
          isLoading: false,
          sessionExpiredReason: null,
        })),
      // zustand's `set` type here is generic (StoreApi doesn't know about the
      // persist wrapper), but at runtime persist's `set` returns the storage
      // write's promise — see the interface comment on setTokens above.
      setTokens: (token, refreshToken) => set({ token, refreshToken }) as unknown as Promise<void>,
      logout: () => set({ user: null, token: null, refreshToken: null, isLoading: false, sessionExpiredReason: null }),
      setLoading: (loading) => set({ isLoading: loading }),
      setSessionExpired: (reason) => set({ sessionExpiredReason: reason }),
      clearSessionExpired: () => set({ sessionExpiredReason: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      // sessionExpiredReason is transient — never persist it
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
);
