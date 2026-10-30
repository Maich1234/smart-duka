import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useActiveScreen } from '@/hooks/useActiveScreen';
import { getPriceHealth } from '@/services/priceHealth';
export function usePriceHealth(page = 1) {
  const user = useAuthStore(s => s.user);
  const active = useActiveScreen();
  const query = useQuery({ queryKey: ['priceHealth', user?.shop?._id, page], queryFn: () => getPriceHealth(page), enabled: user?.role === 'owner', refetchOnMount: 'always', refetchInterval: active ? 60_000 : false, refetchIntervalInBackground: false });
  const { refetch } = query;
  useEffect(() => { if (active && user?.role === 'owner') refetch(); }, [active, user?.role, refetch]);
  return query;
}
