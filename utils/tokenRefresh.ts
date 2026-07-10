import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';

// Single-flight token refresh. Lives outside services/api.ts so both the
// interactive axios instance and the offline queue can call it without an
// import cycle, and uses a raw axios call so the api interceptors can't
// recurse into it.

let inFlight: Promise<string | null> | null = null;

/**
 * Exchanges the stored refresh token for a fresh access token, updating the
 * auth store. Returns the new access token, or null if refresh is impossible
 * (no refresh token, token revoked/expired, or the server rejected it) —
 * null means "this session is over, log the user out".
 *
 * Network failures reject on purpose: a dead connection says nothing about
 * whether the session is still valid, and the offline queue should keep the
 * item pending rather than pausing the queue as logged-out.
 */
export const refreshAuthToken = (): Promise<string | null> => {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return null;

    try {
      const res = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 12000, headers: { 'Content-Type': 'application/json' } }
      );
      const data = res.data?.data;
      if (!data?.token || !data?.refreshToken) return null;
      useAuthStore.getState().setTokens(data.token, data.refreshToken);
      return data.token as string;
    } catch (err: any) {
      if (err?.response) {
        // The server answered and said no — the session is genuinely dead.
        return null;
      }
      // No response = network problem; surface it so callers can retry later.
      throw err;
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
};
