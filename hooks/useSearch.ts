import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'smart_duka_recent_';
const MAX_RECENT = 6;
const DEBOUNCE_MS = 350;

/**
 * useSearch — contextual, non-navigating search with debouncing and
 * persistent recent searches per named context key (e.g. 'inventory').
 *
 * Returns:
 *  value       — raw input (bind to TextInput)
 *  query       — debounced value (pass to API / filter memo)
 *  onChange    — setter for value
 *  onSubmit    — call on Enter / returnKeyType=search
 *  selectRecent— tap a recent term to fill + immediate query update
 *  recentSearches — ordered list, most-recent first
 *  clearRecent — remove all recent searches for this key
 *  clear       — clear value + query instantly
 *  isSearching — true when value is non-empty
 */
export function useSearch(key: string) {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(`${KEY_PREFIX}${key}`)
      .then((raw) => { if (raw) setRecentSearches(JSON.parse(raw)); })
      .catch(() => {});
  }, [key]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value === '') {
      setQuery('');
      return;
    }
    timerRef.current = setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value]);

  const persistRecent = useCallback(
    async (term: string, list: string[]) => {
      await AsyncStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(list));
    },
    [key],
  );

  const addToRecent = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      setRecentSearches((prev) => {
        const updated = [t, ...prev.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
        persistRecent(t, updated);
        return updated;
      });
    },
    [persistRecent],
  );

  const onChange = useCallback((text: string) => setValue(text), []);

  const onSubmit = useCallback(() => {
    if (value.trim()) {
      setQuery(value.trim());
      addToRecent(value.trim());
    }
  }, [value, addToRecent]);

  const selectRecent = useCallback(
    (term: string) => {
      setValue(term);
      setQuery(term);
      addToRecent(term);
    },
    [addToRecent],
  );

  const clearRecent = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(`${KEY_PREFIX}${key}`);
  }, [key]);

  const clear = useCallback(() => {
    setValue('');
    setQuery('');
  }, []);

  return {
    value,
    query,
    onChange,
    onSubmit,
    selectRecent,
    recentSearches,
    clearRecent,
    clear,
    isSearching: value.length > 0,
  };
}

/**
 * localFilter — fast, typo-tolerant, multi-field client-side filter.
 *
 * Scoring (descending priority):
 *   1. Exact word boundary match
 *   2. Starts-with match on any field
 *   3. Contains match on any field
 *   4. All query words present across fields (partial)
 *
 * Returns the input list sorted so best matches come first.
 */
export function localFilter<T>(
  items: T[],
  query: string,
  fields: (item: T) => (string | undefined | null)[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const words = q.split(/\s+/);

  const score = (item: T): number => {
    const texts = fields(item)
      .filter(Boolean)
      .map((f) => (f as string).toLowerCase());
    const joined = texts.join(' ');

    if (joined.includes(q)) {
      const wordBoundary = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      return wordBoundary.test(joined) ? 4 : 3;
    }
    if (words.every((w) => joined.includes(w))) return 2;
    if (words.some((w) => joined.includes(w))) return 1;

    // Single typo tolerance for words >= 4 chars
    if (words.some((w) => w.length >= 4 && levenshtein(joined, w) <= 1)) return 0.5;

    return 0;
  };

  return items
    .map((item) => ({ item, score: score(item) }))
    .filter(({ score: s }) => s > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function levenshtein(text: string, word: string): number {
  for (let i = 0; i <= text.length - word.length; i++) {
    const slice = text.slice(i, i + word.length);
    let diff = 0;
    for (let j = 0; j < word.length; j++) {
      if (slice[j] !== word[j]) diff++;
      if (diff > 1) break;
    }
    if (diff <= 1) return diff;
  }
  return 2;
}
