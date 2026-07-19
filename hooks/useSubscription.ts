import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMySubscription } from '@/services/subscription';
import { useAuthStore } from '@/store/authStore';

/**
 * The shop's subscription + derived access state (trialing/active/grace/
 * locked) — drives the trial banner and the paywall lock. Cached and
 * persisted with the react-query cache so an offline relaunch keeps the
 * last-known state instead of locking a paid-up duka out in the field.
 */
export const useSubscription = () => {
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ['subscription'],
    queryFn: getMySubscription,
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const subscription = query.data?.data?.subscription ?? null;
  const plan = subscription?.plan && typeof subscription.plan === 'object' ? subscription.plan : null;

  return {
    subscription,
    /** The populated plan doc (chatLimits, features, pricing, ...) — null while loading or if plan is unpopulated. */
    plan,
    /** Undefined while loading — callers must not lock on missing data. */
    access: query.data?.data?.access,
    renewal: query.data?.data?.renewal ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

/** Invalidate after trial activation / payment so banner and lock update. */
export const useInvalidateSubscription = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['subscription'] });
};
