import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveShift } from '@/services/shifts';
import { useAuthStore } from '@/store/authStore';

/**
 * The caller's shift state: whether the shop enforces shifts and, if so,
 * whether one is currently open. Drives the sales-screen gate and the active
 * shift banner. Cached briefly so tab hops don't refetch, and persisted with
 * the rest of the react-query cache so an offline relaunch still knows the
 * last-known shift.
 */
export const useShift = () => {
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ['activeShift'],
    queryFn: getActiveShift,
    enabled: !!user,
    staleTime: 30_000,
  });

  return {
    /** Feature flag from the shop config — false while loading. */
    enabled: query.data?.enabled ?? false,
    shift: query.data?.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

/** Invalidate after start/end so every gate and banner updates at once. */
export const useInvalidateShift = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['activeShift'] });
};
