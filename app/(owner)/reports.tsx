import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { getSalesReport, type ReportPeriod } from '@/services/reports';
import { getRatingsSummary } from '@/services/ratings';
import { getDepletionAnalytics } from '@/services/analytics';
import { getShopConfig } from '@/services/shop';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { PeriodSegmentControl } from '@/components/reports/PeriodSegmentControl';
import { HeroRevenueCard } from '@/components/reports/HeroRevenueCard';
import {
  InsightCards,
  QuickShortcuts,
  TopProductsLeaderboard,
  StaffPerformanceSection,
  RatingsModule,
  StockIntelligence,
  RevenueBreakdownCard,
  PeakActivitySection,
} from '@/components/reports/ReportSections';
import { ReportsSkeleton } from '@/components/reports/ReportsSkeleton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BorderRadius } from '@/constants/BorderRadius';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

// ─── screen ───────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY = {
  totalRevenue: 0,
  totalTransactions: 0,
  cashTotal: 0,
  mpesaTotal: 0,
  averageSale: 0,
  expenseTotal: 0,
  netProfit: 0,
};

export default function OwnerReports() {
  const tabBarHeight = useTabBarHeight();
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['salesReport', period],
    queryFn: () => getSalesReport(period),
  });

  const { data: ratingsData } = useQuery({
    queryKey: ['ratingsSummary'],
    queryFn: getRatingsSummary,
  });

  const { data: depletionData } = useQuery({
    queryKey: ['depletionAnalytics'],
    queryFn: () => getDepletionAnalytics(),
  });

  const canViewPurchases = usePermission('view_purchases');
  const { data: shopConfigData } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const showPurchasesShortcut = canViewPurchases && (shopConfigData?.data?.purchasingEnabled ?? false);

  if (isLoading) return <ReportsSkeleton />;

  const report = data?.data;
  const ratingsSummary = ratingsData?.data;
  const depletion = depletionData?.data;
  const series = report?.series ?? [];
  const summary = report?.summary ?? EMPTY_SUMMARY;

  return (
    <>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Reports"
        subtitle="Track performance and grow your business"
        bordered={false}
        backgroundColor={Colors.background}
        fallbackHref="/(owner)/dashboard"
      />
      <Animated.ScrollView
        entering={FadeIn.duration(Motion.duration.slow)}
        style={s.root}
      contentContainerStyle={[
        s.content,
        {
          paddingTop: Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.primary}
        />
      }
    >
      {/* ── period selector ────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(340).delay(40)}>
        <PeriodSegmentControl value={period} onChange={setPeriod} />
      </Animated.View>

      <View style={s.gap} />

      {/* ── hero revenue card with embedded chart ──────────────────── */}
      <HeroRevenueCard
        summary={summary}
        series={series}
        currency={currency}
        period={period}
      />

      <View style={s.gap} />

      {/* ── revenue / expenses / profit breakdown ──────────────────── */}
      <RevenueBreakdownCard summary={summary} currency={currency} />

      <View style={s.gap} />

      {/* ── insight carousel ───────────────────────────────────────── */}
      <InsightCards
        summary={summary}
        series={series}
        currency={currency}
        period={period}
      />

      <View style={s.gap} />

      {/* ── peak activity bar chart ────────────────────────────────── */}
      <PeakActivitySection series={series} currency={currency} period={period} />

      <View style={s.gap} />

      {/* ── quick-access shortcuts ─────────────────────────────────── */}
      <QuickShortcuts showPurchases={showPurchasesShortcut} />

      <View style={s.sectionGap} />

      {/* ── section divider ────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(320).delay(280)} style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerLabel}>Detailed Analytics</Text>
        <View style={s.dividerLine} />
      </Animated.View>

      <View style={s.sectionGap} />

      {/* ── top products leaderboard ───────────────────────────────── */}
      <TopProductsLeaderboard
        products={report?.topProducts ?? []}
        currency={currency}
      />

      <View style={s.sectionGap} />

      {/* ── staff performance ──────────────────────────────────────── */}
      <StaffPerformanceSection
        staff={report?.byStaff ?? []}
        currency={currency}
      />

      <View style={s.sectionGap} />

      {/* ── customer ratings ───────────────────────────────────────── */}
      <RatingsModule ratings={ratingsSummary} />

      <View style={s.sectionGap} />

      {/* ── stock intelligence ─────────────────────────────────────── */}
      <StockIntelligence depletion={depletion} />

      <View style={s.sectionGap} />

      {/* ── financial records ──────────────────────────────────────── */}
      {/* The books live on their own screen rather than inline: they're a
          document you take away, not a figure you glance at. */}
      <AnimatedPressable
        onPress={() => { haptics.light(); router.push('/(owner)/books' as never); }}
        style={s.booksLink}
        accessibilityRole="button"
        accessibilityLabel="Financial records"
      >
        <View style={s.booksIcon}>
          <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
        </View>
        <View style={s.booksText}>
          <Text style={s.booksTitle}>Financial Records</Text>
          <Text style={s.booksSub}>Cashbook, profit &amp; loss and registers — download as PDF or Excel</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </AnimatedPressable>
      </Animated.ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  booksLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    minHeight: 64,
  },
  booksIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  booksText: { flex: 1 },
  booksTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  booksSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  gap: {
    height: Spacing.md,
  },
  sectionGap: {
    height: Spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
