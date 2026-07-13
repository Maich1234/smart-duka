import React, { useEffect } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { getAiInsight } from '@/services/aiInsight';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
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
} from '@/components/insights/InsightSections';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function OwnerInsights() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const shopId = user?.shop?._id;

  const { access, isLoading: isSubscriptionLoading } = useSubscription();
  // AI insights are available to any active subscription (trial, paid, or
  // grace) — no plan-tier gate. Matches the backend's requireActiveSubscription.
  const hasAiInsights = access?.state === 'trialing' || access?.state === 'active' || access?.state === 'grace';

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
      <Animated.ScrollView
        entering={FadeIn.duration(Motion.duration.slow)}
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          hasAiInsights ? (
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} progressViewOffset={insets.top} />
          ) : undefined
        }
      >
        <View style={s.header}>
          <Text style={s.title}>Insights</Text>
          <Text style={s.subtitle}>Your business, explained</Text>
        </View>

        {isSubscriptionLoading ? (
          <View style={s.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : !hasAiInsights ? (
          <UpsellCard />
        ) : isLoading && !cached ? (
          <View style={s.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : insight && snapshot ? (
          <>
            <HealthScoreCard health={snapshot.health} />
            <View style={s.gap} />
            <AiNarrativeCard insight={insight} cachedNote={cachedNote} />
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
      </Animated.ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg },
  header: { marginBottom: Spacing.lg, gap: 3 },
  title: { fontSize: Typography.size.h1, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, letterSpacing: -0.6, lineHeight: 36 },
  subtitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary, lineHeight: 20 },
  gap: { height: Spacing.md },
  sectionGap: { height: Spacing.lg },
  loading: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  errorText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
});
