import { useCallback, useSyncExternalStore } from 'react';
import { getCachedInsight, onInsightChange, type CachedInsight } from '@/utils/aiInsightCache';

/**
 * The last SQLite-cached AI insight for this shop, read synchronously so it
 * renders instantly (and offline) before the network fetch resolves — same
 * pattern as useOfflineQueue's useSyncExternalStore usage.
 */
export const useAiInsight = (shopId: string | undefined): CachedInsight | null => {
  const subscribe = useCallback((onStoreChange: () => void) => onInsightChange(onStoreChange), []);
  const getSnapshot = useCallback(() => (shopId ? getCachedInsight(shopId) : null), [shopId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
};
