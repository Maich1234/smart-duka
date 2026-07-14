import { useCallback, useSyncExternalStore } from 'react';
import { getCachedInsight, onInsightChange, type CachedInsight } from '@/utils/aiInsightCache';

// getCachedInsight re-reads SQLite and JSON.parses a fresh object on every
// call, which breaks useSyncExternalStore's "same reference until the store
// changes" contract and causes React to throw (tearing loop) once a row
// exists. Cache the snapshot and only recompute when the store actually
// writes — same module-level-snapshot pattern as useOfflineQueue.
let cachedShopId: string | undefined;
let cachedValue: CachedInsight | null = null;

function readSnapshot(shopId: string | undefined): CachedInsight | null {
  if (shopId !== cachedShopId) {
    cachedShopId = shopId;
    cachedValue = shopId ? getCachedInsight(shopId) : null;
  }
  return cachedValue;
}

/**
 * The last SQLite-cached AI insight for this shop, read synchronously so it
 * renders instantly (and offline) before the network fetch resolves — same
 * pattern as useOfflineQueue's useSyncExternalStore usage.
 */
export const useAiInsight = (shopId: string | undefined): CachedInsight | null => {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      onInsightChange(() => {
        cachedShopId = undefined; // force a recompute on the next getSnapshot call
        onStoreChange();
      }),
    []
  );
  const getSnapshot = useCallback(() => readSnapshot(shopId), [shopId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
};
