import { useQuery } from '@tanstack/react-query';
import { getStaffDeletionRequests } from '@/services/staff';

/**
 * Staff account-closure requests waiting on the owner.
 *
 * Shared by the staff list's banner and each staff profile's approve/decline
 * card. Both read the same cache entry, so opening a request from the banner
 * costs no extra fetch — and defining the options once keeps the two call
 * sites from drifting apart, which matters because passing different options
 * for one query key is a subtle source of surprise in React Query.
 *
 * The response's `meta` carries the server's grace and approval windows; UI
 * copy must take the day counts from there rather than hardcoding them.
 */
export const useStaffDeletionRequests = () =>
  useQuery({
    queryKey: ['staffDeletionRequests'],
    queryFn: getStaffDeletionRequests,
    // Requests move on the scale of days, so re-fetching on every navigation
    // between the list and a profile is pure waste. Approve/decline invalidate
    // this key explicitly, so acting on one still updates immediately.
    staleTime: 60_000,
  });
