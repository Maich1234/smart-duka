import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { enqueueOperation } from '@/utils/offlineQueue';
import { refreshAuthToken } from '@/utils/tokenRefresh';
import { randomUUID } from '@/utils/uuid';
import NetInfo from '@react-native-community/netinfo';

const api = axios.create({
  baseURL: API_BASE_URL,
  // 12 s — short enough that users don't wait forever on a dead connection,
  // long enough for slow 3G responses.
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Endpoints that require live connectivity — never queue these offline.
// M-Pesa STK push must reach Safaricom in real time; queuing it later
// would push a payment prompt to the customer hours after they left the shop.
// Refunds move money out of the till — they must never fire silently later.
// Subscription actions (trial, pay, cancel) are billing events — replaying
// them from a queue hours later could charge the owner unexpectedly.
// A chat message answered hours later, out of context, would be actively
// wrong rather than just delayed.
const REALTIME_ONLY = ['/mpesa/initiate', '/mpesa/verify-receipt', '/refund', '/subscriptions/', '/staff/seat-payment', '/ai/chat'];

// Auth requests carry credentials and only make sense interactively — never
// write them (and the password inside) to the offline outbox. Fail fast with
// a connection error instead of "saved offline".
const NEVER_QUEUE = ['/auth/'];

const isRealtimeOnly = (url: string) =>
  REALTIME_ONLY.some(p => url.includes(p));

const isNeverQueued = (url: string) =>
  isRealtimeOnly(url) || NEVER_QUEUE.some(p => url.includes(p));

// True for errors that mean the request never reached (or never returned from)
// the server — safe to queue and retry.
const isNetworkFailure = (error: any): boolean =>
  !error.response && (
    error.code === 'ECONNABORTED' ||   // axios timeout
    error.code === 'ERR_NETWORK' ||
    error.message === 'Network Error' ||
    error.message?.includes('timeout')
  );

// Lightweight connectivity check — only used for write requests.
// Defaults to true (online) if NetInfo is unavailable or slow.
const checkOffline = async (): Promise<boolean> => {
  try {
    const state = await Promise.race([
      NetInfo.fetch(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 1500)),
    ]);
    if (!state) return false; // timed out → assume online
    return state.isConnected === false; // null isConnected → assume online
  } catch {
    return false; // any error → assume online
  }
};

// Enqueue helper — shared between request pre-flight and response error path.
const queueAndReject = (
  method: string,
  url: string,
  body: any,
  idempotencyKey: string,
) => {
  enqueueOperation(
    { method, url, body: body ?? null },
    idempotencyKey,
  );
  return Promise.reject({
    offlineQueued: true,
    message: 'Saved offline — will sync when connected.',
  });
};

// ── Request interceptor ────────────────────────────────────────────────────────
// Adds auth token.
// For non-GET requests: generates a stable idempotency key (UUID, not Date.now),
// pre-flights connectivity, and queues the operation if offline.
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.method && config.method.toLowerCase() !== 'get') {
    // Generate ONE stable key per request attempt. Stored on the config so the
    // response interceptor can use it if the request fails mid-flight, and
    // reused when the same config is replayed after a token refresh.
    const idempotencyKey = (config as any)._idempotencyKey ?? randomUUID();
    (config as any)._idempotencyKey = idempotencyKey;
    // Forward to server so it can deduplicate on its end.
    config.headers['X-Idempotency-Key'] = idempotencyKey;

    const offline = await checkOffline();
    if (offline) {
      if (isRealtimeOnly(config.url ?? '')) {
        throw new Error('OFFLINE_REALTIME');
      }
      // NEVER_QUEUE (auth) is exempt from the pre-flight block: NetInfo can
      // report a false "offline" (stale native module, emulator quirks), and
      // rejecting here would brick login while the network is actually fine.
      // Attempt the request anyway — a real outage rejects below and is
      // mapped to a connection error in the response interceptor.
      if (!isNeverQueued(config.url ?? '')) {
        return queueAndReject(
          config.method,
          config.url ?? '',
          config.data,
          idempotencyKey,
        ) as any;
      }
    }
  }

  return config;
});

// ── Response interceptor ───────────────────────────────────────────────────────
// Handles:
//   • OFFLINE_QUEUED / OFFLINE_REALTIME sentinel errors from request interceptor
//   • Network failures that occur AFTER the request was dispatched (e.g. WiFi
//     with no internet reaches here — the pre-flight said "online" but the
//     request timed out or got ECONNABORTED). We queue those retroactively so
//     the user never has to wait 12 s then lose their data.
//   • 401 → auto-logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.message === 'OFFLINE_QUEUED') {
      return Promise.reject({
        offlineQueued: true,
        message: 'Saved offline — will sync when connected.',
      });
    }
    if (error.message === 'OFFLINE_REALTIME') {
      // Shared across every REALTIME_ONLY endpoint (M-Pesa, refunds,
      // subscriptions, seat payments, AI chat) — keep this wording generic,
      // never name one of them specifically.
      return Promise.reject({
        offlineRealtime: true,
        message: 'This requires an internet connection. Please connect and try again.',
      });
    }
    // Network failure mid-flight: request was dispatched but never completed.
    // Queue it so the mutation isn't lost — this is the "forever loading" fix.
    const config = error.config;
    if (isNetworkFailure(error) && config?.method && config.method.toLowerCase() !== 'get') {
      if (!isNeverQueued(config?.url ?? '')) {
        // Re-use the key generated in the request interceptor so the idempotency
        // table deduplicates this if it was already queued by a fast pre-flight.
        const key =
          (config as any)._idempotencyKey ??
          `net-fail:${config.method}:${config.url}:${randomUUID()}`;
        return queueAndReject(config.method, config.url ?? '', config.data, key);
      }
      if (!isRealtimeOnly(config?.url ?? '')) {
        // Auth request that genuinely couldn't reach the server — never
        // queued, so surface a connection error the UI can show verbatim.
        return Promise.reject({
          message: 'No internet connection. Please check your network and try again.',
        });
      }
    }

    if (error.response?.status === 401) {
      const cfg = error.config;
      // Access token expired mid-session: refresh once (single-flight) and
      // replay the original request so the user never notices.
      if (cfg && !cfg._retriedAfterRefresh && useAuthStore.getState().refreshToken) {
        try {
          const newToken = await refreshAuthToken();
          if (newToken) {
            cfg._retriedAfterRefresh = true;
            cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${newToken}` };
            return api(cfg);
          }
          // newToken is null — refreshAuthToken() already set
          // sessionExpiredReason (expired vs revoked_elsewhere) before
          // returning. SessionExpiredHandler in _layout.tsx picks it up.
        } catch {
          // Refresh unreachable (network) — session may still be valid, so
          // fail this request without logging the user out.
          return Promise.reject(error);
        }
      } else if (cfg?.headers?.Authorization) {
        // No refresh token, or already retried once: nothing has set a
        // reason yet, so this is the generic case. Only surface "session
        // expired" when this request actually carried a session token — a
        // 401 with no Authorization header (login, register, forgot-password)
        // is a credentials/auth failure, not an expired session, and the
        // caller already shows its own error message for those.
        useAuthStore.getState().setSessionExpired('expired');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
