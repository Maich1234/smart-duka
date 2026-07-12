import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '@/services/notificationInbox';

/** Polled unread count for the dashboard bell badge — cheap enough to refresh every minute. */
export const useUnreadNotificationsCount = () => {
  const query = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return query.data?.data?.count ?? 0;
};
