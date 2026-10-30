import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getShopConfig } from '@/services/shop';
import { useActiveScreen } from '@/hooks/useActiveScreen';

/** One cache for settings, the till, quotation checkout and repayments. */
export function useShopConfigQuery({ live = false }: { live?: boolean } = {}) {
  const active = useActiveScreen();
  const query = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
    staleTime: live ? 0 : 60_000,
    refetchInterval: live && active ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnMount: live ? 'always' : true,
  });
  const { refetch } = query;
  useEffect(() => {
    if (live && active) refetch();
  }, [live, active, refetch]);
  return query;
}

export function useShopConfig(options: { live?: boolean } = {}) {
  const { data, isLoading } = useShopConfigQuery(options);
  return { shopConfig: data?.data, loadingShop: isLoading };
}
