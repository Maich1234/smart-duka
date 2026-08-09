import { useQuery } from '@tanstack/react-query';
import { getShopConfig } from '@/services/shop';

/**
 * Reads the shop config cache — every Settings sub-screen needs a slice of
 * it (which flags are on, payment methods, tax rate...). Extracted because
 * five screens had `useQuery({ queryKey: ['shopConfig'], queryFn: getShopConfig })`
 * copied verbatim, and one of them had already drifted (omitted `isLoading`
 * entirely). `useShopConfigToggle` owns writes to this same key; this is its
 * read-side companion.
 */
export function useShopConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });

  return { shopConfig: data?.data, loadingShop: isLoading };
}
