import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveShift } from '@/services/shifts';
import { useAuthStore } from '@/store/authStore';
import { usePendingShiftStore, asShift } from '@/store/pendingShiftStore';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { hasQueuedOperation } from '@/utils/offlineQueue';

/** Paths the outbox holds for each half of a device-only shift decision. */
const START_PATH = '/shifts/start';
const END_PATH = '/shifts/current/end';

/**
 * The caller's shift state: whether the shop enforces shifts and, if so,
 * whether one is currently open. Drives the sales-screen gate and the active
 * shift banner. Cached briefly so tab hops don't refetch, and persisted with
 * the rest of the react-query cache so an offline relaunch still knows the
 * last-known shift.
 *
 * A shift opened offline counts as open, and one closed offline counts as
 * closed. The server has not heard about either yet, but the drawer is
 * counted and the cashier is standing at the till — the app has no business
 * claiming otherwise just because the network is down.
 */
export const useShift = () => {
  const user = useAuthStore((s) => s.user);
  const pendingShift = usePendingShiftStore((s) => s.shift);
  const closePendingFor = usePendingShiftStore((s) => s.closePendingFor);
  const clearPending = usePendingShiftStore((s) => s.clear);
  const clearClosePending = usePendingShiftStore((s) => s.clearClosePending);
  const { pendingCount } = useOfflineQueue();

  const query = useQuery({
    queryKey: ['activeShift'],
    queryFn: getActiveShift,
    enabled: !!user,
    staleTime: 30_000,
  });
  const { refetch, isFetching } = query;

  const serverShift = query.data?.data ?? null;
  const localShift =
    pendingShift && user?._id === pendingShift.userId ? pendingShift : null;
  const closeQueued = !!user?._id && closePendingFor === user._id;

  // Whether this reconciliation round has already asked the server. Reset
  // whenever there is nothing to reconcile, so each new offline decision gets
  // its own round.
  const askedRef = useRef(false);

  // Retire a device-only shift decision once the server can speak for it, so
  // it never outlives the outage that created it.
  //
  // The subtlety is that the queued row leaving the outbox is not by itself an
  // answer: it may have synced (the server now has the real shift) or been
  // rejected (nothing will ever open it), and the cached query result predates
  // both. Deciding on that stale answer is how a cashier gets thrown back to
  // "Ready to sell?" mid-sale on a shift that did in fact open — so ask once,
  // then decide on the fresh reply.
  useEffect(() => {
    const hasLocalIntent = !!localShift || closeQueued;
    if (!hasLocalIntent) {
      askedRef.current = false;
      return;
    }

    // A real shift supersedes a local one outright — no round trip needed.
    if (localShift && serverShift) {
      clearPending();
      askedRef.current = false;
      return;
    }

    // Still on its way up: keep trusting the device.
    if (hasQueuedOperation(localShift ? START_PATH : END_PATH)) {
      askedRef.current = false;
      return;
    }

    if (!askedRef.current) {
      askedRef.current = true;
      void refetch();
      return;
    }
    if (isFetching) return;

    // Fresh answer in hand. Anything the server still doesn't know about was
    // rejected or discarded, and holding it would leave the till unlocked
    // against a server that will refuse every sale it takes.
    askedRef.current = false;
    if (localShift) clearPending();
    if (closeQueued) clearClosePending();
  }, [
    localShift,
    closeQueued,
    serverShift,
    pendingCount,
    isFetching,
    refetch,
    clearPending,
    clearClosePending,
  ]);

  const shift = closeQueued ? null : (serverShift ?? (localShift ? asShift(localShift) : null));

  return {
    /** Feature flag from the shop config — false while loading. */
    enabled: query.data?.enabled ?? false,
    shift,
    /** True while the open shift exists only on this device. */
    isPendingSync: !!shift && !serverShift,
    isLoading: query.isLoading,
    refetch,
  };
};

/** Invalidate after start/end so every gate and banner updates at once. */
export const useInvalidateShift = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['activeShift'] });
};
