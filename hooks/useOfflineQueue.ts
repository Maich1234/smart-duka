import { useSyncExternalStore } from 'react';
import { getPendingCount, onQueueCountChange, onSyncStateChange } from '@/utils/offlineQueue';

const subscribeCount = (onStoreChange: () => void) => onQueueCountChange(onStoreChange);

// The queue exposes sync state only through its listener, so keep a
// module-level snapshot for useSyncExternalStore to read.
let syncingSnapshot = false;
const subscribeSyncing = (onStoreChange: () => void) =>
  onSyncStateChange((syncing) => {
    syncingSnapshot = syncing;
    onStoreChange();
  });
const getSyncingSnapshot = () => syncingSnapshot;

/**
 * Reactive view of the SQLite outbox for dashboard surfaces: how many writes
 * are waiting to sync and whether a sync pass is running right now.
 */
export const useOfflineQueue = () => {
  const pendingCount = useSyncExternalStore(subscribeCount, getPendingCount, () => 0);
  const isSyncing = useSyncExternalStore(subscribeSyncing, getSyncingSnapshot, () => false);
  return { pendingCount, isSyncing };
};
