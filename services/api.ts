import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnline } from '@/utils/offlineManager';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – add token and offline detection
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Offline mode: queue non‑GET requests
  const online = await isOnline();
  if (!online && config.method !== 'get') {
    // Instead of throwing immediately, store the request in a queue
    const queueKey = 'offline_mutations';
    const existing = await AsyncStorage.getItem(queueKey);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({ method: config.method, url: config.url, data: config.data, headers: config.headers });
    await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
    // Return a special error to prevent the request from going out
    throw new Error('OFFLINE_QUEUED');
  }
  return config;
});

// Response interceptor – handle 401 and re‑throw other errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If we queued the request offline, we don't want to trigger logout
    if (error.message === 'OFFLINE_QUEUED') {
      return Promise.reject({ offlineQueued: true, message: 'Request queued for later sync' });
    }
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;