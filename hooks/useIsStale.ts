import { useEffect, useState } from 'react';

/**
 * Whether `timestamp` is older than `maxAgeMs` — re-evaluated as time passes,
 * not just when the component happens to re-render.
 *
 * Reading the clock during render is impure: two renders a minute apart would
 * disagree, and React is free to render whenever it likes. The comparison
 * therefore lives in an effect, with a timer scheduled for the exact moment
 * the value would flip, so a screen left open transitions from "live" to
 * "last updated…" on its own instead of when something unrelated re-renders.
 */
export const useIsStale = (timestamp: number | undefined, maxAgeMs: number): boolean => {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!timestamp) {
      setStale(false);
      return;
    }
    const remaining = timestamp + maxAgeMs - Date.now();
    if (remaining <= 0) {
      setStale(true);
      return;
    }
    setStale(false);
    const timer = setTimeout(() => setStale(true), remaining);
    return () => clearTimeout(timer);
  }, [timestamp, maxAgeMs]);

  return stale;
};
