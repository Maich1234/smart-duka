import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { processQueue, getPendingCount } from './offlineQueue';

// How often to attempt a retry while online with pending items (ms).
// Covers items in exponential backoff that would otherwise never retry until
// the next offline→online transition.
const PERIODIC_RETRY_INTERVAL_MS = 30_000;

let periodicRetryTimer: ReturnType<typeof setInterval> | null = null;

function startPeriodicRetry() {
  if (periodicRetryTimer) return;
  periodicRetryTimer = setInterval(() => {
    if (getPendingCount() > 0) {
      processQueue();
    } else {
      stopPeriodicRetry();
    }
  }, PERIODIC_RETRY_INTERVAL_MS);
}

function stopPeriodicRetry() {
  if (periodicRetryTimer) {
    clearInterval(periodicRetryTimer);
    periodicRetryTimer = null;
  }
}

export const setupOfflineListener = () => {
  // Wire React Query's online state to NetInfo and flush the queue on reconnect.
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener(state => {
      // isConnected is null while NetInfo hasn't produced a reading yet —
      // only an explicit false means offline. Treating "unknown" as offline
      // pauses React Query and strands the queue (matches api.ts policy).
      const connected = state.isConnected !== false;
      setOnline(connected);
      if (connected) {
        processQueue();
        startPeriodicRetry();
      } else {
        stopPeriodicRetry();
      }
    });
  });

  // Retry the queue whenever the app returns to the foreground.
  // This catches items stuck in backoff when the user never went
  // offline→online (e.g. app backgrounded, connection restored in background,
  // app foregrounded while already online).
  AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      NetInfo.fetch().then(state => {
        if (state.isConnected !== false && getPendingCount() > 0) {
          processQueue();
          startPeriodicRetry();
        }
      });
    } else if (nextState === 'background' || nextState === 'inactive') {
      stopPeriodicRetry();
    }
  });
};

export const isOnline = async (): Promise<boolean> => {
  const netInfo = await NetInfo.fetch();
  // null (unknown) counts as online — an attempted request that fails gets
  // queued/backed off anyway, whereas assuming offline blocks it entirely.
  return netInfo.isConnected !== false;
};
