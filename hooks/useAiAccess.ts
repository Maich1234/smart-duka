import { useQuery } from '@tanstack/react-query';
import { getShopConfig } from '@/services/shop';
import { useSubscription } from '@/hooks/useSubscription';

export type AiAccessState = 'no_subscription' | 'not_in_plan' | 'disabled' | 'enabled';

/**
 * Single source of truth for Gemini feature access, combining subscription
 * state (trialing/active/grace), the plan's `ai_insights` feature flag, and
 * the shop's own aiEnabled opt-in/out — replaces the `hasAiChat`/
 * `hasAiInsights` checks that used to be duplicated inline in chat.tsx and
 * insights.tsx (subscription state only, no feature/opt-out awareness).
 */
export function useAiAccess() {
  const { access, plan, isLoading: isSubscriptionLoading } = useSubscription();
  const { data: shopConfigData, isLoading: isShopLoading } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });

  const isSubscribed = access?.state === 'trialing' || access?.state === 'active' || access?.state === 'grace';
  // Don't lock on a plan that hasn't loaded yet — only treat it as "not in
  // plan" once we actually have the plan doc and it omits the feature.
  const inPlan = plan ? (plan.features?.includes('ai_insights') ?? false) : true;
  const aiEnabled = shopConfigData?.data?.aiEnabled ?? true;

  const state: AiAccessState = !isSubscribed
    ? 'no_subscription'
    : !inPlan
      ? 'not_in_plan'
      : !aiEnabled
        ? 'disabled'
        : 'enabled';

  return {
    state,
    hasAiAccess: state === 'enabled',
    aiEnabled,
    isLoading: isSubscriptionLoading || isShopLoading,
  };
}
