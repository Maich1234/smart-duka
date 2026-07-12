import { getDb, isOfflineDbAvailable } from './offlineDb';
import type { AiInsightData } from '@/services/aiInsight';

export interface CachedInsight {
  summary: string;
  priority: string;
  actions: string[];
  health: number;
  snapshot: AiInsightData['snapshot'];
  cachedAt: number;
}

type InsightListener = () => void;
const insightListeners = new Set<InsightListener>();

function notifyInsightChange() {
  insightListeners.forEach((l) => l());
}

/** Subscribe to cache writes. Returns an unsubscribe function. */
export const onInsightChange = (listener: InsightListener): (() => void) => {
  insightListeners.add(listener);
  return () => { insightListeners.delete(listener); };
};

type InsightRow = {
  summary: string;
  priority: string;
  actions: string;
  health: number;
  snapshot: string;
  cached_at: number;
};

/**
 * The most recently cached insight for a shop, regardless of date — a shop
 * that's been offline for days should still see its last insight (labeled
 * with how old it is) rather than nothing.
 */
export const getCachedInsight = (shopId: string): CachedInsight | null => {
  if (!isOfflineDbAvailable()) return null;
  const db = getDb();
  const row = db.getFirstSync<InsightRow>(
    `SELECT summary, priority, actions, health, snapshot, cached_at
     FROM ai_insight_cache WHERE shop_id = ? ORDER BY date DESC LIMIT 1`,
    [shopId]
  );
  if (!row) return null;
  try {
    return {
      summary: row.summary,
      priority: row.priority,
      actions: JSON.parse(row.actions),
      health: row.health,
      snapshot: JSON.parse(row.snapshot),
      cachedAt: row.cached_at,
    };
  } catch {
    return null;
  }
};

/** Upserts today's insight into the cache and notifies subscribers. */
export const cacheInsight = (shopId: string, date: string, data: AiInsightData): void => {
  if (!isOfflineDbAvailable()) return;
  const db = getDb();
  db.runSync(
    `INSERT OR REPLACE INTO ai_insight_cache
       (shop_id, date, summary, priority, actions, health, snapshot, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      shopId,
      date,
      data.insight.summary,
      data.insight.priority,
      JSON.stringify(data.insight.actions),
      data.insight.health,
      JSON.stringify(data.snapshot),
      Date.now(),
    ]
  );
  notifyInsightChange();
};
