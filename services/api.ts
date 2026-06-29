import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { isOnline } from '@/utils/offlineManager';
import { enqueueOperation } from '@/utils/offlineQueue';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Endpoints that require live connectivity — never queue these offline.
// M-Pesa STK push must reach Safaricom in real time; queuing it for later
// would push a payment prompt to the customer hours after they left the shop.
const REALTIME_ONLY = ['/mpesa/initiate', '/mpesa/verify-receipt'];

const isRealtimeOnly = (url: string) =>
  REALTIME_ONLY.some(p => url.includes(p));

// Request interceptor — add auth token; queue writes when offline
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const online = await isOnline();
  if (!online && config.method !== 'get') {
    if (isRealtimeOnly(config.url ?? '')) {
      // Fail fast — caller shows "no connection" error, not a queued confirmation
      throw new Error('OFFLINE_REALTIME');
    }
    enqueueOperation(
      {
        method: config.method ?? 'POST',
        url: config.url ?? '',
        body: config.data ?? null,
      },
      `${config.method?.toUpperCase()}:${config.url}:${Date.now()}`
    );
    throw new Error('OFFLINE_QUEUED');
  }
  return config;
});

// Response interceptor — handle offline cases and 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.message === 'OFFLINE_QUEUED') {
      return Promise.reject({ offlineQueued: true, message: 'Saved offline — will sync when connected.' });
    }
    if (error.message === 'OFFLINE_REALTIME') {
      return Promise.reject({ offlineRealtime: true, message: 'M-Pesa requires an internet connection. Please connect and try again.' });
    }
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
