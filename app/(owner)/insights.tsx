import React, { useEffect } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { getAiInsight } from '@/services/aiInsight';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { useAiAccess } from '@/hooks/useAiAccess';
import { useAiInsight } from '@/hooks/useAiInsight';
import { cacheInsight } from '@/utils/aiInsightCache';
import { formatRelativeTime } from '@/utils/formatters';
import {
  HealthScoreCard,
  AiNarrativeCard,
  AlertsList,
  TrendSummary,
  ReportsShortcut,
  UpsellCard,
  AiDisabledCard,
} from '@/components/insights/InsightSections';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function OwnerInsights() {
  const tabBarHeight = useTabBarHeight();
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const shopId = user?.shop?._id;

  // Subscription state, plan feature, and the shop's own DuQana AI
  // toggle. Matches the backend's requireActiveSubscription + requireFeature
  // + requireAiEnabled on GET /ai/insight.
  const { hasAiAccess: hasAiInsights, state: aiAccessState, isLoading: isSubscriptionLoading } = useAiAccess();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['aiInsight'],
    queryFn: getAiInsight,
    enabled: hasAiInsights,
  });

  const cached = useAiInsight(shopId);

  useEffect(() => {
    if (data?.data && shopId) {
      cacheInsight(shopId, todayStr(), data.data);
    }
  }, [data, shopId]);

  const fresh = data?.data;
  const insight = fresh?.insight ?? (cached ? { summary: cached.summary, priority: cached.priority as 'low' | 'medium' | 'high', actions: cached.actions, health: cached.health, source: 'cache' as const } : null);
  const snapshot = fresh?.snapshot ?? cached?.snapshot ?? null;
  const cachedNote = !fresh && cached ? `Showing insight from ${formatRelativeTime(new Date(cached.cachedAt))}` : undefined;

  return (
    <>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Insights"
        subtitle="Your business, explained"
        bordered={false}
        backgroundColor={Colors.background}
        fallbackHref="/(owner)/dashboard"
      />
      {/* Plain ScrollView on purpose: each card below runs its own entering
          animation, and nesting those inside another one leaves the children
          stranded at their start transform. */}
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          hasAiInsights ? (
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          ) : undefined
        }
      >
        {isSubscriptionLoading ? (
          <View style={s.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : !hasAiInsights ? (
          aiAccessState === 'disabled' ? <AiDisabledCard /> : <UpsellCard />
        ) : isLoading && !cached ? (
          <View style={s.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : insight && snapshot ? (
          <>
            <HealthScoreCard health={snapshot.health} />
            <View style={s.gap} />
            <AiNarrativeCard
              insight={insight}
              cachedNote={cachedNote}
              onAskWhy={() =>
                router.push({
                  pathname: '/(owner)/chat',
                  params: { seed: "Can you explain today's business summary in more detail and what I should watch out for?" },
                })
              }
            />
            <View style={s.gap} />
            <AlertsList alerts={snapshot.alerts} />
            {snapshot.alerts.length > 0 && <View style={s.gap} />}
            <TrendSummary trend={snapshot.trend} currency={currency} />
            <View style={s.sectionGap} />
            <ReportsShortcut />
          </>
        ) : (
          <View style={s.loading}>
            <Text style={s.errorText}>Couldn&apos;t load insights. Pull down to try again.</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg },
  // Same rhythm as the reports screen: related cards a `gap` apart, separate
  // sections a `sectionGap`, so a section header never crowds the card above.
  gap: { height: Spacing.lg },
  sectionGap: { height: Spacing.xl },
  loading: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  errorText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
});
